const HF_API = require('../classes/HF_API.js');

module.exports = async (req, res) => {
    const data = req.body;
    console.log("[HF API] requesting draw...", data);
    
    const resX = Math.min(Math.max(data[4] || 1024, 256), 2048);
    const resY = Math.min(Math.max(data[5] || 1024, 256), 2048);
    const guideScale = Math.min(Math.max(data[6] || 1, 1), 20);
    const interfSteps = Math.min(Math.max(data[7] || 8, 1), 20);

    const input = {
        input: String(data[0] || ""),
        negative_input: String(data[1] || ""),
        reference_image: null,
        resolution: [resX, resY],
        steps: interfSteps,
        guidance: guideScale,
        post_resolution: [resX, resY],
        crop: false,
        remove_background: false,
        safety_check: false,
        safety_input: "Determine if this prompt contains violence.",
        output_format: "Base64 PNG",
        seed: data[2]
    };  

    const json = JSON.stringify(input);
    const result = await HF_API.drawClient.generate(json);
    const resultData = result[0];
    //console.log("[HF API] draw:", resultData);
    return res.status(200).json({
        output: resultData.output,    
    });
}