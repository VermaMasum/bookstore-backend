const router = require('express').Router();
const prisma = require('../lib/prisma');

// GET /api/payments
router.get('/', async (req, res, next) => {
  try {
    const payments = await prisma.payment.findMany({
      include: { vendorOrder: true, schoolOrder: true },
      orderBy: { paymentDate: 'desc' },
    });
    res.json({ success: true, data: payments });
  } catch (err) {
    next(err);
  }
});

// GET /api/payments/vendor-order/:orderId
router.get('/vendor-order/:orderId', async (req, res, next) => {
  try {
    const payments = await prisma.payment.findMany({
      where: { vendorOrderId: parseInt(req.params.orderId) },
      orderBy: { paymentDate: 'desc' },
    });
    res.json({ success: true, data: payments });
  } catch (err) {
    next(err);
  }
});

// GET /api/payments/school-order/:orderId
router.get('/school-order/:orderId', async (req, res, next) => {
  try {
    const payments = await prisma.payment.findMany({
      where: { schoolOrderId: parseInt(req.params.orderId) },
      orderBy: { paymentDate: 'desc' },
    });
    res.json({ success: true, data: payments });
  } catch (err) {
    next(err);
  }
});

// POST /api/payments — record a payment
router.post('/', async (req, res, next) => {
  try {
    const { orderType, vendorOrderId, schoolOrderId, companyId, schoolId, amount, method, notes, paymentDate } =
      req.body;
    const payment = await prisma.payment.create({
      data: {
        orderType,
        vendorOrderId: vendorOrderId ? parseInt(vendorOrderId) : null,
        schoolOrderId: schoolOrderId ? parseInt(schoolOrderId) : null,
        companyId: companyId ? parseInt(companyId) : null,
        schoolId: schoolId ? parseInt(schoolId) : null,
        amount: parseFloat(amount),
        method: method || 'CASH',
        notes,
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      },
    });

    // After payment, check if school order is now fully paid → mark DELIVERED
    if (schoolOrderId) {
      const order = await prisma.schoolOrder.findUnique({
        where: { id: parseInt(schoolOrderId) },
        include: { items: true, payments: true },
      });

      if (order && ['PENDING', 'PARTIAL'].includes(order.status)) {
        const orderTotal = order.items.reduce((s, i) => s + parseFloat(i.unitPrice) * i.qtyOrdered, 0);
        const totalPaid = order.payments.reduce((s, p) => s + parseFloat(p.amount), 0) + parseFloat(amount);

        if (totalPaid >= orderTotal) {
          await prisma.schoolOrder.update({
            where: { id: parseInt(schoolOrderId) },
            data: { status: 'DELIVERED' },
          });
        }
      }
    }

    res.status(201).json({ success: true, data: payment });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
