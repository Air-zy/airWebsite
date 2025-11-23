const WebSocket = require('ws');

function start(serverToUse) {
    const wss = new WebSocket.Server({ server: serverToUse, path: '/ws' });

    wss.on('error', (err) => {
        console.error("WSS ERROR:", err);
    });

    wss.on('listening', () => {
        console.log('WSS listening!');
    });

    const broadcast = (msg) => {
        //console.log("broadcasting...", msg)
        wss.clients.forEach(client => {
            console.log(client.readyState)
            if (client.readyState === WebSocket.OPEN) {
                client.send(msg);
            }
        });
    };

    return {
        broadcast: broadcast,
        wss: wss
    }
}

module.exports = { start: start }