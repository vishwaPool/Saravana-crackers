import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required to seed an admin user");
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: "SUPER_ADMIN", active: true },
    create: { name: "Saravana Admin", email, passwordHash, role: "SUPER_ADMIN" }
  });

  await prisma.shopSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      shopName: "Saravana Crackers",
      whatsapp: process.env.SHOP_WHATSAPP || "919876543210",
      heroTitle: "Celebrate Brighter with Saravana Crackers",
      heroSubtitle: "Retail, wholesale, festival combos and special offers."
    }
  });

  const names = ["Sound Crackers","Sparklers","Flower Pots","Ground Chakkars","Rockets","Fancy Crackers","Aerial Shots","Wala Crackers","Gift Boxes","Combo Packs"];
  const cats = {};

  for (let i = 0; i < names.length; i++) {
    cats[names[i]] = await prisma.category.upsert({
      where: { slug: slug(names[i]) },
      update: {},
      create: { name: names[i], slug: slug(names[i]), displayOrder: i + 1 }
    });
  }

  const sample = [
    ["SC-LAK-4",'4" Lakshmi',"Sound Crackers",35,120,65,200,"1 Packet"],
    ["SC-FPB-01","Flower Pot Big","Flower Pots",145,450,250,100,"1 Box"],
    ["SC-GCB-01","Ground Chakkar Big","Ground Chakkars",100,350,190,80,"1 Box"],
    ["SC-SP30-01","30cm Sparklers","Sparklers",60,200,110,150,"1 Box"],
    ["SC-RKT-01","Rocket Special","Rockets",95,320,180,90,"1 Box"],
    ["SC-FAS-01","Fancy Aerial Shot","Aerial Shots",300,900,525,50,"1 Piece"]
  ];

  for (const [sku,name,cat,cost,mrp,retail,stock,unit] of sample) {
    await prisma.product.upsert({
      where: { sku },
      update: {},
      create: {
        sku,
        name,
        slug: slug(name),
        categoryId: cats[cat].id,
        purchasePrice: cost,
        mrp,
        retailPrice: retail,
        wholesalePrice: retail * 0.9,
        stock,
        minStock: 10,
        unit,
        featured: true
      }
    });
  }

  const products = await prisma.product.findMany();
  const bySku = Object.fromEntries(products.map(p => [p.sku, p]));

  // Offers
  const now = new Date();
  const startAt = new Date(now.getFullYear(), 0, 1);
  const endAt = new Date(now.getFullYear() + 1, 11, 31);
  const offers = [
    { title: "Festival Bumper Discount", description: "10% off on all orders", type: "PERCENTAGE", value: 10, minOrder: 500 },
    { title: "Flat ₹100 Off", description: "Flat ₹100 off above ₹1000", type: "FIXED", value: 100, minOrder: 1000 }
  ];
  for (const o of offers) {
    const existing = await prisma.offer.findFirst({ where: { title: o.title } });
    if (!existing) await prisma.offer.create({ data: { ...o, startAt, endAt, active: true } });
  }

  // Suppliers
  const supplierData = [
    { name: "Sivakasi Fireworks Co", contactPerson: "Murugan", phone: "9791234567", email: "sales@sivakasifireworks.in", gstNumber: "33ABCDE1234F1Z5", city: "Sivakasi" },
    { name: "Standard Crackers Ltd", contactPerson: "Kumar", phone: "9842123456", email: "info@standardcrackers.in", gstNumber: "33XYZAB6789K2Z1", city: "Sivakasi" }
  ];
  const suppliers = {};
  for (const s of supplierData) {
    let sup = await prisma.supplier.findFirst({ where: { name: s.name } });
    if (!sup) sup = await prisma.supplier.create({ data: { ...s, active: true } });
    suppliers[s.name] = sup;
  }

  // Customers
  const customerData = [
    { name: "Ravi Kumar", phone: "9876500001", whatsapp: "9876500001", email: "ravi@example.com", address: "12 Gandhi St", city: "Madurai", district: "Madurai", state: "Tamil Nadu", pincode: "625001" },
    { name: "Priya Sundaram", phone: "9876500002", whatsapp: "9876500002", email: "priya@example.com", address: "45 Anna Nagar", city: "Chennai", district: "Chennai", state: "Tamil Nadu", pincode: "600040" },
    { name: "Arun Prakash", phone: "9876500003", whatsapp: "9876500003", email: "arun@example.com", address: "8 Bharathi Rd", city: "Coimbatore", district: "Coimbatore", state: "Tamil Nadu", pincode: "641001" }
  ];
  const customers = {};
  for (const c of customerData) {
    customers[c.phone] = await prisma.customer.upsert({
      where: { phone: c.phone },
      update: {},
      create: c
    });
  }

  // Orders
  const orderData = [
    { orderNumber: "SC-1001", phone: "9876500001", status: "NEW", deliveryMethod: "PICKUP", lines: [["SC-LAK-4", 3], ["SC-SP30-01", 2]] },
    { orderNumber: "SC-1002", phone: "9876500002", status: "CONFIRMED", deliveryMethod: "DELIVERY", lines: [["SC-FPB-01", 1], ["SC-GCB-01", 2]] },
    { orderNumber: "SC-1003", phone: "9876500003", status: "DELIVERED", deliveryMethod: "PICKUP", lines: [["SC-RKT-01", 4], ["SC-FAS-01", 1]] }
  ];
  for (const od of orderData) {
    const existing = await prisma.order.findUnique({ where: { orderNumber: od.orderNumber } });
    if (existing) continue;

    const items = od.lines.map(([sku, qty]) => {
      const p = bySku[sku];
      const unitPrice = Number(p.retailPrice);
      return { productId: p.id, productName: p.name, sku: p.sku, unitPrice, quantity: qty, lineTotal: unitPrice * qty };
    });
    const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
    const deliveryCharge = od.deliveryMethod === "DELIVERY" ? 50 : 0;
    const total = subtotal + deliveryCharge;

    await prisma.order.create({
      data: {
        orderNumber: od.orderNumber,
        customerId: customers[od.phone].id,
        status: od.status,
        subtotal,
        discount: 0,
        deliveryCharge,
        total,
        deliveryMethod: od.deliveryMethod,
        deliveryAddress: od.deliveryMethod === "DELIVERY" ? customers[od.phone].address : null,
        items: { create: items },
        statusHistory: { create: { status: od.status, note: "Seed order" } }
      }
    });
  }

  // Purchases
  const purchaseData = [
    { number: "PO-1001", supplier: "Sivakasi Fireworks Co", lines: [["SC-LAK-4", 100, 35], ["SC-SP30-01", 80, 60]] },
    { number: "PO-1002", supplier: "Standard Crackers Ltd", lines: [["SC-FPB-01", 50, 145], ["SC-RKT-01", 60, 95]] }
  ];
  for (const pd of purchaseData) {
    const existing = await prisma.purchase.findUnique({ where: { number: pd.number } });
    if (existing) continue;

    const items = pd.lines.map(([sku, qty, cost]) => ({
      productId: bySku[sku].id,
      quantity: qty,
      unitCost: cost,
      lineTotal: qty * cost
    }));
    const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);

    await prisma.purchase.create({
      data: {
        number: pd.number,
        supplierId: suppliers[pd.supplier].id,
        subtotal,
        charges: 0,
        total: subtotal,
        items: { create: items }
      }
    });
  }

  console.log("Seed complete");
}

main().finally(() => prisma.$disconnect());
