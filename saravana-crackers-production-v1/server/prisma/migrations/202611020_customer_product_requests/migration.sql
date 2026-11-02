ALTER TABLE `User` MODIFY `role` ENUM('SUPER_ADMIN', 'ADMIN', 'CASHIER', 'ORDER_MANAGER', 'INVENTORY_MANAGER', 'OUTDOOR_SALESPERSON', 'INDOOR_STAFF') NOT NULL DEFAULT 'ADMIN';

CREATE TABLE `CustomerProductRequest` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `requestNumber` VARCHAR(191) NOT NULL,
  `customerName` VARCHAR(191) NULL,
  `notes` TEXT NULL,
  `createdById` INTEGER NOT NULL,
  `assignedToId` INTEGER NULL,
  `status` ENUM('PENDING', 'ACKNOWLEDGED', 'PROCESSING', 'COMPLETED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  `rejectionReason` TEXT NULL,
  `acknowledgedAt` DATETIME(3) NULL,
  `completedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `CustomerProductRequest_requestNumber_key`(`requestNumber`),
  INDEX `CustomerProductRequest_createdById_createdAt_idx`(`createdById`, `createdAt`),
  INDEX `CustomerProductRequest_status_createdAt_idx`(`status`, `createdAt`),
  INDEX `CustomerProductRequest_assignedToId_status_idx`(`assignedToId`, `status`),
  CONSTRAINT `CustomerProductRequest_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `CustomerProductRequest_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CustomerProductRequestItem` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `requestId` INTEGER NOT NULL,
  `productId` INTEGER NOT NULL,
  `productNameSnapshot` VARCHAR(191) NOT NULL,
  `quantity` INTEGER NOT NULL,
  `unit` VARCHAR(191) NOT NULL,
  `notes` TEXT NULL,
  INDEX `CustomerProductRequestItem_requestId_idx`(`requestId`),
  INDEX `CustomerProductRequestItem_productId_idx`(`productId`),
  CONSTRAINT `CustomerProductRequestItem_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `CustomerProductRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `CustomerProductRequestItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CustomerProductRequestStatusHistory` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `requestId` INTEGER NOT NULL,
  `status` ENUM('PENDING', 'ACKNOWLEDGED', 'PROCESSING', 'COMPLETED', 'REJECTED') NOT NULL,
  `note` TEXT NULL,
  `changedById` INTEGER NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `CustomerProductRequestStatusHistory_requestId_createdAt_idx`(`requestId`, `createdAt`),
  CONSTRAINT `CustomerProductRequestStatusHistory_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `CustomerProductRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `CustomerProductRequestStatusHistory_changedById_fkey` FOREIGN KEY (`changedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DeviceNotificationToken` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `userId` INTEGER NOT NULL,
  `deviceToken` VARCHAR(191) NOT NULL,
  `platform` VARCHAR(191) NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `DeviceNotificationToken_deviceToken_key`(`deviceToken`),
  INDEX `DeviceNotificationToken_userId_isActive_idx`(`userId`, `isActive`),
  CONSTRAINT `DeviceNotificationToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Notification` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `userId` INTEGER NOT NULL,
  `requestId` INTEGER NULL,
  `title` VARCHAR(191) NOT NULL,
  `message` TEXT NOT NULL,
  `isRead` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `Notification_userId_isRead_createdAt_idx`(`userId`, `isRead`, `createdAt`),
  INDEX `Notification_requestId_idx`(`requestId`),
  CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `Notification_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `CustomerProductRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
