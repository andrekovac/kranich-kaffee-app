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
