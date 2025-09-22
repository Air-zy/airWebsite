const envDecrypt = require('../../envDecrypt.js')
const whookPass = envDecrypt(process.env.airKey, process.env.whookPass)
const discordWebhookUrl = envDecrypt(process.env.airKey, process.env.dwebhook)

module.exports = async (req, res) => {
  const auth = req.headers["authorization"]; 
  if (auth !== whookPass) {
    return res.status(401).send("Unauthorized: bad token");
  }

  if (req && req.body) {
    const { ...data } = req.body;
    try {
      const response = await fetch(discordWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        console.error('Discord webhook responded with err:', response.status, text);
        return res.status(500).send('failed to send message to Discord.');
      }

      res.status(200).send('Message sent to Discord!');
    } catch (error) {
      console.error('err sending to Discord:', error);
      res.status(500).send('failed to send message to Discord.');
    }
  } else {
    res.status(400).send('no request body');
  }
};
