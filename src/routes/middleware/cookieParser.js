module.exports = (req, res, next) => {
  const cookieHeader = req.headers.cookie;
  const cookies = {};

  if (cookieHeader) {
    cookieHeader.split(';').forEach(pair => {
      const [key, ...valParts] = pair.trim().split('=');
      const value = valParts.join('='); // handle '=' in value
      cookies[key] = value;
    });
  }

  req.cookies = cookies;

  next();
};