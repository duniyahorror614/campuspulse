# Technical Architecture & Specification

## 1. System Architecture

```text
+-----------------------------------------------------------------------------------------+
|                                    BROWSER CLIENT                                       |
|                                                                                         |
|  +-----------------------------------------------------------------------------------+  |
|  | React 18 UI Views (Today's Pulse | All Notices | Upcoming | Weekly Digest | Add)  |  |
|  +-----------------------------------------------------------------------------------+  |
|         |                                 |                                 |           |
|         v                                 v                                 v           |
|  +------------------+           +--------------------+            +------------------+  |
|  | Pure Priority    |           | Search & Filter    |            | Duplicate Engine |  |
|  | Engine (Dates)   |           | (O(n*m) Scan)      |            | (Exact + Jaccard)|  |
|  +------------------+           +--------------------+            +------------------+  |
|         |                                 |                                 |           |
|         +------------------------+--------+---------------------------------+           |
|                                  |                                                      |
|                                  v                                                      |
|                   +-------------------------------+                                     |
|                   | NoticeStorage (localStorage)  |                                     |
|                   | In-Memory Map + Hash Set      |                                     |
|                   +-------------------------------+                                     |
+----------------------------------|------------------------------------------------------+
                                   | HTTP REST (JSON)
                                   v
+-----------------------------------------------------------------------------------------+
|                              VERCEL SERVERLESS RUNTIME (/api)                           |
|                                                                                         |
|  +----------------------+    +-----------------------+    +--------------------------+  |
|  | GET /api/health      |    | POST /api/extract     |    | POST /api/summary        |  |
|  | Returns status only  |    | Max body: 20 KB       |    | Max body: 100 KB         |  |
|  | Zero secrets leaked  |    | Rate limit: 10/min    |    | Rate limit: 5/min        |  |
|  +----------------------+    +-----------------------+    +--------------------------+  |
|                                          |                             |                |
|                                          v                             v                |
|                             +----------------------------------------------+            |
|                             | Zod Request & Content-Type Validation        |            |
|                             +----------------------------------------------+            |
|                                          |                             |                |
|                                          v                             v                |
|                             +----------------------------------------------+            |
|                             | Deterministic Pre-Filtering & Injection Guard|            |
|                             +----------------------------------------------+            |
|                                          |                             |                |
|                                          v                             v                |
|                             +----------------------------------------------+            |
|                             | Google GenAI SDK (@google/genai)             |            |
|                             | Server-side only with GEMINI_API_KEY         |            |
|                             +----------------------------------------------+            |
|                                          |                             |                |
|                                          v                             v                |
|                             +----------------------------------------------+            |
|                             | Deterministic Post-Validation & Grounding    |            |
|                             | Hash calculation & Hallucination pruning     |            |
|                             +----------------------------------------------+            |
+-----------------------------------------------------------------------------------------+
```

---

## 2. Directory Structure

```text
/api
  extract.ts            # POST: announcement text -> validated draft notices
  summary.ts            # POST: compact notices -> grounded weekly summary
  health.ts             # GET: { ok: true, aiAvailable: boolean }
  _lib/
    gemini.ts           # Gemini SDK wrapper with timeout, retry, error mapping, DI
    rateLimit.ts        # In-memory sliding window rate limiter per IP
    http.ts             # Method/size checks, security headers, safe error responses
    prompts.ts          # Delimited prompts, schemas, and system instructions
    summaryContext.ts   # Deterministic notice selection for weekly digest
/shared
  schema.ts             # Zod schemas & TypeScript types (single source of truth)
  dates.ts              # Timezone-safe date arithmetic without third-party libraries
  priority.ts           # Pure priority classification function
/src
  main.tsx, App.tsx     # React root and top-level view coordinator
  components/           # Accessible, modular UI components
    Sidebar.tsx         # Primary navigation & dialog triggers
    NoticeCard.tsx      # React.memo notice card with badges and actions
    NoticeList.tsx      # Paginated notice list (50 per page)
    NoticeDetail.tsx    # Full details modal with raw original text
    NoticeForm.tsx      # Accessible notice create/edit form
    SmartInput.tsx      # Textarea with char counter, relative samples, extract trigger
    ReviewDrafts.tsx    # Draft editor with duplicate warnings and batch actions
    Filters.tsx         # Search input, category pills, status chips, date range
    TodayPulse.tsx      # Dashboard summary stats, today's notices, upcoming deadlines
    WeeklySummary.tsx   # Grounded AI digest with fallback rendering
    EmptyState.tsx      # Accessible empty states
    Countdown.tsx       # Semantic time-remaining display
    PriorityBadge.tsx   # Icon + text + color semantic badge
    StatusRegion.tsx    # Accessible aria-live status & alert regions
    ConfirmDialog.tsx   # Modal confirmation with focus trap and keyboard dismissal
  hooks/
    useNotices.ts       # Storage-backed state manager with quota error fallback
    useDebouncedValue.ts# 250ms debouncer for search input
    useNow.ts           # 60-second synchronized clock tick for countdowns
  lib/
    storage.ts          # LocalStorage CRUD with versioning and corruption handling
    search.ts           # Precomputed index with multi-term AND matching
    duplicates.ts       # Content hash and Jaccard token similarity engine
    apiClient.ts        # Type-safe client fetch wrapper
    summaryFallback.ts  # Client-side deterministic fallback generator
  styles/
    tokens.css          # Design tokens (colors, spacing, typography, radii)
    base.css            # Base resets, accessibility landmarks, focus rings
    components.css      # Component layouts and responsive media queries
/tests
  priority.test.ts      # Boundary edge-case tests (midnight, DST, leap year, 48h)
  datesAndSchema.test.ts# Date utility and schema validation tests
  duplicateAndSearch.test.ts # Exact/fuzzy matching and storage resilience
  summaryContext.test.ts# Deterministic selection and fallback generation
  api.test.ts           # API integration tests with injected mock Gemini client
  components.test.tsx   # React component behavior tests
```

---

## 3. Data Model

### Notice Interface (`shared/schema.ts`)
```typescript
interface Notice {
  id: string;               // crypto.randomUUID()
  title: string;            // 1–120 characters, trimmed
  description: string | null;// max 1,000 characters
  category: Category;       // Academic | Exam | Assignment | Event | Club | Placement | Administrative | ScheduleChange | Other
  eventDate: string | null; // ISO YYYY-MM-DD
  eventTime: string | null; // 24h HH:mm
  venue: string | null;     // max 200 characters
  deadlineDate: string | null;// ISO YYYY-MM-DD
  deadlineTime: string | null;// 24h HH:mm
  originalText: string;     // preserved pasted text (max 8,000 chars)
  contentHash: string;      // SHA-256 hex string for duplicate detection
  reviewRequired: boolean;  // true if ambiguous, missing dates, or corrected
  reviewWarnings: string[]; // human-readable warning strings
  createdAt: string;        // ISO 8601 string
  updatedAt: string;        // ISO 8601 string
}
```

### Content Hash Calculation & Anti-Collision Policy
1. Normalise pasted text: `lowercase`, replace consecutive whitespace with single space, trim.
2. If `sourceSegment` exists: verify deterministically that the normalised `sourceSegment` actually occurs as a substring within the normalised pasted text.
3. If verified: `contentHash = SHA256(normalised_sourceSegment)`.
4. If `sourceSegment` fails verification or is absent:
   - If single notice extracted: `contentHash = SHA256(normalised_full_paste)`.
   - If multiple notices extracted: `contentHash = SHA256(normalised_title + '|' + eventDate + '|' + deadlineDate)`.
   - **Guarantee:** Never assigns the same full-paste hash to multiple distinct notices extracted from one message.

---

## 4. Priority Classification Rules

Documented verbatim from specification Section 7:
- **Inputs:** `notice`, `now` (instant), `timezone`. All comparisons are performed in the user's local timezone using calendar dates, never by parsing "YYYY-MM-DD" with `new Date()` (which parses as UTC).
- **Relevant Moments:** A notice's relevant moments are its event datetime and deadline datetime. A date without a time counts as the END of that day (`23:59:59 local`) for expiry and countdown.
- **Expired:** All relevant moments are strictly in the past (`ms < nowMs`).
- **Urgent:** Not expired AND the nearest future relevant moment is within 48 hours of now (`0 <= diffMs <= 48 * 3600 * 1000`). A deadline with no time due today is Urgent until 23:59:59 today.
- **Upcoming:** Not expired, nearest future moment is more than 48 hours away.
- **Unscheduled:** No event date and no deadline.
- **Dual Moments Rule:** If both event and deadline exist, evaluate the nearest FUTURE moment. If one is past but the other is future, the notice is not expired.

---

## 5. API Design & Security Specifications

### Endpoints

| Endpoint | Method | Body Limit | Rate Limit | Description |
|---|---|---|---|---|
| `/api/health` | GET | N/A | None | Returns `{ ok: true, aiAvailable: boolean }`. Leaks zero secret details. |
| `/api/extract` | POST | 20 KB (`MAX_EXTRACT_BODY_SIZE`) | 10 req/min per IP | Parses announcement text into validated draft notices. |
| `/api/summary` | POST | 100 KB (`MAX_SUMMARY_BODY_SIZE`) | 5 req/min per IP | Generates grounded weekly digest for up to 60 notices. |

### Error Codes & Status Mappings
- `INVALID_REQUEST` (400): Schema or parameter failure.
- `METHOD_NOT_ALLOWED` (405): Method not supported.
- `PAYLOAD_TOO_LARGE` (413): Request body exceeds endpoint byte cap.
- `RATE_LIMITED` (429): Rate limiter exceeded; emits `Retry-After` header.
- `AI_INVALID_RESPONSE` (502): AI returned unparseable output or invalid structure.
- `AI_NOT_CONFIGURED` (503): `GEMINI_API_KEY` is not present on the server.
- `AI_UNAVAILABLE` (503): Upstream Gemini service error or rate limit.
- `AI_TIMEOUT` (504): AI response exceeded 25-second deadline.
- `INTERNAL` (500): Unhandled internal server error.

### Security Controls Implemented
1. **API Key Isolation:** `GEMINI_API_KEY` is never prefixed with `VITE_` and is never bundled in frontend distribution (`dist/`).
2. **Prompt Injection Guard:** System instructions explicitly define user announcement text as UNTRUSTED DATA delimited within clear marker fences. Instructions inside the user text are strictly ignored.
3. **Information Hiding:** Error messages returned to clients are generic and safe. Stack traces, upstream API error bodies, and pasted announcement texts are never exposed or logged.
4. **Content Security Policy (`vercel.json`):**
   ```text
   default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self';
   ```

---

## 6. Time and Space Complexity Analysis

Let $n$ = total notices stored, $m$ = number of search query terms, $k$ = count of matching filtered notices, $t$ = average word tokens per title.

| Operation | Time Complexity | Space Complexity | Implementation Detail |
|---|---|---|---|
| Search Index Build | $O(n)$ | $O(n)$ | Precomputes lowercased search string once on notices change. |
| Text Search Query | $O(n \cdot m)$ | $O(k)$ | Multi-term AND substring check against precomputed string. |
| Multi-facet Filtering | $O(n)$ | $O(k)$ | Single-pass evaluation of category, status, and date range predicates. |
| Sorting Filtered Results | $O(k \log k)$ | $O(k)$ | Run once per filtered set using stable comparator. |
| Priority Classification | $O(1)$ per notice / $O(n)$ total | $O(n)$ | Timezone calendar math executed once per 60-second shared tick. |
| Exact Duplicate Check | $O(1)$ avg ($O(n)$ worst) | $O(n)$ | Hash Set lookup across saved `contentHash` values. |
| Fuzzy Duplicate Check | $O(n \cdot t)$ | $O(t)$ | Token Set Jaccard similarity; executed only at save time. |
| Storage Serialization | $O(n)$ | $O(n)$ | Debounced batch write (150ms) to browser `localStorage`. |
| UI Rendering | $O(P)$ | $O(P)$ | Paginated list with page size $P = 50$ DOM nodes. |

---

## 7. Audit & Vulnerability Report

The output of `npm audit` run against dependencies:
- Moderate / High / Critical advisories in devDependencies (`vitest`, `vite`, `esbuild`, `tinypool`) and transitive `zod` collection advisory.
- Production bundle contains zero devDependencies.
- Front-end bundle does not execute server code or expose network ports.
