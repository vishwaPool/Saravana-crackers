import { apiError } from "../lib/apiError.js";
import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { slugify } from "../lib/helpers.js";
import {
  adjustStock,
  categoryReport,
  completeSale,
  createHeldSale,
  createReturn,
  dailyReport,
  dashboardSummary,
  deleteHeldSale,
  getProduct,
  getSale,
  listHeldSales,
  listSales,
  profitReport,
  receiveStock,
  searchProducts,
  serializeSale,
  voidSale
} from "../services/posService.js";

const router = Router();
const adminRoles = new Set(["SUPER_ADMIN", "ADMIN"]);
const inventoryRoles = new Set(["SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"]);

const wrap = fn => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (error) {
    const {message,status} = apiError(error);
    res.status(status).json({ error: message });
  }
};

const requireRole = roles => (req, res, next) => {
  if (!roles.has(req.user?.role)) return res.status(403).json({ error: "Permission denied" });
  next();
};

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function parseCsv(text = "") {
  const lines = String(text).replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const split = line => {
    const cells = [];
    let cell = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === "," && !quoted) {
        cells.push(cell.trim());
        cell = "";
      } else {
        cell += char;
      }
    }
    cells.push(cell.trim());
    return cells;
  };
  const headers = split(lines[0]).map(h => h.trim());
  return lines.slice(1).map((line, lineIndex) => {
    const cells = split(line);
    return {
      line: lineIndex + 2,
      data: Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]))
    };
  });
}

router.get("/products/search", wrap(async (req, res) => {
  res.json(await searchProducts(req.query.q));
}));

router.get("/products/:id", wrap(async (req, res) => {
  const product = await getProduct(req.params.id);
  if (!product) return res.status(404).json({ error: "Product not found" });
  res.json(product);
}));

router.post("/sales", wrap(async (req, res) => {
  try {
    res.status(201).json(await completeSale(req.body, req.user));
  } catch (error) {
    console.error("POS complete sale failed", {
      code: error.code,
      message: error.message,
      requestKey: req.body?.requestKey || null,
      customerName: req.body?.customerName || req.body?.customer?.name || null,
      paymentMethod: req.body?.paymentMethod || null,
      discountType: req.body?.discountType || null,
      discountValue: req.body?.discountValue ?? null,
      gst: req.body?.gst ?? null,
      items: Array.isArray(req.body?.items) ? req.body.items.map(item => ({
        productId: item.productId,
        sku: item.sku,
        quantity: item.quantity,
        sellingPrice: item.sellingPrice,
        discount: item.discount
      })) : []
    });
    throw error;
  }
}));

router.get("/sales", wrap(async (req, res) => {
  res.json(await listSales(req.query));
}));

router.get("/sales/:id", wrap(async (req, res) => {
  const sale = await getSale(req.params.id);
  if (!sale) return res.status(404).json({ error: "Invoice not found" });
  res.json(sale);
}));

router.post("/sales/:id/void", requireRole(adminRoles), wrap(async (req, res) => {
  res.json(await voidSale(req.params.id, req.user, req.body.reason));
}));

router.post("/returns", wrap(async (req, res) => {
  res.status(201).json(await createReturn(req.body, req.user));
}));

router.post("/stock/receive", requireRole(inventoryRoles), wrap(async (req, res) => {
  res.status(201).json(await receiveStock(req.body, req.user));
}));

router.post("/stock/adjust", requireRole(inventoryRoles), wrap(async (req, res) => {
  res.status(201).json(await adjustStock(req.body, req.user));
}));

router.get("/stock/movements", wrap(async (_req, res) => {
  const movements = await prisma.stockMovement.findMany({
    include: {
      product: { select: { sku: true, name: true } },
      createdBy: { select: { name: true, role: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 500
  });
  res.json(movements);
}));

router.post("/held-sales", wrap(async (req, res) => {
  res.status(201).json(await createHeldSale(req.body, req.user));
}));

router.get("/held-sales", wrap(async (_req, res) => {
  res.json(await listHeldSales());
}));

router.delete("/held-sales/:id", wrap(async (req, res) => {
  res.json(await deleteHeldSale(req.params.id));
}));

router.get("/dashboard/pos", wrap(async (_req, res) => {
  res.json(await dashboardSummary());
}));

router.get("/reports/daily", wrap(async (_req, res) => {
  res.json(await dailyReport());
}));

router.get("/reports/profit", requireRole(adminRoles), wrap(async (_req, res) => {
  res.json(await profitReport());
}));

router.get("/reports/category-sales", wrap(async (_req, res) => {
  res.json(await categoryReport());
}));

router.post("/products/import", requireRole(inventoryRoles), wrap(async (req, res) => {
  const rows = parseCsv(req.body.csv);
  if (!rows.length) return res.status(400).json({error:"Paste a CSV header and at least one product row."});
  const categories = await prisma.category.findMany();
  const categoryByName = new Map(categories.map(category => [category.name.toLowerCase(), category]));
  const valid = [];
  const errors = [];

  for (const row of rows) {
    const data = row.data;
    const required = ["ProductCode", "ProductName", "Category", "PurchasePrice", "SellingPrice", "MRP", "OpeningStock", "MinimumStock"];
    const missing = required.filter(field => !String(data[field] || "").trim());
    const purchasePrice = Number(data.PurchasePrice);
    const sellingPrice = Number(data.SellingPrice);
    const mrp = Number(data.MRP);
    const openingStock = Number(data.OpeningStock);
    const minimumStock = Number(data.MinimumStock);
    if (missing.length || [purchasePrice, sellingPrice, mrp, openingStock, minimumStock].some(n => !Number.isFinite(n) || n < 0) || !Number.isInteger(openingStock) || !Number.isInteger(minimumStock)) {
      errors.push({ line: row.line, error: `Invalid row. Missing/invalid: ${missing.join(", ") || "numeric values"}` });
      continue;
    }
    valid.push({ data, purchasePrice, sellingPrice, mrp, openingStock, minimumStock });
  }

  if (req.body.preview !== false) {
    return res.json({ validProducts: valid.length, errors });
  }

  if (errors.length) return res.status(400).json({error:"Correct all CSV errors before importing.",errors});
  const result = await prisma.$transaction(async tx => {
    let imported = 0;
    for (const item of valid) {
      const categoryName = String(item.data.Category).trim();
      let category = categoryByName.get(categoryName.toLowerCase());
      if (!category) {
        category = await tx.category.create({ data: { name: categoryName, slug: slugify(categoryName), active: true } });
        categoryByName.set(category.name.toLowerCase(), category);
      }
      const existing = await tx.product.findUnique({where:{sku:String(item.data.ProductCode).trim()},select:{id:true}});
      const product = await tx.product.upsert({
        where: { sku: String(item.data.ProductCode).trim() },
        update: {
          name: String(item.data.ProductName).trim(),
          categoryId: category.id,
          brand: item.data.Brand || null,
          purchasePrice: item.purchasePrice,
          retailPrice: item.sellingPrice,
          mrp: item.mrp,
          minStock: item.minimumStock,
          barcode: item.data.Barcode || null,
          active: true
        },
        create: {
          sku: String(item.data.ProductCode).trim(),
          name: String(item.data.ProductName).trim(),
          slug: slugify(`${item.data.ProductName}-${item.data.ProductCode}`),
          categoryId: category.id,
          brand: item.data.Brand || null,
          purchasePrice: item.purchasePrice,
          retailPrice: item.sellingPrice,
          mrp: item.mrp,
          stock: item.openingStock,
          minStock: item.minimumStock,
          barcode: item.data.Barcode || null,
          active: true
        }
      });
      if (!existing && item.openingStock > 0) {
        await tx.stockMovement.create({
          data: {
            productId: product.id,
            type: "OPENING_STOCK",
            quantity: item.openingStock,
            previousStock: 0,
            newStock: item.openingStock,
            referenceType: "IMPORT",
            referenceId: "CSV",
            createdById: req.user?.id || null
          }
        });
      }
      imported++;
    }
    return imported;
  });

  res.status(201).json({ imported: result, errors });
}));

router.get("/export/:type", wrap(async (req, res) => {
  let rows = [];
  if (req.params.type === "stock") {
    rows = await prisma.product.findMany({ include: { category: true }, orderBy: { name: "asc" } });
    res.type("text/csv").send([
      "ProductCode,ProductName,Category,Brand,PurchasePrice,SellingPrice,MRP,CurrentStock,MinimumStock,Barcode",
      ...rows.map(p => [p.sku, p.name, p.category?.name, p.brand, p.purchasePrice, p.retailPrice, p.mrp, p.stock, p.minStock, p.barcode].map(csvEscape).join(","))
    ].join("\n"));
    return;
  }
  if (req.params.type === "sales") {
    rows = await listSales({});
    res.type("text/csv").send([
      "InvoiceNo,Date,Customer,Mobile,Items,Total,Discount,PaymentMode,Status",
      ...rows.map(s => [s.invoiceNumber, s.createdAt, s.customer?.name || "", s.customer?.phone || "", s.items.length, s.grandTotal, s.discountAmount, s.paymentMethod, s.status].map(csvEscape).join(","))
    ].join("\n"));
    return;
  }
  res.status(404).json({ error: "Unknown export type" });
}));

export default router;
