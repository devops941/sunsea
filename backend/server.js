const fs = require("fs");
const path = require("path");

const distPath = path.join(__dirname, "dist", "server.js");

if (fs.existsSync(distPath)) {
  console.log("Running compiled production backend from dist...");
  require("./dist/server.js");
} else {
  console.log("Registering ts-node and running development backend from src...");
  require("ts-node/register");
  require("./src/server.ts");
}
