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
      data: Object.fromEntries(headers.map((header, index) => [header.toLowerCase().replace(/[\s_-]+/g, ""), cells[index] ?? ""]))
    };
  });
}

function isGiftBoxProduct(name) {
  return /^(20|25|30|35|40|50)\s+ITEMS$/i.test(String(name).trim());
}

function parseCategoryMappings(value) {
  if (!value) return new Map();
  if (typeof value === "object" && !Array.isArray(value)) {
    return new Map(Object.entries(value).map(([name, category]) => [
      String(name).trim().toLowerCase(),
      String(category).trim()
    ]));
  }
  return new Map(String(value).split(/\r?\n/).filter(Boolean).map(line => {
    const separator = line.indexOf("|");
    if (separator < 1) return ["", ""];
    return [
      line.slice(0, separator).trim().toLowerCase(),
      line.slice(separator + 1).trim()
    ];
  }).filter(([name, category]) => name && category));
}

function numericField(data, key, label, { integer = false, blank = null } = {}) {
  const raw = String(data[key] ?? "").trim();
  if (!raw) return { value: blank };
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || (integer && !Number.isInteger(value))) {
    return { error: `${label} must be a non-negative${integer ? " whole" : ""} number.` };
  }
  return { value };
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
  const categories = await prisma.category.findMany({ select: { id: true, name: true, slug: true } });
  const categoryByName = new Map(categories.map(category => [category.name.toLowerCase(), category]));
  const existingProducts = await prisma.product.findMany({ select: { id: true, sku: true, name: true } });
  const existingBySku = new Map(existingProducts.map(product => [product.sku.toLowerCase(), product]));
  const existingByName = new Map(existingProducts.map(product => [product.name.trim().toLowerCase(), product]));
  const usedSkus = new Set(existingProducts.map(product => product.sku.toLowerCase()));
  const categoryMappings = parseCategoryMappings(req.body.categoryMappings);
  const defaultMinimumStock = Number.isFinite(Number(req.body.defaultMinimumStock)) && Number(req.body.defaultMinimumStock) >= 0
    ? Number(req.body.defaultMinimumStock)
    : 5;
  const valid = [];
  const errors = [];
  const duplicates = [];
  const previewRows = [];
  const seenSkus = new Set();
  const seenNames = new Set();
  let nextSku = 1;
  const allocateSku = () => {
    let sku;
    do { sku = `SC-${String(nextSku++).padStart(3, "0")}`; } while (usedSkus.has(sku.toLowerCase()));
    usedSkus.add(sku.toLowerCase());
    return sku;
  };

  for (const row of rows) {
    const data = row.data;
    const productName = String(data.productname || "").trim();
    const reasons = [];
    if (!productName) reasons.push("ProductName is required.");
    const purchase = numericField(data, "purchaseprice", "PurchasePrice", { blank: 0 });
    const selling = numericField(data, "sellingprice", "SellingPrice");
    const mrpField = numericField(data, "mrp", "MRP");
    const stock = numericField(data, "openingstock", "OpeningStock", { integer: true, blank: 0 });
    const minimum = numericField(data, "minimumstock", "MinimumStock", { integer: true, blank: defaultMinimumStock });
    for (const field of [purchase, selling, mrpField, stock, minimum]) if (field.error) reasons.push(field.error);
    if (selling.value == null) reasons.push("SellingPrice is required.");

    let sku = String(data.productcode || "").trim();
    if (!sku) sku = allocateSku();
    const skuKey = sku.toLowerCase();
    const nameKey = productName.toLowerCase();
    if (seenSkus.has(skuKey)) reasons.push(`ProductCode ${sku} is duplicated in the CSV.`);
    if (seenNames.has(nameKey)) reasons.push("ProductName is duplicated in the CSV.");
    seenSkus.add(skuKey);
    seenNames.add(nameKey);
    const existingSku = existingBySku.get(sku.toLowerCase());
    const existingName = existingByName.get(productName.toLowerCase());
    if (existingSku && existingSku.name.trim().toLowerCase() !== productName.toLowerCase()) {
      reasons.push(`ProductCode ${sku} already belongs to "${existingSku.name}".`);
    } else if (existingSku || existingName) {
      duplicates.push({ line: row.line, productName, sku, reason: existingSku ? "Product code already exists." : "Product name already exists." });
    }

    const categoryName = isGiftBoxProduct(productName)
      ? "Gift Box"
      : String(data.category || "").trim() || categoryMappings.get(productName.toLowerCase()) || "";
    if (!categoryName) reasons.push("Category is required; add it to the CSV or category mapping.");

    if (reasons.length) {
      const error = { line: row.line, productName, reason: reasons.join(" ") };
      errors.push(error);
      previewRows.push({ line: row.line, productName, sku, status: "invalid", reason: error.reason });
      continue;
    }
    valid.push({ data, productName, sku, categoryName, purchasePrice: purchase.value, sellingPrice: selling.value, mrp: mrpField.value, openingStock: stock.value, minimumStock: minimum.value, duplicate: Boolean(existingSku || existingName) });
    previewRows.push({ line: row.line, productName, sku, category: categoryName, status: existingSku || existingName ? "duplicate" : "valid" });
  }

  if (req.body.preview !== false) {
    return res.json({
      totalRows: rows.length,
      validProducts: valid.filter(item => !item.duplicate).length,
      duplicateProducts: duplicates.length,
      invalidProducts: errors.length,
      errors,
      duplicates,
      rows: previewRows
    });
  }

  if (errors.length) return res.status(400).json({error:"Correct all CSV errors before importing.",errors});
  let currentItem = null;
  try {
    const result = await prisma.$transaction(async tx => {
      let imported = 0;
      for (const item of valid) {
        if (item.duplicate) continue;
        currentItem = item;
        const categoryName = item.categoryName;
        let category = categoryByName.get(categoryName.toLowerCase());
        if (!category) {
          category = await tx.category.create({ data: { name: categoryName, slug: slugify(categoryName), active: true } });
          categoryByName.set(category.name.toLowerCase(), category);
        }
        const product = await tx.product.create({
          data: {
            sku: item.sku,
            name: item.productName,
            slug: slugify(`${item.productName}-${item.sku}`),
            categoryId: category.id,
            brand: item.data.brand || null,
            purchasePrice: item.purchasePrice,
            retailPrice: item.sellingPrice,
            mrp: item.mrp,
            stock: item.openingStock,
            minStock: item.minimumStock,
            barcode: item.data.barcode || null,
            active: true
          }
        });
        if (item.openingStock > 0) {
          await tx.stockTransaction.create({
            data: {
              productId: product.id,
              type: "OPENING",
              quantity: item.openingStock,
              reference: "CSV_IMPORT",
              note: "Opening stock imported from CSV"
            }
          });
          await tx.stockMovement.create({
            data: {
              productId: product.id,
              type: "OPENING_STOCK",
              quantity: item.openingStock,
              previousStock: 0,
              newStock: item.openingStock,
              referenceType: "IMPORT",
              referenceId: "CSV_IMPORT",
              createdById: req.user?.id || null
            }
          });
        }
        imported++;
      }
      return imported;
    });

    res.status(201).json({ imported: result, skipped: duplicates.length, errors: [], duplicates });
  } catch (error) {
    const code = error.code || error.errorCode || "UNKNOWN";
    const meta = error.meta || null;
    console.error("Product CSV import database failure", {
      code,
      meta,
      message: error.message,
      row: currentItem ? { line: currentItem.data?.line, productName: currentItem.productName, sku: currentItem.sku } : null
    });
    const migrationRequired = code === "P2011" || code === "P2022";
    const duplicate = code === "P2002";
    const status = migrationRequired ? 409 : duplicate ? 409 : 500;
    const message = migrationRequired
      ? "Product import requires the pending database migration for nullable MRP. No products were imported."
      : duplicate
        ? "Product import found a duplicate SKU or slug while writing. No products were imported."
        : "Product import failed and was rolled back. No products were imported.";
    return res.status(status).json({
      error: message,
      importError: {
        code,
        meta,
        message: error.message,
        row: currentItem ? { productName: currentItem.productName, sku: currentItem.sku } : null
      }
    });
  }
}));

router.get("/export/:type", wrap(async (req, res) => {
  let rows = [];
  if (req.params.type === "stock") {
    rows = await prisma.product.findMany({ include: { category: true }, orderBy: { name: "asc" } });
    res.set("Content-Disposition", 'attachment; filename="saravana-crackers-stock.csv"');
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
