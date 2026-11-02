import { randomUUID } from "node:crypto";
import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { canCreateCustomerRequests, canManageCustomerRequests, notifyUsers } from "../lib/customerRequestNotifications.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

const serialize = request => ({
  ...request,
  createdBy: request.createdBy ? { id: request.createdBy.id, name: request.createdBy.name, role: request.createdBy.role } : null,
  assignedTo: request.assignedTo ? { id: request.assignedTo.id, name: request.assignedTo.name } : null,
  items: request.items.map(item => ({
    ...item,
    quantity: Number(item.quantity),
    productCode: item.product?.sku || null,
    category: item.product?.category?.name || null
  })),
  statusHistory: request.statusHistory || []
});
const include = {
  createdBy: true,
  assignedTo: true,
  items: {
    include: {
      product: { select: { sku: true, category: { select: { name: true } } } }
    }
  },
  statusHistory: { include: { changedBy: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: "asc" } }
};
const requestNumber = () => `CR-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 6).toUpperCase()}`;
const parseDate = value => value ? new Date(String(value)) : null;

router.post("/", async (req, res) => {
  if (!canCreateCustomerRequests(req.user.role)) return res.status(403).json({ error: "You cannot create customer requests." });
  const { customerName, notes, items } = req.body || {};
  if (customerName !== undefined && (typeof customerName !== "string" || customerName.trim().length > 120)) return res.status(400).json({ error: "Customer name must be 120 characters or fewer." });
  if (notes !== undefined && (typeof notes !== "string" || notes.length > 2000)) return res.status(400).json({ error: "Notes must be 2000 characters or fewer." });
  if (!Array.isArray(items) || !items.length || items.length > 50) return res.status(400).json({ error: "Add between 1 and 50 products." });
  const normalized = items.map(item => ({
    productId: Number(item?.productId),
    quantity: Number(item?.quantity),
    unit: typeof item?.unit === "string" ? item.unit.trim() : "",
    notes: typeof item?.notes === "string" ? item.notes.trim() : null
  }));
  if (normalized.some(item => !Number.isSafeInteger(item.productId) || item.productId < 1 || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 100000 || !item.unit || item.unit.length > 40)) {
    return res.status(400).json({ error: "Each item needs a valid product, positive whole quantity, and unit." });
  }
  const ids = [...new Set(normalized.map(item => item.productId))];
  const products = await prisma.product.findMany({ where: { id: { in: ids }, active: true }, select: { id: true, name: true } });
  if (products.length !== ids.length) return res.status(400).json({ error: "One or more products are unavailable." });
  const productMap = new Map(products.map(product => [product.id, product]));
  const created = await prisma.$transaction(async tx => {
    const request = await tx.customerProductRequest.create({
      data: {
        requestNumber: requestNumber(),
        customerName: customerName?.trim() || null,
        notes: notes?.trim() || null,
        createdById: req.user.id,
        items: { create: normalized.map(item => ({ ...item, productNameSnapshot: productMap.get(item.productId).name })) },
        statusHistory: { create: { status: "PENDING", changedById: req.user.id, note: "Request submitted" } }
      },
      include
    });
    return request;
  });
  await notifyUsers({ requestId: created.id, title: "New customer request", message: `${created.requestNumber} submitted by ${created.createdBy.name}` });
  res.status(201).json(serialize(created));
});

router.get("/my-requests", async (req, res) => {
  const requests = await listRequests(req, false);
  res.json(requests.map(serialize));
});

router.get("/", async (req, res) => {
  if (!canManageCustomerRequests(req.user.role)) return res.status(403).json({ error: "You cannot view incoming requests." });
  const requests = await listRequests(req, true);
  res.json(requests.map(serialize));
});

async function listRequests(req, incoming) {
  const where = incoming ? {} : { createdById: req.user.id };
  if (req.query.status && ["PENDING", "ACKNOWLEDGED", "PROCESSING", "COMPLETED", "REJECTED"].includes(String(req.query.status))) where.status = String(req.query.status);
  const from = parseDate(req.query.from);
  const to = parseDate(req.query.to);
  if (from && !Number.isNaN(from.getTime())) where.createdAt = { ...(where.createdAt || {}), gte: from };
  if (to && !Number.isNaN(to.getTime())) { to.setHours(23, 59, 59, 999); where.createdAt = { ...(where.createdAt || {}), lte: to }; }
  return prisma.customerProductRequest.findMany({ where, include, orderBy: { createdAt: "desc" }, take: 200 });
}

router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const request = await prisma.customerProductRequest.findUnique({ where: { id }, include });
  if (!request || (!canManageCustomerRequests(req.user.role) && request.createdById !== req.user.id)) return res.status(404).json({ error: "Request not found." });
  res.json(serialize(request));
});

router.patch("/:id/status", async (req, res) => {
  if (!canManageCustomerRequests(req.user.role)) return res.status(403).json({ error: "Only indoor staff can update request status." });
  const id = Number(req.params.id);
  const status = String(req.body?.status || "");
  const allowed = ["ACKNOWLEDGED", "PROCESSING", "COMPLETED", "REJECTED"];
  if (!allowed.includes(status)) return res.status(400).json({ error: "Invalid request status." });
  const rejectionReason = req.body?.rejectionReason;
  if (status === "REJECTED" && (typeof rejectionReason !== "string" || !rejectionReason.trim())) return res.status(400).json({ error: "A rejection reason is required." });
  const current = await prisma.customerProductRequest.findUnique({ where: { id } });
  if (!current) return res.status(404).json({ error: "Request not found." });
  const transitions = {
    PENDING: ["ACKNOWLEDGED", "REJECTED"],
    ACKNOWLEDGED: ["PROCESSING", "REJECTED"],
    PROCESSING: ["COMPLETED", "REJECTED"],
    COMPLETED: [],
    REJECTED: []
  };
  if (!transitions[current.status].includes(status)) return res.status(409).json({ error: `Cannot change ${current.status.toLowerCase()} request to ${status.toLowerCase()}.` });
  const updates = {
    status,
    assignedToId: req.user.id,
    ...(status === "ACKNOWLEDGED" && !current.acknowledgedAt ? { acknowledgedAt: new Date() } : {}),
    ...(status === "COMPLETED" ? { completedAt: new Date() } : {}),
    ...(status === "REJECTED" ? { rejectionReason: rejectionReason.trim() } : {})
  };
  const updated = await prisma.$transaction(async tx => {
    const request = await tx.customerProductRequest.update({ where: { id }, data: updates, include });
    await tx.customerProductRequestStatusHistory.create({ data: { requestId: id, status, changedById: req.user.id, note: status === "REJECTED" ? rejectionReason.trim() : null } });
    return request;
  });
  await notifyUsers({ requestId: id, userIds: [current.createdById], title: "Customer request updated", message: `${updated.requestNumber} is now ${status.toLowerCase()}.` });
  res.json(serialize(updated));
});

export default router;
