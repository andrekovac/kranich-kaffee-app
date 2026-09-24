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

load();

// Reload content when the app comes back from the background.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') load();
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
}
