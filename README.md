# Campus Pulse

> "Everything happening on campus. One intelligent place."

Campus Pulse is an AI-powered campus information and announcement aggregation platform developed for **PROMPTWARS × CSSS 2026**.

Students frequently miss deadlines, exam dates, assignment submissions, club meetings, and schedule alterations scattered across WhatsApp groups, unstructured emails, and notice boards. Campus Pulse transforms messy, unstructured announcements into an organised, prioritised, and actionable dashboard with an AI-generated weekly briefing.

---

## Key Features

1. **Smart Input (AI-Powered Announcement Parsing)**
   - Paste raw announcement text from WhatsApp, email, or posters (up to 8,000 characters).
   - Structured JSON extraction using Google Gemini via the official `@google/genai` SDK.
   - Extracts: title, category, event date & time, venue, deadline date & time, ambiguity flags, and source segment.
   - Interactive draft review with duplicate detection (exact hash and fuzzy Jaccard token similarity) before saving.
   - Graceful fallback: full manual entry flow when AI is unconfigured or offline.

2. **Organised Multi-View Campus Dashboard**
   - **Today's Pulse:** Immediate snapshot of urgent deadlines (next 48h), events today, and active counts.
   - **All Notices:** Searchable and filterable list with debounced search, category multi-select, status filters, and date range picking.
   - **Upcoming Events & Deadlines:** Chronological ordering of pending academic milestones.
   - **Weekly Digest:** Executive summary answering *"What do I need to know this week?"*.
   - Paginated display ("Show 50 more") for bounded DOM memory.

3. **Pure Priority & Countdown Engine**
   - Authoritative classification calculated in the user's local timezone (never guessed by AI).
   - **Urgent:** Active deadlines or events within 48 hours of now. Date-only deadlines due today stay urgent until 23:59:59.
   - **Upcoming:** Scheduled moments more than 48 hours away.
   - **Expired:** All relevant moments are strictly in the past.
   - **Unscheduled:** Notices without dates or deadlines.
   - Live countdowns ("2 days 4 hours left", "Due today", "Overdue by 1 day") driven by a single shared 60-second tick.
   - In-app urgent reminder banner with daily dismissal.

4. **AI Weekly Summary & Grounded Digest**
   - Synthesizes up to 60 candidate notices into a punchy headline, at most 5 grounded bullet points linking directly to notices, and up to 3 concrete next actions.
   - Strict server-side post-validation: drops any hallucinated notice IDs not provided in the prompt.
   - Deterministic offline fallback clearly labeled *"Generated without AI because the AI service was unavailable"*.
   - Client-side cache keyed on notice timestamps to avoid redundant API queries.

5. **Security, Privacy & Accessibility**
   - Zero credentials in client bundle: `GEMINI_API_KEY` exists exclusively in server runtime.
   - Strict payload limits (20 KB for `/api/extract`, 100 KB for `/api/summary`).
   - In-memory sliding window rate limiting (10 req/min for extraction, 5 req/min for summary).
   - Local-first architecture: notice data resides in browser `localStorage`. No analytics, tracking, or accounts.
   - WCAG AA compliant contrast, full keyboard navigation, skip-to-content landmark, visible `:focus-visible` outlines, screen reader announcements via live polite regions.

---

## Tech Stack

- **Frontend:** React 18, TypeScript (strict mode), Vite 5. Plain CSS with CSS variables (`tokens.css`, `base.css`, `components.css`). No heavy UI frameworks.
- **Backend:** Vercel Serverless Functions in `/api` (TypeScript).
- **AI SDK:** Google Gemini via `@google/genai` (`gemini-2.5-flash` default) with structured JSON schemas and minimized thinking latency.
- **Validation:** Shared Zod schemas in `/shared/schema.ts` for end-to-end type safety.
- **Testing:** Vitest with JSDOM and `@testing-library/react`.
- **Storage:** Browser `localStorage` (versioned key `campusPulse.notices.v1`) with quota-error in-memory resilience.

---

## Local Development

### 1. Prerequisites
- Node.js `v20.x` or higher
- npm `v10.x` or higher

### 2. Installation
```bash
# Clone or navigate to repository directory
cd campus-pulse

# Install dependencies
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your Gemini API key (optional for manual features, required for AI extraction and AI summary):
```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
```

> **Note:** The application starts, builds, and runs completely without `GEMINI_API_KEY`. Non-AI features (manual notice creation, editing, deleting, search, priority categorization, count badges, Today's Pulse, reminders, and deterministic weekly summary) remain 100% operational.

### 4. Running the Development Server
```bash
npm run dev
```
Open `http://localhost:5173` in your browser. The embedded Vite dev server plugin routes `/api/health`, `/api/extract`, and `/api/summary` to local serverless handlers.

### 5. Running Tests & Quality Checks
```bash
# Execute Vitest test suite
npm test

# Typecheck with TypeScript
npm run typecheck

# Build production bundle
npm run build
```

---

## Deployment to Vercel

1. Push your repository to GitHub (keep exactly one branch).
2. Import the project in the [Vercel Dashboard](https://vercel.com).
3. In **Project Settings → Environment Variables**, add:
   - `GEMINI_API_KEY`: Your Google Gemini API Key.
   - `GEMINI_MODEL`: `gemini-2.5-flash` (optional, defaults to `gemini-2.5-flash`).
4. Click **Deploy**. `vercel.json` provides security headers (CSP, X-Frame-Options, X-Content-Type-Options) and sets API function timeout limits.

---

## Known Limitations

- **Local-First Storage:** Data is stored in browser `localStorage`. Notices do not sync across different browsers or devices. Use the "Export JSON" button in the sidebar to download a backup.
- **Rate Limiting:** Sliding-window rate limiters are stored in-memory per serverless instance; they provide best-effort abuse protection rather than a distributed cluster guarantee.
