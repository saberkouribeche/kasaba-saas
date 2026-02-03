
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

async function listUsers() {
    console.log("Fetching users...");
    try {
        const snapshot = await getDocs(collection(db, "users"));
        if (snapshot.empty) {
            console.log("No users found.");
            return;
        }

        console.log(`Found ${snapshot.size} users:`);
        snapshot.forEach(doc => {
            const data = doc.data();
            console.log(`ID: ${doc.id}`);
            console.log(` - Phone: '${data.phone}'`);
            console.log(` - Name: ${data.fullName}`);
            console.log(` - Role: ${data.role}`);
            console.log(` - Password: '${data.password}'`);
            console.log("-------------------");
        });
    } catch (error) {
        console.error("Error:", error);
    }
}

listUsers();
