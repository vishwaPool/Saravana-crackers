import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

async function main() {
  const email = process.env.ADMIN_EMAIL || "admin@saravanacrackers.in";
  const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || "ChangeMe123!", 12);

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

  console.log("Seed complete");
}

main().finally(() => prisma.$disconnect());
