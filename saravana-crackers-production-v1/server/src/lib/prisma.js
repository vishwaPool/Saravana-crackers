import { PrismaClient } from "@prisma/client";

// Remote databases need enough time to finish an atomic multi-item bill.
// All inventory/admin transactions use the same bounded defaults.
export const transactionOptions = { maxWait: 10000, timeout: 30000 };
export const prisma = new PrismaClient({ transactionOptions });