import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (typeof email !== "string" || !email.trim() || typeof password !== "string" || !password) return res.status(400).json({error:"Email and password are required."});
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );

  const secure = process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production";

  res.cookie("sc_admin_token", token, {
    httpOnly: true,
    secure,
    sameSite: secure ? "none" : "lax",
    maxAge: 8 * 60 * 60 * 1000
  });

  res.json({ user: { id: user.id, name: user.name, role: user.role } });
});

router.post("/logout", (_req, res) => {
  res.clearCookie("sc_admin_token");
  res.json({ ok: true });
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
