const jwt = require('jsonwebtoken')

module.exports = (req, res, next) => {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer '))
    return res.status(401).json({ success: false, message: 'Unauthorized — please log in' })

  const token = auth.split(' ')[1]
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET)
    next()
  } catch {
    return res.status(401).json({ success: false, message: 'Token invalid or expired — please log in again' })
  }
}
