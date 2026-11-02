import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const firebaseKeys = { API_KEY: "apiKey", AUTH_DOMAIN: "authDomain", PROJECT_ID: "projectId", STORAGE_BUCKET: "storageBucket", MESSAGING_SENDER_ID: "messagingSenderId", APP_ID: "appId" };
  const firebaseConfig = Object.entries(firebaseKeys)
    .map(([key, output]) => `${output}: ${JSON.stringify(env[`VITE_FIREBASE_${key}`] || "")}`)
    .join(",\n  ");
  return {
    plugins: [react(), {
      name: "firebase-messaging-service-worker",
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "firebase-messaging-sw.js",
          source: `importScripts("https://www.gstatic.com/firebasejs/12.4.0/firebase-app-compat.js");\nimportScripts("https://www.gstatic.com/firebasejs/12.4.0/firebase-messaging-compat.js");\nfirebase.initializeApp({${firebaseConfig}});\nfirebase.messaging();`
        });
      }
    }]
  };
});