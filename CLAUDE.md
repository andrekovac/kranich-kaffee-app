# Kranich Kaffee App

Phone app (PWA) for the customers of Kranich Kaffee, a small (fictional) coffee
roastery in Hamburg-Rothenburgsort. Customers add it to their home screen. It shows
current promotions and events (the most important part) and the three coffees, with
buttons to copy a discount code, add an event to the calendar, or sign up by email.

This is a workshop demo. The owner is not technical and often works from the Claude
app on their phone, with no computer running.

## Talking to the owner

- Reply in German, plain and simple words, and use "du".
- Explain what you do in one short sentence per step. No jargon without explaining it.
- Never use em dashes, anywhere (chat, code, comments, commits, copy). Use a comma,
  colon, full stop or parentheses instead.

## How it is built

Plain static files. No build step, no npm dependencies, no database, no logins.

| File | Job |
|---|---|
| `index.html` | the page: layout, colours, fonts (design "Wochenblatt") |
| `parse.js` | reads `Aktionen.md` / `Sortiment.md`, dates, expiry, labels, calendar file |
| `app.js` | fetches the two `.md` files on every open, renders, wires the buttons |
| `sw.js` | service worker: network first, cached copy only when offline |
| `manifest.webmanifest` | app name, icons, opens without browser bar |
| `netlify.toml` | `Cache-Control: no-cache` for everything |
| `test.mjs` | tests for `parse.js` |
| `icon-192.png`, `icon-512.png` | app icon (opaque, used for iPhone too) |
| `.claude/agents/` | review sub-agents (see below) |
| `docs/superpowers/` | the approved design (spec) and the build plan |

Updates must always reach installed apps. Never make the service worker cache-first,
never add long cache headers, never add a version-pinned asset cache. The owner
tests this by adding a promotion and reopening the app on a phone.

## Where the data lives

- `Aktionen.md`: promotions and events. The ONLY place for them. The app reads it live.
- `Sortiment.md`: the coffees. Only entries with a `Preis` count. Everything after the
  `---` line (the English note) is ignored.
- Ended entries hide themselves the day after their date. No need to delete them,
  but tidy up old ones when you are editing anyway.

### Format for `Aktionen.md` (keep it exactly like this)

```
## Titel der Aktion

- Rabattcode: CODE           (optional, adds a "Kopieren" button)
- Gilt bis: TT.MM.JJJJ       (optional, hidden the day after)
- Datum: Wochentag, TT.MM.JJJJ, HH:MM bis HH:MM   (optional, adds "In den Kalender", hidden the day after)
- Ort: Adresse               (optional, goes into the calendar entry)
- Anmeldung: per Mail an name@example.de   (optional, adds "Per Mail anmelden")
- Text: Ein bis zwei kurze Sätze.
```

- Always write the year with 4 digits. An entry without any date shows forever.
- Entries show in file order. Put the most important one first.

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
- Before going live and after new features: run the `datenschutz` sub-agent.
- After layout changes: run the `kundin` sub-agent.

## Deploying

- Code lives on GitHub: `andrekovac/kranich-kaffee-app` (public), branch `main`.
- Live at https://kranich-kaffee-app.netlify.app (Netlify project `kranich-kaffee-app`).
- Netlify is linked to the GitHub repo: every push to `main` goes live within about a
  minute. No build command, publish directory = repo root. So "save to GitHub" is also
  "publish".
- `.mcp.json` lists the official Netlify and Supabase MCP servers for this project.
  Each environment must log in to them once. The app does not use Supabase.

## Saving

When the owner says "save to GitHub" or "Speicher auf GitHub": run the tests, commit
all changes with a short, clear English message, and push to `main`.
