const router = require('express').Router();
const prisma = require('../lib/prisma');

const WHERE = { type: { in: ['SUPPLIER', 'BOTH'] } };

router.get('/', async (req, res, next) => {
  try {
    const data = await prisma.company.findMany({ where: WHERE, orderBy: { name: 'asc' } });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const data = await prisma.company.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { purchaseOrders: { include: { items: { include: { book: true } } } }, payments: true },
    });
    if (!data || !['SUPPLIER', 'BOTH'].includes(data.type))
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, contact, email, address, gstin, creditLimit } = req.body;
    const data = await prisma.company.create({
      data: { name, type: 'SUPPLIER', contact: contact || null, email: email || null, address: address || null, gstin: gstin || null, creditLimit: creditLimit ? parseFloat(creditLimit) : null },
    });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { name, contact, email, address, gstin, creditLimit } = req.body;
    const data = await prisma.company.update({
      where: { id: parseInt(req.params.id) },
      data: { name, contact: contact || null, email: email || null, address: address || null, gstin: gstin || null, creditLimit: creditLimit !== undefined ? parseFloat(creditLimit) : undefined },
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.company.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true, message: 'Supplier deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
