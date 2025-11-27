module.exports = async (req, res) => {
    try {
        const response = await fetch(
            "https://deepwoken.co/api/proxy?url=https%3A%2F%2Fapi.deepwoken.co%2Fget%3Ftype%3Dtalent%26name%3Dall"
        );

        if (!response.ok) {
            throw new Error(`Fetch failed with status ${response.status}`);
        }

        const data = await response.json();
        res.json(data);

    } catch (err) {
        console.error("err fetching Deepwoken data:", err);
        res.status(500).json({ error: "failed to fetch Deepwoken data" });
    }
};
