const jwt = require('jsonwebtoken')

module.exports = (req, res, next) => {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer '))
    return res.status(401).json({ success: false, message: 'Unauthorized — please log in' })

  const token = auth.split(' ')[1]
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    if (decoded.role !== 'END_USER')
      return res.status(403).json({ success: false, message: 'Access denied — customer portal only' })
    req.user = decoded
    next()
  } catch {
    return res.status(401).json({ success: false, message: 'Token invalid or expired — please log in again' })
  }
}
