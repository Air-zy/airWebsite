/* status.test.js - node src/modules/myStatus/status.test.js
   Rolling window in myStatus.js, forecast smoothing, and the grid maths in
   presence.html. The page functions are pulled from source so they cannot drift.
   myStatus.js is not required, it needs firebase. */

const fs = require('fs'), assert = require('assert');
const MultiYearStatusLog = require('./MultiYearStatusLog.js');
const { analyze } = require('./forecastStatus.js');

/* lift one function out of a file by brace matching, same as ugi/rec.test.js */
function grab(file, name) {
  const s = fs.readFileSync(file, 'utf8');
  let i = s.indexOf('function ' + name + '(');
  if (s.slice(i - 6, i) === 'async ') i -= 6;
  let d = 0;
  for (let k = s.indexOf('{', i); k < s.length; k++) {
    if (s[k] === '{') d++;
    if (s[k] === '}' && !--d) return s.slice(i, k + 1);
  }
}

const page = __dirname + '/../../public/presence.html';
eval(grab(__dirname + '/myStatus.js', 'getRollingStatus'));
eval(grab(page, 'decodeBits'));
eval(grab(page, 'dayKey'));
eval(grab(page, 'toDays'));
eval(grab(page, 'toWeek'));
eval(grab(page, 'level'));
eval(grab(page, 'scale'));

const HOUR = 3600000;
const now = new Date();
const currentHour = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours());

/* ---- the rolling window and the day rows the board draws from it ---- */

const log = new MultiYearStatusLog();
log.set(new Date(currentHour), true);                  // right now
log.set(new Date(currentHour - 5 * HOUR), true);       // five hours back
log.set(new Date(currentHour - 29 * 24 * HOUR), true);  // a month back, outside the week
log.set(new Date(currentHour - 364 * 24 * HOUR), true); // oldest hour a 365 day window holds

const getStatusLog = async () => log;

(async () => {
  for (const days of [7, 365]) {
    const payload = await getRollingStatus(days);
    const start = new Date(payload.startDate).getTime();

    assert.strictEqual(payload.totalHours, days * 24, 'window is days * 24 hours');
    assert.strictEqual(start + (payload.totalHours - 1) * HOUR, currentHour,
      'window ends on the current hour, never in the future');

    const bits = decodeBits(payload.data, payload.totalHours);
    assert.strictEqual(bits[payload.totalHours - 1], 1, 'the current hour is the last bit');
    assert.strictEqual(bits[payload.totalHours - 6], 1, 'five hours back is still set');

    /* hours outside the window must be null (a hole), not 0 (offline) */
    const rows = toDays(payload);
    const known = rows.reduce((n, r) => n + r.hours.filter(v => v !== null).length, 0);

    /* a fall back day holds 25 hours in a 24 cell row, so a year loses a slot to dst.
       what must never happen is an online hour going missing behind the collision */
    assert(known >= payload.totalHours - 2, 'window hours land in rows, give or take a dst slot');

    const byDay = new Map(rows.map(r => [dayKey(r.date), r]));
    for (let i = 0; i < payload.totalHours; i++) {
      if (!bits[i]) continue;
      const d = new Date(start + i * HOUR);
      assert.strictEqual(byDay.get(dayKey(d)).hours[d.getHours()], 1, 'an online hour is never hidden');
    }

    const last = rows[rows.length - 1];
    assert.strictEqual(last.hours[now.getHours()], 1, 'the current local hour is online');
    for (let h = now.getHours() + 1; h < 24; h++) {
      assert.strictEqual(last.hours[h], null, 'hours after now are holes, not offline');
    }

    const lit = rows.reduce((n, r) => n + r.hours.filter(v => v === 1).length, 0);
    assert.strictEqual(lit, days === 365 ? 4 : 2, 'the year window reaches hours the week one does not');
  }

  /* ---- green steps ---- */

  assert.strictEqual(level(0, 24), 0, 'no online hours leaves the cell empty');
  assert.strictEqual(level(1, 24), 1, 'a single hour still shows');
  assert.strictEqual(level(6, 24), 1);
  assert.strictEqual(level(7, 24), 2);
  assert.strictEqual(level(24, 24), 4, 'a full day is the top step');
  assert.strictEqual(level(0.5, 1), 2, 'probabilities use the same scale');

  /* ---- the year board scales to its own spread ---- */

  const hours = [0, 0, 8, 9, 10, 11, 12];
  const step = scale(hours);

  assert.strictEqual(step(0), 0, 'a day with nothing stays empty');
  assert.strictEqual(step(8), 1, 'the quietest active day is the lowest step');
  assert.strictEqual(step(12), 4, 'the busiest is the top step');
  assert.deepStrictEqual([...new Set(hours.map(step))].sort(), [0, 1, 2, 3, 4],
    'a steady 8 to 12 hour habit still uses every green, a fixed 0 to 24 scale would not');
  assert.strictEqual(scale([0, 0, 0])(0), 0, 'an empty history does not divide by nothing');

  /* ---- forecast smoothing ----
     one online hour 24h back means that hour of day was seen twice and was online
     once, so its marginal is 0.5. the weekday cell behind it has a single sample
     and must not come back as a hard 1 or 0 */

  const seen = new Date(currentHour - 24 * HOUR);
  const thin = new MultiYearStatusLog();
  thin.set(seen, true);

  const a = analyze(thin);
  const H = seen.getUTCHours();
  const onDay = seen.getUTCDay();
  const offDay = new Date(currentHour).getUTCDay();

  assert.strictEqual(a.byHourOfDay[H], 0.5, 'that hour of day was online half the times it was seen');

  const hot = a.byDayOfWeek[onDay].byHourOfDay[H];
  const cold = a.byDayOfWeek[offDay].byHourOfDay[H];
  assert(hot > 0.5 && hot < 1, 'a 1 of 1 weekday cell is pulled down off certainty, got ' + hot);
  assert(cold > 0 && cold < 0.5, 'a 0 of 1 weekday cell is pulled up off zero, got ' + cold);

  const empty = [0, 1, 2, 3, 4, 5, 6].find(d => d !== onDay && d !== offDay);
  assert.strictEqual(a.byDayOfWeek[empty].byHourOfDay[H], a.byHourOfDay[H],
    'a weekday with no samples falls back to the hour of day marginal');

  /* ---- utc table drawn on a local board ---- */

  const table = { byDayOfWeek: {} };
  for (let d = 0; d < 7; d++) {
    table.byDayOfWeek[d] = { byHourOfDay: {} };
    for (let h = 0; h < 24; h++) table.byDayOfWeek[d].byHourOfDay[h] = 0;
  }
  table.byDayOfWeek[3].byHourOfDay[14] = 1; // wednesday 2pm utc

  const week = toWeek(table);
  assert.strictEqual(week.length, 7, 'seven weekday rows');
  assert(week.every(r => r.length === 24), 'twenty four hours each');

  // walk real instants across this week, find the one that is wednesday 2pm utc,
  // and check the board lights up at that instant's local weekday and hour
  const sunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  let checked = false;

  for (let i = 0; i < 7 * 24; i++) {
    const t = new Date(sunday.getTime() + i * HOUR);
    if (t.getUTCDay() !== 3 || t.getUTCHours() !== 14) continue;
    assert.strictEqual(week[t.getDay()][t.getHours()], 1, 'the hot utc slot shows at its local time');
    checked = true;
  }

  assert(checked, 'the week contains a wednesday 2pm utc');
  assert.strictEqual(week.flat().filter(p => p === 1).length, 1, 'and nothing else lights up');

  console.log('ok');
})();
