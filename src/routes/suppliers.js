const router = require('express').Router();
const prisma = require('../lib/prisma');

router.get('/', async (req, res, next) => {
  try {
    const data = await prisma.supplier.findMany({ orderBy: { name: 'asc' } });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const data = await prisma.supplier.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { PurchaseOrder: { include: { items: { include: { book: true } } } } },
    });
    if (!data) return res.status(404).json({ success: false, message: 'Supplier not found' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, contact, email, address } = req.body;
    const data = await prisma.supplier.create({
      data: { name, contact: contact || null, email: email || null, address: address || null },
    });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { name, contact, email, address } = req.body;
    const data = await prisma.supplier.update({
      where: { id: parseInt(req.params.id) },
      data: { name, contact: contact || null, email: email || null, address: address || null },
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.supplier.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true, message: 'Supplier deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
