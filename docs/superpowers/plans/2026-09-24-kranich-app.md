# Kranich Kaffee App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A German-language PWA for Kranich Kaffee customers that shows current promotions/events (read live from `Aktionen.md`) and the three coffees (from `Sortiment.md`), with tap actions, installable on the home screen, and never stuck on old content.

**Architecture:** Plain static files, no build step, no dependencies. `parse.js` turns the two Markdown files into data (pure functions, tested with Node). `app.js` fetches the files on every open with `cache: "no-store"`, renders design C ("Wochenblatt") and wires the buttons. A network-first service worker gives an offline fallback only; `netlify.toml` sends `Cache-Control: no-cache` for everything.

**Tech Stack:** HTML, CSS, vanilla JS (ES modules), Web App Manifest, Service Worker, Google Fonts (Fraunces, Inter), Node 22 `node:assert` for tests, `python3 -m http.server` for local preview.

**Spec:** `docs/superpowers/specs/2026-09-24-kranich-app-design.md`

## Global Constraints

- All user-visible text in German, customers addressed with "du".
- Colours only: Nachtblau `#1F2A44` (text), Kranichrot `#C8412D` (accents only, max 10 %), Papierweiß `#F6F1E7` (background), Röstbraun `#6B4A2F` (surfaces). Never `#000`, no gradients, no neon.
- Headings Fraunces, body Inter. Headings never uppercase (`text-transform: none`).
- Max one "!" per text, max 20 words per sentence. Never: Premium, Genuss pur, Kaffeeliebhaber aufgepasst, einzigartig, Geheimtipp, Barista-Qualität.
- Every coffee shown names its roast date as "geröstet am TT.MM.JJJJ".
- Never use the em dash character anywhere (code, comments, copy).
- `Aktionen.md` and `Sortiment.md` are not modified by this plan; their format is the contract.
- No database, no logins, no npm dependencies, no build step.
- Not a git repo yet (git is set up later in workshop step 7). Skip commit steps until then; there are none in this plan.

## Review Focus

1. An entry whose date is today must still show (inclusive end of day), and vanish the next day. Test in Task 1.
2. File saved with Windows line endings (`\r\n`) must parse the same. Test in Task 1.
3. An entry with neither `Gilt bis` nor `Datum` must always show and have no calendar button. Test in Task 1.
4. Titles or texts containing `<`, `&` or `"` must render as text, not HTML. Escaped in Task 2 (`esc`), checked manually in Task 2 Step 4.
5. Phone offline after a previous visit must still show the last content; offline on first visit shows the "keine Verbindung" message. Checked in Task 3 Step 5.

---

### Task 1: Markdown parser with tests

**Files:**
- Create: `parse.js`
- Create: `test.mjs`
- Create: `.gitignore`

**Interfaces:**
- Produces (all exported from `parse.js`):
  - `parseSections(md: string) -> Array<{title: string, fields: Record<string,string>, body: string}>`
  - `parseWhen(value?: string) -> {date: "YYYYMMDD", start: "HHMM"|null, end: "HHMM"|null} | null`
  - `dateKey(d: Date) -> "YYYYMMDD"` (local time)
  - `parsePromotions(md: string, now?: Date) -> Array<Promo>` where `Promo = {title, text, code: string|null, until: When|null, when: When|null, place: string|null, email: string|null}`; expired entries removed.
  - `parseCoffees(md: string) -> Array<{name, kind, origin, roasted, price, text}>`
  - `label(p: Promo) -> string` e.g. `"Aktion · bis 11.10."`, `"Termin · Sa, 03.10. · 11:00"`
  - `toICS(p: Promo, stamp?: Date) -> string` (CRLF lines)

- [ ] **Step 1: Write `.gitignore`**

```
.superpowers/
.env
.env.*
node_modules/
.DS_Store
```

- [ ] **Step 2: Write the failing test `test.mjs`**

```js
// Run with: node test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parsePromotions, parseCoffees, label, toICS } from './parse.js';

const aktionen = readFileSync(new URL('./Aktionen.md', import.meta.url), 'utf8');
const sortiment = readFileSync(new URL('./Sortiment.md', import.meta.url), 'utf8');
const day = (y, m, d) => new Date(y, m - 1, d, 12);

// Coffees
const coffees = parseCoffees(sortiment);
assert.deepEqual(coffees.map(c => c.name), ['Kranich Espresso', 'Hanse Filter', 'Sidamo Äthiopien']);
assert.equal(coffees[0].roasted, '22.09.2026');
assert.equal(coffees[0].price, '9,90 € / 250 g');
assert.match(coffees[2].text, /blumig/);

// Promotions on 24.09.2026: all three
const now = parsePromotions(aktionen, day(2026, 9, 24));
assert.equal(now.length, 3);
const [herbst, cupping, roest] = now;
assert.equal(herbst.code, 'HERBST10');
assert.equal(herbst.until.date, '20261011');
assert.match(herbst.text, /online und im Laden\.$/); // continuation line joined
assert.deepEqual(cupping.when, { date: '20261003', start: '1100', end: '1230' });
assert.equal(cupping.email, 'hallo@kranich-kaffee.example');
assert.match(cupping.place, /Billwerder Neuer Deich 40/);
assert.deepEqual(roest.when, { date: '20261001', start: null, end: null });

// Labels
assert.equal(label(herbst), 'Aktion · bis 11.10.');
assert.equal(label(cupping), 'Termin · Sa, 03.10. · 11:00');
assert.equal(label(roest), 'Termin · Do, 01.10.');

// Expiry: last day still visible, gone the day after
assert.equal(parsePromotions(aktionen, day(2026, 10, 1)).length, 3);
assert.equal(parsePromotions(aktionen, day(2026, 10, 2)).length, 2);
assert.equal(parsePromotions(aktionen, day(2026, 10, 11)).length, 1);
assert.equal(parsePromotions(aktionen, day(2026, 10, 12)).length, 0);

// Entry without any date: always shown, no when
const undated = parsePromotions('## Neu im Laden\n\n- Text: Tassen mit Kranich.\n', day(2030, 1, 1));
assert.equal(undated.length, 1);
assert.equal(undated[0].when, null);
assert.equal(label(undated[0]), 'Aktion');

// Windows line endings parse the same
assert.equal(parsePromotions(aktionen.replace(/\n/g, '\r\n'), day(2026, 9, 24)).length, 3);
assert.equal(parseCoffees(sortiment.replace(/\n/g, '\r\n')).length, 3);

// Calendar file
const ics = toICS(cupping, new Date(Date.UTC(2026, 8, 24, 10, 0, 0)));
assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
assert.match(ics, /\r\nDTSTART:20261003T110000\r\n/);
assert.match(ics, /\r\nDTEND:20261003T123000\r\n/);
assert.match(ics, /\r\nDTSTAMP:20260924T100000Z\r\n/);
assert.match(ics, /\r\nSUMMARY:Cupping in der Rösterei\r\n/);
assert.match(ics, /\r\nLOCATION:Kranich Kaffee\\, Billwerder Neuer Deich 40\\, /);
const allDay = toICS(roest);
assert.match(allDay, /\r\nDTSTART;VALUE=DATE:20261001\r\n/);
assert.match(allDay, /\r\nDTEND;VALUE=DATE:20261002\r\n/);

console.log('OK: alle Tests bestanden');
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node test.mjs`
Expected: FAIL, `Cannot find module` / `ERR_MODULE_NOT_FOUND` for `parse.js`.

- [ ] **Step 4: Write `parse.js`**

```js
// Reads the simple Markdown format of Aktionen.md and Sortiment.md.
// Format: "## Title", then "- Key: value" lines; indented lines continue the value.

export function parseSections(md) {
  const body = md.replace(/\r\n/g, '\n').split(/^---\s*$/m)[0];
  const sections = [];
  let cur = null;
  let lastKey = null;
  for (const line of body.split('\n')) {
    const heading = line.match(/^## (.+)/);
    if (heading) {
      cur = { title: heading[1].trim(), fields: {}, body: '' };
      sections.push(cur);
      lastKey = null;
      continue;
    }
    if (!cur) continue;
    const field = line.match(/^- ([^:]+):\s*(.*)$/);
    if (field) {
      lastKey = field[1].trim();
      cur.fields[lastKey] = field[2].trim();
    } else if (lastKey && /^\s+\S/.test(line)) {
      cur.fields[lastKey] += ' ' + line.trim();
    } else {
      lastKey = null;
      if (line.trim()) cur.body += (cur.body ? ' ' : '') + line.trim();
    }
  }
  return sections;
}

export function parseWhen(value = '') {
  const d = value.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!d) return null;
  const times = [...value.matchAll(/(\d{1,2}):(\d{2})/g)].map(m => m[1].padStart(2, '0') + m[2]);
  return {
    date: d[3] + d[2].padStart(2, '0') + d[1].padStart(2, '0'),
    start: times[0] || null,
    end: times[1] || null,
  };
}

export function dateKey(d) {
  return String(d.getFullYear()) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
}

export function parsePromotions(md, now = new Date()) {
  const today = dateKey(now);
  return parseSections(md)
    .map(({ title, fields: f, body }) => ({
      title,
      text: f['Text'] || body,
      code: f['Rabattcode'] || null,
      until: parseWhen(f['Gilt bis']),
      when: parseWhen(f['Datum']),
      place: f['Ort'] || null,
      email: (f['Anmeldung'] || '').match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/)?.[0] || null,
    }))
    .filter(p => {
      const end = p.until || p.when;
      return !end || end.date >= today; // visible through the whole last day
    });
}

export function parseCoffees(md) {
  return parseSections(md)
    .filter(s => s.fields['Preis'])
    .map(({ title, fields: f, body }) => ({
      name: title,
      kind: f['Art'] || '',
      origin: f['Herkunft'] || '',
      roasted: f['Röstdatum'] || '',
      price: f['Preis'],
      text: body,
    }));
}

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const toDate = key => new Date(+key.slice(0, 4), +key.slice(4, 6) - 1, +key.slice(6, 8));
const shortDate = key => `${key.slice(6, 8)}.${key.slice(4, 6)}.`;
const clock = hhmm => `${hhmm.slice(0, 2)}:${hhmm.slice(2)}`;

export function label(p) {
  if (p.code) return p.until ? `Aktion · bis ${shortDate(p.until.date)}` : 'Aktion';
  if (p.when) {
    const base = `Termin · ${WEEKDAYS[toDate(p.when.date).getDay()]}, ${shortDate(p.when.date)}`;
    return p.when.start ? `${base} · ${clock(p.when.start)}` : base;
  }
  return 'Aktion';
}

export function toICS(p, stamp = new Date()) {
  const esc = s => String(s).replace(/[\\;,]/g, m => '\\' + m).replace(/\n/g, '\\n');
  const w = p.when;
  const next = toDate(w.date);
  next.setDate(next.getDate() + 1);
  // Times are "floating": the phone's local time, which is Hamburg for our customers.
  const times = w.start
    ? [`DTSTART:${w.date}T${w.start}00`, `DTEND:${w.date}T${w.end || w.start}00`]
    : [`DTSTART;VALUE=DATE:${w.date}`, `DTEND;VALUE=DATE:${dateKey(next)}`];
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kranich Kaffee//App//DE',
    'BEGIN:VEVENT',
    `UID:${w.date}-${p.title.replace(/\W+/g, '-')}@kranich-kaffee`,
    `DTSTAMP:${stamp.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    ...times,
    `SUMMARY:${esc(p.title)}`,
    p.place && `LOCATION:${esc(p.place)}`,
    p.text && `DESCRIPTION:${esc(p.text)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n') + '\r\n';
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node test.mjs`
Expected: `OK: alle Tests bestanden`

---

### Task 2: The page (design C) and buttons

**Files:**
- Create: `index.html`
- Create: `app.js`
- Create: `.claude/launch.json`

**Interfaces:**
- Consumes: `parsePromotions`, `parseCoffees`, `label`, `toICS` from `parse.js` (Task 1).
- Produces: `index.html` with `<main id="promos">`, `<section id="coffees">`; `app.js` exporting nothing, exposing `load()` internally for Task 3's `visibilitychange` hook (Task 3 edits `app.js`).

- [ ] **Step 1: Write `index.html`**

```html
<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Kranich Kaffee</title>
  <meta name="theme-color" content="#6B4A2F">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root { --blau: #1F2A44; --rot: #C8412D; --papier: #F6F1E7; --braun: #6B4A2F; --linie: #E4DCCB; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--papier); color: var(--blau); font: 16px/1.5 Inter, system-ui, sans-serif; }
    h1, h2, h3 { font-family: Fraunces, Georgia, serif; text-transform: none; letter-spacing: 0; margin: 0; }
    .wrap { max-width: 560px; margin: 0 auto; }
    header { background: var(--braun); color: var(--papier); padding: calc(env(safe-area-inset-top) + 20px) 20px 22px; }
    .brand { display: flex; align-items: center; gap: 10px; font-size: 14px; }
    .brand img { width: 32px; height: 32px; border-radius: 50%; }
    header h1 { font-size: 34px; line-height: 1.1; margin-top: 18px; font-weight: 700; }
    .item, .coffee { padding: 20px; border-top: 1px solid var(--linie); }
    .item:first-child { border-top: 0; }
    .label { color: var(--braun); font-size: 13px; font-weight: 600; margin: 0 0 2px; }
    .item h2 { font-size: 24px; line-height: 1.2; }
    .item p, .coffee p { margin: 8px 0 0; }
    .code { display: flex; justify-content: space-between; align-items: center; gap: 12px;
            border: 1.5px dashed var(--blau); border-radius: 10px; padding: 8px 8px 8px 14px; margin-top: 14px;
            font-weight: 600; letter-spacing: 2px; user-select: all; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
    .btn { font: 600 15px Inter, sans-serif; border: 0; border-radius: 10px; padding: 10px 14px; cursor: pointer;
           background: var(--blau); color: var(--papier); text-decoration: none; letter-spacing: 0; }
    .btn.rot { background: var(--rot); }
    .btn.leise { background: transparent; color: var(--blau); border: 1.5px solid var(--blau); }
    .section-title { font-size: 26px; padding: 28px 20px 4px; border-top: 6px solid var(--braun); margin-top: 12px; }
    .coffee h3 { font-size: 20px; }
    .meta { color: var(--braun); font-size: 14px; margin-top: 2px; }
    .price { font-weight: 600; }
    .hinweis { padding: 20px; }
    footer { padding: 24px 20px calc(env(safe-area-inset-bottom) + 32px); font-size: 14px; color: var(--braun); border-top: 1px solid var(--linie); }
  </style>
  <link rel="manifest" href="manifest.webmanifest">
  <link rel="apple-touch-icon" href="icon-192.png">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="Kranich">
</head>
<body>
  <div class="wrap">
    <header>
      <div class="brand"><img src="icon-192.png" alt=""> Kranich Kaffee · Rothenburgsort</div>
      <h1>Diese Woche bei uns</h1>
    </header>
    <main id="promos"><p class="hinweis">Einen Moment, wir holen die Neuigkeiten.</p></main>
    <h2 class="section-title">Unser Kaffee</h2>
    <section id="coffees"></section>
    <footer>Kranich Kaffee, Billwerder Neuer Deich 40, 20539 Hamburg-Rothenburgsort</footer>
  </div>
  <script type="module" src="app.js"></script>
</body>
</html>
```

(The manifest and apple tags point at files created in Task 3; a missing manifest does not break the page.)

- [ ] **Step 2: Write `app.js`**

```js
import { parsePromotions, parseCoffees, label, toICS } from './parse.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const promosEl = document.getElementById('promos');
const coffeesEl = document.getElementById('coffees');
let promos = [];

async function getText(file) {
  const res = await fetch(file, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${file}: ${res.status}`);
  return res.text();
}

function renderPromos() {
  if (!promos.length) {
    promosEl.innerHTML = '<p class="hinweis">Gerade keine Aktionen. Schau bald wieder rein.</p>';
    return;
  }
  promosEl.innerHTML = promos.map((p, i) => `
    <article class="item">
      <p class="label">${esc(label(p))}</p>
      <h2>${esc(p.title)}</h2>
      ${p.text ? `<p>${esc(p.text)}</p>` : ''}
      ${p.code ? `<div class="code"><span>${esc(p.code)}</span><button class="btn rot" data-copy="${i}">Kopieren</button></div>` : ''}
      ${p.when || p.email ? `<div class="actions">
        ${p.when ? `<button class="btn" data-cal="${i}">In den Kalender</button>` : ''}
        ${p.email ? `<a class="btn leise" href="mailto:${esc(p.email)}?subject=${encodeURIComponent('Anmeldung: ' + p.title)}">Per Mail anmelden</a>` : ''}
      </div>` : ''}
    </article>`).join('');
}

function renderCoffees(coffees) {
  coffeesEl.innerHTML = coffees.map(c => `
    <article class="coffee">
      <h3>${esc(c.name)}</h3>
      <p class="meta">${esc(c.kind)} · ${esc(c.origin)} · geröstet am ${esc(c.roasted)}</p>
      <p>${esc(c.text)}</p>
      <p class="price">${esc(c.price)}</p>
    </article>`).join('');
}

async function load() {
  try {
    const [aktionen, sortiment] = await Promise.all([getText('Aktionen.md'), getText('Sortiment.md')]);
    promos = parsePromotions(aktionen);
    renderPromos();
    renderCoffees(parseCoffees(sortiment));
  } catch {
    if (!promos.length) promosEl.innerHTML = '<p class="hinweis">Gerade keine Verbindung. Versuch es gleich noch mal.</p>';
  }
}

promosEl.addEventListener('click', async e => {
  const btn = e.target.closest('button');
  if (!btn) return;
  if (btn.dataset.copy) {
    try {
      await navigator.clipboard.writeText(promos[btn.dataset.copy].code);
      btn.textContent = 'Kopiert';
      setTimeout(() => { btn.textContent = 'Kopieren'; }, 2000);
    } catch { /* code stays visible and selectable */ }
  }
  if (btn.dataset.cal) {
    // ponytail: data: URL opens the phone calendar on most phones; verify on a real iPhone in step 8.
    location.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(toICS(promos[btn.dataset.cal]));
  }
});

load();
```

- [ ] **Step 3: Write `.claude/launch.json` and start the preview**

```json
{
  "version": "0.0.1",
  "configurations": [
    { "name": "kranich", "runtimeExecutable": "python3", "runtimeArgs": ["-m", "http.server", "8080"], "port": 8080 }
  ]
}
```

Start with the `preview_start` tool, name `kranich`. Set mobile viewport (375x812).

- [ ] **Step 4: Verify in the browser**

Check by eye and with `get_page_text`:
- Brown header, "Diese Woche bei uns", three entries in file order with labels `Aktion · bis 11.10.`, `Termin · Sa, 03.10. · 11:00`, `Termin · Do, 01.10.`.
- "Unser Kaffee" with 3 coffees, each "geröstet am …".
- Tap "Kopieren": button shows "Kopiert" for 2 s.
- Tap "In den Kalender" on Cupping: browser downloads/opens an `.ics`; no console errors.
- "Per Mail anmelden" link `href` starts with `mailto:hallo@kranich-kaffee.example?subject=Anmeldung%3A%20Cupping`.
- Escaping: in the browser console run `document.querySelector('#promos h2').textContent` and confirm it is plain text; code path uses `esc()` for every interpolated value.

---

### Task 3: Installable app and updates that always arrive

**Files:**
- Create: `manifest.webmanifest`
- Create: `sw.js`
- Create: `netlify.toml`
- Modify: `app.js` (append service worker registration and `visibilitychange` reload)

**Interfaces:**
- Consumes: `load()` in `app.js` (Task 2).
- Produces: files served at site root: `/manifest.webmanifest`, `/sw.js`.

- [ ] **Step 1: Write `manifest.webmanifest`**

```json
{
  "name": "Kranich Kaffee",
  "short_name": "Kranich",
  "lang": "de",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "background_color": "#F6F1E7",
  "theme_color": "#6B4A2F",
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 2: Write `sw.js`**

```js
// Network first, always. The saved copy is only used when the phone is offline.
const CACHE = 'kranich';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || Response.error()))
  );
});
```

- [ ] **Step 3: Write `netlify.toml`**

```toml
# Phones must ask for the newest version every time, so updates always arrive.
[[headers]]
  for = "/*"
  [headers.values]
    Cache-Control = "no-cache"
```

- [ ] **Step 4: Append to the end of `app.js`**

```js
// Reload content when the app comes back from the background.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') load();
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
}
```

- [ ] **Step 5: Verify installability, update and offline**

1. Reload preview. In console: `(await navigator.serviceWorker.ready).active.state` is `"activated"`; `document.querySelector('link[rel=manifest]')` resolves and `fetch('manifest.webmanifest').then(r=>r.json())` returns the name "Kranich Kaffee".
2. Update test: in `Aktionen.md` temporarily change the heading `## Cupping in der Rösterei` to `## Cupping in der Rösterei (Test)`. Reload once. The new title shows. Revert the file exactly, reload, the old title shows.
3. Offline: stop the preview server (`preview_stop`), reload. Last content still shows from the service worker copy. Start the server again.
4. Run `node test.mjs` again: `OK: alle Tests bestanden`.

---

### Task 4: Final check against spec and styleguide

**Files:** none new (fix in place if something fails).

- [ ] **Step 1:** Grep all shipped files for forbidden things:

Run: `grep -nE $'\xe2\x80\x94'"|#000\b|#000000|gradient|Premium|Genuss pur|einzigartig|Geheimtipp|Barista|aufgepasst|uppercase" index.html app.js parse.js sw.js manifest.webmanifest netlify.toml`
Expected: no output.

- [ ] **Step 2:** Walk the spec sections ("Was die Kundschaft sieht", "Knöpfe", "Wann etwas verschwindet", "Updates kommen immer an", "Fehlerfälle") and confirm each against the running preview. Take one mobile screenshot for the owner.

- [ ] **Step 3:** Stop the brainstorm companion server: `bash <superpowers>/skills/brainstorming/scripts/stop-server.sh <session dir>`.
