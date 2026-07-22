# ☎ Hall Line Worker — "where did the board leave off?"

Calls the hall's recorded dispatch line a few minutes after each board ends, transcribes the recording, parses the card the board left off on (e.g. **W4912**), and posts it to the Order's `board_wire` table in Supabase.

The app already knows what to do from there: the post lands exactly like a member logging the board — the chain re-anchors the next board's start, "Starting on" updates, the predictions re-figure, and any hand can correct it in-app with a re-log (last word stands; **the bot never overwrites a human's row**).

```
GitHub Actions cron ──► Twilio call (recorded) ──► Whisper transcript
        ──► parse card ──► sanity check vs previous board
        ──► board_wire (bot row, status live)  +  hall_line_log (audit trail)
        ──► the app's realtime channel lights it up on every open screen
```

## Files

| file | what it is |
|---|---|
| `leftoff.js` | the worker (Node 20+, zero dependencies) |
| `parse.js` | transcript → card parser (NATO letters, "double u", "forty-nine twelve", etc.) |
| `parse.test.js` | parser test battery — `node --test parse.test.js` |
| `hall-line.yml` | GitHub Actions workflow — copy to `.github/workflows/` in the repo that runs your dispatch-PDF worker |

## Setup

**1. Twilio (~$1.15/month + ~$0.02 per call)**
Create an account at twilio.com, buy any local number (that's `TWILIO_FROM`), and grab the Account SID + Auth Token from the console dashboard.

**2. OpenAI key** for Whisper transcription (~$0.01 per call) — platform.openai.com → API keys.

**3. Supabase table for the audit trail** — run once in the SQL editor:

```sql
create table if not exists hall_line_log (
  id         bigserial primary key,
  ran_at     timestamptz default now(),
  k          text,        -- board key, e.g. 2026-07-22_Wed_PM
  card       text,        -- what it parsed, e.g. W4912 (null = nothing found)
  conf       real,        -- 0..1 confidence
  heard      text,        -- the words around the match
  transcript text,        -- full transcript, for tuning the parser
  call_sid   text,        -- Twilio call id, to replay the audio if needed
  posted     boolean      -- true = it went to board_wire
);
alter table hall_line_log enable row level security;  -- service key only
```

**4. GitHub secrets** (repo → Settings → Secrets and variables → Actions):

| secret | value |
|---|---|
| `TWILIO_SID` / `TWILIO_TOKEN` / `TWILIO_FROM` | from step 1 |
| `DISPATCH_NUMBER` | the hall's recorded line, `+1310…` format |
| `DISPATCH_DTMF` | *(optional)* menu presses to reach the casual recording, e.g. `ww2` (`w` = half-second wait) |
| `OPENAI_API_KEY` | from step 2 |
| `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` | project settings → API (service_role key, **not** the anon key) |

Optional repo **variables**: `CALL_SECONDS` (default 120 — set to roughly the recording's length), `SLOT_KEYWORDS` (comma-separated words that name the board you want when the recording lists several, e.g. `casual,unidentified`), `MIN_CONF` (default 0.75 — below it the run only logs, never posts).

**5. Copy `hall-line.yml` into `.github/workflows/`** and commit. It fires at 9:40 and 19:40 Long Beach time (scheduled at both PDT and PST offsets; the worker's own LA-time gate makes the wrong-offset run exit immediately).

## Test it without spending a call

```bash
node --test hall-line-worker/parse.test.js          # parser battery

# parse-only dry run (no Twilio, no Whisper, no writes):
node hall-line-worker/leftoff.js --dry-run --force \
  --transcript "the day board left off on whiskey 4912"

# transcribe a saved recording (voice memo of the hotline works great):
OPENAI_API_KEY=sk-... node hall-line-worker/leftoff.js --dry-run --force --audio hotline.m4a
```

The first live run is best done by hand: Actions → **hall-line-leftoff** → *Run workflow* with `dry_run: true`, then read the run log — it prints the full transcript, every candidate card with its confidence, and the exact row it would post.

## Tuning to the real recording

The parser ships tuned to plausible wording ("…left off on/at…", multiple boards, NATO/spoken letters and numbers). Once the first real transcripts land in `hall_line_log.transcript`, tighten two knobs to match the hall's actual script:

- `SLOT_KEYWORDS` — the exact words the recording uses for the board you track
- anchor phrases in `parse.js` (`ANCHORS`) if the hall says something other than "left off / stopped at / ended on"

## Behavior details

- **Never talks over a human**: if a member already logged the board on the wire, the worker stands down for that board.
- **Idempotent**: re-runs that hear the same card change nothing.
- **Sanity check**: a card more than ~20 letters ahead of the previous board's end loses confidence (the wire only gets high-confidence posts; everything is still written to `hall_line_log`).
- **Fails loud**: a failed call/transcription exits 1 so the Actions run shows red; a quiet "nothing to post" exits 0.
