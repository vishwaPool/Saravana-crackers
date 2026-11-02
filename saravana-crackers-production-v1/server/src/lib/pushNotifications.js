import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { prisma } from "./prisma.js";

function messaging() {
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) return null;
  const app = getApps()[0] || initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    })
  });
  return getMessaging(app);
}

export async function sendPushNotifications(userIds, title, body, data = {}) {
  const service = messaging();
  if (!service || !userIds.length) return;
  const tokens = await prisma.deviceNotificationToken.findMany({ where: { userId: { in: userIds }, isActive: true }, select: { id: true, deviceToken: true } });
  if (!tokens.length) return;
  try {
    const result = await service.sendEachForMulticast({ tokens: tokens.map(token => token.deviceToken), notification: { title, body }, data: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, String(value)])) });
    const invalidIds = tokens.filter((_, index) => !result.responses[index].success && ["messaging/registration-token-not-registered", "messaging/invalid-registration-token"].includes(result.responses[index].error?.code)).map(token => token.id);
    if (invalidIds.length) await prisma.deviceNotificationToken.updateMany({ where: { id: { in: invalidIds } }, data: { isActive: false } });
  } catch (error) {
    console.error("FCM notification failed", error);
  }
}
