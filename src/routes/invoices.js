const router = require('express').Router()
const prisma = require('../lib/prisma')

function fmtNum(n, len) {
  return String(n).padStart(len, '0')
}

function makeInvoiceNo(seq) {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = fmtNum(d.getMonth() + 1, 2)
  return `INV-${yyyy}${mm}-${fmtNum(seq, 4)}`
}

function calcItem(unitPrice, qty, discountPct) {
  const gross = parseFloat(unitPrice) * qty
  const disc = gross * (parseFloat(discountPct || 0) / 100)
  return { gross, disc, net: gross - disc }
}

// POST /api/invoices/generate
// Body: { orderType, orderId, discountPct?, gstRate?, supplyType? }
router.post('/generate', async (req, res, next) => {
  try {
    const { orderType, orderId, discountPct = 0, gstRate = 0, supplyType = 'INTRA', buyerAddressOverride } = req.body
    if (!orderType || !orderId) return res.status(400).json({ message: 'orderType and orderId are required' })
    const oid = parseInt(orderId)
    const disc = parseFloat(discountPct || 0)
    const gst = parseFloat(gstRate || 0)

    const exists = orderType === 'B2B'
      ? await prisma.invoice.findUnique({ where: { vendorOrderId: oid } })
      : await prisma.invoice.findUnique({ where: { schoolOrderId: oid } })
    if (exists) return res.status(400).json({ message: 'Invoice already exists for this order' })

    // Increment counter atomically
    const settings = await prisma.shopSettings.upsert({
      where: { id: 1 },
      update: { lastInvoiceNo: { increment: 1 } },
      create: { id: 1, lastInvoiceNo: 1 },
    })
    const invoiceNumber = makeInvoiceNo(settings.lastInvoiceNo)

    let invoice
    if (orderType === 'B2B') {
      const order = await prisma.vendorOrder.findUnique({
        where: { id: oid },
        include: {
          company: true,
          items: { include: { book: { include: { publisher: true } } } },
        },
      })
      if (!order) return res.status(404).json({ message: 'Vendor order not found' })

      let subtotal = 0, discountTotal = 0
      const itemRows = order.items.map(i => {
        const { gross, disc: d, net } = calcItem(i.unitPrice, i.quantity, disc)
        subtotal += gross; discountTotal += d
        return {
          bookTitle: i.book.title,
          bookClass: i.book.level || '',
          publisher: i.book.publisher?.name || '',
          isbn: i.book.isbn || '',
          hsnCode: '4901',
          qty: i.quantity,
          unitPrice: parseFloat(i.unitPrice),
          discountPct: disc,
          amount: Math.round(net * 100) / 100,
        }
      })

      const taxableAmount = subtotal - discountTotal
      const taxAmount = Math.round(taxableAmount * gst / 100 * 100) / 100

      invoice = await prisma.invoice.create({
        data: {
          invoiceNumber, orderType: 'B2B',
          vendorOrder: { connect: { id: order.id } },
          buyerName: order.company.name,
          buyerAddress: buyerAddressOverride !== undefined ? buyerAddressOverride : (order.company.address || ''),
          buyerGstin: order.company.gstin || '',
          buyerPhone: order.company.contact || '',
          buyerEmail: order.company.email || '',
          subtotal: Math.round(subtotal * 100) / 100,
          discountTotal: Math.round(discountTotal * 100) / 100,
          gstRate: gst,
          supplyType,
          taxAmount,
          totalAmount: Math.round((taxableAmount + taxAmount) * 100) / 100,
          notes: order.notes,
          items: { create: itemRows },
        },
        include: { items: true },
      })
    } else {
      const order = await prisma.schoolOrder.findUnique({
        where: { id: oid },
        include: {
          school: true,
          items: { include: { book: { include: { publisher: true } } } },
        },
      })
      if (!order) return res.status(404).json({ message: 'School order not found' })

      let subtotal = 0, discountTotal = 0
      const itemRows = order.items.map(i => {
        const { gross, disc: d, net } = calcItem(i.unitPrice, i.qtyOrdered, disc)
        subtotal += gross; discountTotal += d
        return {
          bookTitle: i.book.title,
          bookClass: i.book.level || '',
          publisher: i.book.publisher?.name || '',
          isbn: i.book.isbn || '',
          hsnCode: '4901',
          qty: i.qtyOrdered,
          unitPrice: parseFloat(i.unitPrice),
          discountPct: disc,
          amount: Math.round(net * 100) / 100,
        }
      })

      const taxableAmount = subtotal - discountTotal
      const taxAmount = Math.round(taxableAmount * gst / 100 * 100) / 100

      invoice = await prisma.invoice.create({
        data: {
          invoiceNumber, orderType: 'B2C',
          schoolOrder: { connect: { id: order.id } },
          buyerName: order.school.name,
          buyerAddress: buyerAddressOverride !== undefined ? buyerAddressOverride : (order.school.address || ''),
          buyerGstin: '',
          buyerPhone: order.school.contact || '',
          buyerEmail: order.school.email || '',
          subtotal: Math.round(subtotal * 100) / 100,
          discountTotal: Math.round(discountTotal * 100) / 100,
          gstRate: gst,
          supplyType,
          taxAmount,
          totalAmount: Math.round((taxableAmount + taxAmount) * 100) / 100,
          notes: order.notes,
          items: { create: itemRows },
        },
        include: { items: true },
      })
    }

    res.json({ success: true, data: invoice })
  } catch (e) { next(e) }
})

// GET /api/invoices
router.get('/', async (req, res, next) => {
  try {
    const invoices = await prisma.invoice.findMany({
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ success: true, data: invoices })
  } catch (e) { next(e) }
})

// GET /api/invoices/:id  (includes shopSettings for printing)
router.get('/:id', async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { items: true },
    })
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' })

    let shop = await prisma.shopSettings.findUnique({ where: { id: 1 } })
    if (!shop) shop = { shopName: 'My Bookstore', address: '', city: '', state: '', pincode: '', gstin: '', phone: '', email: '', bankName: '', accountNo: '', ifscCode: '' }

    res.json({ success: true, data: { ...invoice, shopSettings: shop } })
  } catch (e) { next(e) }
})

// DELETE /api/invoices/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.invoice.delete({ where: { id: parseInt(req.params.id) } })
    res.json({ success: true, message: 'Invoice deleted' })
  } catch (e) { next(e) }
})

module.exports = router
