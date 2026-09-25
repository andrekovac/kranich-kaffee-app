# Supabase Promotions and Sign-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promotions come from a Supabase database (Frankfurt), and visitors can sign up for events by name ("Ich bin dabei") with a hard capacity limit.

**Architecture:** Two locked-down tables, reachable by visitors only through two `security definer` SQL functions (`get_promotions`, `sign_up`). The static PWA calls them with plain `fetch` and the public publishable key. Pure logic (row mapping, labels, remembered sign-ups) lives in `parse.js` and is tested with Node; database rules are tested live with the public key.

**Tech Stack:** Supabase (Postgres 15+, PostgREST, pg_cron), plain JS ES modules, Node 22 `node:assert`, Netlify static hosting.

**Spec:** `docs/superpowers/specs/2026-09-25-supabase-promotions-signups-design.md`

## Global Constraints

- Supabase project name `kranich-kaffee`, region `eu-central-1` (Frankfurt), free plan. Confirm the cost is $0 before creating it.
- Visitors (`anon`, `authenticated`) have NO table privileges and NO RLS policies. Only `execute` on `public.get_promotions()` and `public.sign_up(bigint, text)`.
- Both functions: `security definer`, `set search_path = ''`, fully qualified names.
- "Today" in SQL is always `(now() at time zone 'Europe/Berlin')::date`.
- Names: trimmed, 1 to 60 characters. Error codes: `not_found`, `closed`, `past`, `bad_name`, `full`.
- No new npm or CDN dependencies. Plain `fetch`, header `apikey: <publishable key>` only.
- All user-visible text German, "du", Kranich styleguide, max one "!", max 20 words per sentence. Never an em dash anywhere.
- Coffees stay in `Sortiment.md`. `Aktionen.md` is deleted at the end of Task 3.
- Kranichrot stays an accent: new buttons use the navy `.btn`, not `.btn.rot`.
- Commit after each task. Push only in Task 4.

## Review Focus

1. Two visitors tap "Anmelden" for the last place at the same moment: exactly one succeeds, the other gets "Leider schon ausgebucht." (test in Task 1, `test-db.mjs`, parallel calls).
2. A name containing `<script>` or `&` shows as plain text in "Du bist dabei, ..." (browser check in Task 3 Step 6).
3. `localStorage` unavailable or throwing (private mode): the app still loads and sign-up still works, it just is not remembered (Node test in Task 2 with a throwing storage).
4. Offline with a saved promotions list from an earlier day: entries that ended since then are not shown (Node test in Task 2, `isVisible`).
5. Supabase unreachable on first open: the "keine Verbindung" hint shows and the coffees still render (code-reading check in Task 3 Step 6, item 6; the saved-copy path is checked in the browser, item 5).

---

### Task 1: Supabase project, schema, seed and live rule tests

**Files:**
- Create: `supabase/migrations/20260925_promotions_signups.sql` (copy of the applied SQL, for the record)
- Create: `config.js`
- Create: `test-db.mjs`

**Interfaces:**
- Produces: `config.js` exporting `SUPABASE_URL: string`, `SUPABASE_KEY: string`.
- Produces: RPC `get_promotions()` returning rows `{id, title, text, code, valid_until: "YYYY-MM-DD"|null, event_date: "YYYY-MM-DD"|null, start_time: "HH:MM:SS"|null, end_time: "HH:MM:SS"|null, place, signups_open: boolean, capacity: int|null, places_left: int|null}`.
- Produces: RPC `sign_up({p_promotion_id, p_name})` returning `places_left` (int or null); on refusal HTTP 400 with JSON `message` = one of the error codes.

- [ ] **Step 1: Find the organisation and confirm cost**

Use the Supabase connector: `list_organizations`, then `get_cost` (type `project`, that org), then `confirm_cost`. Expected: $0/month. If not $0, STOP and ask the owner.

- [ ] **Step 2: Create the project**

`create_project` with name `kranich-kaffee`, region `eu-central-1`, the org id and the confirm-cost id. Poll `get_project` until status is `ACTIVE_HEALTHY`.

- [ ] **Step 3: Apply the migration** (`apply_migration`, name `promotions_signups`)

```sql
create table public.promotions (
  id bigint generated always as identity primary key,
  title text not null,
  text text,
  code text,
  valid_until date,
  event_date date,
  start_time time,
  end_time time,
  place text,
  signups_open boolean not null default false,
  capacity int check (capacity > 0),
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table public.signups (
  id bigint generated always as identity primary key,
  promotion_id bigint not null references public.promotions (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  created_at timestamptz not null default now()
);
create index signups_promotion_id_idx on public.signups (promotion_id);

alter table public.promotions enable row level security;
alter table public.signups enable row level security;
revoke all on public.promotions, public.signups from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

create function public.get_promotions()
returns table (
  id bigint, title text, text text, code text, valid_until date, event_date date,
  start_time time, end_time time, place text, signups_open boolean, capacity int,
  places_left int
)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.title, p.text, p.code, p.valid_until, p.event_date,
         p.start_time, p.end_time, p.place, p.signups_open, p.capacity,
         case when p.capacity is null then null
              else p.capacity - (select count(*)::int from public.signups s where s.promotion_id = p.id)
         end
  from public.promotions p
  where coalesce(p.valid_until, p.event_date) is null
     or coalesce(p.valid_until, p.event_date) >= (now() at time zone 'Europe/Berlin')::date
  order by p.sort, p.id;
$$;

create function public.sign_up(p_promotion_id bigint, p_name text)
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_promo public.promotions%rowtype;
  v_name text := btrim(coalesce(p_name, ''));
  v_taken int;
begin
  select * into v_promo from public.promotions where id = p_promotion_id for update;
  if not found then raise exception 'not_found'; end if;
  if not v_promo.signups_open or v_promo.event_date is null then raise exception 'closed'; end if;
  if v_promo.event_date < (now() at time zone 'Europe/Berlin')::date then raise exception 'past'; end if;
  if char_length(v_name) not between 1 and 60 then raise exception 'bad_name'; end if;
  select count(*) into v_taken from public.signups where promotion_id = p_promotion_id;
  if v_promo.capacity is not null and v_taken >= v_promo.capacity then raise exception 'full'; end if;
  insert into public.signups (promotion_id, name) values (p_promotion_id, v_name);
  return case when v_promo.capacity is null then null else v_promo.capacity - v_taken - 1 end;
end;
$$;

revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
grant execute on function public.get_promotions() to anon, authenticated;
grant execute on function public.sign_up(bigint, text) to anon, authenticated;

create extension if not exists pg_cron;
select cron.schedule(
  'delete-old-signups', '15 3 * * *',
  $$delete from public.signups s using public.promotions p
    where s.promotion_id = p.id
      and p.event_date < (now() at time zone 'Europe/Berlin')::date - 14$$
);
```

Save the same SQL to `supabase/migrations/20260925_promotions_signups.sql`.

- [ ] **Step 4: Seed the current promotions** (`execute_sql`)

```sql
insert into public.promotions (title, text, code, valid_until, sort) values
  ('Herbst-Aktion: 10 % auf den Hanse Filter',
   'Der Herbst ist Filterkaffee-Zeit. Mit dem Code HERBST10 bekommst du 10 % auf den Hanse Filter, online und im Laden.',
   'HERBST10', '2026-10-11', 1);
insert into public.promotions (title, text, event_date, start_time, end_time, place, signups_open, capacity, sort) values
  ('Cupping in der Rösterei',
   'Wir probieren gemeinsam alle drei Kaffees aus dem Sortiment und erklären, was du da eigentlich schmeckst. Kostenlos, Anmeldung nötig.',
   '2026-10-03', '11:00', '12:30',
   'Kranich Kaffee, Billwerder Neuer Deich 40, 20539 Hamburg-Rothenburgsort', true, 12, 2);
insert into public.promotions (title, text, event_date, sort) values
  ('Nächster Röst-Tag',
   'Am Donnerstag rösten wir den Sidamo neu. Ab Freitag ist er im Laden und online wieder da.',
   '2026-10-01', 3);
```

- [ ] **Step 5: Write `config.js`** with `get_project_url` and `get_publishable_keys` (use the publishable `sb_publishable_...` key; fall back to the legacy anon key only if no publishable key exists)

```js
// Public by design: this key only allows what the database functions allow.
export const SUPABASE_URL = 'https://<project-ref>.supabase.co';
export const SUPABASE_KEY = '<publishable key>';
```

- [ ] **Step 6: Write `test-db.mjs`**

```js
// Live check of the database rules with the public key only, like a visitor.
// Usage: node test-db.mjs <openTestId> <pastTestId>
// Create the two hidden test promotions first and delete them afterwards (see the plan).
import assert from 'node:assert/strict';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const [openId, pastId] = process.argv.slice(2).map(Number);
assert.ok(openId && pastId, 'usage: node test-db.mjs <openTestId> <pastTestId>');
const headers = { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' };
const rest = (path, init = {}) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers, ...init });
const rpc = async (name, body = {}) => {
  const r = await rest(`rpc/${name}`, { method: 'POST', body: JSON.stringify(body) });
  return { ok: r.ok, data: await r.json() };
};
const signUp = name => rpc('sign_up', { p_promotion_id: openId, p_name: name });

// Tables are closed to visitors
for (const t of ['signups', 'promotions']) {
  assert.ok(!(await rest(`${t}?select=*`)).ok, `${t} must not be readable`);
}
const direct = await rest('signups', { method: 'POST', body: JSON.stringify({ promotion_id: openId, name: 'x' }) });
assert.ok(!direct.ok, 'direct insert must fail');

// get_promotions: visible entries only, never names
const list = await rpc('get_promotions');
assert.ok(list.ok);
assert.ok(list.data.length >= 1);
assert.ok(list.data.every(p => !('name' in p)));
assert.ok(!list.data.some(p => p.id === openId || p.id === pastId), 'test rows stay hidden');

// Refusals
assert.equal((await rpc('sign_up', { p_promotion_id: 0, p_name: 'A' })).data.message, 'not_found');
assert.equal((await rpc('sign_up', { p_promotion_id: pastId, p_name: 'A' })).data.message, 'past');
assert.equal((await signUp('x'.repeat(61))).data.message, 'bad_name');
assert.equal((await signUp('   ')).data.message, 'bad_name');

// Capacity 2: one sign-up, then two at the same moment for the last place
assert.deepEqual(await signUp('  Test Eins  '), { ok: true, data: 1 });
const both = await Promise.all([signUp('Test Zwei'), signUp('Test Drei')]);
assert.deepEqual(both.map(r => r.ok).sort(), [false, true]);
assert.equal(both.find(r => !r.ok).data.message, 'full');
assert.equal(both.find(r => r.ok).data, 0);

console.log('OK: Datenbank-Regeln halten');
```

- [ ] **Step 7: Create hidden test promotions** (`execute_sql`; `valid_until` yesterday hides them from `get_promotions`, `event_date` decides sign-up rules)

```sql
insert into public.promotions (title, valid_until, event_date, signups_open, capacity)
values ('TEST offen', current_date - 1, current_date + 7, true, 2),
       ('TEST vorbei', current_date - 1, current_date - 1, true, 5)
returning id, title;
```

- [ ] **Step 8: Run the live test**

Run: `node test-db.mjs <id of TEST offen> <id of TEST vorbei>`
Expected: `OK: Datenbank-Regeln halten`

Then check the stored name was trimmed (`execute_sql`): `select name from public.signups order by id;` Expected: `Test Eins` and one of `Test Zwei` / `Test Drei`.

- [ ] **Step 9: Remove test data** (`execute_sql`)

```sql
delete from public.promotions where title like 'TEST %';
select count(*) from public.signups;  -- expected 0
```

- [ ] **Step 10: Security advisor**

Run `get_advisors` type `security`. Expected: no errors about RLS or exposed tables. Warnings about `security definer` functions are expected (by design); note them in the ledger.

- [ ] **Step 11: Commit**

```bash
git add config.js test-db.mjs supabase/
git commit -m "Add Supabase schema, seed and live rule test"
```

---

### Task 2: App logic for database promotions (tested)

**Files:**
- Modify: `parse.js` (remove `parsePromotions`, `parseWhen`; add `fromRow`, `isVisible`, `placesLabel`, `signupError`, `loadJoined`, `saveJoined`)
- Modify: `test.mjs` (replace `Aktionen.md` tests)

**Interfaces:**
- Consumes: row shape from Task 1 `get_promotions()`.
- Produces (exports of `parse.js`):
  - `fromRow(row) -> Promo` with `Promo = {id, title, text, code|null, until: When|null, when: When|null, place|null, signupsOpen: boolean, placesLeft: int|null}`, `When = {date: "YYYYMMDD", start: "HHMM"|null, end: "HHMM"|null}`
  - `isVisible(p: Promo, now?: Date) -> boolean`
  - `placesLabel(n: int|null) -> string`
  - `signupError(code?: string) -> string`
  - `loadJoined(storage|null) -> Record<id, name>`; `saveJoined(storage|null, id, name) -> Record<id, name>`
  - unchanged: `parseSections`, `parseCoffees`, `dateKey`, `label`, `toICS`

- [ ] **Step 1: Replace `test.mjs` with the failing tests**

```js
// Run with: node test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCoffees, label, toICS, fromRow, isVisible, placesLabel, signupError, loadJoined, saveJoined } from './parse.js';

const sortiment = readFileSync(new URL('./Sortiment.md', import.meta.url), 'utf8');
const day = (y, m, d) => new Date(y, m - 1, d, 12);

// Coffees (unchanged)
const coffees = parseCoffees(sortiment);
assert.deepEqual(coffees.map(c => c.name), ['Kranich Espresso', 'Hanse Filter', 'Sidamo Äthiopien']);
assert.equal(coffees[0].roasted, '22.09.2026');
assert.equal(parseCoffees(sortiment.replace(/\n/g, '\r\n')).length, 3);

// Rows as get_promotions() returns them
const base = { text: null, code: null, valid_until: null, event_date: null, start_time: null, end_time: null, place: null, signups_open: false, capacity: null, places_left: null };
const herbst = fromRow({ ...base, id: 1, title: 'Herbst-Aktion', code: 'HERBST10', valid_until: '2026-10-11' });
const cupping = fromRow({ ...base, id: 2, title: 'Cupping in der Rösterei', text: 'Wir probieren.', event_date: '2026-10-03',
  start_time: '11:00:00', end_time: '12:30:00', place: 'Kranich Kaffee, Billwerder Neuer Deich 40', signups_open: true, capacity: 12, places_left: 5 });
const roest = fromRow({ ...base, id: 3, title: 'Nächster Röst-Tag', event_date: '2026-10-01' });

assert.equal(herbst.code, 'HERBST10');
assert.deepEqual(herbst.until, { date: '20261011', start: null, end: null });
assert.equal(herbst.when, null);
assert.equal(herbst.signupsOpen, false);
assert.deepEqual(cupping.when, { date: '20261003', start: '1100', end: '1230' });
assert.equal(cupping.signupsOpen, true);
assert.equal(cupping.placesLeft, 5);
assert.equal(roest.placesLeft, null);
assert.equal(fromRow({ ...base, id: 4, title: 'Ohne Datum', signups_open: true }).signupsOpen, false);

// Labels and calendar still work on mapped rows
assert.equal(label(herbst), 'Aktion · bis 11.10.');
assert.equal(label(cupping), 'Termin · Sa, 03.10. · 11:00');
assert.equal(label(roest), 'Termin · Do, 01.10.');
const ics = toICS(cupping, new Date(Date.UTC(2026, 8, 24, 10)));
assert.match(ics, /\r\nDTSTART:20261003T110000\r\n/);
assert.match(ics, /\r\nDTEND:20261003T123000\r\n/);
assert.match(ics, /\r\nLOCATION:Kranich Kaffee\\, Billwerder Neuer Deich 40\r\n/);

// Offline copy from an earlier day: ended entries are hidden, last day still shown
assert.equal(isVisible(roest, day(2026, 10, 1)), true);
assert.equal(isVisible(roest, day(2026, 10, 2)), false);
assert.equal(isVisible(herbst, day(2026, 10, 11)), true);
assert.equal(isVisible(fromRow({ ...base, id: 5, title: 'Immer' }), day(2030, 1, 1)), true);

// Places label
assert.equal(placesLabel(null), '');
assert.equal(placesLabel(5), 'Noch 5 Plätze frei');
assert.equal(placesLabel(1), 'Noch 1 Platz frei');
assert.equal(placesLabel(0), 'Ausgebucht');

// Error texts
assert.equal(signupError('full'), 'Leider schon ausgebucht.');
assert.equal(signupError('past'), 'Anmeldung ist geschlossen.');
assert.equal(signupError('closed'), 'Anmeldung ist geschlossen.');
assert.equal(signupError('not_found'), 'Anmeldung ist geschlossen.');
assert.equal(signupError('bad_name'), 'Bitte gib einen Namen an (höchstens 60 Zeichen).');
assert.equal(signupError(undefined), 'Gerade keine Verbindung. Versuch es gleich noch mal.');

// Remembered sign-ups
const mem = new Map();
const store = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
assert.deepEqual(loadJoined(store), {});
assert.deepEqual(saveJoined(store, 2, 'Anna'), { 2: 'Anna' });
assert.deepEqual(loadJoined(store), { 2: 'Anna' });
const broken = { getItem() { throw new Error('private mode'); }, setItem() { throw new Error('private mode'); } };
assert.deepEqual(loadJoined(broken), {});
assert.deepEqual(saveJoined(broken, 2, 'Anna'), { 2: 'Anna' });
assert.deepEqual(loadJoined(null), {});
mem.set('kranich-joined', 'not json');
assert.deepEqual(loadJoined(store), {});

console.log('OK: alle Tests bestanden');
```

- [ ] **Step 2: Run to see it fail**

Run: `node test.mjs`
Expected: FAIL, `SyntaxError: The requested module './parse.js' does not provide an export named 'fromRow'`

- [ ] **Step 3: Edit `parse.js`**

Change the header comment to:

```js
// Pure logic of the app: reading Sortiment.md, turning database rows into
// promotions, labels, calendar files and remembered sign-ups. Tested by test.mjs.
```

Delete the functions `parseWhen` and `parsePromotions`. Add after `parseCoffees`:

```js
// Turns a row from get_promotions() into the shape the page uses.
export function fromRow(r) {
  const day = d => (d ? d.replaceAll('-', '') : null);            // "2026-10-03" -> "20261003"
  const hhmm = t => (t ? t.slice(0, 5).replace(':', '') : null);  // "11:00:00" -> "1100"
  const when = r.event_date ? { date: day(r.event_date), start: hhmm(r.start_time), end: hhmm(r.end_time) } : null;
  return {
    id: r.id,
    title: r.title,
    text: r.text || '',
    code: r.code || null,
    until: r.valid_until ? { date: day(r.valid_until), start: null, end: null } : null,
    when,
    place: r.place || null,
    signupsOpen: Boolean(r.signups_open && when),
    placesLeft: r.places_left ?? null,
  };
}

// Visible through the whole last day. The database filters too; this covers offline copies.
export function isVisible(p, now = new Date()) {
  const end = p.until || p.when;
  return !end || end.date >= dateKey(now);
}

export function placesLabel(n) {
  if (n == null) return '';
  if (n <= 0) return 'Ausgebucht';
  return n === 1 ? 'Noch 1 Platz frei' : `Noch ${n} Plätze frei`;
}

const SIGNUP_ERRORS = {
  full: 'Leider schon ausgebucht.',
  past: 'Anmeldung ist geschlossen.',
  closed: 'Anmeldung ist geschlossen.',
  not_found: 'Anmeldung ist geschlossen.',
  bad_name: 'Bitte gib einen Namen an (höchstens 60 Zeichen).',
};
export function signupError(code) {
  return SIGNUP_ERRORS[code] || 'Gerade keine Verbindung. Versuch es gleich noch mal.';
}

// Which events this phone signed up for: { promotionId: name }. Storage may be missing or throw.
const JOINED_KEY = 'kranich-joined';
export function loadJoined(storage) {
  try {
    const data = JSON.parse(storage?.getItem(JOINED_KEY) || '{}');
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}
export function saveJoined(storage, id, name) {
  const joined = { ...loadJoined(storage), [id]: name };
  try { storage?.setItem(JOINED_KEY, JSON.stringify(joined)); } catch { /* not remembered, still signed up */ }
  return joined;
}
```

- [ ] **Step 4: Run the tests**

Run: `node test.mjs`
Expected: `OK: alle Tests bestanden`

- [ ] **Step 5: Commit**

```bash
git add parse.js test.mjs
git commit -m "Map database promotions and sign-up state in parse.js"
```

---

### Task 3: Page, sign-up UI, privacy page, service worker

**Files:**
- Modify: `app.js`
- Modify: `index.html` (styles, footer link)
- Create: `datenschutz.html`
- Modify: `sw.js` (precache list)
- Delete: `Aktionen.md`

**Interfaces:**
- Consumes: `config.js` (Task 1), `parse.js` exports (Task 2), RPCs (Task 1).
- Produces: the finished page.

- [ ] **Step 1: Replace the top of `app.js` down to and including `async function load() {...}`** with:

```js
import { parseCoffees, label, toICS, fromRow, isVisible, placesLabel, signupError, loadJoined, saveJoined } from './parse.js';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const promosEl = document.getElementById('promos');
const coffeesEl = document.getElementById('coffees');
const store = (() => { try { return localStorage; } catch { return null; } })();
const SAVED_KEY = 'kranich-promos';
let promos = [];
let joined = loadJoined(store);

async function getText(file) {
  const res = await fetch(file, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${file}: ${res.status}`);
  return res.text();
}

// Calls a database function. Throws an error whose .code is the database's error code.
async function rpc(name, body = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    cache: 'no-store',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw Object.assign(new Error(data?.message || 'network'), { code: data?.message });
  return data;
}

function signupBlock(p, i) {
  const name = joined[p.id];
  let inner;
  if (name) {
    inner = `<p class="dabei">Du bist dabei, ${esc(name)}.</p>`;
  } else if (p.placesLeft === 0) {
    inner = '<p class="dabei">Ausgebucht</p>';
  } else {
    inner = `
      <button class="btn" data-join="${i}">Ich bin dabei</button>
      <form class="join" data-form="${i}" hidden>
        <label>Wie heißt du?<input name="name" maxlength="60" autocomplete="given-name" required></label>
        <button class="btn">Anmelden</button>
        <p class="fehler" role="alert"></p>
      </form>`;
  }
  return `<div class="signup">
    ${!name && p.placesLeft > 0 ? `<p class="label">${esc(placesLabel(p.placesLeft))}</p>` : ''}
    ${inner}
    <p class="klein">Wir speichern nur deinen Namen für diesen Termin und löschen ihn 14 Tage danach.</p>
  </div>`;
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
      ${p.when ? `<div class="actions"><button class="btn leise" data-cal="${i}">In den Kalender</button></div>` : ''}
      ${p.signupsOpen ? signupBlock(p, i) : ''}
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

async function loadPromos() {
  let rows = null;
  try {
    rows = await rpc('get_promotions');
    try { store?.setItem(SAVED_KEY, JSON.stringify(rows)); } catch { /* no offline copy */ }
  } catch {
    try { rows = JSON.parse(store?.getItem(SAVED_KEY) || 'null'); } catch { rows = null; }
  }
  if (rows) {
    promos = rows.map(fromRow).filter(p => isVisible(p));
    renderPromos();
  } else if (!promos.length) {
    promosEl.innerHTML = '<p class="hinweis">Gerade keine Verbindung. Versuch es gleich noch mal.</p>';
  }
}

async function load() {
  await Promise.all([
    loadPromos(),
    getText('Sortiment.md').then(md => renderCoffees(parseCoffees(md)), () => {}),
  ]);
}
```

(The "In den Kalender" button becomes `.btn.leise` so the navy "Ich bin dabei" is the main action.)

- [ ] **Step 2: In the click handler of `app.js`, add before `if (btn.dataset.copy)`:**

```js
  if (btn.dataset.join) {
    const form = promosEl.querySelector(`[data-form="${btn.dataset.join}"]`);
    btn.hidden = true;
    form.hidden = false;
    form.elements.name.focus();
    return;
  }
```

and after the click handler add:

```js
promosEl.addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target;
  const p = promos[form.dataset.form];
  const name = form.elements.name.value.trim();
  const button = form.querySelector('button');
  const error = form.querySelector('.fehler');
  button.disabled = true;
  error.textContent = '';
  try {
    await rpc('sign_up', { p_promotion_id: p.id, p_name: name });
    joined = saveJoined(store, p.id, name);
    renderPromos();
    loadPromos(); // fresh places left
  } catch (err) {
    error.textContent = signupError(err.code);
    button.disabled = false;
  }
});
```

- [ ] **Step 3: `index.html`**

Add to the `<style>` block:

```css
    .signup { margin-top: 16px; padding-top: 14px; border-top: 1px dashed var(--linie); }
    .signup .label { margin-bottom: 8px; }
    .join label { display: block; font-weight: 600; margin-bottom: 8px; }
    .join input { display: block; width: 100%; margin-top: 6px; font: 16px Inter, sans-serif; padding: 10px 12px;
                  border: 1.5px solid var(--blau); border-radius: 10px; background: #fff; color: var(--blau); }
    .dabei { font-weight: 600; margin: 0; }
    .fehler { color: var(--rot); font-weight: 600; margin: 8px 0 0; }
    .fehler:empty { display: none; }
    .klein { font-size: 13px; color: var(--braun); margin: 10px 0 0; }
    footer a { color: var(--braun); }
```

Replace the footer with:

```html
    <footer>Kranich Kaffee, Billwerder Neuer Deich 40, 20539 Hamburg-Rothenburgsort · <a href="datenschutz.html">Datenschutz</a></footer>
```

(`font-size: 16px` on the input stops iPhones from zooming in.)

- [ ] **Step 4: Create `datenschutz.html`**

```html
<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Datenschutz · Kranich Kaffee</title>
  <style>
    body { margin: 0; background: #F6F1E7; color: #1F2A44; font: 16px/1.6 Inter, system-ui, sans-serif; }
    main { max-width: 560px; margin: 0 auto; padding: 24px 20px 48px; }
    h1, h2 { font-family: Fraunces, Georgia, serif; text-transform: none; }
    a { color: #6B4A2F; }
  </style>
</head>
<body>
  <main>
    <p><a href="./">Zurück zur App</a></p>
    <h1>Datenschutz</h1>
    <h2>Wer ist verantwortlich?</h2>
    <p>Kranich Kaffee, Billwerder Neuer Deich 40, 20539 Hamburg-Rothenburgsort. Mail: hallo@kranich-kaffee.example</p>
    <h2>Was speichern wir?</h2>
    <p>Wenn du dich für einen Termin anmeldest, speichern wir deinen Namen und den Zeitpunkt der Anmeldung. Sonst speichern wir nichts über dich.</p>
    <h2>Wozu?</h2>
    <p>Damit wir wissen, wer kommt, und die Plätze richtig planen.</p>
    <h2>Wo liegen die Daten?</h2>
    <p>Die Anmeldungen liegen in einer Datenbank bei Supabase in Frankfurt. Die App selbst liegt bei Netlify. Beide sehen beim Aufruf technisch deine IP-Adresse.</p>
    <h2>Wie lange?</h2>
    <p>Wir löschen deinen Namen automatisch 14 Tage nach dem Termin.</p>
    <h2>Auf deinem Handy</h2>
    <p>Die App merkt sich auf deinem Handy die letzten Aktionen und ob du dich angemeldet hast. Das verlässt dein Handy nicht.</p>
    <h2>Deine Rechte</h2>
    <p>Du kannst jederzeit fragen, was wir gespeichert haben, und die Löschung verlangen. Schreib uns dafür eine Mail.</p>
    <p><small>Fiktive Demo für eine Workshop-Übung.</small></p>
  </main>
</body>
</html>
```

- [ ] **Step 5: `sw.js` precache list and delete `Aktionen.md`**

In `sw.js` change the `addAll` list to:

```js
    .then(c => c.addAll(['./', 'app.js', 'parse.js', 'config.js', 'Sortiment.md', 'icon-192.png', 'datenschutz.html']))
```

Then `git rm Aktionen.md`. (A missing file in `addAll` would make the whole service worker install fail, so this list must only name files that exist.)

- [ ] **Step 6: Browser verification** (local preview `python3 -m http.server 8080`, mobile viewport 375x812)

1. Three promotions from the database in order; Cupping shows "Noch 12 Plätze frei", "Ich bin dabei", the privacy line. Röst-Tag and Herbst have no sign-up block. No console errors.
2. Tap "Ich bin dabei", submit empty: browser blocks (required). Submit `<b>Anna & Co</b>`: shows "Du bist dabei, <b>Anna & Co</b>." as plain text; `places_left` for the Cupping is now 11 (`execute_sql` or `get_promotions`).
3. Reload: still "Du bist dabei". Clear `localStorage` in the console, reload: button is back (sign-up stays in the database).
4. Full event: `execute_sql` `update public.promotions set capacity = 1 where title = 'Cupping in der Rösterei';` (Anna's sign-up fills it). Reload: "Ausgebucht", no button. Restore with `capacity = 12` and `delete from public.signups where name = '<b>Anna & Co</b>';`.
5. Offline with a saved copy: in the console run
   `const f = window.fetch; window.fetch = (u, o) => String(u).includes('supabase.co') ? Promise.reject(new TypeError('offline')) : f(u, o); document.dispatchEvent(new Event('visibilitychange'));`
   The three promotions stay on screen (read from `localStorage`). Reload to undo.
6. Supabase unreachable on first open (no saved copy, nothing in memory): cannot be forced in the preview without editing code. Check by reading `loadPromos`: fetch fails, saved copy is null, `promos` is empty, so the "keine Verbindung" hint shows; coffees load in the other branch of `Promise.all`. Note this in the ledger.
7. `node test.mjs` passes.

- [ ] **Step 7: Commit**

```bash
git add app.js index.html datenschutz.html sw.js
git commit -m "Load promotions from Supabase and add event sign-up"
```

---

### Task 4: Docs, reviews, publish

**Files:**
- Modify: `CLAUDE.md`
- Modify: `.claude/agents/texter.md`, `.claude/agents/datenschutz.md`, `.claude/agents/kundin.md` (replace `Aktionen.md` references with the database)

- [ ] **Step 1: Update `CLAUDE.md`**

Replace the sections "Where the data lives" and the `Aktionen.md` format with a section "Promotions and sign-ups (Supabase)":

```markdown
## Promotions and sign-ups (Supabase)

- Supabase project `kranich-kaffee`, Frankfurt. Reach it through the Supabase MCP / connector.
- `public.promotions`: title, text, code, valid_until, event_date, start_time, end_time,
  place, signups_open, capacity, sort. New or changed rows are live on the next app open,
  no push needed. Ended entries hide themselves the day after their date.
- `public.signups`: promotion_id, name, created_at. Deleted automatically 14 days after
  the event (pg_cron job `delete-old-signups`).
- "Wer kommt zum Cupping?": `select s.name, s.created_at from public.signups s join
  public.promotions p on p.id = s.promotion_id where p.title ilike '%cupping%' order by s.created_at;`
- Security: visitors only have `execute` on `get_promotions()` and `sign_up()`. NEVER grant
  table access to `anon`/`authenticated`, never add RLS policies for them, never expose names.
  After any schema change: run `get_advisors` (security) and `node test-db.mjs` (see its header).
- `config.js` holds the public URL and publishable key. Never put the secret/service key in this repo.
- Coffees still come from `Sortiment.md`.
```

Update the file table (`config.js`, `datenschutz.html`, `test-db.mjs`, `supabase/migrations/`), remove `Aktionen.md`, and change "no database, no logins" to "no logins; data in Supabase".

- [ ] **Step 2: Update the three agent files** to point at the database (texter: read promotions with `get_promotions` via the Supabase connector or ask the main session for them; datenschutz: also check `datenschutz.html`, `config.js`, Supabase region and retention; kundin: promotions come from the database, sign-up flow in `app.js`).

- [ ] **Step 3: Run the reviews in parallel**: `datenschutz`, `texter`, `kundin`. Fix every finding that is about this change; list the rest for the owner.

- [ ] **Step 4: Run both tests**

Run: `node test.mjs` → `OK: alle Tests bestanden`. Re-run the Task 1 Steps 7 to 9 cycle with `node test-db.mjs` → `OK: Datenbank-Regeln halten`, test rows deleted.

- [ ] **Step 5: Commit and push, then verify live**

```bash
git add -A
git commit -m "Document Supabase workflow and update review agents"
git push
```

Wait until https://kranich-kaffee-app.netlify.app/config.js returns 200, then open the live site: promotions from the database, sign-up block on the Cupping, no console errors. This also proves the Netlify auto-deploy on push.
