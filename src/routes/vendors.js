const router = require('express').Router();
const prisma = require('../lib/prisma');

router.get('/', async (req, res, next) => {
  try {
    const data = await prisma.vendor.findMany({ orderBy: { name: 'asc' } });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const data = await prisma.vendor.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { VendorOrder: { include: { items: { include: { book: true } } } }, Payment: true },
    });
    if (!data) return res.status(404).json({ success: false, message: 'Vendor not found' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, contact, email, address, creditLimit } = req.body;
    const data = await prisma.vendor.create({
      data: { name, contact: contact || null, email: email || null, address: address || null, creditLimit: creditLimit ? parseFloat(creditLimit) : null },
    });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { name, contact, email, address, creditLimit } = req.body;
    const data = await prisma.vendor.update({
      where: { id: parseInt(req.params.id) },
      data: { name, contact: contact || null, email: email || null, address: address || null, creditLimit: creditLimit !== undefined ? parseFloat(creditLimit) : undefined },
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.vendor.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true, message: 'Vendor deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
