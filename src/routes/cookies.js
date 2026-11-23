// every cookie but the session one, which is httpOnly so page scripts cant read it. it stays out of the logs too
module.exports = (req, res) => {
    const { airzy_session, ...cookies } = req.cookies;
    const { cookie, ...headers } = req.headers;
    console.log(headers)
    res.json({ cookies });
}
