ALTER TABLE `User`
  MODIFY `role` ENUM('SUPER_ADMIN', 'ADMIN', 'CASHIER', 'ORDER_MANAGER', 'INVENTORY_MANAGER') NOT NULL DEFAULT 'ADMIN';

ALTER TABLE `Product`
  ADD COLUMN `barcode` VARCHAR(191) NULL;

CREATE INDEX `Product_barcode_idx` ON `Product`(`barcode`);
CREATE INDEX `Product_name_idx` ON `Product`(`name`);
CREATE INDEX `Product_brand_idx` ON `Product`(`brand`);
CREATE INDEX `Product_stock_idx` ON `Product`(`stock`);

CREATE TABLE `InvoiceSequence` (
  `year` INTEGER NOT NULL,
  `nextNumber` INTEGER NOT NULL DEFAULT 1,
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`year`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Sale` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `invoiceNumber` VARCHAR(191) NOT NULL,
  `requestKey` VARCHAR(191) NULL,
  `customerId` INTEGER NULL,
  `subtotal` DECIMAL(12, 2) NOT NULL,
  `discountType` ENUM('FIXED', 'PERCENTAGE') NOT NULL DEFAULT 'FIXED',
  `discountValue` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `discountAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `gst` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `roundOff` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `grandTotal` DECIMAL(12, 2) NOT NULL,
  `paymentMethod` ENUM('CASH', 'UPI', 'CARD', 'CREDIT') NOT NULL DEFAULT 'CASH',
  `status` ENUM('COMPLETED', 'VOIDED', 'REFUNDED') NOT NULL DEFAULT 'COMPLETED',
  `createdById` INTEGER NULL,
  `voidedById` INTEGER NULL,
  `voidReason` TEXT NULL,
  `voidedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `Sale_invoiceNumber_key`(`invoiceNumber`),
  UNIQUE INDEX `Sale_requestKey_key`(`requestKey`),
  INDEX `Sale_invoiceNumber_idx`(`invoiceNumber`),
  INDEX `Sale_customerId_idx`(`customerId`),
  INDEX `Sale_createdAt_idx`(`createdAt`),
  INDEX `Sale_status_idx`(`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SaleItem` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `saleId` INTEGER NOT NULL,
  `productId` INTEGER NOT NULL,
  `productNameSnapshot` VARCHAR(191) NOT NULL,
  `skuSnapshot` VARCHAR(191) NOT NULL,
  `categoryNameSnapshot` VARCHAR(191) NULL,
  `purchasePriceSnapshot` DECIMAL(12, 2) NOT NULL,
  `sellingPrice` DECIMAL(12, 2) NOT NULL,
  `quantity` INTEGER NOT NULL,
  `discount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `total` DECIMAL(12, 2) NOT NULL,
  `returnedQuantity` INTEGER NOT NULL DEFAULT 0,
  INDEX `SaleItem_saleId_idx`(`saleId`),
  INDEX `SaleItem_productId_idx`(`productId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Payment` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `saleId` INTEGER NOT NULL,
  `paymentMethod` ENUM('CASH', 'UPI', 'CARD', 'CREDIT') NOT NULL,
  `amount` DECIMAL(12, 2) NOT NULL,
  `referenceNumber` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `Payment_saleId_idx`(`saleId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `StockMovement` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `productId` INTEGER NOT NULL,
  `type` ENUM('OPENING_STOCK', 'PURCHASE', 'SALE', 'SALE_RETURN', 'VOID', 'ADJUSTMENT', 'DAMAGE') NOT NULL,
  `quantity` INTEGER NOT NULL,
  `previousStock` INTEGER NOT NULL,
  `newStock` INTEGER NOT NULL,
  `referenceType` VARCHAR(191) NULL,
  `referenceId` VARCHAR(191) NULL,
  `remarks` TEXT NULL,
  `createdById` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `StockMovement_productId_idx`(`productId`),
  INDEX `StockMovement_type_idx`(`type`),
  INDEX `StockMovement_createdAt_idx`(`createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `HeldSale` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `referenceNumber` VARCHAR(191) NOT NULL,
  `customerData` JSON NULL,
  `items` JSON NOT NULL,
  `createdById` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `HeldSale_referenceNumber_key`(`referenceNumber`),
  INDEX `HeldSale_createdAt_idx`(`createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SaleReturn` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `saleId` INTEGER NOT NULL,
  `returnNumber` VARCHAR(191) NOT NULL,
  `refundAmount` DECIMAL(12, 2) NOT NULL,
  `createdById` INTEGER NULL,
  `remarks` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `SaleReturn_returnNumber_key`(`returnNumber`),
  INDEX `SaleReturn_saleId_idx`(`saleId`),
  INDEX `SaleReturn_createdAt_idx`(`createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ReturnItem` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `returnId` INTEGER NOT NULL,
  `saleItemId` INTEGER NOT NULL,
  `productId` INTEGER NOT NULL,
  `quantity` INTEGER NOT NULL,
  `amount` DECIMAL(12, 2) NOT NULL,
  INDEX `ReturnItem_returnId_idx`(`returnId`),
  INDEX `ReturnItem_saleItemId_idx`(`saleItemId`),
  INDEX `ReturnItem_productId_idx`(`productId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Sale`
  ADD CONSTRAINT `Sale_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `Sale_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `Sale_voidedById_fkey` FOREIGN KEY (`voidedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `SaleItem`
  ADD CONSTRAINT `SaleItem_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `Sale`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `SaleItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Payment`
  ADD CONSTRAINT `Payment_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `Sale`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `StockMovement`
  ADD CONSTRAINT `StockMovement_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `StockMovement_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `HeldSale`
  ADD CONSTRAINT `HeldSale_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `SaleReturn`
  ADD CONSTRAINT `SaleReturn_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `Sale`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `SaleReturn_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ReturnItem`
  ADD CONSTRAINT `ReturnItem_returnId_fkey` FOREIGN KEY (`returnId`) REFERENCES `SaleReturn`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ReturnItem_saleItemId_fkey` FOREIGN KEY (`saleItemId`) REFERENCES `SaleItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `ReturnItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
