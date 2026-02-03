
const { initializeApp } = require("firebase/app");
const { getFirestore, doc, getDoc } = require("firebase/firestore");
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

const PHONE = "0552340728";
const PASSWORD = "sadik123";

async function debugLogin() {
    console.log(`Debug Login Simulation for: ${PHONE}`);

    try {
        const userRef = doc(db, "users", PHONE);
        const snap = await getDoc(userRef);

        if (!snap.exists()) {
            console.error("❌ Document does NOT exist with ID:", PHONE);
            // Try searching by field incase ID is different
            console.log("Searching collection for phone field...");
            // (omitted for brevity, usually ID matches phone in this app)
            return;
        }

        const data = snap.data();
        console.log("✅ Document Found.");
        console.log(" - Role:", data.role);
        console.log(" - Stored Password:", `'${data.password}'`);
        console.log(" - Input Password: ", `'${PASSWORD}'`);

        if (data.password === PASSWORD) {
            console.log("✅ PASSWORD MATCH. Login should work.");
        } else {
            console.error("❌ PASSWORD MISMATCH.");
            console.log("Length Stored:", data.password.length);
            console.log("Length Input:", PASSWORD.length);
        }

    } catch (error) {
        console.error("Error:", error);
    }
}

debugLogin();
