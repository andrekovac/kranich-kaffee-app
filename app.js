import { parseCoffees, label, toICS, isoWeek, seasonIcon, fromRow, isVisible, placesLabel, signupError, loadJoined, saveJoined } from './parse.js';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const promosEl = document.getElementById('promos');
const coffeesEl = document.getElementById('coffees');
const kwEl = document.getElementById('kw');
const store = (() => { try { return localStorage; } catch { return null; } })();
const SAVED_KEY = 'kranich-promos';
let promos = [];
let joined = loadJoined(store);

kwEl.textContent = `Woche ${isoWeek()} ${seasonIcon()}`;

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

promosEl.addEventListener('click', async e => {
  const btn = e.target.closest('button');
  if (!btn) return;
  if (btn.dataset.join) {
    const form = promosEl.querySelector(`[data-form="${btn.dataset.join}"]`);
    btn.hidden = true;
    form.hidden = false;
    form.elements.name.focus();
    return;
  }
  if (btn.dataset.copy) {
    let copied = await navigator.clipboard?.writeText(promos[btn.dataset.copy].code).then(() => true, () => false);
    if (!copied) {
      // Older in-app browsers: select the code on screen and copy the selection.
      getSelection().selectAllChildren(btn.previousElementSibling);
      copied = document.execCommand('copy');
    }
    if (copied) {
      btn.textContent = 'Kopiert';
      setTimeout(() => { btn.textContent = 'Kopieren'; }, 2000);
    }
  }
  if (btn.dataset.cal) {
    const ics = toICS(promos[btn.dataset.cal]);
    // ponytail: iPhone shows "Add to calendar" for a data: URL, others get a named .ics file; verify on real phones in step 8.
    if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
      location.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
      a.download = 'kranich-termin.ics';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
  }
});

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

load();

// Reload content when the app comes back from the background.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') load();
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
}
