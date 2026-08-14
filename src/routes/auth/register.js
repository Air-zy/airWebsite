const { register } = require('../../modules/account/accountsManager.js');
const { setAuthCookie } = require('../middleware/auth.js');

const TAKEN = ['username-taken', 'email-taken'];
const BAD = ['username-invalid', 'email-invalid', 'password-too-short', 'password-too-long', 'password-required'];

module.exports = async (req, res) => {
    const { name, email, password } = req.body || {};

    if (!name || !email || !password) {
        return res.status(400).json({ error: 'missing-fields' });
    }

    try {
        const acc = await register(name, email, password);

        // registering logs you in, no reason to make them type it again
        setAuthCookie(req, res, acc.uid);
        return res.json({ uid: acc.uid, name: acc.name, createdAt: acc.createdAt });
    } catch (err) {
        if (TAKEN.includes(err.message)) return res.status(409).json({ error: err.message });
        if (BAD.includes(err.message)) return res.status(400).json({ error: err.message });

        console.error(err);
        return res.status(500).json({ error: 'server-error' });
    }
}
