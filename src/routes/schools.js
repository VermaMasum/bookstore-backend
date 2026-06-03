const router = require('express').Router();
const prisma = require('../lib/prisma');

router.get('/', async (req, res, next) => {
  try {
    const schools = await prisma.school.findMany({ orderBy: { name: 'asc' } });
    res.json({ success: true, data: schools });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const school = await prisma.school.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        bookSets: { include: { items: { include: { book: true } } } },
        schoolOrders: { include: { items: true } },
        payments: true,
      },
    });
    if (!school) return res.status(404).json({ success: false, message: 'School not found' });
    res.json({ success: true, data: school });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const school = await prisma.school.create({ data: req.body });
    res.status(201).json({ success: true, data: school });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const school = await prisma.school.update({
      where: { id: parseInt(req.params.id) },
      data: req.body,
    });
    res.json({ success: true, data: school });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.school.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true, message: 'School deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
