const { idtoname } = require('../rblxutils')

module.exports = async (req, res) => {
    const { userId } = req.params;
    try {
        const data = idtoname(userId)
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch from Roblox API' });
    }
};