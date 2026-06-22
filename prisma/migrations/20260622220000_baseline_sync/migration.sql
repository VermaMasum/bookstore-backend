-- Drop FK constraints referencing old tables
ALTER TABLE "PurchaseOrder" DROP CONSTRAINT IF EXISTS "PurchaseOrder_supplierId_fkey";
ALTER TABLE "VendorOrder" DROP CONSTRAINT IF EXISTS "VendorOrder_vendorId_fkey";
ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_vendorId_fkey";

-- Drop mrp from Book
ALTER TABLE "Book" DROP COLUMN IF EXISTS "mrp";

-- Drop old FK columns
ALTER TABLE "PurchaseOrder" DROP COLUMN IF EXISTS "supplierId";
ALTER TABLE "VendorOrder" DROP COLUMN IF EXISTS "vendorId";
ALTER TABLE "Payment" DROP COLUMN IF EXISTS "vendorId";

-- Drop old tables
DROP TABLE IF EXISTS "Supplier";
DROP TABLE IF EXISTS "Vendor";

-- Drop old enum
DROP TYPE IF EXISTS "SupplierType";

-- CreateTable Company
CREATE TABLE IF NOT EXISTS "Company" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "email" TEXT,
    "address" TEXT,
    "creditLimit" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable ShopSettings
CREATE TABLE IF NOT EXISTS "ShopSettings" (
    "id" SERIAL NOT NULL,
    "shopName" TEXT NOT NULL DEFAULT 'My Bookstore',
    "address" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT '',
    "pincode" TEXT NOT NULL DEFAULT '',
    "gstin" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "bankName" TEXT NOT NULL DEFAULT '',
    "accountNo" TEXT NOT NULL DEFAULT '',
    "ifscCode" TEXT NOT NULL DEFAULT '',
    "lastInvoiceNo" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ShopSettings_pkey" PRIMARY KEY ("id")
);

-- Add companyId to PurchaseOrder
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "companyId" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PurchaseOrder" ALTER COLUMN "companyId" DROP DEFAULT;

-- Add companyId to VendorOrder
ALTER TABLE "VendorOrder" ADD COLUMN IF NOT EXISTS "companyId" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "VendorOrder" ALTER COLUMN "companyId" DROP DEFAULT;

-- Add companyId to Payment
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "companyId" INTEGER;

-- AddForeignKey for companyId
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VendorOrder" ADD CONSTRAINT "VendorOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
