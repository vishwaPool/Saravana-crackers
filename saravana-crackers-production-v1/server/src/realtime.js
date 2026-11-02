import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { requestEvents } from "./lib/customerRequestNotifications.js";

const staffRoles = new Set(["SUPER_ADMIN", "ADMIN", "INDOOR_STAFF", "ORDER_MANAGER"]);
const readCookie = (header, name) => header?.split(";").map(value => value.trim()).find(value => value.startsWith(`${name}=`))?.slice(name.length + 1);

export function attachRealtime(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: process.env.FRONTEND_URL || process.env.CLIENT_URL || "http://localhost:5173", credentials: true }
  });
  io.use((socket, next) => {
    try {
      const token = readCookie(socket.handshake.headers.cookie, "sc_admin_token");
      if (!token) return next(new Error("Authentication required"));
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch { next(new Error("Invalid session")); }
  });
  io.on("connection", socket => {
    socket.join(`user:${socket.user.id}`);
    if (staffRoles.has(socket.user.role)) socket.join("customer-request-staff");
  });
  const forward = notification => {
    io.to(`user:${notification.userId}`).emit("notification", notification);
  };
  requestEvents.on("notification", forward);
  return io;
}
