SHADOW HOOK - Cloudflare site files   (snapshot: July 19, 2026)
================================================================

WHAT'S IN THIS FOLDER
  index.html            The whole app in one file - the logo, every screen, the
                        wire, the board logic. Your Supabase keys are baked in here.
  sw.js                 Service worker: offline support, push notifications, and
                        AUTO-UPDATE (every phone pulls the latest on its next open).
  manifest.webmanifest  Makes the app installable to the home screen.

NOT IN THIS FOLDER  (these are yours to keep):
  icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png
  Your home-screen icon images (the copper hook tile). The app runs fine without
  them - the logo is baked into index.html - but keep your originals for a full
  deploy. Lost them? Ask Claude to make you a fresh matching set.

THE ONE DEPLOY RULE  (this is the important one)
  Your Cloudflare setup REPLACES every file each time you upload. So ALWAYS upload
  ALL the files together (index.html + sw.js + manifest + your icons) in one go.
  Uploading just one file on its own wipes the rest - that's what broke the site
  that one time. After a deploy, the auto-updating sw.js does the rest: members
  get the new version on their next open, no version-bumping needed.
  (You don't need to upload THIS README to Cloudflare - it's just your notes.)

HOW THE WHOLE THING FITS TOGETHER
  Cloudflare  -> hosts this app  (theshadowhook.com)
  Supabase    -> the backend/database  (project ehykqebzkbelwtkgjbml)
                 Tables: dispatch_boards (forecasts), board_wire (board results),
                 drop_wire (job calls), profiles / profiles_private (members).
  GitHub      -> the dispatch bot  (repo: shadowhook-dispatch-bot)
                 Runs a few times a day, downloads the ILWU dispatch PDFs from
                 ilwu13.com, reads them, and writes the forecasts into Supabase.

DISPATCH TIMELINE  (what the bot chases - Pacific time)
  Morning FINAL (D file)  - posted ~4:30pm the day BEFORE. No early count.
  Night EARLY   (E file)  - posted ~9:30am (end of the morning dispatch).
  Night FINAL   (N file)  - posted after 2:30pm.

SECURITY
  The Supabase "service_role" (secret) key lives ONLY in your GitHub repo's
  Secrets - never in these files, never in a chat, never in the app. Keep it there.
