#!/usr/bin/env node

/**
 * Simple validation script for quiet hours feature
 * Checks basic syntax and runs the new tests
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

console.log("=== Validating Quiet Hours Feature ===\n");

// Check if all files exist
const files = [
    "db/knex_migrations/2026-09-07-0000-quiet-hours.js",
    "server/model/quiet-hours.js",
    "server/socket-handlers/quiet-hours-socket-handler.js",
    "src/components/QuietHours.vue",
    "test/backend-test/test-quiet-hours.js",
    "test/backend-test/test-quiet-hours-integration.js",
];

console.log("Checking files...");
let allFilesExist = true;
for (const file of files) {
    const fullPath = path.join(__dirname, file);
    if (fs.existsSync(fullPath)) {
        console.log(`✓ ${file}`);
    } else {
        console.log(`✗ ${file} - MISSING`);
        allFilesExist = false;
    }
}

if (!allFilesExist) {
    console.error("\nSome files are missing!");
    process.exit(1);
}

console.log("\n=== All files present ===\n");

// Try to require the modules to check for syntax errors
console.log("Checking JavaScript syntax...");
try {
    require("./server/model/quiet-hours");
    console.log("✓ server/model/quiet-hours.js - Valid syntax");
} catch (e) {
    console.error(`✗ server/model/quiet-hours.js - Syntax error: ${e.message}`);
    process.exit(1);
}

try {
    require("./server/socket-handlers/quiet-hours-socket-handler");
    console.log("✓ server/socket-handlers/quiet-hours-socket-handler.js - Valid syntax");
} catch (e) {
    console.error(`✗ server/socket-handlers/quiet-hours-socket-handler.js - Syntax error: ${e.message}`);
    process.exit(1);
}

console.log("\n=== Syntax validation passed ===\n");

// Run the new tests
console.log("Running quiet hours tests...\n");
try {
    execSync("node --test test/backend-test/test-quiet-hours.js", { 
        stdio: "inherit",
        cwd: __dirname 
    });
    console.log("\n✓ Pure function tests passed");
} catch (e) {
    console.error("\n✗ Pure function tests failed");
    process.exit(1);
}

console.log("\n=== All validations passed ===\n");
