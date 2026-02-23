const envDecrypt = require('../../FallbackEncryption/envDecrypt.js')
const whookPass = envDecrypt(process.env.airKey, process.env.whookPass)
const discordWebhookUrl = envDecrypt(process.env.airKey, process.env.dwebhook)
const sendDiscordWebhook = require('./sendWebhook.js');

module.exports = async (req, res) => {
  const auth = req.headers["authorization"]; 
  if (auth !== whookPass) { return res.status(401).send("Unauthorized: bad token"); }
  if (!req || !req.body) return res.status(400).send('no request body');

  try {
    await sendDiscordWebhook(discordWebhookUrl, req.body);
    res.status(200).send('Message sent to Discord!');
  } catch (error) {
    console.error('err sending to Discord:', error);
    res.status(500).send('failed to send message to Discord.');
  }
};
