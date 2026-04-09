import { spawn } from "node:child_process";

const argv = process.argv.slice(2).filter((arg) => arg !== "--runInBand");

const vitest = spawn(
  process.execPath,
  ["./node_modules/vitest/vitest.mjs", ...argv],
  {
    stdio: "inherit",
    env: process.env,
  },
);

vitest.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
