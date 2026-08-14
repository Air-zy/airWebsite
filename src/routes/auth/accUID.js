const { getAccountByUID } = require('../../modules/account/accountsManager.js');

// public endpoint, anyone can look up any uid.
// keep picking fields by hand here, never spread the account. it carries email and passwordHash.
module.exports = async (req, res) => {
    try {
        const acc = await getAccountByUID(req.params.uid);
        if (!acc) return res.status(404).json({ error: 'not-found' });

        return res.json({
            uid: acc.uid,
            name: acc.name,
            createdAt: acc.createdAt
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'server-error' });
    }
}