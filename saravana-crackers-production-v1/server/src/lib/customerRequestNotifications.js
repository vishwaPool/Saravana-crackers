import { EventEmitter } from "node:events";
import { prisma } from "./prisma.js";
import { sendPushNotifications } from "./pushNotifications.js";

export const requestEvents = new EventEmitter();

const indoorRoles = ["SUPER_ADMIN", "ADMIN", "INDOOR_STAFF", "ORDER_MANAGER"];

export async function notifyUsers({ requestId, title, message, userIds = null }) {
  const users = userIds
    ? await prisma.user.findMany({ where: { id: { in: userIds }, active: true }, select: { id: true } })
    : await prisma.user.findMany({ where: { active: true, role: { in: indoorRoles } }, select: { id: true } });
  if (!users.length) return [];
  const notifications = await prisma.$transaction(users.map(user => prisma.notification.create({
    data: { userId: user.id, requestId, title, message }
  })));
  for (const notification of notifications) requestEvents.emit("notification", notification);
  await sendPushNotifications(users.map(user => user.id), title, message, { requestId });
  return notifications;
}

export function canManageCustomerRequests(role) {
  return indoorRoles.includes(role);
}

export function canCreateCustomerRequests(role) {
  return role === "OUTDOOR_SALESPERSON" || canManageCustomerRequests(role);
}
