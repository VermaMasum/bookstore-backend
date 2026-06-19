const router = require('express').Router()
const prisma = require('../lib/prisma')

router.get('/', async (req, res, next) => {
  try {
    let s = await prisma.shopSettings.findUnique({ where: { id: 1 } })
    if (!s) {
      s = await prisma.shopSettings.create({ data: { id: 1 } })
    }
    res.json({ success: true, data: s })
  } catch (e) { next(e) }
})

router.put('/', async (req, res, next) => {
  try {
    const { shopName, address, city, state, pincode, gstin, phone, email, bankName, accountNo, ifscCode } = req.body
    const s = await prisma.shopSettings.upsert({
      where: { id: 1 },
      update: { shopName, address, city, state, pincode, gstin, phone, email, bankName, accountNo, ifscCode },
      create: { id: 1, shopName: shopName || 'My Bookstore', address: address || '', city: city || '', state: state || '', pincode: pincode || '', gstin: gstin || '', phone: phone || '', email: email || '', bankName: bankName || '', accountNo: accountNo || '', ifscCode: ifscCode || '' },
    })
    res.json({ success: true, data: s })
  } catch (e) { next(e) }
})

module.exports = router
