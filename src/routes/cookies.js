module.exports = (req, res) => {
    console.log(req.headers)
    res.json({
        cookies: req.cookies
    });
}