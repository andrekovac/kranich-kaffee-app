// Run with: node test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseSections, parseCoffees, label, toICS, isoWeek, seasonIcon, fromRow, isVisible, placesLabel, signupError, loadJoined, saveJoined } from './parse.js';

const sortiment = readFileSync(new URL('./Sortiment.md', import.meta.url), 'utf8');
const day = (y, m, d) => new Date(y, m - 1, d, 12);

// Coffees
const coffees = parseCoffees(sortiment);
assert.deepEqual(coffees.map(c => c.name), ['Kranich Espresso', 'Hanse Filter', 'Sidamo Äthiopien']);
assert.equal(coffees[0].roasted, '22.09.2026');
assert.equal(coffees[0].price, '9,90 € / 250 g');
assert.match(coffees[2].text, /blumig/);
assert.equal(parseCoffees(sortiment.replace(/\n/g, '\r\n')).length, 3);

// Markdown reader: wrapped lines, lowercase keys, "*" bullets
const [loose] = parseSections('## A\n\n* Preis: 1 €\n- Text: erste Zeile\nzweite Zeile\n');
assert.equal(loose.fields['preis'], '1 €');
assert.equal(loose.fields['text'], 'erste Zeile zweite Zeile');

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
assert.match(toICS(roest), /\r\nDTEND;VALUE=DATE:20261002\r\n/);

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

// Calendar week and season
assert.equal(isoWeek(day(2026, 9, 24)), 39);
assert.equal(isoWeek(day(2026, 1, 1)), 1);
assert.equal(isoWeek(day(2026, 12, 31)), 53);
assert.equal(seasonIcon(day(2026, 1, 15)), '❄️');
assert.equal(seasonIcon(day(2026, 7, 15)), '☀️');
assert.equal(seasonIcon(day(2026, 9, 24)), '🌧️');

console.log('OK: alle Tests bestanden');
