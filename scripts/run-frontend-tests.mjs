import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "..");

process.env.CI = "true";

const invocation =
  process.platform === "win32"
    ? {
        command: "cmd.exe",
        args: ["/d", "/s", "/c", "npm test --prefix frontend -- --watchAll=false"]
      }
    : {
        command: "npm",
        args: ["test", "--prefix", "frontend", "--", "--watchAll=false"]
      };

const child = spawn(invocation.command, invocation.args, {
  cwd: rootDir,
  stdio: "inherit"
});

child.on("close", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
