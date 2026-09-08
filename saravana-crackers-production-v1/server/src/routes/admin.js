import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { slugify } from "../lib/helpers.js";
import { requireAuth } from "../middleware/auth.js";
import posRoutes from "./adminPos.js";

const router = Router();
router.use(requireAuth);
router.use(posRoutes);

const audit = (userId, action, entity, entityId, details = {}) =>
  prisma.auditLog.create({
    data: {
      userId,
      action,
      entity,
      entityId: String(entityId || ""),
      details: JSON.stringify(details)
    }
  });

router.get("/dashboard", async (_req, res) => {
  const start = new Date();
  start.setHours(0,0,0,0);

  const [products, orders, newOrders, customers, revenue] = await Promise.all([
    prisma.product.count({ where: { active: true } }),
    prisma.order.count({ where: { createdAt: { gte: start } } }),
    prisma.order.count({ where: { status: "NEW" } }),
    prisma.customer.count(),
    prisma.order.aggregate({
      where: { createdAt: { gte: start }, status: { not: "CANCELLED" } },
      _sum: { total: true }
    })
  ]);

  const allProducts = await prisma.product.findMany({ where: { active: true }, select: { stock: true, minStock: true } });
  const lowStock = allProducts.filter(p => p.stock <= p.minStock).length;

  res.json({
    productCount: products,
    todayOrders: orders,
    newOrders,
    customers,
    lowStock,
    todayRevenue: Number(revenue._sum.total || 0)
  });
});

router.get("/categories", async (_req, res) => {
  res.json(await prisma.category.findMany({ orderBy: [{ displayOrder: "asc" }, { name: "asc" }] }));
});

router.post("/categories", async (req, res) => {
  const category = await prisma.category.create({
    data: {
      name: req.body.name,
      slug: slugify(req.body.name),
      description: req.body.description || null,
      imageUrl: req.body.imageUrl || null,
      displayOrder: Number(req.body.displayOrder || 0),
      active: req.body.active !== false
    }
  });

  await audit(req.user.id, "CREATE", "Category", category.id, category);
  res.status(201).json(category);
});

router.get("/products", async (_req, res) => {
  const products = await prisma.product.findMany({
    include: { category: true },
    orderBy: { updatedAt: "desc" }
  });

  res.json(products.map(p => ({
    ...p,
    purchasePrice: Number(p.purchasePrice),
    mrp: Number(p.mrp),
    retailPrice: Number(p.retailPrice),
    wholesalePrice: p.wholesalePrice ? Number(p.wholesalePrice) : null
  })));
});

router.post("/products", async (req, res) => {
  const data = req.body;

  const product = await prisma.$transaction(async tx => {
    const p = await tx.product.create({
      data: {
        sku: data.sku,
        barcode: data.barcode || null,
        name: data.name,
        slug: slugify(data.name),
        categoryId: Number(data.categoryId),
        description: data.description || null,
        brand: data.brand || null,
        purchasePrice: Number(data.purchasePrice),
        mrp: Number(data.mrp),
        retailPrice: Number(data.retailPrice),
        wholesalePrice: data.wholesalePrice ? Number(data.wholesalePrice) : null,
        stock: Number(data.stock || 0),
        minStock: Number(data.minStock || 0),
        unit: data.unit || "1 Box",
        imageUrl: data.imageUrl || null,
        featured: Boolean(data.featured),
        active: data.active !== false
      }
    });

    if (p.stock > 0) {
      await tx.stockTransaction.create({
        data: {
          productId: p.id,
          type: "OPENING",
          quantity: p.stock,
          reference: "OPENING"
        }
      });
      await tx.stockMovement.create({
        data: {
          productId: p.id,
          type: "OPENING_STOCK",
          quantity: p.stock,
          previousStock: 0,
          newStock: p.stock,
          referenceType: "PRODUCT",
          referenceId: String(p.id),
          remarks: "Opening stock",
          createdById: req.user.id
        }
      });
    }

    return p;
  });

  await audit(req.user.id, "CREATE", "Product", product.id, data);
  res.status(201).json(product);
});

router.put("/products/:id", async (req, res) => {
  const id = Number(req.params.id);
  const current = await prisma.product.findUnique({ where: { id } });
  if (!current) return res.status(404).json({ error: "Product not found" });

  const data = req.body;
  const newStock = Number(data.stock || 0);
  const delta = newStock - current.stock;

  const product = await prisma.$transaction(async tx => {
    const p = await tx.product.update({
      where: { id },
      data: {
        sku: data.sku,
        barcode: data.barcode || null,
        name: data.name,
        slug: slugify(data.name),
        categoryId: Number(data.categoryId),
        description: data.description || null,
        brand: data.brand || null,
        purchasePrice: Number(data.purchasePrice),
        mrp: Number(data.mrp),
        retailPrice: Number(data.retailPrice),
        wholesalePrice: data.wholesalePrice ? Number(data.wholesalePrice) : null,
        stock: newStock,
        minStock: Number(data.minStock || 0),
        unit: data.unit || "1 Box",
        imageUrl: data.imageUrl || null,
        featured: Boolean(data.featured),
        active: data.active !== false
      }
    });

    if (delta !== 0) {
      await tx.stockTransaction.create({
        data: {
          productId: id,
          type: "ADJUSTMENT",
          quantity: delta,
          reference: "ADMIN_EDIT"
        }
      });
      await tx.stockMovement.create({
        data: {
          productId: id,
          type: "ADJUSTMENT",
          quantity: delta,
          previousStock: current.stock,
          newStock,
          referenceType: "PRODUCT",
          referenceId: String(id),
          remarks: "Admin product edit",
          createdById: req.user.id
        }
      });
    }

    return p;
  });

  await audit(req.user.id, "UPDATE", "Product", id, { before: current, after: data });
  res.json(product);
});

router.get("/orders", async (_req, res) => {
  const orders = await prisma.order.findMany({
    include: { customer: true, items: true },
    orderBy: { createdAt: "desc" }
  });

  res.json(orders.map(o => ({
    ...o,
    subtotal: Number(o.subtotal),
    discount: Number(o.discount),
    deliveryCharge: Number(o.deliveryCharge),
    total: Number(o.total),
    items: o.items.map(i => ({ ...i, unitPrice: Number(i.unitPrice), lineTotal: Number(i.lineTotal) }))
  })));
});

router.put("/orders/:id/status", async (req, res) => {
  const id = Number(req.params.id);
  const order = await prisma.order.findUnique({ where: { id }, include: { items: true } });
  if (!order) return res.status(404).json({ error: "Order not found" });

  const status = req.body.status;

  const updated = await prisma.$transaction(async tx => {
    if (status === "CANCELLED" && !order.inventoryRestored) {
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } }
        });

        await tx.stockTransaction.create({
          data: {
            productId: item.productId,
            type: "CANCELLATION",
            quantity: item.quantity,
            reference: order.orderNumber
          }
        });
      }
    }

    return tx.order.update({
      where: { id },
      data: {
        status,
        inventoryRestored: status === "CANCELLED" ? true : order.inventoryRestored,
        statusHistory: { create: { status, note: req.body.note || null } }
      }
    });
  });

  await audit(req.user.id, "STATUS_CHANGE", "Order", id, { from: order.status, to: status });
  res.json(updated);
});

router.get("/offers", async (_req, res) => {
  const offers = await prisma.offer.findMany({ orderBy: { createdAt: "desc" } });
  res.json(offers.map(o => ({ ...o, value: Number(o.value), minOrder: o.minOrder ? Number(o.minOrder) : null })));
});

router.post("/offers", async (req, res) => {
  const offer = await prisma.offer.create({
    data: {
      title: req.body.title,
      description: req.body.description || null,
      type: req.body.type,
      value: Number(req.body.value),
      minOrder: req.body.minOrder ? Number(req.body.minOrder) : null,
      startAt: new Date(req.body.startAt),
      endAt: new Date(req.body.endAt),
      bannerUrl: req.body.bannerUrl || null,
      active: req.body.active !== false
    }
  });

  await audit(req.user.id, "CREATE", "Offer", offer.id, req.body);
  res.status(201).json(offer);
});

router.get("/customers", async (_req, res) => {
  const customers = await prisma.customer.findMany({
    include: {
      _count: { select: { orders: true } },
      orders: { select: { total: true, createdAt: true }, orderBy: { createdAt: "desc" } }
    },
    orderBy: { updatedAt: "desc" }
  });

  res.json(customers.map(c => ({
    ...c,
    totalSpend: c.orders.reduce((sum, o) => sum + Number(o.total), 0),
    lastOrderAt: c.orders[0]?.createdAt || null,
    orders: undefined
  })));
});

router.get("/suppliers", async (_req, res) => {
  res.json(await prisma.supplier.findMany({ orderBy: { name: "asc" } }));
});

router.post("/suppliers", async (req, res) => {
  const supplier = await prisma.supplier.create({ data: { ...req.body, active: req.body.active !== false } });
  await audit(req.user.id, "CREATE", "Supplier", supplier.id, req.body);
  res.status(201).json(supplier);
});

router.post("/purchases", async (req, res) => {
  const number = `PUR-${Date.now()}`;
  const items = req.body.items || [];
  const subtotal = items.reduce((sum, i) => sum + Number(i.quantity) * Number(i.unitCost), 0);
  const charges = Number(req.body.charges || 0);

  const purchase = await prisma.$transaction(async tx => {
    const p = await tx.purchase.create({
      data: {
        number,
        supplierId: Number(req.body.supplierId),
        subtotal,
        charges,
        total: subtotal + charges,
        notes: req.body.notes || null,
        items: {
          create: items.map(i => ({
            productId: Number(i.productId),
            quantity: Number(i.quantity),
            unitCost: Number(i.unitCost),
            lineTotal: Number(i.quantity) * Number(i.unitCost)
          }))
        }
      }
    });

    for (const item of items) {
      await tx.product.update({
        where: { id: Number(item.productId) },
        data: {
          stock: { increment: Number(item.quantity) },
          purchasePrice: Number(item.unitCost)
        }
      });

      await tx.stockTransaction.create({
        data: {
          productId: Number(item.productId),
          type: "PURCHASE",
          quantity: Number(item.quantity),
          reference: number
        }
      });
      const updated = await tx.product.findUnique({ where: { id: Number(item.productId) }, select: { stock: true } });
      await tx.stockMovement.create({
        data: {
          productId: Number(item.productId),
          type: "PURCHASE",
          quantity: Number(item.quantity),
          previousStock: updated.stock - Number(item.quantity),
          newStock: updated.stock,
          referenceType: "PURCHASE",
          referenceId: number,
          createdById: req.user.id
        }
      });
    }

    return p;
  });

  await audit(req.user.id, "CREATE", "Purchase", purchase.id, { number });
  res.status(201).json(purchase);
});

router.get("/stock-transactions", async (_req, res) => {
  res.json(await prisma.stockTransaction.findMany({
    include: { product: { select: { sku: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 500
  }));
});

router.get("/settings", async (_req, res) => {
  res.json(await prisma.shopSettings.findUnique({ where: { id: 1 } }));
});

router.put("/settings", async (req, res) => {
  const data = {
    shopName: req.body.shopName,
    phone: req.body.phone || null,
    whatsapp: req.body.whatsapp || null,
    email: req.body.email || null,
    address: req.body.address || null,
    minimumOrder: Number(req.body.minimumOrder || 0),
    deliveryCharge: Number(req.body.deliveryCharge || 0),
    pickupEnabled: Boolean(req.body.pickupEnabled),
    deliveryEnabled: Boolean(req.body.deliveryEnabled),
    heroTitle: req.body.heroTitle || null,
    heroSubtitle: req.body.heroSubtitle || null
  };

  const settings = await prisma.shopSettings.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, ...data }
  });

  await audit(req.user.id, "UPDATE", "Settings", 1, data);
  res.json(settings);
});

router.get("/audit-logs", async (_req, res) => {
  res.json(await prisma.auditLog.findMany({
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 300
  }));
});

export default router;
