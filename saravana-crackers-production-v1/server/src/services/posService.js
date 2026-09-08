import { prisma } from "../lib/prisma.js";

const PAYMENT_METHODS = new Set(["CASH", "UPI", "CARD", "CREDIT"]);
const DISCOUNT_TYPES = new Set(["FIXED", "PERCENTAGE"]);

const toMoney = value => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const toInt = value => Math.trunc(Number(value || 0));

function normalizePaymentMethod(method = "CASH") {
  const value = String(method || "CASH").toUpperCase();
  return PAYMENT_METHODS.has(value) ? value : "CASH";
}

function normalizeDiscountType(type = "FIXED") {
  const value = String(type || "FIXED").toUpperCase();
  return DISCOUNT_TYPES.has(value) ? value : "FIXED";
}

function saleInclude() {
  return {
    customer: true,
    createdBy: { select: { id: true, name: true, role: true } },
    items: { include: { product: { select: { stock: true, minStock: true, active: true } } } },
    payments: true,
    returns: { include: { items: true } }
  };
}

export function serializeSale(sale) {
  if (!sale) return null;
  return {
    ...sale,
    subtotal: Number(sale.subtotal),
    discountValue: Number(sale.discountValue),
    discountAmount: Number(sale.discountAmount),
    gst: Number(sale.gst),
    roundOff: Number(sale.roundOff),
    grandTotal: Number(sale.grandTotal),
    items: sale.items?.map(item => ({
      ...item,
      purchasePriceSnapshot: Number(item.purchasePriceSnapshot),
      sellingPrice: Number(item.sellingPrice),
      discount: Number(item.discount),
      total: Number(item.total)
    })) || [],
    payments: sale.payments?.map(payment => ({
      ...payment,
      amount: Number(payment.amount)
    })) || [],
    returns: sale.returns?.map(ret => ({
      ...ret,
      refundAmount: Number(ret.refundAmount),
      items: ret.items?.map(item => ({ ...item, amount: Number(item.amount) })) || []
    })) || []
  };
}

async function nextInvoiceNumber(tx) {
  const year = new Date().getFullYear();
  const sequence = await tx.invoiceSequence.upsert({
    where: { year },
    create: { year, nextNumber: 2 },
    update: { nextNumber: { increment: 1 } }
  });
  return `SC-${year}-${String(sequence.nextNumber - 1).padStart(6, "0")}`;
}

async function nextReturnNumber(tx) {
  const count = await tx.saleReturn.count();
  return `SCR-${new Date().getFullYear()}-${String(count + 1).padStart(6, "0")}`;
}

function preparePayments(inputPayments, fallbackMethod, grandTotal) {
  const payments = Array.isArray(inputPayments)
    ? inputPayments
        .map(p => ({
          paymentMethod: normalizePaymentMethod(p.paymentMethod),
          amount: toMoney(p.amount),
          referenceNumber: p.referenceNumber || null
        }))
        .filter(p => p.amount > 0)
    : [];

  if (!payments.length) {
    payments.push({
      paymentMethod: normalizePaymentMethod(fallbackMethod),
      amount: grandTotal,
      referenceNumber: null
    });
  }

  const paid = toMoney(payments.reduce((sum, p) => sum + p.amount, 0));
  if (Math.abs(paid - grandTotal) > 0.01) {
    throw new Error(`Payment total must match grand total. Paid ${paid}, bill total ${grandTotal}.`);
  }

  return payments;
}

function prepareCustomerData(customer = {}) {
  const mobile = String(customer.mobile || customer.phone || "").trim();
  if (!mobile) return null;
  return {
    name: String(customer.name || "Walk-in Customer").trim() || "Walk-in Customer",
    phone: mobile,
    whatsapp: String(customer.whatsapp || mobile).trim(),
    email: customer.email || null,
    address: customer.address || null,
    city: customer.city || null,
    district: customer.district || null,
    state: customer.state || null,
    pincode: customer.pincode || null
  };
}

export async function searchProducts(query) {
  const q = String(query || "").trim();
  if (!q) return [];

  const products = await prisma.product.findMany({
    where: { active: true },
    include: { category: true },
    orderBy: { name: "asc" },
    take: 2500
  });

  const needle = q.toLowerCase();
  const score = product => {
    const sku = String(product.sku || "").toLowerCase();
    const barcode = String(product.barcode || "").toLowerCase();
    const name = String(product.name || "").toLowerCase();
    const category = String(product.category?.name || "").toLowerCase();
    const brand = String(product.brand || "").toLowerCase();
    if (sku === needle || barcode === needle) return 0;
    if (name.startsWith(needle)) return 1;
    if (name.includes(needle)) return 2;
    if (category.includes(needle)) return 3;
    if (brand.includes(needle)) return 4;
    return 5;
  };

  return products
    .filter(product => {
      const sku = String(product.sku || "").toLowerCase();
      const barcode = String(product.barcode || "").toLowerCase();
      const name = String(product.name || "").toLowerCase();
      const category = String(product.category?.name || "").toLowerCase();
      const brand = String(product.brand || "").toLowerCase();
      return sku.includes(needle) || barcode.includes(needle) || name.includes(needle) || category.includes(needle) || brand.includes(needle);
    })
    .sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name))
    .slice(0, 25)
    .map(product => ({
      id: product.id,
      productCode: product.sku,
      sku: product.sku,
      barcode: product.barcode,
      name: product.name,
      category: product.category?.name || "",
      brand: product.brand || "",
      purchasePrice: Number(product.purchasePrice),
      sellingPrice: Number(product.retailPrice),
      retailPrice: Number(product.retailPrice),
      mrp: Number(product.mrp),
      currentStock: product.stock,
      stock: product.stock,
      minimumStock: product.minStock,
      unit: product.unit,
      active: product.active
    }));
}

export async function getProduct(id) {
  const product = await prisma.product.findUnique({ where: { id: Number(id) }, include: { category: true } });
  if (!product) return null;
  return {
    ...product,
    productCode: product.sku,
    currentStock: product.stock,
    minimumStock: product.minStock,
    sellingPrice: Number(product.retailPrice),
    purchasePrice: Number(product.purchasePrice),
    retailPrice: Number(product.retailPrice),
    mrp: Number(product.mrp),
    wholesalePrice: product.wholesalePrice ? Number(product.wholesalePrice) : null
  };
}

export async function completeSale(body, user) {
  const existing = body.requestKey
    ? await prisma.sale.findUnique({ where: { requestKey: String(body.requestKey) }, include: saleInclude() })
    : null;
  if (existing) return serializeSale(existing);

  const inputItems = Array.isArray(body.items) ? body.items : [];
  if (!inputItems.length) throw new Error("Add at least one product before completing sale.");

  const sale = await prisma.$transaction(async tx => {
    const productIds = [...new Set(inputItems.map(item => Number(item.productId)).filter(Boolean))];
    const products = await tx.product.findMany({
      where: { id: { in: productIds }, active: true },
      include: { category: true }
    });
    const productMap = new Map(products.map(product => [product.id, product]));
    if (products.length !== productIds.length) throw new Error("One or more products are unavailable.");

    const lines = inputItems.map(item => {
      const product = productMap.get(Number(item.productId));
      const quantity = toInt(item.quantity);
      const sellingPrice = toMoney(item.sellingPrice ?? product.retailPrice);
      const discount = toMoney(item.discount);
      if (!product || quantity < 1) throw new Error("Invalid bill item.");
      if (sellingPrice < 0 || discount < 0) throw new Error("Invalid price or discount.");
      const gross = toMoney(sellingPrice * quantity);
      if (discount > gross) throw new Error(`${product.name} discount cannot be more than item amount.`);
      return {
        product,
        quantity,
        sellingPrice,
        discount,
        lineTotal: toMoney(gross - discount)
      };
    });

    const subtotal = toMoney(lines.reduce((sum, line) => sum + line.lineTotal, 0));
    const discountType = normalizeDiscountType(body.discountType);
    const discountValue = toMoney(body.discountValue);
    const discountAmount = discountType === "PERCENTAGE"
      ? toMoney(subtotal * Math.min(Math.max(discountValue, 0), 100) / 100)
      : Math.min(toMoney(discountValue), subtotal);
    const gst = toMoney(body.gst);
    const totalBeforeRound = toMoney(subtotal - discountAmount + gst);
    const grandTotal = toMoney(Math.round(totalBeforeRound));
    const roundOff = toMoney(grandTotal - totalBeforeRound);
    const payments = preparePayments(body.payments, body.paymentMethod, grandTotal);
    const paymentMethod = payments.length === 1 ? payments[0].paymentMethod : normalizePaymentMethod(body.paymentMethod);
    const invoiceNumber = await nextInvoiceNumber(tx);
    const customerData = prepareCustomerData(body.customer);
    const customer = customerData
      ? await tx.customer.upsert({
          where: { phone: customerData.phone },
          update: customerData,
          create: customerData
        })
      : null;

    for (const line of lines) {
      const changed = await tx.product.updateMany({
        where: { id: line.product.id, stock: { gte: line.quantity }, active: true },
        data: { stock: { decrement: line.quantity } }
      });
      if (changed.count !== 1) {
        throw new Error(`Only ${line.product.stock} items available in stock for ${line.product.name}.`);
      }
      const updated = await tx.product.findUnique({ where: { id: line.product.id }, select: { stock: true } });
      await tx.stockMovement.create({
        data: {
          productId: line.product.id,
          type: "SALE",
          quantity: -line.quantity,
          previousStock: updated.stock + line.quantity,
          newStock: updated.stock,
          referenceType: "SALE",
          referenceId: invoiceNumber,
          remarks: "POS billing",
          createdById: user?.id || null
        }
      });
      await tx.stockTransaction.create({
        data: {
          productId: line.product.id,
          type: "SALE",
          quantity: -line.quantity,
          reference: invoiceNumber,
          note: "POS billing"
        }
      });
    }

    const created = await tx.sale.create({
      data: {
        invoiceNumber,
        requestKey: body.requestKey ? String(body.requestKey) : null,
        customerId: customer?.id || null,
        subtotal,
        discountType,
        discountValue,
        discountAmount,
        gst,
        roundOff,
        grandTotal,
        paymentMethod,
        createdById: user?.id || null,
        items: {
          create: lines.map(line => ({
            productId: line.product.id,
            productNameSnapshot: line.product.name,
            skuSnapshot: line.product.sku,
            categoryNameSnapshot: line.product.category?.name || null,
            purchasePriceSnapshot: Number(line.product.purchasePrice),
            sellingPrice: line.sellingPrice,
            quantity: line.quantity,
            discount: line.discount,
            total: line.lineTotal
          }))
        },
        payments: { create: payments }
      },
      include: saleInclude()
    });

    await tx.auditLog.create({
      data: {
        userId: user?.id || null,
        action: "CREATE",
        entity: "Sale",
        entityId: String(created.id),
        details: JSON.stringify({ invoiceNumber, grandTotal })
      }
    });

    return created;
  });

  return serializeSale(sale);
}

export async function listSales({ search = "", from, to, status } = {}) {
  const where = {};
  const q = String(search || "").trim();
  if (q) {
    where.OR = [
      { invoiceNumber: { contains: q } },
      { customer: { name: { contains: q } } },
      { customer: { phone: { contains: q } } }
    ];
  }
  if (status) where.status = String(status).toUpperCase();
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  const sales = await prisma.sale.findMany({
    where,
    include: { customer: true, items: true, payments: true },
    orderBy: { createdAt: "desc" },
    take: 300
  });
  return sales.map(serializeSale);
}

export async function getSale(identifier) {
  const id = Number(identifier);
  const sale = await prisma.sale.findFirst({
    where: Number.isFinite(id) && id > 0
      ? { OR: [{ id }, { invoiceNumber: String(identifier) }] }
      : { invoiceNumber: String(identifier) },
    include: saleInclude()
  });
  return serializeSale(sale);
}

export async function voidSale(id, user, reason = "") {
  const updated = await prisma.$transaction(async tx => {
    const sale = await tx.sale.findUnique({ where: { id: Number(id) }, include: { items: true } });
    if (!sale) throw new Error("Invoice not found.");
    if (sale.status !== "COMPLETED") throw new Error("Only completed invoices can be voided.");

    for (const item of sale.items) {
      const current = await tx.product.findUnique({ where: { id: item.productId }, select: { stock: true } });
      await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          type: "VOID",
          quantity: item.quantity,
          previousStock: current.stock,
          newStock: current.stock + item.quantity,
          referenceType: "SALE",
          referenceId: sale.invoiceNumber,
          remarks: reason || "Invoice voided",
          createdById: user?.id || null
        }
      });
    }

    const voided = await tx.sale.update({
      where: { id: sale.id },
      data: {
        status: "VOIDED",
        voidReason: reason || null,
        voidedById: user?.id || null,
        voidedAt: new Date()
      },
      include: saleInclude()
    });

    await tx.auditLog.create({
      data: {
        userId: user?.id || null,
        action: "VOID",
        entity: "Sale",
        entityId: String(sale.id),
        details: JSON.stringify({ invoiceNumber: sale.invoiceNumber, reason })
      }
    });

    return voided;
  });

  return serializeSale(updated);
}

export async function createReturn(body, user) {
  const created = await prisma.$transaction(async tx => {
    const sale = await tx.sale.findFirst({
      where: body.saleId ? { id: Number(body.saleId) } : { invoiceNumber: String(body.invoiceNumber || "") },
      include: { items: true }
    });
    if (!sale) throw new Error("Invoice not found.");
    if (sale.status === "VOIDED") throw new Error("Voided invoices cannot be returned.");

    const byId = new Map(sale.items.map(item => [item.id, item]));
    const returnLines = (Array.isArray(body.items) ? body.items : []).map(input => {
      const saleItem = byId.get(Number(input.saleItemId));
      const quantity = toInt(input.quantity);
      if (!saleItem || quantity < 1) throw new Error("Invalid return item.");
      const available = saleItem.quantity - saleItem.returnedQuantity;
      if (quantity > available) throw new Error(`Only ${available} can be returned for ${saleItem.productNameSnapshot}.`);
      const amount = toMoney((Number(saleItem.total) / saleItem.quantity) * quantity);
      return { saleItem, quantity, amount };
    });
    if (!returnLines.length) throw new Error("Select at least one item to return.");

    const returnNumber = await nextReturnNumber(tx);
    const refundAmount = toMoney(returnLines.reduce((sum, line) => sum + line.amount, 0));
    const ret = await tx.saleReturn.create({
      data: {
        saleId: sale.id,
        returnNumber,
        refundAmount,
        remarks: body.remarks || null,
        createdById: user?.id || null,
        items: {
          create: returnLines.map(line => ({
            saleItemId: line.saleItem.id,
            productId: line.saleItem.productId,
            quantity: line.quantity,
            amount: line.amount
          }))
        }
      },
      include: { items: true }
    });

    for (const line of returnLines) {
      const current = await tx.product.findUnique({ where: { id: line.saleItem.productId }, select: { stock: true } });
      await tx.product.update({ where: { id: line.saleItem.productId }, data: { stock: { increment: line.quantity } } });
      await tx.saleItem.update({
        where: { id: line.saleItem.id },
        data: { returnedQuantity: { increment: line.quantity } }
      });
      await tx.stockMovement.create({
        data: {
          productId: line.saleItem.productId,
          type: "SALE_RETURN",
          quantity: line.quantity,
          previousStock: current.stock,
          newStock: current.stock + line.quantity,
          referenceType: "RETURN",
          referenceId: returnNumber,
          remarks: body.remarks || "Sales return",
          createdById: user?.id || null
        }
      });
    }

    await tx.auditLog.create({
      data: {
        userId: user?.id || null,
        action: "RETURN",
        entity: "Sale",
        entityId: String(sale.id),
        details: JSON.stringify({ invoiceNumber: sale.invoiceNumber, returnNumber, refundAmount })
      }
    });

    return ret;
  });

  return {
    ...created,
    refundAmount: Number(created.refundAmount),
    items: created.items.map(item => ({ ...item, amount: Number(item.amount) }))
  };
}

export async function receiveStock(body, user) {
  const quantity = toInt(body.quantity);
  const productId = Number(body.productId);
  if (!productId || quantity < 1) throw new Error("Select a product and enter received quantity.");

  return prisma.$transaction(async tx => {
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) throw new Error("Product not found.");
    const updated = await tx.product.update({
      where: { id: productId },
      data: {
        stock: { increment: quantity },
        ...(body.purchasePrice ? { purchasePrice: toMoney(body.purchasePrice) } : {})
      }
    });
    const reference = body.purchaseInvoiceNumber || `PUR-${Date.now()}`;
    await tx.stockMovement.create({
      data: {
        productId,
        type: "PURCHASE",
        quantity,
        previousStock: product.stock,
        newStock: updated.stock,
        referenceType: "PURCHASE",
        referenceId: reference,
        remarks: [body.supplier, body.remarks].filter(Boolean).join(" - ") || null,
        createdById: user?.id || null
      }
    });
    await tx.stockTransaction.create({
      data: { productId, type: "PURCHASE", quantity, reference, note: body.remarks || null }
    });
    return { productId, previousStock: product.stock, newStock: updated.stock };
  });
}

export async function adjustStock(body, user) {
  const productId = Number(body.productId);
  const physicalStock = toInt(body.physicalStock);
  if (!productId || physicalStock < 0) throw new Error("Select a product and enter valid physical stock.");

  return prisma.$transaction(async tx => {
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) throw new Error("Product not found.");
    const delta = physicalStock - product.stock;
    const type = delta < 0 && String(body.reason || "").toLowerCase().includes("damage") ? "DAMAGE" : "ADJUSTMENT";
    const updated = await tx.product.update({ where: { id: productId }, data: { stock: physicalStock } });
    await tx.stockMovement.create({
      data: {
        productId,
        type,
        quantity: delta,
        previousStock: product.stock,
        newStock: updated.stock,
        referenceType: "ADJUSTMENT",
        referenceId: body.reference || null,
        remarks: body.reason || body.remarks || "Manual stock adjustment",
        createdById: user?.id || null
      }
    });
    await tx.auditLog.create({
      data: {
        userId: user?.id || null,
        action: "STOCK_ADJUSTMENT",
        entity: "Product",
        entityId: String(productId),
        details: JSON.stringify({ before: product.stock, after: physicalStock, reason: body.reason })
      }
    });
    return { productId, previousStock: product.stock, newStock: updated.stock, delta };
  });
}

export async function dashboardSummary() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const [sales, payments, products, customers, orderCount, lowStockProducts, saleItems] = await Promise.all([
    prisma.sale.findMany({ where: { createdAt: { gte: start, lt: end }, status: { not: "VOIDED" } }, include: { items: true } }),
    prisma.payment.findMany({ where: { sale: { createdAt: { gte: start, lt: end }, status: { not: "VOIDED" } } } }),
    prisma.product.findMany({ where: { active: true }, select: { stock: true, minStock: true, purchasePrice: true } }),
    prisma.customer.count(),
    prisma.order.count({ where: { createdAt: { gte: start } } }),
    prisma.product.findMany({
      where: { active: true },
      select: { id: true, sku: true, name: true, stock: true, minStock: true },
      orderBy: { stock: "asc" }
    }),
    prisma.saleItem.findMany({
      where: { sale: { createdAt: { gte: start, lt: end }, status: { not: "VOIDED" } } },
      select: { productId: true, productNameSnapshot: true, quantity: true, total: true }
    })
  ]);

  const byMethod = { CASH: 0, UPI: 0, CARD: 0, CREDIT: 0 };
  for (const payment of payments) byMethod[payment.paymentMethod] += Number(payment.amount);

  const topMap = new Map();
  for (const item of saleItems) {
    const current = topMap.get(item.productId) || { productId: item.productId, name: item.productNameSnapshot, quantity: 0, amount: 0 };
    current.quantity += item.quantity;
    current.amount += Number(item.total);
    topMap.set(item.productId, current);
  }

  return {
    todaySales: toMoney(sales.reduce((sum, sale) => sum + Number(sale.grandTotal), 0)),
    todayBills: sales.length,
    todayItemsSold: sales.reduce((sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0),
    cashSales: toMoney(byMethod.CASH),
    upiSales: toMoney(byMethod.UPI),
    cardSales: toMoney(byMethod.CARD),
    creditSales: toMoney(byMethod.CREDIT),
    currentStockValue: toMoney(products.reduce((sum, product) => sum + product.stock * Number(product.purchasePrice), 0)),
    lowStock: lowStockProducts.filter(product => product.stock <= product.minStock).length,
    lowStockProducts: lowStockProducts.filter(product => product.stock <= product.minStock).slice(0, 20),
    topSellingProducts: [...topMap.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 10),
    productCount: products.length,
    customers,
    todayOrders: orderCount
  };
}

export async function dailyReport() {
  return dashboardSummary();
}

export async function profitReport() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const items = await prisma.saleItem.findMany({
    where: { sale: { createdAt: { gte: start }, status: { not: "VOIDED" } } }
  });
  const productMap = new Map();
  for (const item of items) {
    const purchase = Number(item.purchasePriceSnapshot);
    const sell = Number(item.sellingPrice);
    const profit = toMoney((sell - purchase) * item.quantity - Number(item.discount));
    const current = productMap.get(item.productId) || {
      productId: item.productId,
      name: item.productNameSnapshot,
      quantity: 0,
      sales: 0,
      profit: 0
    };
    current.quantity += item.quantity;
    current.sales = toMoney(current.sales + Number(item.total));
    current.profit = toMoney(current.profit + profit);
    productMap.set(item.productId, current);
  }
  const products = [...productMap.values()].sort((a, b) => b.profit - a.profit);
  return {
    todayProfit: toMoney(products.reduce((sum, item) => sum + item.profit, 0)),
    products
  };
}

export async function categoryReport() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const items = await prisma.saleItem.findMany({
    where: { sale: { createdAt: { gte: start }, status: { not: "VOIDED" } } }
  });
  const map = new Map();
  for (const item of items) {
    const key = item.categoryNameSnapshot || "Uncategorised";
    map.set(key, toMoney((map.get(key) || 0) + Number(item.total)));
  }
  return [...map.entries()].map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);
}

export async function createHeldSale(body, user) {
  if (!Array.isArray(body.items) || !body.items.length) throw new Error("Cannot hold an empty bill.");
  const held = await prisma.heldSale.create({
    data: {
      referenceNumber: `HOLD-${Date.now()}`,
      customerData: body.customer || null,
      items: body.items,
      createdById: user?.id || null
    }
  });
  return held;
}

export async function listHeldSales() {
  return prisma.heldSale.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
}

export async function deleteHeldSale(id) {
  await prisma.heldSale.delete({ where: { id: Number(id) } });
  return { ok: true };
}
