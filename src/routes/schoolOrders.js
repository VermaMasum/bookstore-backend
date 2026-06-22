const router = require("express").Router();
const prisma = require("../lib/prisma");

// GET /api/school-orders
router.get("/", async (req, res, next) => {
  try {
    const orders = await prisma.schoolOrder.findMany({
      include: {
        school: true,
        bookSet: true,
        items: { include: { book: true } },
        payments: true,
      },
      orderBy: { orderDate: "desc" },
    });
    res.json({ success: true, data: orders });
  } catch (err) {
    next(err);
  }
});

// GET /api/school-orders/:id
router.get("/:id", async (req, res, next) => {
  try {
    const order = await prisma.schoolOrder.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        school: true,
        bookSet: true,
        items: { include: { book: true } },
        payments: true,
      },
    });
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "School order not found" });
    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
});

// POST /api/school-orders — create from multiple sets or manual items
router.post("/", async (req, res, next) => {
  try {
    const { schoolId, sets, notes, items } = req.body;
    let orderItems = items;

    if (sets && sets.length > 0) {
      const itemMap = {};
      for (const s of sets) {
        const qty = Math.max(1, parseInt(s.quantity) || 1);
        const set = await prisma.bookSet.findUnique({
          where: { id: parseInt(s.setId) },
          include: { items: { include: { book: true } } },
        });
        if (!set)
          return res
            .status(404)
            .json({ success: false, message: "Book set not found" });
        for (const si of set.items) {
          if (itemMap[si.bookId]) {
            itemMap[si.bookId].qtyOrdered += si.quantity * qty;
          } else {
            itemMap[si.bookId] = {
              bookId: si.bookId,
              qtyOrdered: si.quantity * qty,
              unitPrice: parseFloat(si.book.mrp),
            };
          }
        }
      }
      orderItems = Object.values(itemMap);
    }

    const order = await prisma.schoolOrder.create({
      data: {
        schoolId: parseInt(schoolId),
        setId: null,
        notes,
        items: {
          create: orderItems.map((i) => ({
            bookId: parseInt(i.bookId),
            qtyOrdered: parseInt(i.qtyOrdered),
            qtyDelivered: 0,
            unitPrice: parseFloat(i.unitPrice),
          })),
        },
      },
      include: {
        school: true,
        bookSet: true,
        items: { include: { book: true } },
      },
    });
    res.status(201).json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
});

// PUT /api/school-orders/:id/deliver — update delivered qty, deduct inventory
router.put("/:id/deliver", async (req, res, next) => {
  try {
    const orderId = parseInt(req.params.id);
    const { deliveries } = req.body;
    // deliveries: [{ itemId, qtyDelivered }]

    const order = await prisma.schoolOrder.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });

    const updates = [];
    const inventoryDeductions = [];

    for (const d of deliveries) {
      const item = order.items.find((i) => i.id === parseInt(d.itemId));
      if (!item) continue;
      const newDelivered = item.qtyDelivered + parseInt(d.qtyDelivered);
      const additionalQty = parseInt(d.qtyDelivered);

      updates.push(
        prisma.schoolOrderItem.update({
          where: { id: item.id },
          data: { qtyDelivered: newDelivered },
        }),
      );

      inventoryDeductions.push(
        prisma.inventory.update({
          where: { bookId: item.bookId },
          data: { quantity: { decrement: additionalQty } },
        }),
      );
    }

    // Determine new order status
    const updatedItems = order.items.map((item) => {
      const d = deliveries.find((d) => parseInt(d.itemId) === item.id);
      const delivered = item.qtyDelivered + (d ? parseInt(d.qtyDelivered) : 0);
      return { ...item, qtyDelivered: delivered };
    });
    const allDelivered = updatedItems.every(
      (i) => i.qtyDelivered >= i.qtyOrdered,
    );
    const anyDelivered = updatedItems.some((i) => i.qtyDelivered > 0);
    const newStatus = allDelivered
      ? "DELIVERED"
      : anyDelivered
        ? "PARTIAL"
        : "PENDING";

    await prisma.$transaction([
      ...updates,
      ...inventoryDeductions,
      prisma.schoolOrder.update({
        where: { id: orderId },
        data: { status: newStatus },
      }),
    ]);

    res.json({ success: true, message: "Delivery updated", status: newStatus });
  } catch (err) {
    next(err);
  }
});

// PUT /api/school-orders/:id/cancel
router.put("/:id/cancel", async (req, res, next) => {
  try {
    const order = await prisma.schoolOrder.update({
      where: { id: parseInt(req.params.id) },
      data: { status: "CANCELLED" },
    });
    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
