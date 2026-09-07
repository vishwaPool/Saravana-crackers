import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import auth from "./routes/auth.js";
import publicRoutes from "./routes/public.js";
import adminRoutes from "./routes/admin.js";

if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is required");

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true
}));

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", auth);
app.use("/api", publicRoutes);
app.use("/api/admin", adminRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

app.listen(port, () => console.log(`API running at http://localhost:${port}`));
