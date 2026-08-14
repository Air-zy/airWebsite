const envDecrypt = require('../../FallbackEncryption/envDecrypt.js')
const sendDiscordWebhook = require('./sendWebhook.js');

// takes the encrypted env value for whichever discord webhook this route posts to
// auth lives on the route declaration, see rootRouter.js
module.exports = (encryptedUrl) => {
  const discordWebhookUrl = envDecrypt(process.env.airKey, encryptedUrl);

  return async (req, res) => {
    if (!req.body) return res.status(400).json({ error: 'no request body' });

    await sendDiscordWebhook(discordWebhookUrl, req.body);
    res.json({ ok: true });
  };
};
