import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDirectory, "..");
const sdkRoot = path.join(appRoot, "node_modules", "biodaw", "dist-sdk");
const publicRoot = path.join(appRoot, "public");

if (!fs.existsSync(sdkRoot)) {
  throw new Error(`BioDAW SDK assets are missing at ${sdkRoot}. Run npm install.`);
}

fs.cpSync(path.join(sdkRoot, "app"), path.join(publicRoot, "biodaw", "app"), {
  recursive: true,
  force: true,
});
fs.cpSync(
  path.join(sdkRoot, "silent-check-sso.html"),
  path.join(publicRoot, "silent-check-sso.html"),
  { force: true },
);

console.log("[prepare:assets] BioDAW 1.0.1 runtime and Keycloak SSO helper ready.");
