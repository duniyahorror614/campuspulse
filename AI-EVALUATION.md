# AI Evaluation Report

This document evaluates **Campus Pulse** across the six criteria specified for the PROMPTWARS × CSSS 2026 challenge: **Code Quality, Security, Efficiency, Testing, Accessibility, and Problem Alignment**.

---

## 1. Code Quality & Clean Code

### Implemented Functionality & Design
- **Architecture & Modularity:** Clean separation of concerns between presentation (`src/components`), local persistence (`src/lib/storage.ts`), business logic & classification (`shared/priority.ts`, `shared/dates.ts`), API contracts (`shared/schema.ts`), and serverless endpoints (`/api`).
- **Single Source of Truth:** Pure date arithmetic, priority classification, and Zod schemas live in `/shared` and are shared without duplication across client and server.
- **Type Safety:** Full TypeScript strict mode enabled (`"strict": true`, `"noUnusedLocals": true`, `"noUnusedParameters": true`). Zero usage of `any` in application source code.
- **Maintainability:** Pure functions for date parsing, classification, search, and duplicate detection without side effects or hidden mutations.

### Relevant Source Files
- `shared/schema.ts`
- `shared/dates.ts`
- `shared/priority.ts`
- `src/hooks/useNotices.ts`
- `src/lib/storage.ts`
- `api/_lib/gemini.ts`

### Actual Verification Evidence
- `npx tsc --noEmit` passed with exit code 0 and 0 errors across 55 source files.
- `npm run build` completed cleanly in 868ms with zero type warnings.

---

## 2. Security

### Implemented Functionality & Design
- **Secret Isolation:** `GEMINI_API_KEY` is restricted exclusively to server-side code (`process.env.GEMINI_API_KEY`). It is never referenced or imported by `/src`.
- **Untrusted Input Defense & Anti-Injection:** System prompts explicitly declare user-submitted announcements as UNTRUSTED DATA delimited inside fence blocks. Instructions inside user text (e.g., "ignore previous instructions") are ignored.
- **Payload & Rate Limiting:**
  - `/api/extract`: capped at 20 KB (`MAX_EXTRACT_BODY_SIZE`); rate-limited to 10 requests/min per IP.
  - `/api/summary`: capped at 100 KB (`MAX_SUMMARY_BODY_SIZE`); rate-limited to 5 requests/min per IP.
- **Safe Error Reporting:** User-facing responses return standard error codes (`INVALID_REQUEST`, `PAYLOAD_TOO_LARGE`, `RATE_LIMITED`, `AI_NOT_CONFIGURED`, `AI_TIMEOUT`, `AI_INVALID_RESPONSE`). Stack traces, upstream API error bodies, and raw user announcement texts are never logged or leaked.
- **Safe Rendering:** React JSX text nodes are used exclusively. `dangerouslySetInnerHTML` is never used.
- **Security Headers (`vercel.json`):** Strict CSP (`default-src 'self'`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy`.

### Relevant Source Files
- `api/_lib/http.ts`
- `api/_lib/rateLimit.ts`
- `api/_lib/prompts.ts`
- `api/extract.ts`
- `api/summary.ts`
- `vercel.json`

### Actual Verification Evidence
- Scanned `dist/` with `Select-String -Pattern 'AIza'` -> 0 matches.
- Automated API test `9. Prompt injection text passed as data does not change system instruction` passed.
- Rate limiting test `7. Rate limiter triggers 429 after 10 requests` verified with HTTP 429 and `Retry-After` header.

---

## 3. Efficiency & Time/Space Complexity

### Implemented Functionality & Design
- **Search Optimization:** Lowercased search text is precomputed once per notice on data load (`buildSearchIndex`), avoiding recomputation per keystroke. Search runs an $O(n \cdot m)$ multi-term scan debounced by 250ms.
- **Render Bounding:** Paginated notice list renders 50 items at a time (`Show 50 more`), bounding DOM node count.
- **Memoization & Shared Clock:** `NoticeCard` is wrapped with `React.memo`. Priority classification is calculated once per minute via a single shared 60-second clock (`useNow`), eliminating per-card intervals.
- **Client Summary Caching:** AI summaries are cached on the client using a composite key (`referenceDate|timezone|noticeIds:updatedAt`), preventing redundant network calls when notices have not changed.
- **Bundle Footprint:** Minimized production bundle is under 285 KB total (CSS: 18 KB, JS: 264 KB). Repository size excluding node_modules/dist is only ~348 KB (vastly below 10 MB limit).

### Relevant Source Files
- `src/lib/search.ts`
- `src/hooks/useNow.ts`
- `src/hooks/useDebouncedValue.ts`
- `src/components/NoticeList.tsx`
- `src/components/WeeklySummary.tsx`

### Actual Verification Evidence
- Exact measured repo size (excluding node_modules, dist, .git): **356,230 bytes (~0.340 MB)** across 55 files.
- Production build size: 263.86 kB JS + 18.05 kB CSS.

---

## 4. Testing

### Implemented Functionality & Design
- **Comprehensive Unit & Integration Coverage:** 6 test suites covering priority boundaries, date utilities, Zod schemas, duplicate detection, search filtering, storage resilience, API serverless handlers with mock Gemini injection, and React UI components.
- **Edge Cases Tested:** Midnight boundary transition, date-only deadlines today, timezone/DST differences, end-of-month and year-end rollovers, leap days, and past event with future deadline.

### Relevant Source Files
- `tests/priority.test.ts`
- `tests/datesAndSchema.test.ts`
- `tests/duplicateAndSearch.test.ts`
- `tests/summaryContext.test.ts`
- `tests/api.test.ts`
- `tests/components.test.tsx`

### Actual Verification Evidence
- Command executed: `npx vitest run`
- Actual test execution summary:
  - **Test Files:** 6 passed out of 6 (100%)
  - **Tests:** 46 passed out of 46 (100%)
  - **Failures:** 0
  - **Duration:** 8.02s

---

## 5. Accessibility

### Implemented Functionality & Design
- **Semantic Structure:** Native landmarks (`<header>`, `<nav>`, `<aside>`, `<main>`), unique `<h1>` per view, logical heading hierarchy (`h1` -> `h2` -> `h3`).
- **Assistive Technologies:** Single polite `aria-live` region (`StatusRegion`) for search results and save notifications, with `role="alert"` for errors.
- **Accessible Controls:** Form inputs have visible `<label>` elements; error messages are linked with `aria-describedby` and announced; buttons use native `<button>` tags; icon buttons include descriptive `aria-label`.
- **Keyboard Navigation:** Explicit `:focus-visible` outline rings; skip-to-content shortcut; native `<dialog>` and focus management with Escape dismissal.
- **Visual Compliance:** Priority badges combine SVG icons + text + color (never color alone). Color tokens adhere to WCAG AA contrast standards.
- **Mobile Responsive:** Touch targets $\ge 44$px; sidebar transitions smoothly to responsive layout; zero horizontal overflow from 360px to 1440px.

### Relevant Source Files
- `src/styles/tokens.css`
- `src/styles/base.css`
- `src/styles/components.css`
- `src/components/StatusRegion.tsx`
- `src/components/PriorityBadge.tsx`
- `src/components/ConfirmDialog.tsx`
- `src/components/Filters.tsx`

### Actual Verification Evidence
- Keyboard focus navigation and modal dismissal verified in component test suite.
- ARIA live announcements verified via `tests/components.test.tsx`.

---

## 6. Problem Alignment

### Challenge Alignment & Scope
- **Core Mission:** "Everything happening on campus. One intelligent place." Solves the problem of fragmented student announcements from WhatsApp, email, and posters.
- **Smart Input (Feature A):** Paste messy announcements -> AI extracts title, category, event date/time, venue, deadline date/time into a clean card. Features 3 dynamic sample announcements relative to today (never expired) and a manual entry fallback.
- **Organized View (Feature B):** Multi-view dashboard (Today's Pulse, All Notices, Upcoming, Weekly Summary) with multi-term search and category/status/date filtering.
- **Priority & Reminders (Feature C):** Pure calendar-based priority classification (Urgent, Upcoming, Expired, Unscheduled), live countdowns, and an urgent alert banner with daily dismissal.
- **AI Weekly Summary (Feature D):** "What do I need to know this week?" digest with headline, max 5 grounded bullet points linking to notices, and 3 actionable next steps. Includes offline deterministic fallback when AI is unavailable.
- **Zero-Friction First-Time UX:** First-time users see an immediate call to action to paste or try a sample announcement, creating a notice card within seconds without instructions.

### Known Limitations
- Local browser storage does not sync across devices.
- Rate limiting is per-serverless-instance (in-memory).
- Live Gemini API call was not verified due to absent `GEMINI_API_KEY` in execution environment; graceful degradation and mock integration were verified.
