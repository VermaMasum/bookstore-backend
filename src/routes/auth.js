const router = require('express').Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const prisma = require('../lib/prisma')
const { sendPasswordResetEmail } = require('../lib/mailer')

const sign = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
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

    res.json({ success: true, token: sign(user), user: { id: user.id, name: user.name, email: user.email, role: user.role } })
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

    if (user.role === 'END_USER')
      return res.json({ success: false, message: 'Please use the customer portal to log in' })

    const valid = await bcrypt.compare(password, user.password)
    if (!valid)
      return res.json({ success: false, message: 'Invalid email or password' })

    res.json({ success: true, token: sign(user), user: { id: user.id, name: user.name, email: user.email, role: user.role } })
  } catch (err) { next(err) }
})

/* ── POST /api/auth/forgot-password ── */
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body
    if (!email)
      return res.json({ success: false, message: 'Email is required' })

    const user = await prisma.user.findUnique({ where: { email } })
    // Always return the same message so we don't reveal whether email exists
    if (!user)
      return res.json({ success: true, message: 'If this email is registered, a code has been sent.' })

    // 6-digit numeric OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000))
    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex')
    const expiry = new Date(Date.now() + 1000 * 60 * 15) // 15 minutes

    await prisma.user.update({
      where: { email },
      data: { resetToken: hashedOtp, resetTokenExpiry: expiry },
    })

    try {
      await sendPasswordResetEmail(email, otp)
    } catch (mailErr) {
      // Revert the token if email fails so user can retry
      await prisma.user.update({ where: { email }, data: { resetToken: null, resetTokenExpiry: null } })
      return res.status(500).json({ success: false, message: mailErr.message || 'Failed to send email. Check EMAIL_USER and EMAIL_PASS in .env' })
    }

    res.json({ success: true, message: 'A 6-digit code has been sent to your email. It expires in 15 minutes.' })
  } catch (err) { next(err) }
})

/* ── POST /api/auth/reset-password ── */
router.post('/reset-password', async (req, res, next) => {
  try {
    const { email, code, password } = req.body
    if (!email || !code || !password)
      return res.json({ success: false, message: 'Email, code and new password are required' })

    if (password.length < 6)
      return res.json({ success: false, message: 'Password must be at least 6 characters' })

    const hashedOtp = crypto.createHash('sha256').update(String(code).trim()).digest('hex')

    const user = await prisma.user.findFirst({
      where: {
        email,
        resetToken: hashedOtp,
        resetTokenExpiry: { gt: new Date() },
      },
    })

    if (!user)
      return res.json({ success: false, message: 'Invalid or expired code. Please request a new one.' })

    const hashed = await bcrypt.hash(password, 10)
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, resetToken: null, resetTokenExpiry: null },
    })

    res.json({ success: true, message: 'Password updated successfully. You can now log in.' })
  } catch (err) { next(err) }
})

/* ── GET /api/auth/me ── */
router.get('/me', require('../middleware/authMiddleware'), (req, res) => {
  res.json({ success: true, user: req.user })
})

module.exports = router
