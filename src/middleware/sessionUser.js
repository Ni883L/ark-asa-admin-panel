function attachSessionUser(req, res, next) {
  res.locals.sessionUser = req.session?.user || null;
  res.locals.csrfToken = req.session?.csrfToken || null;
  next();
}

module.exports = { attachSessionUser };
