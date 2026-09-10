import { apiError } from "./lib/apiError.js";
import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import auth from "./routes/auth.js";
import publicRoutes from "./routes/public.js";
import adminRoutes from "./routes/admin.js";
import analyticsRoutes from "./routes/analytics.js";

if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is required");

const app = express();
const port = Number(process.env.PORT || 4000);
const configuredOrigins = (process.env.FRONTEND_URL || process.env.CLIENT_URL || "")
  .split(",")
  // Browser Origin headers never include a trailing slash.
  .map(origin => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);
const allowedOrigins = new Set(["http://localhost:5173", ...configuredOrigins]);

if (process.env.VERCEL && !process.env.FRONTEND_URL?.trim()) {
  console.warn("FRONTEND_URL is missing; set the frontend origin in the backend Vercel environment and redeploy.");
}

// Application-level cors handles OPTIONS before body parsing and API routes.
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    console.error(`CORS blocked origin: ${origin}`);
    return callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", auth);
app.use("/api", publicRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/analytics", analyticsRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  const {status,message} = apiError(err);
  res.status(status).json({ error: message });
});

if (!process.env.VERCEL) {
  app.listen(port, () => console.log(`API running on port ${port}`));
}

export default app;
