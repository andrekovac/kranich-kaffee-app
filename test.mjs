// Run with: node test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parsePromotions, parseCoffees, label, toICS, isoWeek, seasonIcon } from './parse.js';

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

// A "---" between promotions must not drop the entries after it
const withRule = parsePromotions('## A\n\n- Text: eins\n\n---\n\n## B\n\n- Text: zwei\n', day(2026, 9, 24));
assert.deepEqual(withRule.map(p => p.title), ['A', 'B']);

// A wrapped line without indent still belongs to the field above
const wrapped = parsePromotions('## A\n\n- Text: erste Zeile\nzweite Zeile\n', day(2026, 9, 24));
assert.equal(wrapped[0].text, 'erste Zeile zweite Zeile');

// Lowercase keys and "*" bullets are read the same
const loose = parsePromotions('## A\n\n* gilt bis: 01.10.2026\n* rabattcode: X1\n', day(2026, 10, 2));
assert.equal(loose.length, 0);

// German-style times with a dot ("11.00 Uhr")
const dotted = parsePromotions('## A\n\n- Datum: Sa, 03.10.2026, 11.00 bis 12.30 Uhr\n', day(2026, 9, 24));
assert.deepEqual(dotted[0].when, { date: '20261003', start: '1100', end: '1230' });

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

// Kalenderwoche und Jahreszeiten-Icon
assert.equal(isoWeek(day(2026, 9, 24)), 39);
assert.equal(isoWeek(day(2026, 1, 1)), 1);
assert.equal(isoWeek(day(2026, 12, 31)), 53);
assert.equal(seasonIcon(day(2026, 1, 15)), '❄️');
assert.equal(seasonIcon(day(2026, 7, 15)), '☀️');
assert.equal(seasonIcon(day(2026, 9, 24)), '🌧️');

console.log('OK: alle Tests bestanden');
