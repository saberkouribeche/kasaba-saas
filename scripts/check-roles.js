
const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs } = require("firebase/firestore");
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

async function checkRoles() {
    console.log("Checking user roles...");
    try {
        const snapshot = await getDocs(collection(db, "users"));
        const roles = {};
        const allUsers = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            allUsers.push({ id: doc.id, ...data });
            const r = data.role || 'undefined';
            roles[r] = (roles[r] || 0) + 1;
        });

        console.log("Role Distribution:", roles);
        console.log("--------------------------------");
        console.log("Sample Users (First 10):");
        allUsers.slice(0, 10).forEach(u => {
            console.log(`ID: ${u.id}, Name: ${u.fullName}, Role: ${u.role}, Phone: ${u.phone}`);
            console.log(JSON.stringify(u)); // Dump full object to check for other fields
            console.log("---");
        });

    } catch (error) {
        console.error("Error:", error);
    }
}

checkRoles();
