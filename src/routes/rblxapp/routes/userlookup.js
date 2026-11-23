const { idtoname } = require('../rblxutils')

module.exports = async (req, res) => {
    const { userId } = req.params;
    if (!/^\d+$/.test(userId)) return res.status(400).json({ error: 'bad user id' });
    try {
        const data = await idtoname(userId)
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch from Roblox API' });
    }
};