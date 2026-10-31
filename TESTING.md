# Testing & Verification Report

## 1. Test Suite Summary

- **Test Runner:** `vitest v2.1.9`
- **Environment:** `jsdom` + `@testing-library/react`
- **Execution Command:** `npx vitest run`
- **Actual Result:** **6 passed of 6 test files, 46 passed of 46 tests, 0 failed**

```text
 ✓ tests/summaryContext.test.ts (3 tests)
 ✓ tests/components.test.tsx (4 tests)
 ✓ tests/priority.test.ts (9 tests)
 ✓ tests/datesAndSchema.test.ts (8 tests)
 ✓ tests/duplicateAndSearch.test.ts (7 tests)
 ✓ tests/api.test.ts (15 tests)

 Test Files  6 passed (6)
      Tests  46 passed (46)
   Duration  8.02s
```

---

## 2. Test Cases Covered

### A. Priority Classification Boundaries (`tests/priority.test.ts`)
- Unscheduled notice (null dates) -> status `Unscheduled`.
- Expired notice (all relevant moments in past) -> status `Expired` and overdue countdown.
- Notice with past event and future deadline -> status `Upcoming` (not expired).
- Date-only deadline today -> status `Urgent` until 23:59:59 end-of-day.
- Exactly 48-hour boundary -> `Urgent` at 48h, `Upcoming` at 48h + 1 minute.
- Midnight boundary transition -> `Urgent` 2 seconds before midnight, `Expired` 2 seconds after midnight.
- Timezone difference between `Asia/Kolkata` and `America/New_York` across midnight and month roll-overs.
- Leap day (`2028-02-29`) handled without calendar errors.
- Year-end rollover (`2026-12-31` to `2027-01-01`).

### B. Dates & Schema Validation (`tests/datesAndSchema.test.ts`)
- Rejection of impossible dates (e.g. `2026-02-29`, `2026-02-30`, `2026-04-31`, `2026-13-01`).
- Verification of 24h `HH:mm` times and IANA timezone strings.
- Pure calendar day arithmetic (`calendarDaysDifference`, `addDaysToDateString`).
- Validation of `NoticeSchema`, `ExtractRequestSchema`, and `SummaryRequestSchema` constraints (max 60 notices, max 8,000 characters).

### C. Search, Duplicate Detection & Storage Resilience (`tests/duplicateAndSearch.test.ts`)
- Exact duplicate detection via `contentHash`.
- Fuzzy duplicate detection via title token Jaccard similarity ($\ge 0.8$) with matching dates.
- Prevention of false positives when titles are similar but dates differ, or when titles are distinct.
- Search precomputation and multi-term AND matching.
- Corrupted localStorage JSON handling: drops malformed items and loads valid items without crashing.
- Storage quota failure: graceful in-memory persistence and quota error banner triggering.

### D. Weekly Summary Context & Deterministic Fallback (`tests/summaryContext.test.ts`)
- Deterministic selection of notices in the upcoming 7 days, urgent notices, and schedule updates.
- Complete exclusion of past/expired notices and far-future (>7 days) items.
- Deterministic client fallback generation when AI is offline, tagged with `generatedWithoutAi: true`.

### E. Serverless API Integration (`tests/api.test.ts`)
- `GET /api/health` -> returns `{ ok: true, aiAvailable: false }` with zero secrets.
- `POST /api/extract` method validation (rejects GET with 405).
- Rejection of empty/whitespace text and requests exceeding 20 KB limit with 413.
- Key missing behavior: returns 503 `AI_NOT_CONFIGURED` without throwing at import time.
- Valid announcement extraction via injected mock Gemini client.
- Missing venue and dates mapped to nulls and `reviewRequired: true`.
- Ambiguous dates flagged with warning badges.
- Multi-announcement pastes generate distinct per-notice hashes.
- Malformed AI JSON safely mapped to 502 `AI_INVALID_RESPONSE`.
- Sliding-window rate limiter returns 429 with `Retry-After` header.
- Prompt injection attempts inside untrusted user data do not alter system instructions.
- `POST /api/summary`: empty notice sets return deterministic response without invoking AI.
- Hallucinated notice IDs from AI output are dropped during post-validation.

### F. Critical UI Components (`tests/components.test.tsx`)
- `NoticeList` renders accessible empty state when notices array is empty.
- `NoticeCard` displays review warning badge for ambiguous notices.
- `Filters` updates state and announces filtered results count to assistive technologies.
- `ConfirmDialog` renders accessible modal requiring user confirmation for destructive actions.

---

## 3. Build & Compilation Verification

### A. TypeScript Typecheck
- **Command:** `npx tsc --noEmit`
- **Output:** Exit code 0 (zero errors across `/src`, `/api`, `/shared`, and `/tests`).

### B. Production Bundle Build
- **Command:** `npm run build`
- **Result:** Completed in 868ms.
- **Output Files:**
  - `dist/index.html` (0.63 kB)
  - `dist/assets/index-BCXTzQ8-.css` (18.05 kB)
  - `dist/assets/index-E3TX0YY0.js` (263.86 kB)
- **Total Production Size:** ~282.5 kB (< 300 kB).

### C. Client Bundle Secret Scan
- **Command:** `Get-ChildItem -Path dist -Recurse | Select-String -Pattern 'AIza'`
- **Result:** Zero matches found. No Google API keys or credentials leaked into frontend assets.

---

## 4. End-to-End Server & Flow Verification

Tested using an automated local server probe against the Vite serverless integration:
1. `GET /api/health` -> Status 200, returned `{"ok":true,"aiAvailable":false}`.
2. `POST /api/extract` -> Status 503, returned `{"error":{"code":"AI_NOT_CONFIGURED", ...}}`.
3. `GET /` -> Status 200, served index HTML with `Campus Pulse` title.
4. **Manual Fallback Flow Verified:** User enters text manually or clicks "Enter manually instead" -> fills NoticeForm -> saves notice -> stored in localStorage -> classified into priority buckets -> displayed in Today's Pulse and All Notices -> editable and deletable with confirmation dialog.

---

## 5. Untested Areas & Verification Limitations

- **Live Gemini API Execution:** `GEMINI_API_KEY` was not configured in the host environment; live calls to Google's upstream Gemini endpoints were not executed. Handlers were comprehensively verified using dependency-injected mock clients matching `@google/genai` output specifications.
- **Vercel CLI Build:** The Vercel CLI (`vercel`) was not installed globally in the environment. API handlers were loaded and executed via local Vite serverless simulation and Vitest tests; Vercel cloud runtime bundling was not directly executed.
- **Screen Reader Hardware:** Accessibility was verified via automated DOM landmark checks, ARIA live regions, role attributes, and keyboard focus traps. Physical testing with JAWS, NVDA, or VoiceOver was not performed.
