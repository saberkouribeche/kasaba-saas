
const { initializeApp } = require("firebase/app");
const { getFirestore, doc, setDoc } = require("firebase/firestore");

// Hardcoded for script execution context (Node.js doesn't load .env.local automatically)
const firebaseConfig = {
    apiKey: "AIzaSyAG70vRmS8_l7mIiJV-0ykfUh37rxsvMoM",
    authDomain: "pymentresto.firebaseapp.com",
    projectId: "pymentresto",
    storageBucket: "pymentresto.firebasestorage.app",
    messagingSenderId: "897304760501",
    appId: "1:897304760501:web:8c8d5f8e9eb0b9f86f2efc",
    measurementId: "G-65V69DJ43V"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function createAdmin() {
    try {
        console.log("Creating admin user...");
        await setDoc(doc(db, "users", "0550123456"), {
            phone: "0550123456",
            password: "admin",
            fullName: "Admin User",
            role: "admin",
            createdAt: new Date().toISOString() // Use string to be safe
        });
        console.log("Admin user created successfully!");
        process.exit(0);
    } catch (error) {
        console.error("Error creating admin:", error);
        process.exit(1);
    }
}

createAdmin();
