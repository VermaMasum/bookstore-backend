const router = require('express').Router();
const prisma = require('../lib/prisma');

router.get('/', async (req, res, next) => {
  try {
    const publishers = await prisma.publisher.findMany({ orderBy: { name: 'asc' } });
    res.json({ success: true, data: publishers });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const publisher = await prisma.publisher.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { books: true },
    });
    if (!publisher) return res.status(404).json({ success: false, message: 'Publisher not found' });
    res.json({ success: true, data: publisher });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const publisher = await prisma.publisher.create({ data: req.body });
    res.status(201).json({ success: true, data: publisher });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const publisher = await prisma.publisher.update({
      where: { id: parseInt(req.params.id) },
      data: req.body,
    });
    res.json({ success: true, data: publisher });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.publisher.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true, message: 'Publisher deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
