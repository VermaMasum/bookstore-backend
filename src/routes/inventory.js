const router = require('express').Router();
const prisma = require('../lib/prisma');
const multer = require('multer');
const { parse } = require('csv-parse/sync');

const upload = multer({ storage: multer.memoryStorage() });

// GET /api/inventory — full inventory list
router.get('/', async (req, res, next) => {
  try {
    const inventory = await prisma.inventory.findMany({
      include: { book: { include: { publisher: true } } },
      orderBy: { book: { title: 'asc' } },
    });
    res.json({ success: true, data: inventory });
  } catch (err) {
    next(err);
  }
});

// GET /api/inventory/low-stock — books with qty < 10
router.get('/low-stock', async (req, res, next) => {
  try {
    const threshold = parseInt(req.query.threshold) || 10;
    const items = await prisma.inventory.findMany({
      where: { quantity: { lt: threshold } },
      include: { book: { include: { publisher: true } } },
      orderBy: { quantity: 'asc' },
    });
    res.json({ success: true, data: items });
  } catch (err) {
    next(err);
  }
});

// POST /api/inventory/bulk-update
router.post('/bulk-update', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.json({ success: false, message: 'No file uploaded' });

    const rows = parse(req.file.buffer.toString('utf8'), {
      columns: true, skip_empty_lines: true, trim: true,
    });

    let updated = 0;
    const skipped = [];

    for (const row of rows) {
      const bookId = parseInt(row.book_id);
      const stock = parseInt(row.stock);

      if (!bookId || isNaN(stock) || stock < 0) {
        skipped.push({ row: row.title || row.book_id, reason: 'Invalid book_id or stock value' });
        continue;
      }

      try {
        await prisma.inventory.update({ where: { bookId }, data: { quantity: stock } });
        updated++;
      } catch (rowErr) {
        skipped.push({ row: row.title || bookId, reason: rowErr.message });
      }
    }

    res.json({ success: true, data: { updated, skipped } });
  } catch (err) {
    next(err);
  }
});

// POST /api/inventory/bulk-update-json
router.post('/bulk-update-json', async (req, res, next) => {
  try {
    const { items } = req.body
    if (!Array.isArray(items) || items.length === 0)
      return res.json({ success: false, message: 'No items provided' })

    let updated = 0
    for (const { bookId, stock } of items) {
      if (!bookId || isNaN(parseInt(stock)) || parseInt(stock) < 0) continue
      await prisma.inventory.update({ where: { bookId: parseInt(bookId) }, data: { quantity: parseInt(stock) } })
      updated++
    }

    res.json({ success: true, data: { updated } })
  } catch (err) {
    next(err)
  }
})

// PUT /api/inventory/:bookId — manual stock adjustment
router.put('/:bookId', async (req, res, next) => {
  try {
    const { quantity, adjustment } = req.body;
    const bookId = parseInt(req.params.bookId);

    let updatedInventory;

    if (adjustment !== undefined) {
      // Relative adjustment (e.g. +5 or -3)
      const current = await prisma.inventory.findUnique({ where: { bookId } });
      if (!current) return res.status(404).json({ success: false, message: 'Inventory record not found' });
      updatedInventory = await prisma.inventory.update({
        where: { bookId },
        data: { quantity: current.quantity + parseInt(adjustment) },
        include: { book: true },
      });
    } else {
      // Absolute set
      updatedInventory = await prisma.inventory.update({
        where: { bookId },
        data: { quantity: parseInt(quantity) },
        include: { book: true },
      });
    }

    res.json({ success: true, data: updatedInventory });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
