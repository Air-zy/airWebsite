const fs = require('fs');
module.exports = async(req, res) => {
    const id = String(req.params.userid || '');
    const esc = s => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
    fs.readFile(__dirname + '/res/rowaPlr.html', 'utf8', (err, html) => {
        if (err) return res.status(500).end();
        const meta = `<title>${esc(id)}</title>\n<meta property="og:title" content="${esc(id)}">`;
        html = html.replace(/<head(?:\s[^>]*)?>/i, m => m + '\n' + meta);
        res.send(html);
    });
}