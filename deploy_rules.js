const admin = require("firebase-admin");
const fs = require("fs");

const serviceAccount = require("./service-account.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

async function deploy() {
    const source = fs.readFileSync("firestore.rules", "utf8");

    try {
        const ruleset = await admin.securityRules().createRuleset({
            source: {
                files: [{
                    name: "firestore.rules",
                    content: source
                }]
            }
        });

        await admin.securityRules().releaseFirestoreRuleset(ruleset.name);
        console.log("Firestore Security Rules updated successfully!");
    } catch (error) {
        console.error("Failed to deploy rules:", JSON.stringify(error, null, 2));
        if (error.response) {
            console.error("Response:", JSON.stringify(error.response, null, 2));
        }
        process.exit(1);
    }
}

deploy();
