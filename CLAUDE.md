# Kranich Kaffee App

Phone app (PWA) for the customers of Kranich Kaffee, a small (fictional) coffee
roastery in Hamburg-Rothenburgsort. Customers add it to their home screen. It shows
current promotions and events (the most important part) and the three coffees, with
buttons to copy a discount code, add an event to the calendar, or sign up for an
event by name ("Ich bin dabei").

This is a workshop demo. The owner is not technical and often works from the Claude
app on their phone, with no computer running.

## Talking to the owner

- Reply in German, plain and simple words, and use "du".
- Explain what you do in one short sentence per step. No jargon without explaining it.
- Never use em dashes, anywhere (chat, code, comments, commits, copy). Use a comma,
  colon, full stop or parentheses instead.

## How it is built

Plain static files. No build step, no npm dependencies, no logins. Promotions and
sign-ups live in Supabase; the page calls it directly with plain `fetch`.

| File | Job |
|---|---|
| `index.html` | the page: layout, colours, fonts (design "Wochenblatt") |
| `parse.js` | pure logic: reads `Sortiment.md`, maps database rows, expiry, labels, calendar file, remembered sign-ups, calendar week and season icon |
| `app.js` | loads promotions from Supabase and coffees from `Sortiment.md` on every open, renders, buttons, sign-up form, offline copy |
| `config.js` | Supabase URL and publishable key (public by design) |
| `datenschutz.html` | privacy page (linked in the footer) |
| `sw.js` | service worker: network first, cached copy only when offline |
| `manifest.webmanifest` | app name, icons, opens without browser bar |
| `netlify.toml` | `Cache-Control: no-cache` for everything |
| `test.mjs` | tests for `parse.js` |
| `test-db.mjs` | live test of the database rules with the public key (see its header) |
| `supabase/migrations/` | the SQL that created the database, for the record |
| `icon-192.png`, `icon-512.png` | app icon (opaque, used for iPhone too) |
| `.claude/agents/` | review sub-agents (see below) |
| `.claude/settings.json` | turns on the Superpowers plugin in every session, also cloud ones |
| `docs/superpowers/` | the approved design (spec) and the build plan |

Updates must always reach installed apps. Never make the service worker cache-first,
never add long cache headers, never add a version-pinned asset cache. The owner
tests this by adding a promotion and reopening the app on a phone. Promotions are
fetched from Supabase with `cache: 'no-store'`; the service worker only touches
same-origin GET requests, never Supabase.

## Where the data lives

- **Promotions and events: Supabase** (see next section). `Aktionen.md` is gone.
- `Sortiment.md`: the coffees. Only entries with a `Preis` count. Everything after the
  `---` line (the English note) is ignored.

## Promotions and sign-ups (Supabase)

- Supabase project `kranich-kaffee` (ref `vgdrahxmudzqwxmbdwgb`), Frankfurt, free plan.
  Use the Supabase connector (`execute_sql`, `apply_migration`).
- `public.promotions`: `title`, `text`, `code`, `valid_until`, `event_date`,
  `start_time`, `end_time`, `place`, `signups_open`, `capacity`, `sort`. A new or changed
  row is live on the next app open, no push needed. Entries hide themselves the day
  after `valid_until` (or `event_date` if there is no `valid_until`). Lower `sort` shows first.
- A promotion with a code: set `code` and `valid_until`. An event: set `event_date`
  (and times, `place`). Sign-ups: `signups_open = true`, optional `capacity`.
- `public.signups`: `promotion_id`, `name`, `created_at`. Deleted automatically 14 days
  after the event (pg_cron job `delete-old-signups`).
- "Wer kommt zum Cupping?":
  `select s.name, s.created_at from public.signups s join public.promotions p on p.id = s.promotion_id where p.title ilike '%cupping%' order by s.created_at;`
- Texts in the table follow the styleguide below. Run the `texter` agent on new ones.
- **Security, never break this:** visitors (`anon`, `authenticated`) have NO table
  privileges and NO RLS policies. They can only execute `public.get_promotions()` and
  `public.sign_up(bigint, text)`. Never grant table access, never add policies for them,
  never return names from a public function, never put the secret/service key in this
  repo. After any schema change: `get_advisors` (security) and `node test-db.mjs`.
  The advisor warnings about these two `security definer` functions are intended.

## Styleguide (`Kranich-Styleguide.pdf` is the authority)

- Colours: Nachtblau `#1F2A44` (text), Kranichrot `#C8412D` (accents only, max 10 %),
  Papierweiß `#F6F1E7` (background), Röstbraun `#6B4A2F` (surfaces). Never pure
  black, no gradients, no neon.
- Fonts: Fraunces (headings, never all caps), Inter (body).
- Customers: "du". Business customers: "Sie". Warm, concrete, reserved.
- Max one "!" per text, max 20 words per sentence.
- Every product mention names its roast date ("geröstet am 22.09.2026").
- Never: Premium, Genuss pur, Kaffeeliebhaber aufgepasst, einzigartig, Geheimtipp,
  Barista-Qualität.

## Checking your work

- `node test.mjs` must print `OK: alle Tests bestanden`.
- Local preview: `python3 -m http.server 8080`, then open http://localhost:8080.
- After changing promotions or any customer text: run the `texter` sub-agent and fix
  what it finds before saving.
- After database changes: `node test-db.mjs` (see its header for the hidden test rows).
- Before going live and after new features: run the `datenschutz` sub-agent.
- After layout changes: run the `kundin` sub-agent.

## Deploying

- Code lives on GitHub: `andrekovac/kranich-kaffee-app` (public), branch `main`.
- Live at https://kranich-kaffee-app.netlify.app (Netlify project `kranich-kaffee-app`).
- Netlify is linked to the GitHub repo: every push to `main` goes live within about a
  minute. No build command, publish directory = repo root. So "save to GitHub" is also
  "publish".
- Netlify and Supabase come from the owner's Claude account connectors (checked
  25.09.2026: Netlify site `kranich-kaffee-app` and the Supabase organization
  `andrekovac` both answer). `.mcp.json` lists the same two official MCP servers as a
  fallback. If a tool says "needs authentication", tell the owner to connect it in
  the Claude connector settings.
- Nothing in the repo depends on the owner's computer: no secrets, no absolute paths.
  `.netlify/` (local link to the site) is git-ignored and not needed, deploys go
  through GitHub.
- The owner also edits from the Claude app on the phone (cloud session). Such a session
  starts from a fresh clone of GitHub, so only what is pushed to `main` exists there.
  Always push before ending a session, and `git pull --rebase` before you start
  (phone sessions may have pushed changes, for example the calendar week line).

## Saving

When the owner says "save to GitHub" or "Speicher auf GitHub": run the tests, commit
all changes with a short, clear English message, and push to `main`.
