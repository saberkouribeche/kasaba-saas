const { execSync } = require('child_process');

try {
    console.log("Deploying Firestore Rules...");
    execSync('npx firebase deploy --only firestore:rules', { stdio: 'inherit' });
    console.log("Rules deployed successfully.");
} catch (error) {
    console.error("Failed to deploy rules:", error);
    process.exit(1);
}
