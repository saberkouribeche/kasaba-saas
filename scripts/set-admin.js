
const { initializeApp } = require("firebase/app");
const { getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp } = require("firebase/firestore");
const fs = require("fs");
const path = require("path");

// Load env
const envPath = path.resolve(__dirname, "../.env.local");
let env = {};
if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf8");
    content.split("\n").forEach(line => {
        const [key, value] = line.split("=");
        if (key && value) {
            env[key.trim()] = value.trim().replace(/"/g, "");
        }
    });
}

const firebaseConfig = {
    apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const TARGET_PHONE = "0540030932";
const NEW_PASSWORD = "saber@97_2004";

async function setAdmin() {
    console.log(`Setting Admin: ${TARGET_PHONE}`);
    const userRef = doc(db, "users", TARGET_PHONE);

    try {
        const snap = await getDoc(userRef);

        if (snap.exists()) {
            console.log("User exists. Updating role and password...");
            await updateDoc(userRef, {
                role: "admin",
                password: NEW_PASSWORD,
                updatedAt: serverTimestamp()
            });
            console.log("✅ User updated to Admin successfully.");
        } else {
            console.log("User does not exist. Creating new Admin user...");
            await setDoc(userRef, {
                phone: TARGET_PHONE,
                password: NEW_PASSWORD,
                fullName: "Admin User (Saber)",
                role: "admin",
                createdAt: serverTimestamp()
            });
            console.log("✅ New Admin user created successfully.");
        }

    } catch (error) {
        console.error("Error:", error);
    }
}

setAdmin();
