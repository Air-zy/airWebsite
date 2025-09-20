module.exports = async (req, res) => {
    const { placeId, jobId } = req.query;
    if (!placeId || !jobId) {
        return res.status(400).send("Missing placeId or jobId");
    }
    const robloxUrl = `roblox://experiences/start?placeId=${placeId}&gameInstanceId=${jobId}`;
    res.redirect(robloxUrl);
};
