const GradioClient = require("./GradioClient.js");

const envDecrypt = require('../../FallbackEncryption/envDecrypt.js');
const HFSpacesSecret = JSON.parse(
    envDecrypt(process.env.airKey, process.env.HFSpacesSecret)
);

const carousel = HFSpacesSecret.carousel;
const drawClient = new GradioClient({
  baseUrl: HFSpacesSecret.url1,
  apiName: "generate",
  tokens: carousel,
});

module.exports = {
    drawClient
};