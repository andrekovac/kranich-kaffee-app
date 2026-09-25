# Promotions from Supabase and event sign-ups: design

Date: 25.09.2026. Agreed in chat. Supersedes the "no database" and "`Aktionen.md` is
the only source" parts of `2026-09-24-kranich-app-design.md`; everything else there
still applies.

## Goal

Promotions and events come from a Supabase database instead of `Aktionen.md`.
Visitors can tap "Ich bin dabei" on an event and give their name. The owner sees who
signed up by asking Claude. Visitors never log in.

## Decisions

| Question | Decision |
|---|---|
| Hosting of data | New Supabase project `kranich-kaffee`, region Frankfurt (`eu-central-1`), free plan |
| What a visitor gives | Name only (1 to 60 characters) |
| How the owner sees sign-ups | Asks Claude (Supabase connection); Supabase dashboard as backup |
| Full events | Show places left; database refuses sign-ups beyond capacity |
| Coffees | Stay in `Sortiment.md` (unchanged) |
| "Per Mail anmelden" | Replaced by "Ich bin dabei" on events with sign-ups open |
| Retention | Sign-ups deleted automatically 14 days after the event |
| Client | Plain `fetch` to Supabase's REST API. No supabase-js, no Netlify function |

Out of scope: owner page or any login, email addresses, waiting list, captcha,
cancelling a sign-up by the visitor (the owner can delete via Claude).

## Database

Schema `public`, both tables with Row Level Security ON and **no policies for
`anon` / `authenticated`**, and table privileges revoked from `anon` and
`authenticated`. Visitors reach data only through the two functions below.

### `promotions`

| Column | Type | Notes |
|---|---|---|
| `id` | `bigint` identity PK | |
| `title` | `text not null` | |
| `text` | `text` | |
| `code` | `text` | discount code, adds "Kopieren" |
| `valid_until` | `date` | hidden the day after |
| `event_date` | `date` | adds "In den Kalender", hidden the day after |
| `start_time`, `end_time` | `time` | optional |
| `place` | `text` | goes into the calendar entry |
| `signups_open` | `boolean not null default false` | shows "Ich bin dabei" (needs `event_date`) |
| `capacity` | `int check (capacity > 0)` | null = no limit |
| `sort` | `int not null default 0` | ascending, then `id` |
| `created_at` | `timestamptz default now()` | |

### `signups`

| Column | Type | Notes |
|---|---|---|
| `id` | `bigint` identity PK | |
| `promotion_id` | `bigint not null references promotions on delete cascade` | |
| `name` | `text not null check (char_length(btrim(name)) between 1 and 60)` | |
| `created_at` | `timestamptz default now()` | |

### Functions (the only public entry points)

"Today" is always `(now() at time zone 'Europe/Berlin')::date`.

- `get_promotions()` returns the visible promotions, each with `places_left`
  (`capacity - count(signups)`, or null when there is no capacity). Visible means:
  `coalesce(valid_until, event_date)` is null or on/after today. Ordered by `sort`,
  `id`. Never returns names. `security definer`, `set search_path = ''`, `stable`.
  `execute` granted to `anon`.
- `sign_up(p_promotion_id bigint, p_name text)` returns `places_left` after the
  insert. In one transaction:
  1. Lock the promotion row (`for update`).
  2. Refuse with a clear error if: not found, `signups_open` is false,
     `event_date` is null or before today, the trimmed name is not 1 to 60
     characters, or the event is full.
  3. Insert the trimmed name.

  Error codes are stable strings the app can map: `not_found`, `closed`, `past`,
  `bad_name`, `full`. `security definer`, `set search_path = ''`. `execute`
  granted to `anon`.

Default `execute` on functions for `public` is revoked, so only these two are
callable by visitors.

### Retention

A daily `pg_cron` job deletes sign-ups whose event date is more than 14 days ago.

### Seed

The 3 current entries from `Aktionen.md` are inserted. The Cupping gets
`signups_open = true`, `capacity = 12`. The Röst-Tag has no sign-ups.
`Aktionen.md` is then deleted from the repo.

## App

- New `config.js`: Supabase URL and publishable key (public by design).
- `app.js` loads promotions with `POST /rest/v1/rpc/get_promotions` and coffees from
  `Sortiment.md` as before. Promotions are fetched on every open and when the app
  comes back from the background, as before.
- Mapping from database rows to the existing promotion shape happens in a small
  pure function in `parse.js`, so labels, expiry display and calendar files keep
  working unchanged.
- Offline: the last successful promotions response is saved in `localStorage` and
  shown when the network fails. If there is none, the existing "keine Verbindung"
  hint shows.
- Event with `signups_open`:
  - label line: "Noch N Plätze frei" (or nothing when there is no capacity),
  - button "Ich bin dabei" opens an inline field "Wie heißt du?" and "Anmelden",
  - success: "Du bist dabei, <Name>." The event id and name are remembered in
    `localStorage`, so later opens show "Du bist dabei" instead of the button,
  - `places_left = 0`: button replaced by "Ausgebucht",
  - errors map to short German texts: full "Leider schon ausgebucht.", past or
    closed "Anmeldung ist geschlossen.", bad name "Bitte gib einen Namen an (höchstens
    60 Zeichen).", network "Gerade keine Verbindung. Versuch es gleich noch mal.",
  - one line under the button: "Wir speichern nur deinen Namen für diesen Termin und
    löschen ihn 14 Tage danach."
- Footer gets a link "Datenschutz" to a new `datenschutz.html`: who is responsible
  (Kranich Kaffee, address), what is stored (name per event), why, where (Supabase,
  Frankfurt; hosting at Netlify), how long (14 days after the event), and how to
  get it deleted (email hallo@kranich-kaffee.example).
- The service worker stays network-first. Supabase requests are cross-origin POSTs
  and are not touched by it.
- All user-visible text follows the Kranich styleguide. No em dashes.

## Owner workflow (through Claude)

- New or changed promotion: Claude inserts or updates a row in `promotions`. It is live
  on the next app open, with no push.
- "Wer kommt zum Cupping?": Claude lists the names from `signups`.
- Removing a fake sign-up: Claude deletes the row.
- CLAUDE.md is updated to describe this instead of `Aktionen.md`.

## Known limits

- Anyone can add fake names until an event is full. Accepted for a small shop; the
  owner deletes them via Claude.
- "Du bist dabei" is remembered per phone only. Clearing browser data forgets it
  (the sign-up stays in the database).

## Testing

1. `node test.mjs`: existing coffee tests, plus the row mapping, the "places left"
   label, and the error-code-to-text mapping.
2. Live database checks with the publishable key only (as a visitor would):
   - direct `select` on `signups` and `promotions` is refused,
   - `get_promotions()` returns the 3 entries and no names,
   - sign-up works and `places_left` goes down,
   - sign-up number 13 on a 12-place event is refused with `full`,
   - sign-up for a past event is refused with `past`,
   - a 61-character or empty name is refused with `bad_name`.
   Test sign-ups are deleted afterwards.
3. Browser check on the local preview: sign up, see "Du bist dabei", reload, still
   shown; full event shows "Ausgebucht"; offline shows the saved promotions.
4. `datenschutz` and `texter` sub-agents run on the finished change.
