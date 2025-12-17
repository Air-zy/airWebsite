const { login } = require('../../modules/account/accountsManager.js');

module.exports = async (req, res) => {
  const { identifier, password } = req.body;

    if (!identifier || !password)
        return res.status(400).json({ error: 'identifier and password required' });

    try {
        const acc = await login(identifier, password);
        if (!acc) return res.status(401).json({ error: 'invalid-credentials' });

        return res.json({
            ok: true,
            uid: acc.uid,
            name: acc.name,
            sesh: acc.currentSession.onlyPublic()
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'server-error' });
    }
};