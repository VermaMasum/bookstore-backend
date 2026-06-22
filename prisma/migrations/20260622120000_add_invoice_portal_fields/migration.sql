-- AlterTable: Add phone and role to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'ADMIN';

-- AlterTable: Add portal fields to SchoolOrder
ALTER TABLE "SchoolOrder" ADD COLUMN IF NOT EXISTS "userId" INTEGER;
ALTER TABLE "SchoolOrder" ADD COLUMN IF NOT EXISTS "childName" TEXT;
ALTER TABLE "SchoolOrder" ADD COLUMN IF NOT EXISTS "guardianName" TEXT;

-- CreateTable: Invoice
CREATE TABLE IF NOT EXISTS "Invoice" (
    "id" SERIAL NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "orderType" "OrderType" NOT NULL,
    "vendorOrderId" INTEGER,
    "schoolOrderId" INTEGER,
    "buyerName" TEXT NOT NULL,
    "buyerAddress" TEXT NOT NULL DEFAULT '',
    "buyerGstin" TEXT NOT NULL DEFAULT '',
    "buyerPhone" TEXT NOT NULL DEFAULT '',
    "buyerEmail" TEXT NOT NULL DEFAULT '',
    "subtotal" DECIMAL(10,2) NOT NULL,
    "discountTotal" DECIMAL(10,2) NOT NULL,
    "gstRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "supplyType" TEXT NOT NULL DEFAULT 'INTRA',
    "taxAmount" DECIMAL(10,2) NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable: InvoiceItem
CREATE TABLE IF NOT EXISTS "InvoiceItem" (
    "id" SERIAL NOT NULL,
    "invoiceId" INTEGER NOT NULL,
    "bookTitle" TEXT NOT NULL,
    "bookClass" TEXT NOT NULL DEFAULT '',
    "publisher" TEXT NOT NULL DEFAULT '',
    "isbn" TEXT NOT NULL DEFAULT '',
    "hsnCode" TEXT NOT NULL DEFAULT '4901',
    "qty" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "discountPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amount" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_vendorOrderId_key" ON "Invoice"("vendorOrderId");
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_schoolOrderId_key" ON "Invoice"("schoolOrderId");

-- AddForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT IF EXISTS "Invoice_vendorOrderId_fkey";
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_vendorOrderId_fkey" FOREIGN KEY ("vendorOrderId") REFERENCES "VendorOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Invoice" DROP CONSTRAINT IF EXISTS "Invoice_schoolOrderId_fkey";
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_schoolOrderId_fkey" FOREIGN KEY ("schoolOrderId") REFERENCES "SchoolOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InvoiceItem" DROP CONSTRAINT IF EXISTS "InvoiceItem_invoiceId_fkey";
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
