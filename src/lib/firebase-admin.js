import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const serviceAccount = {
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
};

export function initAdmin() {
    try {
        if (!getApps().length) {
            console.log("🔥 [AdminSDK] Initializing...");
            if (!serviceAccount.clientEmail || !serviceAccount.privateKey) {
                console.warn("🔥 [AdminSDK] Missing credentials!");
                return null;
            }
            initializeApp({
                credential: cert(serviceAccount),
            });
            console.log("🔥 [AdminSDK] Initialized Successfully");
        } else {
            console.log("🔥 [AdminSDK] Already Initialized");
        }
        return getFirestore();
    } catch (error) {
        console.error("🔥 [AdminSDK] Initialization Error:", error);
        return null; // Fail gracefully
    }
}

export const adminDb = initAdmin();
