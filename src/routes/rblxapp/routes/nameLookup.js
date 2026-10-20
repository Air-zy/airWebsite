// username -> id for the /posing avatar picker, same roproxy as the id -> name batch
module.exports = async (req, res) => {
  const name = req.params.name;
  if (!/^\w{3,20}$/.test(name)) return res.status(400).json({ error: 'bad username' });
  try {
    const r = await fetch('https://users.roproxy.com/v1/usernames/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: [name], excludeBannedUsers: false }),
      signal: AbortSignal.timeout(8000)
    });
    if (!r.ok) throw new Error('usernames ' + r.status);
    const user = (await r.json()).data?.[0];
    if (!user) return res.status(404).json({ error: 'no such user' });
    res.json({ id: user.id, name: user.name });
  } catch (err) {
    console.error('[name lookup]', err.message);
    res.status(502).json({ error: 'lookup failed' });
  }
};
