const { register } = require('../../modules/account/accountsManager.js');

module.exports = async (req, res) => {
    const { name, password } = req.body;

    if (!name || !password)
        return res.status(400).json({ error: 'name and password required' });
    try {
        const acc = await register(name, password);
        return res.json({
            uid: acc.uid,
            name: acc.name,
            createdAt: acc.createdAt
        });
    } catch (err) {
        // todo
        if (err.message === 'username-taken') {
            return res.status(409).json({ error: 'username-taken' });
        } else if (err.message === 'username-length') {
            return res.status(409).json({ error: 'username-length' });
        } else if (err.message === 'password-too-short') {
            return res.status(409).json({ error: 'password-too-short' });
        } else if (err.message === 'username-invalid') {
            return res.status(409).json({ error: 'username-invalid' });
        }

        console.error(err);
        return res.status(500).json({ error: 'server-error' });
    }
}