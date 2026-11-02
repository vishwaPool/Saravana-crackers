import { initializeApp } from "firebase/app";
import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { api } from "./api";

export async function registerPushNotifications() {
  if (!import.meta.env.VITE_FIREBASE_PROJECT_ID || !("Notification" in window) || Notification.permission === "denied") return;
  if (!(await isSupported())) return;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return;
  const app = initializeApp({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
  });
  const token = await getToken(getMessaging(app), { vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY });
  if (token) await api("/notifications/register-device", { method: "POST", body: JSON.stringify({ deviceToken: token, platform: "web" }) });
}
