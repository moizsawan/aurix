#!/usr/bin/env node
// Generates an AURIX_USERS entry for a clinician or patient account.
//
//   npm run hash-password -- --email dr.patel@practice.com --name "Dr A Patel"
//
// The password is read from the terminal without echoing and is never written
// to disk, never passed as an argument (which would land in shell history and
// in the process table), and never printed back.

import { createInterface } from "node:readline";
import { stdin, stdout, argv, exit } from "node:process";
import { scryptSync, randomBytes } from "node:crypto";

const SCRYPT = { N: 32768, r: 8, p: 1, maxmem: 128 * 32768 * 8 * 2 };
const KEY_LEN = 64;

function arg(flag, fallback = null) {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
}

const email = arg("--email");
const name = arg("--name");
const role = arg("--role", "clinician");
const title = arg("--title");
const patientId = arg("--patient-id");

if (!email || !email.includes("@")) {
  console.error("Usage: npm run hash-password -- --email <address> [--name <name>] [--role clinician|patient] [--title <title>] [--patient-id <id>]");
  exit(1);
}
if (role !== "clinician" && role !== "patient") {
  console.error('--role must be "clinician" or "patient"');
  exit(1);
}

function askHidden(prompt) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: stdin, output: stdout, terminal: true });
    // Suppress echo so the password is not left on screen or in a scrollback.
    const onData = (char) => {
      if (["\n", "\r", ""].includes(String(char))) stdin.removeListener("data", onData);
      else stdout.write("\x1b[2K\x1b[200D" + prompt + "*".repeat(rl.line.length));
    };
    stdout.write(prompt);
    stdin.on("data", onData);
    rl.question("", (answer) => {
      rl.close();
      stdout.write("\n");
      resolve(answer);
    });
  });
}

const password = await askHidden("Password: ");
if (!password || password.length < 12) {
  console.error("\nPassword must be at least 12 characters.");
  exit(1);
}
const again = await askHidden("Confirm:  ");
if (password !== again) {
  console.error("\nPasswords do not match.");
  exit(1);
}

const salt = randomBytes(16);
const key = scryptSync(password, salt, KEY_LEN, SCRYPT);
const hash = ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64"), key.toString("base64")].join("$");

const entry = {
  email: email.trim().toLowerCase(),
  name: name || email,
  role,
  ...(title ? { title } : {}),
  ...(role === "patient" && patientId ? { patientId } : {}),
  hash,
};

console.log("\nAdd this object to the AURIX_USERS JSON array:\n");
console.log(JSON.stringify(entry, null, 2));
console.log(`
AURIX_USERS must be the whole array on one line, for example:

  AURIX_USERS='[${JSON.stringify(entry)}]'

You also need a session secret of at least 32 characters:

  AURIX_SESSION_SECRET=$(openssl rand -base64 48)

Set both on the deployment, not in the repository. With AURIX_USERS unset the
app stays in demo mode and the published sandbox accounts apply.
`);
