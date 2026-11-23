// everything but the cookies. the session cookie is httpOnly so page scripts cant read it, echoing it here would undo that
module.exports = async (req, res) => {
  const { cookie, ...headers } = req.headers;
  res.json(headers);
};
