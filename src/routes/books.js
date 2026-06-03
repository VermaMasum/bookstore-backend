const router = require('express').Router();
const prisma = require('../lib/prisma');
const multer = require('multer');
const { parse } = require('csv-parse/sync');

const upload = multer({ storage: multer.memoryStorage() });

// GET /api/books
router.get('/', async (req, res, next) => {
  try {
    const books = await prisma.book.findMany({
      include: {
        publisher: true,
        inventory: true,
      },
      orderBy: { title: 'asc' },
    });
    res.json({ success: true, data: books });
  } catch (err) {
    next(err);
  }
});

// POST /api/books/bulk-import
router.post('/bulk-import', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.json({ success: false, message: 'No file uploaded' });

    const rows = parse(req.file.buffer.toString('utf8'), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    let added = 0;
    const skipped = [];

    for (const row of rows) {
      const { title, publisher_name, mrp, cost_price, isbn, author, category } = row;

      if (!title || !publisher_name || !mrp || !cost_price) {
        skipped.push({ row: title || '(untitled)', reason: 'Missing required fields' });
        continue;
      }

      const parsedMrp = parseFloat(mrp);
      const parsedCost = parseFloat(cost_price);
      if (isNaN(parsedMrp) || isNaN(parsedCost)) {
        skipped.push({ row: title, reason: 'Invalid MRP or cost_price' });
        continue;
      }

      try {
        if (isbn) {
          const existing = await prisma.book.findFirst({ where: { isbn } });
          if (existing) { skipped.push({ row: title, reason: `Duplicate ISBN: ${isbn}` }); continue; }
        }

        let publisher = await prisma.publisher.findFirst({
          where: { name: { equals: publisher_name, mode: 'insensitive' } },
        });
        if (!publisher) publisher = await prisma.publisher.create({ data: { name: publisher_name } });

        await prisma.book.create({
          data: {
            title,
            isbn: isbn || null,
            author: author || null,
            category: category || null,
            mrp: parsedMrp,
            costPrice: parsedCost,
            publisherId: publisher.id,
            inventory: { create: { quantity: 0 } },
          },
        });
        added++;
      } catch (rowErr) {
        skipped.push({ row: title, reason: rowErr.message });
      }
    }

    res.json({ success: true, data: { added, skipped } });
  } catch (err) {
    next(err);
  }
});

// GET /api/books/:id
router.get('/:id', async (req, res, next) => {
  try {
    const book = await prisma.book.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { publisher: true, inventory: true },
    });
    if (!book) return res.status(404).json({ success: false, message: 'Book not found' });
    res.json({ success: true, data: book });
  } catch (err) {
    next(err);
  }
});

// POST /api/books
router.post('/', async (req, res, next) => {
  try {
    const { title, isbn, author, publisherId, category, mrp, costPrice } = req.body;
    const book = await prisma.book.create({
      data: {
        title,
        isbn,
        author,
        publisherId: parseInt(publisherId),
        category,
        mrp: parseFloat(mrp),
        costPrice: parseFloat(costPrice),
        inventory: { create: { quantity: 0 } },
      },
      include: { publisher: true, inventory: true },
    });
    res.status(201).json({ success: true, data: book });
  } catch (err) {
    next(err);
  }
});

// PUT /api/books/:id
router.put('/:id', async (req, res, next) => {
  try {
    const { title, isbn, author, publisherId, category, mrp, costPrice } = req.body;
    const book = await prisma.book.update({
      where: { id: parseInt(req.params.id) },
      data: {
        title,
        isbn,
        author,
        publisherId: publisherId ? parseInt(publisherId) : undefined,
        category,
        mrp: mrp ? parseFloat(mrp) : undefined,
        costPrice: costPrice ? parseFloat(costPrice) : undefined,
      },
      include: { publisher: true, inventory: true },
    });
    res.json({ success: true, data: book });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/books/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.book.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true, message: 'Book deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
