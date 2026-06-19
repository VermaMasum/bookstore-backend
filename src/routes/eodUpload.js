const router = require('express').Router()
const prisma = require('../lib/prisma')
const multer = require('multer')
const { parse } = require('csv-parse/sync')

const upload = multer({ storage: multer.memoryStorage() })

// POST /api/eod-upload
// CSV columns: school_name, isbn, qty, unit_price, notes (optional)
router.post('/', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'CSV file is required' })

    const rows = parse(req.file.buffer.toString(), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    })

    if (!rows.length) return res.status(400).json({ message: 'CSV file is empty' })

    const errors = []
    // Group rows by school_name
    const bySchool = {}
    for (const [idx, row] of rows.entries()) {
      const lineNo = idx + 2
      const schoolName = row.school_name?.trim()
      const isbn = row.isbn?.trim()
      const qty = parseInt(row.qty)
      const unitPrice = parseFloat(row.unit_price)

      if (!schoolName) { errors.push(`Row ${lineNo}: school_name is required`); continue }
      if (!isbn)       { errors.push(`Row ${lineNo}: isbn is required`); continue }
      if (!qty || qty < 1) { errors.push(`Row ${lineNo}: qty must be a positive number`); continue }
      if (!unitPrice || unitPrice <= 0) { errors.push(`Row ${lineNo}: unit_price must be a positive number`); continue }

      if (!bySchool[schoolName]) bySchool[schoolName] = []
      bySchool[schoolName].push({ isbn, qty, unitPrice, notes: row.notes?.trim() || '' })
    }

    const created = []

    for (const [schoolName, items] of Object.entries(bySchool)) {
      // Find school (case-insensitive)
      const school = await prisma.school.findFirst({
        where: { name: { equals: schoolName, mode: 'insensitive' } },
      })
      if (!school) { errors.push(`School not found: "${schoolName}"`); continue }

      // Resolve books by ISBN
      const resolvedItems = []
      for (const item of items) {
        const book = await prisma.book.findFirst({ where: { isbn: item.isbn } })
        if (!book) { errors.push(`Book ISBN not found: ${item.isbn} (school: ${schoolName})`); continue }
        resolvedItems.push({ bookId: book.id, qtyOrdered: item.qty, unitPrice: item.unitPrice })
      }

      if (resolvedItems.length === 0) continue

      const order = await prisma.schoolOrder.create({
        data: {
          schoolId: school.id,
          notes: `EOD Upload — ${new Date().toLocaleDateString('en-IN')}`,
          items: {
            create: resolvedItems.map(i => ({
              bookId: i.bookId,
              qtyOrdered: i.qtyOrdered,
              unitPrice: i.unitPrice,
            })),
          },
        },
        include: { school: true, items: true },
      })
      created.push({ orderId: order.id, school: school.name, itemCount: resolvedItems.length })
    }

    res.json({
      success: true,
      message: `${created.length} order(s) created, ${errors.length} error(s)`,
      created,
      errors,
    })
  } catch (e) { next(e) }
})

// GET /api/eod-upload/template  — download sample CSV
router.get('/template', (req, res) => {
  const csv = `school_name,isbn,qty,unit_price,notes\nDPS School,9789387421022,5,400,\nApeejay School,9788174507242,3,220,Class 11 set`
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename="eod_upload_template.csv"')
  res.send(csv)
})

module.exports = router
