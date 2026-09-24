// Reads the simple Markdown format of Aktionen.md and Sortiment.md.
// Format: "## Title", then "- Key: value" lines (keys are case-insensitive).
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

export function parseWhen(value = '') {
  const d = value.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!d) return null;
  // Times look like "11:00" or "11.00"; the date is removed first so it is not read as a time.
  const times = [...value.replace(d[0], '').matchAll(/(\d{1,2})[:.](\d{2})(?!\d)/g)].map(m => m[1].padStart(2, '0') + m[2]);
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
      text: f['text'] || body,
      code: f['rabattcode'] || null,
      until: parseWhen(f['gilt bis']),
      when: parseWhen(f['datum']),
      place: f['ort'] || null,
      email: (f['anmeldung'] || '').match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/)?.[0] || null,
    }))
    .filter(p => {
      const end = p.until || p.when;
      return !end || end.date >= today; // visible through the whole last day
    });
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
