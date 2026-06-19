require('dotenv').config()
const express = require('express')
const cors = require('cors')
const auth = require('./middleware/authMiddleware')

const app = express()

app.use(cors())
app.use(express.json())

// Health check
app.get('/', (req, res) => res.json({ success: true, message: 'Bookstore API is running' }))

// Public — no token needed
app.use('/api/auth',   require('./routes/auth'))
app.use('/api/portal', require('./routes/portal'))

// Protected — all routes below require valid JWT
app.use(auth)

app.use('/api/books',           require('./routes/books'))
app.use('/api/publishers',      require('./routes/publishers'))
app.use('/api/companies',       require('./routes/companies'))
app.use('/api/schools',         require('./routes/schools'))
app.use('/api/inventory',       require('./routes/inventory'))
app.use('/api/purchase-orders', require('./routes/purchaseOrders'))
app.use('/api/vendor-orders',   require('./routes/vendorOrders'))
app.use('/api/book-sets',       require('./routes/bookSets'))
app.use('/api/school-orders',   require('./routes/schoolOrders'))
app.use('/api/payments',        require('./routes/payments'))
app.use('/api/reconciliation',  require('./routes/reconciliation'))
app.use('/api/invoices',        require('./routes/invoices'))
app.use('/api/shop-settings',   require('./routes/shopSettings'))
app.use('/api/eod-upload',      require('./routes/eodUpload'))

app.use(require('./middleware/errorHandler'))

const os = require('os')

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  const nets = os.networkInterfaces()
  const lan = Object.values(nets).flat().find(n => n.family === 'IPv4' && !n.internal)
  console.log(`Bookstore server running on port ${PORT}`)
  if (lan) console.log(`  Network: http://${lan.address}:${PORT}`)
})

module.exports = app
