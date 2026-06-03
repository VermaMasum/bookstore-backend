const router = require('express').Router();
const prisma = require('../lib/prisma');

// GET /api/reconciliation
router.get('/', async (req, res, next) => {
  try {
    const records = await prisma.dailyReconciliation.findMany({
      orderBy: { date: 'desc' },
    });
    res.json({ success: true, data: records });
  } catch (err) {
    next(err);
  }
});

// GET /api/reconciliation/summary — auto-calculate today's numbers
router.get('/summary', async (req, res, next) => {
  try {
    const date = req.query.date ? new Date(req.query.date) : new Date();
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Total inventory value
    const inventory = await prisma.inventory.findMany({ include: { book: true } });
    const totalStock = inventory.reduce((sum, i) => sum + i.quantity, 0);

    // B2B sales today (dispatched vendor orders)
    const vendorOrders = await prisma.vendorOrder.findMany({
      where: {
        status: 'DISPATCHED',
        orderDate: { gte: startOfDay, lte: endOfDay },
      },
      include: { items: true },
    });
    const salesB2B = vendorOrders.reduce(
      (sum, o) => sum + o.items.reduce((s, i) => s + parseFloat(i.unitPrice) * i.quantity, 0),
      0
    );

    // B2C sales today (school order deliveries)
    const schoolOrders = await prisma.schoolOrder.findMany({
      where: {
        status: { in: ['DELIVERED', 'PARTIAL'] },
        orderDate: { gte: startOfDay, lte: endOfDay },
      },
      include: { items: true },
    });
    const salesB2C = schoolOrders.reduce(
      (sum, o) => sum + o.items.reduce((s, i) => s + parseFloat(i.unitPrice) * i.qtyDelivered, 0),
      0
    );

    // Purchases today
    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: {
        status: 'RECEIVED',
        orderDate: { gte: startOfDay, lte: endOfDay },
      },
      include: { items: true },
    });
    const purchasesTotal = purchaseOrders.reduce(
      (sum, o) => sum + o.items.reduce((s, i) => s + parseFloat(i.unitCost) * i.quantity, 0),
      0
    );

    res.json({
      success: true,
      data: { date, totalStock, salesB2B, salesB2C, purchasesTotal },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/reconciliation/:date
router.get('/:date', async (req, res, next) => {
  try {
    const record = await prisma.dailyReconciliation.findUnique({
      where: { date: new Date(req.params.date) },
    });
    if (!record) return res.status(404).json({ success: false, message: 'No reconciliation for this date' });
    res.json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
});

// POST /api/reconciliation — save end-of-day record
router.post('/', async (req, res, next) => {
  try {
    const { date, openingStock, closingStock, salesB2B, salesB2C, purchasesTotal, notes } = req.body;
    const record = await prisma.dailyReconciliation.create({
      data: {
        date: new Date(date),
        openingStock: parseInt(openingStock),
        closingStock: parseInt(closingStock),
        salesB2B: parseFloat(salesB2B),
        salesB2C: parseFloat(salesB2C),
        purchasesTotal: parseFloat(purchasesTotal),
        notes,
      },
    });
    res.status(201).json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
