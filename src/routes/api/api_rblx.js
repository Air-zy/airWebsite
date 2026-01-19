async function serverExists(placeId, jobId) {
    let cursor = null;

    do {
        const url = new URL(
            `https://games.roblox.com/v1/games/${placeId}/servers/Public`
        );
        url.searchParams.set("limit", "100");
        if (cursor) url.searchParams.set("cursor", cursor);

        const res = await fetch(url);
        if (!res.ok) throw new Error("Roblox API error");

        const data = await res.json();

        if (data.data.some(server => server.id === jobId)) {
            return true;
        }

        cursor = data.nextPageCursor;
    } while (cursor);

    return false;
}

module.exports = async (req, res) => {
    const { placeId, jobId } = req.query;

    if (!placeId || !jobId) {
        return res.status(400).send("Missing placeId or jobId");
    }

    const robloxUrl = `roblox://experiences/start?placeId=${placeId}&gameInstanceId=${jobId}`;
    try {
        const alive = await serverExists(placeId, jobId);

        if (!alive) {
            return res.status(404).send("Server no longer exists");
        }

        return res.redirect(302, robloxUrl);
    } catch (err) {
        //console.error(err);
        //return res.status(502).send("Failed to verify server");
        return res.redirect(302, robloxUrl);
    }
};