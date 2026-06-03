const router = require('express').Router();
const prisma = require('../lib/prisma');

router.get('/', async (req, res, next) => {
  try {
    const suppliers = await prisma.supplier.findMany({ orderBy: { name: 'asc' } });
    res.json({ success: true, data: suppliers });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { purchaseOrders: { include: { items: true } } },
    });
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found' });
    res.json({ success: true, data: supplier });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const supplier = await prisma.supplier.create({ data: req.body });
    res.status(201).json({ success: true, data: supplier });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const supplier = await prisma.supplier.update({
      where: { id: parseInt(req.params.id) },
      data: req.body,
    });
    res.json({ success: true, data: supplier });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.supplier.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true, message: 'Supplier deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
