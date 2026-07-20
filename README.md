# ILWU 13 Dispatch Worker

The off-page "hands" for the app's Dispatch Bot. The browser can't read a cross-origin
scanned PDF, so this worker fetches each dispatch sheet from ilwu13.com, OCRs it, parses
the forecast, and upserts it into Supabase `dispatch_boards`. The app's `sbLoadDispatch()`
reads that table on load — no manual upload.

## What it fetches

| Sheet | Folder | Named for | Posted | App key |
|------|--------|-----------|--------|---------|
| `MMDDYYE` Early  | `Day-Night-Early/`  | that day        | ~9:45 AM that day | `DATE_DOW_PM` (nested under `early`) |
| `MMDDYYN` Night  | `Nightside-Final/`  | that day        | ~2:30 PM that day | `DATE_DOW_PM` |
| `MMDDYYD` Day    | `Dayside-Final/`    | the morning it's FOR | the evening before (~4–5 PM) | `DATE_DOW_AM` |

The header stamp (`Jul. 19. 2026 4:17PM No. 9120 P. 1/21`) is the **generation** time, a
running **serial**, and the **page count** — captured into `generated` / `serial` / `pages`.
A board is always dated by its **filename**, never the header (a D sheet's header is the day before).

## One-time setup

1. **Create the table.** Run [`schema.sql`](./schema.sql) in the Supabase SQL editor.
   It also sets RLS so the app's anon key can read but only the service role can write.

2. **Add repo secrets** (Settings → Secrets and variables → Actions):
   - `SUPABASE_URL` — e.g. `https://ehykqebzkbelwtkgjbml.supabase.co`
   - `SUPABASE_SERVICE_KEY` — the **service-role** key (Project settings → API).
     ⚠️ Server-side only. It bypasses RLS — never ship it in the app / index.html.

3. **Commit these files** to your repo (keep the path `worker/…` and
   `.github/workflows/dispatch.yml`). The Action runs every 15 min and self-throttles.

## Local test (no Supabase, no secrets)

```bash
pip install -r worker/requirements.txt
sudo apt-get install -y poppler-utils tesseract-ocr      # OCR engines
python worker/fetch_dispatch.py --dump --all             # fetch what's live, OCR + parse to ./out/
```

`--dump` writes `out/<sheet>_ocr.txt` (raw OCR text) and `out/<sheet>_parsed.json`
(what would be upserted) **without touching Supabase**.

Other flags: `--all` (ignore time windows), `--force` (re-ingest), `--date 2026-07-20 --kind N`
(one specific sheet, for backfill).

## ⚠️ Finish the parser (needs one real data page)

`parse_header()` is solid. The **board / totals / ships** parser (`parse_forecast()`) is a
first pass, because the sample sheet's page 1 was a community flyer — the real column layout
lives on the data pages. To lock it exactly:

```bash
python worker/fetch_dispatch.py --dump --all
```

then send back `out/*_ocr.txt`. With the real OCR text I'll pin the column mapping so
`total`, `boards`, `flops`, and `ships` come out matching the app's schema every time.

## How data reaches the app

Worker → `dispatch_boards` (upsert, merging Early + Night on the same `_PM` key, exactly like
the app's `addDispatchData`) → app `sbLoadDispatch()` on load → `ingestForecast()` →
Recent Boards + predictions. Everything stays live-synced through Supabase.
