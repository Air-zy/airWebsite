const envDecrypt = require('../FallbackEncryption/envDecrypt.js')
//const EXPECTED_TOKEN = envDecrypt(process.env.airKey, process.env.airWebToken)

module.exports = async (req, res) => {
    //TODO add auth check lol
    const response = await fetch(
        "https://gist.githubusercontent.com/leonTrigi/1c586fd04360f7fc7d9c0645ca644e04/raw/stf.txt"
    );
    const heartUrls = await response.text();
    const urls = JSON.parse(envDecrypt(process.env.publicClusterKey, heartUrls)).urls;

    res.json(urls);
};
