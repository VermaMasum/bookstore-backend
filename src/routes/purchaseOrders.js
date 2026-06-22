const router = require('express').Router();
const prisma = require('../lib/prisma');

router.get('/', async (req, res, next) => {
  try {
    const orders = await prisma.purchaseOrder.findMany({
      include: {
        company: { select: { id: true, name: true } },
        items: { include: { book: true } },
      },
      orderBy: { orderDate: 'desc' },
    });
    res.json({ success: true, data: orders });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const order = await prisma.purchaseOrder.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        company: { select: { id: true, name: true } },
        items: { include: { book: true } },
      },
    });
    if (!order) return res.status(404).json({ success: false, message: 'Purchase order not found' });
    res.json({ success: true, data: order });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { companyId, notes, items } = req.body;
    const order = await prisma.purchaseOrder.create({
      data: {
        companyId: parseInt(companyId),
        notes,
        items: {
          create: items.map(i => ({
            bookId: parseInt(i.bookId),
            quantity: parseInt(i.quantity),
            unitCost: parseFloat(i.unitCost),
          })),
        },
      },
      include: {
        company: { select: { id: true, name: true } },
        items: { include: { book: true } },
      },
    });
    res.status(201).json({ success: true, data: order });
  } catch (err) { next(err); }
});

router.put('/:id/receive', async (req, res, next) => {
  try {
    const orderId = parseInt(req.params.id);
    const order = await prisma.purchaseOrder.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.status === 'RECEIVED')
      return res.status(400).json({ success: false, message: 'Order already received' });

    await prisma.$transaction([
      ...order.items.map(item =>
        prisma.inventory.upsert({
          where: { bookId: item.bookId },
          update: { quantity: { increment: item.quantity } },
          create: { bookId: item.bookId, quantity: item.quantity },
        })
      ),
      prisma.purchaseOrder.update({ where: { id: orderId }, data: { status: 'RECEIVED' } }),
    ]);

    res.json({ success: true, message: 'Purchase order received and inventory updated' });
  } catch (err) { next(err); }
});

router.put('/:id/cancel', async (req, res, next) => {
  try {
    const order = await prisma.purchaseOrder.update({
      where: { id: parseInt(req.params.id) },
      data: { status: 'CANCELLED' },
    });
    res.json({ success: true, data: order });
  } catch (err) { next(err); }
});

module.exports = router;
