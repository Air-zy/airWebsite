const sessions = new Map();

function generateToken(length = 32) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  for (let i = 0; i < length; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

function createSession(id, durationMs = 3600000) {
  const t = generateToken();
  const now = Date.now();
  const session = {
    id,
    t,
    at: now,
    end: now + durationMs,
  };
  sessions.set(t, session);
  return t;
}

function validateSession(token) {
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.end) {
    sessions.delete(token);
    return null;
  }
  return session;
}

setInterval(() => {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (now > session.end) {
      sessions.delete(token);
    }
  }
}, 60 * 1000); // 1min

module.exports = {
  createSession,
  validateSession,
};
