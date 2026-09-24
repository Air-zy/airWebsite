// the guestbook on the home page. anyone can read it, posting takes an account so every note has an owner.
// notes are public the moment they post. writers can delete their own, ADMIN_UID pins and deletes any from the page itself
const router = require('express').Router();
const { sql } = require('../../DATABASE/utilDB.js');
const { limiter } = require('../middleware/ratelimit.js');
const { ADMIN_UID, requireAuth, requireAdmin } = require('../middleware/auth.js');
const { getAccountByUID, getNames } = require('../../modules/account/accountsManager.js');

// per account, a shared school or office ip should not share one budget
const postLimiter = limiter({ windowMs: 10 * 60 * 1000, max: 3, keyGenerator: req => String(req.user.uid) });

// returns the text to save, or { error } with a reason the page shows as is
function clean(body) {
  const text = body?.text ?? '';
  if (typeof text !== 'string') return { error: 'bad note' };
  // only blank lines come off the front, the first line's indent is part of ascii art.
  // blank lines squeeze to one, and zalgo keeps 3 marks per letter so it cannot spill onto other notes
  const t = text.replace(/^\s*\n/, '').trimEnd().replace(/\n{3,}/g, '\n\n').replace(/(\p{M}{3})\p{M}+/gu, '$1');
  if (!t) return { error: 'write something first' };
  if (t.length > 1000) return { error: 'keep it under 1000 characters' };
  // a line limit, not just a length one, or 500 one letter lines make a note taller than the wall
  if (t.split('\n').length > 24) return { error: 'keep it to 24 lines' };
  return { text: t };
}

router.get('/', async (req, res) => {
  const uid = req.user?.uid ?? null;
  // pinned first with the latest pin on top, then newest. mine lets the page mark your own notes without handing out uids
  const rows = await sql`
    SELECT id, uid, text, uid = ${uid} AS mine, pinned_at IS NOT NULL AS pinned
    FROM notes ORDER BY pinned_at DESC NULLS LAST, id DESC LIMIT 50`;

  // names are looked up so a rename shows on old notes. uid stays on the server
  const names = await getNames(rows.map(r => r.uid));
  const notes = rows.map(({ uid, ...n }, i) => ({ ...n, name: names[i] ?? 'deleted' }));
  res.json({ notes, admin: uid === ADMIN_UID });
});

router.post('/', requireAuth, postLimiter, async (req, res) => {
  const note = clean(req.body);
  if (note.error) return res.status(400).json(note);

  const acc = await getAccountByUID(req.user.uid);
  if (!acc) return res.status(401).json({ error: 'not-authenticated' }); // account deleted since the cookie was made

  const [row] = await sql`
    INSERT INTO notes (uid, text) VALUES (${acc.uid}, ${note.text})
    RETURNING id, text, true AS mine, false AS pinned`;
  res.json({ note: { ...row, name: acc.name } });
});

// flips the pin. pinning is also how the owner sorts, whatever got pinned last sits on top
router.post('/:id/pin', requireAdmin, async (req, res) => {
  const [row] = await sql`
    UPDATE notes SET pinned_at = CASE WHEN pinned_at IS NULL THEN now() END
    WHERE id = ${Number(req.params.id)} RETURNING pinned_at IS NOT NULL AS pinned`;
  if (!row) return res.status(404).json({ error: 'no such note' });
  res.json({ pinned: row.pinned });
});

// your own note, or any note if you are ADMIN_UID
router.delete('/:id', requireAuth, async (req, res) => {
  const { uid } = req.user;
  const [row] = await sql`
    DELETE FROM notes WHERE id = ${Number(req.params.id)} AND (uid = ${uid} OR ${uid === ADMIN_UID})
    RETURNING id`;
  if (!row) return res.status(404).json({ error: 'no such note' });
  res.json({ ok: true });
});

module.exports = router;

// node --env-file=.env src/routes/api/notes.js
if (require.main === module) {
  const a = require('assert');
  a.deepStrictEqual(clean({ text: ' hi ' }), { text: ' hi' });
  a.strictEqual(clean({ text: '\n  \n   /\\\n  /  \\\n' }).text, '   /\\\n  /  \\', 'art keeps its first indent');
  a.strictEqual(clean({ text: 'a\n'.repeat(24) }).text.split('\n').length, 24);
  a.strictEqual(clean({ text: 'a\n'.repeat(25) }).error, 'keep it to 24 lines');
  a.strictEqual(clean({ text: 'z' + '́'.repeat(40) }).text, 'ź́́', 'zalgo capped');
  a.strictEqual(clean({ text: '1️⃣ ệ' }).text, '1️⃣ ệ', 'keycaps and stacked accents untouched');
  a.strictEqual(clean({ text: '   ' }).error, 'write something first');
  a.strictEqual(clean({}).error, 'write something first');
  a.strictEqual(clean(undefined).error, 'write something first');
  a.strictEqual(clean({ text: 'x'.repeat(1001) }).error, 'keep it under 1000 characters');
  a.ok(!clean({ text: 'x'.repeat(1000) }).error);
  a.strictEqual(clean({ text: ['hi'] }).error, 'bad note');
  a.strictEqual(clean({ text: { $ne: 1 } }).error, 'bad note');
  a.strictEqual(clean({ text: 'a\n\n\n\n\nb' }).text, 'a\n\nb');
  console.log('notes ok');
}
