const Session = require('./session');
const sessions = new Map();

function createSession(id, durationMs = 3600000) {
  const session = new Session(id, durationMs);
  sessions.set(session.token, session);
  return session.token;
}

function validateSession(token) {
  const session = sessions.get(token);
  if (!session) return null;
  if (session.isExpired()) {
    sessions.delete(token);
    return null;
  }
  return session;
}

setInterval(() => {
  for (const [token, session] of sessions) {
    if (session.isExpired()) {
      sessions.delete(token);
    }
  }
}, 60 * 1000); // every 1m

module.exports = {
  createSession,
  validateSession,
};
