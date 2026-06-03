const router = require('express').Router();
const prisma = require('../lib/prisma');

// GET /api/book-sets
router.get('/', async (req, res, next) => {
  try {
    const sets = await prisma.bookSet.findMany({
      include: {
        school: true,
        items: { include: { book: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: sets });
  } catch (err) {
    next(err);
  }
});

// GET /api/book-sets/:id
router.get('/:id', async (req, res, next) => {
  try {
    const set = await prisma.bookSet.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { school: true, items: { include: { book: true } } },
    });
    if (!set) return res.status(404).json({ success: false, message: 'Book set not found' });
    res.json({ success: true, data: set });
  } catch (err) {
    next(err);
  }
});

// POST /api/book-sets — create set with items, auto-calc total price
router.post('/', async (req, res, next) => {
  try {
    const { name, schoolId, className, sessionYear, items } = req.body;
    // items: [{ bookId, quantity }]

    // Auto-calculate total price from book MRP
    let totalPrice = 0;
    for (const item of items) {
      const book = await prisma.book.findUnique({ where: { id: parseInt(item.bookId) } });
      if (book) totalPrice += parseFloat(book.mrp) * parseInt(item.quantity);
    }

    const set = await prisma.bookSet.create({
      data: {
        name,
        schoolId: parseInt(schoolId),
        className,
        sessionYear,
        totalPrice,
        items: {
          create: items.map((i) => ({
            bookId: parseInt(i.bookId),
            quantity: parseInt(i.quantity),
          })),
        },
      },
      include: { school: true, items: { include: { book: true } } },
    });
    res.status(201).json({ success: true, data: set });
  } catch (err) {
    next(err);
  }
});

// PUT /api/book-sets/:id — replace items
router.put('/:id', async (req, res, next) => {
  try {
    const setId = parseInt(req.params.id);
    const { name, className, sessionYear, items } = req.body;

    let totalPrice = 0;
    if (items) {
      for (const item of items) {
        const book = await prisma.book.findUnique({ where: { id: parseInt(item.bookId) } });
        if (book) totalPrice += parseFloat(book.mrp) * parseInt(item.quantity);
      }
    }

    // Replace items
    if (items) {
      await prisma.bookSetItem.deleteMany({ where: { setId } });
    }

    const set = await prisma.bookSet.update({
      where: { id: setId },
      data: {
        name,
        className,
        sessionYear,
        totalPrice: items ? totalPrice : undefined,
        items: items
          ? {
              create: items.map((i) => ({
                bookId: parseInt(i.bookId),
                quantity: parseInt(i.quantity),
              })),
            }
          : undefined,
      },
      include: { school: true, items: { include: { book: true } } },
    });
    res.json({ success: true, data: set });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/book-sets/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const setId = parseInt(req.params.id);
    await prisma.bookSetItem.deleteMany({ where: { setId } });
    await prisma.bookSet.delete({ where: { id: setId } });
    res.json({ success: true, message: 'Book set deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
