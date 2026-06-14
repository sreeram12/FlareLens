# FlareLens

**A voice-first health companion for people living with Crohn's disease and IBD.**

Logging symptoms, meals, and how you actually feel shouldn't mean filling out forms during a flare. FlareLens lets you just *talk* — say how you're doing, what you ate, or snap a photo of your plate — and it captures the entry, keeps a personal **stability score** current, learns your **Flare Fingerprint**, and turns it all into a doctor-ready report. It also connects to your real medical records so your labs and history inform everything.

> ⚕️ **Not medical advice.** FlareLens is a self-tracking and discussion aid, not a diagnostic tool. Always review decisions with your GI clinician.

---

## What it does

- **🎙️ Talk, snap, or type** — A unified composer backed by Grok (voice transcription, vision, and chat). Say *"cramping and a 4/10 pain today"* or photograph a meal; FlareLens parses it into a structured entry and talks back.
- **📊 Stability score** — A daily 0–100 score across disease-activity, diet, exercise, systemic, and energy/sleep domains, with the *reasons* behind each move.
- **🔬 Flare Fingerprint** — Learns your personal baselines (resting HR, HRV, respiratory rate, sleep, symptoms) and flags when your signals drift toward a flare *before* it's obvious.
- **🥗 IBD-AID diet intelligence** — Anti-inflammatory diet guidance based on the IBD-AID protocol, with meals tagged and rated for your current phase (introduction → maintenance).
- **📈 Timeline** — A clean, chronological history of everything — meals (with phase verdicts), symptoms, wearables, and synced records.
- **🏥 Medical-records sync (Fasten Connect)** — Log in once to your patient portal (Kaiser, Epic, and more); FlareLens pulls your conditions, medications, and labs, summarizes the IBD panel (CRP, calprotectin, ferritin, hemoglobin, WBC, albumin, ESR) with trends, and folds it into your report and diet guidance.
- **🩺 Doctor report** — A GI-ready summary: score trend, key stats, lab trends from your records, red flags, and auto-generated follow-up questions for your next appointment.
- **🤖 Background analyst** — A scheduled agent that reviews your data and surfaces important findings as alerts.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | **Next.js 16** (App Router, Turbopack, React 19) |
| Language | **TypeScript** |
| Styling | **Tailwind CSS v4** + shadcn — a custom "Chrome Futurism" dark theme |
| Database | **Neon Postgres** via **Drizzle ORM** (`pg`) |
| AI | **xAI Grok** through the **Vercel AI Gateway** (`@ai-sdk/xai`) — STT, vision, chat, realtime voice |
| Records | **Fasten Connect** (FHIR medical-records API) |
| Hosting | **Vercel** (incl. cron for the background analyst) |

---

## Getting started

### Prerequisites
- Node.js 20+
- A [Neon](https://neon.tech) Postgres database
- An [xAI](https://x.ai) / Vercel AI Gateway API key
- *(Optional)* [Fasten Connect](https://portal.connect.fastenhealth.com) credentials for medical-records sync

### Setup

```bash
git clone https://github.com/sreeram12/FlareLens.git
cd FlareLens
npm install

cp .env.example .env   # then fill in your values
npm run dev            # http://localhost:3000
```

### Seed demo data (optional)

```bash
node scripts/seed-apple-health.mjs   # wearable baseline (sleep/RHR/HRV)
node scripts/seed-fasten.mjs         # sample labs + conditions + meds
node scripts/backfill-meals.mjs      # phase-tagged meals
```

---

## Environment variables

Copy `.env.example` to `.env` and fill in:

| Variable | Required | Purpose |
|---|:---:|---|
| `DATABASE_URL` | ✅ | Neon Postgres connection string (pooled) |
| `AI_GATEWAY_API_KEY` | ✅ | xAI key via Vercel AI Gateway — powers chat, voice, transcription, vision |
| `FASTEN_PUBLIC_ID` | — | Fasten Connect public id (`public_test_…`) |
| `NEXT_PUBLIC_FASTEN_PUBLIC_ID` | — | Same public id, exposed to the Stitch widget in the browser |
| `FASTEN_PRIVATE_KEY` | — | Fasten private key — **server-side only, never `NEXT_PUBLIC_`** |
| `FASTEN_API_BASE` | — | `https://api.connect.fastenhealth.com/v1` |
| `CRON_SECRET` | — | Bearer secret protecting the `/api/cron/analyze` route |
| `XAI_API_KEY` | — | Fallback xAI key if `AI_GATEWAY_API_KEY` is unset |

### Fasten Connect (medical-records sync)
The records sync uses a one-time portal login (the Stitch web component) → an EHI export → an async **webhook** that delivers the FHIR data. To run it:
1. Create credentials at the [Fasten portal](https://portal.connect.fastenhealth.com) and set a **Redirect URL** (your app origin).
2. Configure a **webhook** pointing at `https://<your-app>/api/webhooks/fasten`. For local dev, tunnel it with [smee.io](https://smee.io):
   ```bash
   npx smee-client --url https://smee.io/<channel> --target http://localhost:3000/api/webhooks/fasten
   ```
3. Open **Import** → *Connect your patient portal* → log in → records sync automatically.

Without Fasten credentials, the rest of the app works fully; you can also import a sample FHIR bundle from the Import page.

---

## Project structure

```
app/                  # Next.js routes
  page.tsx            #   / — Today dashboard (landing)
  talk/               #   /talk — voice/photo/text capture
  diet/  timeline/    #   diet guidance, history
  report/ imports/    #   doctor report, data connections
  api/                #   chat, transcribe, vision, voice-token, parse-log,
                      #   integrations/fasten, webhooks/fasten, cron/analyze
components/           # UI (dashboard, assistant, timeline, imports, …)
lib/
  actions.ts          # server actions / data layer
  stability-score.ts  # daily score model
  flare-fingerprint.ts# personal-baseline engine
  ibd-aid.ts          # IBD-AID diet logic
  labs.ts             # FHIR lab → IBD-panel summaries + trends
  fasten-fhir.ts      # FHIR NDJSON parser
  findings.ts         # background analyst
scripts/              # data seeders + screenshot tooling
```

---

## Privacy & data

Real health data (Apple Health exports, Fasten FHIR records) is **PII** and is kept out of version control — `.env` and `/data` are gitignored. Fasten private keys live server-side only and are never sent to the browser. If you fork this, use your own test-mode credentials and rotate them regularly.

---

## License

MIT — built as a hackathon project; contributions welcome.
