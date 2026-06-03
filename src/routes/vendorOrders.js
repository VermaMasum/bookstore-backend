const router = require('express').Router();
const prisma = require('../lib/prisma');

// GET /api/vendor-orders
router.get('/', async (req, res, next) => {
  try {
    const orders = await prisma.vendorOrder.findMany({
      include: {
        vendor: true,
        items: { include: { book: true } },
        payments: true,
      },
      orderBy: { orderDate: 'desc' },
    });
    res.json({ success: true, data: orders });
  } catch (err) {
    next(err);
  }
});

// GET /api/vendor-orders/:id
router.get('/:id', async (req, res, next) => {
  try {
    const order = await prisma.vendorOrder.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { vendor: true, items: { include: { book: true } }, payments: true },
    });
    if (!order) return res.status(404).json({ success: false, message: 'Vendor order not found' });
    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
});

// POST /api/vendor-orders — create with items
router.post('/', async (req, res, next) => {
  try {
    const { vendorId, notes, items } = req.body;
    // items: [{ bookId, quantity, unitPrice }]
    const order = await prisma.vendorOrder.create({
      data: {
        vendorId: parseInt(vendorId),
        notes,
        items: {
          create: items.map((i) => ({
            bookId: parseInt(i.bookId),
            quantity: parseInt(i.quantity),
            unitPrice: parseFloat(i.unitPrice),
          })),
        },
      },
      include: { vendor: true, items: { include: { book: true } } },
    });
    res.status(201).json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
});

// PUT /api/vendor-orders/:id/dispatch — deduct from inventory
router.put('/:id/dispatch', async (req, res, next) => {
  try {
    const orderId = parseInt(req.params.id);
    const order = await prisma.vendorOrder.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: 'Order cannot be dispatched in current status' });
    }

    // Check stock availability
    for (const item of order.items) {
      const inv = await prisma.inventory.findUnique({ where: { bookId: item.bookId } });
      if (!inv || inv.quantity < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for book ID ${item.bookId}`,
        });
      }
    }

    await prisma.$transaction([
      ...order.items.map((item) =>
        prisma.inventory.update({
          where: { bookId: item.bookId },
          data: { quantity: { decrement: item.quantity } },
        })
      ),
      prisma.vendorOrder.update({
        where: { id: orderId },
        data: { status: 'DISPATCHED' },
      }),
    ]);

    res.json({ success: true, message: 'Order dispatched and inventory deducted' });
  } catch (err) {
    next(err);
  }
});

// PUT /api/vendor-orders/:id/deliver
router.put('/:id/deliver', async (req, res, next) => {
  try {
    const order = await prisma.vendorOrder.update({
      where: { id: parseInt(req.params.id) },
      data: { status: 'DELIVERED' },
    });
    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
});

// PUT /api/vendor-orders/:id/cancel
router.put('/:id/cancel', async (req, res, next) => {
  try {
    const order = await prisma.vendorOrder.update({
      where: { id: parseInt(req.params.id) },
      data: { status: 'CANCELLED' },
    });
    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
