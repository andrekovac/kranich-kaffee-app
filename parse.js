// Pure logic of the app: reading Sortiment.md, turning database rows into
// promotions, labels, calendar files and remembered sign-ups. Tested by test.mjs.
// Sortiment.md format: "## Title", then "- Key: value" lines (keys are case-insensitive).
// Following non-empty lines continue the value; a blank line ends it.

export function parseSections(md) {
  const sections = [];
  let cur = null;
  let lastKey = null;
  for (const line of md.replace(/\r\n/g, '\n').split('\n')) {
    const heading = line.match(/^## (.+)/);
    if (heading) {
      cur = { title: heading[1].trim(), fields: {}, body: '' };
      sections.push(cur);
      lastKey = null;
      continue;
    }
    if (!cur) continue;
    const field = line.match(/^[-*] ([^:]+):\s*(.*)$/);
    if (field) {
      lastKey = field[1].trim().toLowerCase();
      cur.fields[lastKey] = field[2].trim();
    } else if (lastKey && line.trim()) {
      cur.fields[lastKey] += ' ' + line.trim();
    } else {
      lastKey = null;
      if (line.trim()) cur.body += (cur.body ? ' ' : '') + line.trim();
    }
  }
  return sections;
}

export function dateKey(d) {
  return String(d.getFullYear()) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
}

export function parseCoffees(md) {
  // Everything after a "---" line (the English note) is not a coffee.
  return parseSections(md.split(/^---\s*$/m)[0])
    .filter(s => s.fields['preis'])
    .map(({ title, fields: f, body }) => ({
      name: title,
      kind: f['art'] || '',
      origin: f['herkunft'] || '',
      roasted: f['röstdatum'] || '',
      price: f['preis'],
      text: body,
    }));
}

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

export function isoWeek(now = new Date()) {
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7; // Montag = 0
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // Donnerstag der Woche
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  return 1 + Math.round((d - firstThursday) / (7 * 24 * 3600 * 1000));
}

// Meteorologische Jahreszeit nach Monat: Winter -> Schnee, Sommer -> Sonne, dazwischen -> Regen.
export function seasonIcon(now = new Date()) {
  const month = now.getMonth() + 1;
  if (month === 12 || month <= 2) return '❄️';
  if (month >= 6 && month <= 8) return '☀️';
  return '🌧️';
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
