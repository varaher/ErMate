const { initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const fs = require('fs');

async function main() {
  try {
    let testEnv = await initializeTestEnvironment({
      projectId: "test-ermate-" + Math.floor(Math.random()*1000000),
      firestore: {
        rules: fs.readFileSync("firestore.rules", "utf8")
      }
    });
    console.log("RULES SYNTAX VALID");
    await testEnv.cleanup();
  } catch (err) {
    console.error("RULES SYNTAX INVALID:", err.message);
    process.exit(1);
  }
}
main();
