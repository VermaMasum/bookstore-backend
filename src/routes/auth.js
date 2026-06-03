const router = require('express').Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const prisma = require('../lib/prisma')

const sign = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  )

/* ── POST /api/auth/register ── */
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body
    if (!name || !email || !password)
      return res.json({ success: false, message: 'Name, email and password are required' })

    if (password.length < 6)
      return res.json({ success: false, message: 'Password must be at least 6 characters' })

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing)
      return res.json({ success: false, message: 'Email already registered' })

    const hashed = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({ data: { name, email, password: hashed } })

    res.json({ success: true, token: sign(user), user: { id: user.id, name: user.name, email: user.email } })
  } catch (err) { next(err) }
})

/* ── POST /api/auth/login ── */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body
    if (!email || !password)
      return res.json({ success: false, message: 'Email and password are required' })

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user)
      return res.json({ success: false, message: 'Invalid email or password' })

    const valid = await bcrypt.compare(password, user.password)
    if (!valid)
      return res.json({ success: false, message: 'Invalid email or password' })

    res.json({ success: true, token: sign(user), user: { id: user.id, name: user.name, email: user.email } })
  } catch (err) { next(err) }
})

/* ── POST /api/auth/forgot-password ── */
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body
    if (!email)
      return res.json({ success: false, message: 'Email is required' })

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user)
      return res.json({ success: true, message: 'If this email exists, a reset link has been sent' })

    const token = crypto.randomBytes(32).toString('hex')
    const expiry = new Date(Date.now() + 1000 * 60 * 60) // 1 hour

    await prisma.user.update({
      where: { email },
      data: { resetToken: token, resetTokenExpiry: expiry },
    })

    // In production: send email with reset link
    // For now: return token directly (dev mode)
    res.json({
      success: true,
      message: 'Password reset token generated',
      resetToken: token, // Remove this in production, send via email instead
    })
  } catch (err) { next(err) }
})

/* ── POST /api/auth/reset-password ── */
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, password } = req.body
    if (!token || !password)
      return res.json({ success: false, message: 'Token and new password are required' })

    if (password.length < 6)
      return res.json({ success: false, message: 'Password must be at least 6 characters' })

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() },
      },
    })

    if (!user)
      return res.json({ success: false, message: 'Invalid or expired reset token' })

    const hashed = await bcrypt.hash(password, 10)
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, resetToken: null, resetTokenExpiry: null },
    })

    res.json({ success: true, message: 'Password reset successfully. You can now log in.' })
  } catch (err) { next(err) }
})

/* ── GET /api/auth/me ── */
router.get('/me', require('../middleware/authMiddleware'), (req, res) => {
  res.json({ success: true, user: req.user })
})

module.exports = router
