import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "..");

function npmInvocation(command) {
  if (process.platform === "win32") {
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", `npm ${command}`]
    };
  }

  return {
    command: "npm",
    args: command.split(" ")
  };
}

const steps = [
  {
    label: "AI test suite",
    ...npmInvocation("run test:ai")
  },
  {
    label: "Frontend UI tests",
    ...npmInvocation("run test:frontend")
  },
  {
    label: "Frontend production build",
    ...npmInvocation("run build:frontend")
  },
  {
    label: "Backend integration tests",
    ...npmInvocation("run test:backend")
  }
];

function runStep(step) {
  return new Promise((resolve, reject) => {
    console.log(`\n[verify] ${step.label}`);

    const child = spawn(step.command, step.args, {
      cwd: rootDir,
      stdio: "inherit",
      env: process.env
    });

    child.on("close", (code, signal) => {
      if (signal) {
        reject(new Error(`${step.label} was interrupted by signal ${signal}.`));
        return;
      }

      if (code !== 0) {
        reject(new Error(`${step.label} failed with exit code ${code}.`));
        return;
      }

      resolve();
    });
  });
}

for (const step of steps) {
  await runStep(step);
}

console.log("\n[verify] Full pipeline passed.");
