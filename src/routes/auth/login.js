const { login } = require('../../modules/account/accountsManager.js');

module.exports = async (req, res) => {
  const { identifier, password } = req.body;

    if (!identifier || !password)
        return res.status(400).json({ error: 'identifier and password required' });

    try {
        const acc = await login(identifier, password);
        if (!acc) return res.status(401).json({ error: 'invalid-credentials' });

        console.log("login name:", acc.name, "session:", acc.currentSession.id)
        res.cookie('airzy_session', acc.currentSession.token, {
            httpOnly: true,  // JS cannot access it
            secure: true,    // Set true if using HTTPS
            sameSite: 'Lax', // Helps prevent CSRF
            maxAge: 24 * 60 * 60 * 1000 // 1 day
        });

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