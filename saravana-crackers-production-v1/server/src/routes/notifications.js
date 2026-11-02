import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: "desc" },
    take: 100
  });
  res.json(notifications);
});

router.patch("/:id/read", async (req, res) => {
  const notification = await prisma.notification.updateMany({
    where: { id: Number(req.params.id), userId: req.user.id },
    data: { isRead: true }
  });
  if (!notification.count) return res.status(404).json({ error: "Notification not found." });
  res.json({ ok: true });
});

router.post("/register-device", async (req, res) => {
  const { deviceToken, platform = "web" } = req.body || {};
  if (typeof deviceToken !== "string" || deviceToken.trim().length < 10 || deviceToken.length > 4096) return res.status(400).json({ error: "A valid device token is required." });
  if (typeof platform !== "string" || platform.length > 30) return res.status(400).json({ error: "Invalid platform." });
  const token = await prisma.deviceNotificationToken.upsert({
    where: { deviceToken: deviceToken.trim() },
    update: { userId: req.user.id, platform, isActive: true },
    create: { userId: req.user.id, deviceToken: deviceToken.trim(), platform }
  });
  res.status(201).json({ id: token.id });
});

router.delete("/unregister-device", async (req, res) => {
  const deviceToken = typeof req.body?.deviceToken === "string" ? req.body.deviceToken.trim() : "";
  if (!deviceToken) return res.status(400).json({ error: "A device token is required." });
  await prisma.deviceNotificationToken.updateMany({ where: { userId: req.user.id, deviceToken }, data: { isActive: false } });
  res.json({ ok: true });
});

export default router;
