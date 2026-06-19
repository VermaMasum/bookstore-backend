const router = require('express').Router();
const prisma = require('../lib/prisma');

router.get('/', async (req, res, next) => {
  try {
    const companies = await prisma.company.findMany({ orderBy: { name: 'asc' } });
    res.json({ success: true, data: companies });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const company = await prisma.company.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        purchaseOrders: { include: { items: true } },
        vendorOrders: { include: { items: true } },
        payments: true,
      },
    });
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });
    res.json({ success: true, data: company });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, contact, email, address, creditLimit } = req.body;
    const company = await prisma.company.create({
      data: {
        name,
        contact: contact || null,
        email: email || null,
        address: address || null,
        creditLimit: creditLimit ? parseFloat(creditLimit) : null,
      },
    });
    res.status(201).json({ success: true, data: company });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { name, contact, email, address, creditLimit } = req.body;
    const company = await prisma.company.update({
      where: { id: parseInt(req.params.id) },
      data: {
        name,
        contact: contact || null,
        email: email || null,
        address: address || null,
        creditLimit: creditLimit !== undefined ? parseFloat(creditLimit) : undefined,
      },
    });
    res.json({ success: true, data: company });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.company.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true, message: 'Company deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
