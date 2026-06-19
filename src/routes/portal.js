const router = require('express').Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const prisma = require('../lib/prisma')
const portalAuth = require('../middleware/portalAuthMiddleware')

const sign = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  )

/* ── POST /api/portal/register ── */
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body
    if (!name || !email || !password)
      return res.json({ success: false, message: 'Name, email and password are required' })
    if (password.length < 6)
      return res.json({ success: false, message: 'Password must be at least 6 characters' })

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing)
      return res.json({ success: false, message: 'Email already registered' })

    const hashed = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { name, email, password: hashed, phone: phone || null, role: 'END_USER' },
    })

    res.json({ success: true, token: sign(user), user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role } })
  } catch (err) { next(err) }
})

/* ── POST /api/portal/login ── */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body
    if (!email || !password)
      return res.json({ success: false, message: 'Email and password are required' })

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || user.role !== 'END_USER')
      return res.json({ success: false, message: 'Invalid email or password' })

    const valid = await bcrypt.compare(password, user.password)
    if (!valid)
      return res.json({ success: false, message: 'Invalid email or password' })

    res.json({ success: true, token: sign(user), user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role } })
  } catch (err) { next(err) }
})

/* ── GET /api/portal/book-sets ── public, no auth needed ── */
router.get('/book-sets', async (req, res, next) => {
  try {
    const { className, board, level, sessionYear } = req.query
    const where = {}
    if (className) where.className = className
    if (board) where.board = board
    if (level) where.level = level
    if (sessionYear) where.sessionYear = sessionYear

    const sets = await prisma.bookSet.findMany({
      where,
      include: {
        school: true,
        items: { include: { book: { include: { publisher: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ success: true, data: sets })
  } catch (err) { next(err) }
})

/* ── GET /api/portal/book-sets/:id ── public ── */
router.get('/book-sets/:id', async (req, res, next) => {
  try {
    const set = await prisma.bookSet.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        school: true,
        items: { include: { book: { include: { publisher: true } } } },
      },
    })
    if (!set) return res.status(404).json({ success: false, message: 'Book set not found' })
    res.json({ success: true, data: set })
  } catch (err) { next(err) }
})

/* ── POST /api/portal/orders ── requires END_USER auth ── */
router.post('/orders', portalAuth, async (req, res, next) => {
  try {
    const { setId, childName, guardianName, notes } = req.body
    if (!setId || !childName || !guardianName)
      return res.json({ success: false, message: 'Book set, child name and guardian name are required' })

    const bookSet = await prisma.bookSet.findUnique({
      where: { id: parseInt(setId) },
      include: { items: { include: { book: true } } },
    })
    if (!bookSet) return res.json({ success: false, message: 'Book set not found' })

    const order = await prisma.schoolOrder.create({
      data: {
        schoolId: bookSet.schoolId,
        setId: bookSet.id,
        childName,
        guardianName,
        notes: notes || null,
        userId: req.user.id,
        items: {
          create: bookSet.items.map((i) => ({
            bookId: i.bookId,
            qtyOrdered: i.quantity,
            qtyDelivered: 0,
            unitPrice: i.book.costPrice,
          })),
        },
      },
      include: {
        bookSet: true,
        school: true,
        items: { include: { book: true } },
      },
    })

    res.status(201).json({ success: true, data: order })
  } catch (err) { next(err) }
})

/* ── GET /api/portal/orders ── requires END_USER auth ── */
router.get('/orders', portalAuth, async (req, res, next) => {
  try {
    const orders = await prisma.schoolOrder.findMany({
      where: { userId: req.user.id },
      include: {
        bookSet: true,
        school: true,
        items: { include: { book: true } },
      },
      orderBy: { orderDate: 'desc' },
    })
    res.json({ success: true, data: orders })
  } catch (err) { next(err) }
})

module.exports = router
