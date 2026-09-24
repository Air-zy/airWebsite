const { register, INPUT_ERRORS } = require('../../modules/account/accountsManager.js');
const { setAuthCookie } = require('../middleware/auth.js');

module.exports = async (req, res) => {
    const { name, password } = req.body || {};

    if (!name || !password) {
        return res.status(400).json({ error: 'missing-fields' });
    }

    try {
        const acc = await register(name, password);

        // registering logs you in, no reason to make them type it again
        setAuthCookie(req, res, acc.uid);
        return res.json({ uid: acc.uid, name: acc.name, createdAt: acc.createdAt });
    } catch (err) {
        if (err.message === 'username-taken') return res.status(409).json({ error: err.message });
        if (INPUT_ERRORS.includes(err.message)) return res.status(400).json({ error: err.message });

        console.error(err);
        return res.status(500).json({ error: 'server-error' });
    }
}
