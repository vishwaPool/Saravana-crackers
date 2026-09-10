import { validateRequest } from "../lib/validation.js";
import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { orderNo, publicProduct } from "../lib/helpers.js";

const router = Router();
router.use(validateRequest);

router.get("/settings", async (_req, res) => {
  res.json(await prisma.shopSettings.findUnique({ where: { id: 1 } }) || {});
});

router.get("/categories", async (_req, res) => {
  res.json(await prisma.category.findMany({
    where: { active: true },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }]
  }));
});

router.get("/products", async (req, res) => {
  const category = String(req.query.category || "");
  const search = String(req.query.search || "");

  const products = await prisma.product.findMany({
    where: {
      active: true,
      ...(category ? { category: { slug: category } } : {}),
      ...(search ? {
        OR: [
          { name: { contains: search } },
          { sku: { contains: search } },
          { category: { name: { contains: search } } }
        ]
      } : {})
    },
    include: { category: true },
    orderBy: [{ featured: "desc" }, { name: "asc" }]
  });

  res.json(products.map(publicProduct));
});

router.get("/offers", async (_req, res) => {
  const now = new Date();
  const offers = await prisma.offer.findMany({
    where: { active: true, startAt: { lte: now }, endAt: { gte: now } },
    orderBy: { startAt: "desc" }
  });

  res.json(offers.map(o => ({
    ...o,
    value: Number(o.value),
    minOrder: o.minOrder ? Number(o.minOrder) : null
  })));
});

router.post("/orders", async (req, res) => {
  const { customer, items, deliveryMethod = "PICKUP", notes = "" } = req.body;

  if (!customer?.name || !customer?.phone || !Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: "Invalid order" });
  }

  const ids = [...new Set(items.map(i => Number(i.productId)))];
  const products = await prisma.product.findMany({
    where: { id: { in: ids }, active: true }
  });

  if (products.length !== ids.length) {
    return res.status(400).json({ error: "One or more products are unavailable" });
  }

  const map = new Map(products.map(p => [p.id, p]));
  let subtotal = 0;
  const normalized = [];

  for (const item of items) {
    const product = map.get(Number(item.productId));
    const qty = Number(item.quantity);

    if (!product || qty < 1) return res.status(400).json({ error: "Invalid cart item" });
    if (product.stock < qty) {
      return res.status(400).json({ error: `${product.name} has only ${product.stock} in stock` });
    }

    const unitPrice = Number(product.retailPrice);
    const lineTotal = unitPrice * qty;
    subtotal += lineTotal;
    normalized.push({ product, qty, unitPrice, lineTotal });
  }

  const settings = await prisma.shopSettings.findUnique({ where: { id: 1 } });
  const deliveryCharge = deliveryMethod === "DELIVERY" ? Number(settings?.deliveryCharge || 0) : 0;

  let discount = 0;
  const now = new Date();
  const offer = await prisma.offer.findFirst({
    where: {
      active: true,
      startAt: { lte: now },
      endAt: { gte: now },
      OR: [{ minOrder: null }, { minOrder: { lte: subtotal } }]
    },
    orderBy: { value: "desc" }
  });

  if (offer) {
    discount = offer.type === "PERCENTAGE"
      ? subtotal * (Number(offer.value) / 100)
      : Number(offer.value);
    discount = Math.min(discount, subtotal);
  }

  const total = subtotal - discount + deliveryCharge;
  const orderNumber = orderNo();

  const created = await prisma.$transaction(async tx => {
    const savedCustomer = await tx.customer.upsert({
      where: { phone: customer.phone },
      update: {
        name: customer.name,
        whatsapp: customer.whatsapp || customer.phone,
        email: customer.email || null,
        address: customer.address || null,
        city: customer.city || null,
        district: customer.district || null,
        state: customer.state || null,
        pincode: customer.pincode || null
      },
      create: {
        name: customer.name,
        phone: customer.phone,
        whatsapp: customer.whatsapp || customer.phone,
        email: customer.email || null,
        address: customer.address || null,
        city: customer.city || null,
        district: customer.district || null,
        state: customer.state || null,
        pincode: customer.pincode || null
      }
    });

    for (const item of normalized) {
      const changed = await tx.product.updateMany({
        where: { id: item.product.id, stock: { gte: item.qty } },
        data: { stock: { decrement: item.qty } }
      });

      if (changed.count !== 1) throw new Error(`Stock changed for ${item.product.name}`);

      await tx.stockTransaction.create({
        data: {
          productId: item.product.id,
          type: "SALE",
          quantity: -item.qty,
          reference: orderNumber
        }
      });
    }

    return tx.order.create({
      data: {
        orderNumber,
        customerId: savedCustomer.id,
        subtotal,
        discount,
        deliveryCharge,
        total,
        deliveryMethod,
        deliveryAddress: customer.address || null,
        notes,
        items: {
          create: normalized.map(i => ({
            productId: i.product.id,
            productName: i.product.name,
            sku: i.product.sku,
            unitPrice: i.unitPrice,
            quantity: i.qty,
            lineTotal: i.lineTotal
          }))
        },
        statusHistory: {
          create: { status: "NEW", note: "Order placed" }
        }
      }
    });
  });

  res.status(201).json({
    orderNumber: created.orderNumber,
    total: Number(created.total),
    whatsapp: settings?.whatsapp || process.env.SHOP_WHATSAPP || ""
  });
});

router.get("/orders/track/:orderNumber", async (req, res) => {
  const order = await prisma.order.findFirst({
    where: {
      orderNumber: req.params.orderNumber,
      customer: { phone: String(req.query.phone || "") }
    },
    select: {
      orderNumber: true,
      status: true,
      total: true,
      createdAt: true,
      statusHistory: { orderBy: { createdAt: "asc" } }
    }
  });

  if (!order) return res.status(404).json({ error: "Order not found" });

  res.json({ ...order, total: Number(order.total) });
});

export default router;
