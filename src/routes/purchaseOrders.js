const router = require('express').Router();
const prisma = require('../lib/prisma');

// GET /api/purchase-orders
router.get('/', async (req, res, next) => {
  try {
    const orders = await prisma.purchaseOrder.findMany({
      include: {
        supplier: true,
        items: { include: { book: true } },
      },
      orderBy: { orderDate: 'desc' },
    });
    res.json({ success: true, data: orders });
  } catch (err) {
    next(err);
  }
});

// GET /api/purchase-orders/:id
router.get('/:id', async (req, res, next) => {
  try {
    const order = await prisma.purchaseOrder.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { supplier: true, items: { include: { book: true } } },
    });
    if (!order) return res.status(404).json({ success: false, message: 'Purchase order not found' });
    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
});

// POST /api/purchase-orders — create PO with items
router.post('/', async (req, res, next) => {
  try {
    const { supplierId, notes, items } = req.body;
    // items: [{ bookId, quantity, unitCost }]
    const order = await prisma.purchaseOrder.create({
      data: {
        supplierId: parseInt(supplierId),
        notes,
        items: {
          create: items.map((i) => ({
            bookId: parseInt(i.bookId),
            quantity: parseInt(i.quantity),
            unitCost: parseFloat(i.unitCost),
          })),
        },
      },
      include: { supplier: true, items: { include: { book: true } } },
    });
    res.status(201).json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
});

// PUT /api/purchase-orders/:id/receive — mark received, add to inventory
router.put('/:id/receive', async (req, res, next) => {
  try {
    const orderId = parseInt(req.params.id);
    const order = await prisma.purchaseOrder.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.status === 'RECEIVED') {
      return res.status(400).json({ success: false, message: 'Order already received' });
    }

    // Add stock to inventory for each item
    await prisma.$transaction([
      ...order.items.map((item) =>
        prisma.inventory.upsert({
          where: { bookId: item.bookId },
          update: { quantity: { increment: item.quantity } },
          create: { bookId: item.bookId, quantity: item.quantity },
        })
      ),
      prisma.purchaseOrder.update({
        where: { id: orderId },
        data: { status: 'RECEIVED' },
      }),
    ]);

    res.json({ success: true, message: 'Purchase order received and inventory updated' });
  } catch (err) {
    next(err);
  }
});

// PUT /api/purchase-orders/:id/cancel
router.put('/:id/cancel', async (req, res, next) => {
  try {
    const order = await prisma.purchaseOrder.update({
      where: { id: parseInt(req.params.id) },
      data: { status: 'CANCELLED' },
    });
    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
