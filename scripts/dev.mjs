import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  process.exitCode = code;
}
function launch(args, env = process.env) {
  const child = spawn(process.execPath, args, { cwd: root, env, stdio: "inherit" });
  children.push(child);
  child.on("error", error => { console.error(error.message); stop(1); });
  child.on("exit", code => stop(code ?? 1));
  return child;
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
const port = process.env.PORT ?? "3333";
const base = "http://127.0.0.1:" + port + "/api";
try {
  const existing = await fetch(base + "/saude", { signal: AbortSignal.timeout(800) }).catch(() => null);
  if (existing) throw new Error("A porta " + port + " já está em uso. Encerre o backend anterior.");
  launch(["backend/src/server.js"]);
  let healthy = false;
  for (let attempt = 0; attempt < 100 && !stopping; attempt++) {
    const response = await fetch(base + "/saude", { signal: AbortSignal.timeout(500) }).catch(() => null);
    if (response?.ok) { healthy = true; break; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!healthy) throw new Error("A API não iniciou. Confira a versão do Node e a porta " + port + ".");
  if (!stopping) {
    const web = process.argv.includes("--web");
    launch(["node_modules/expo/bin/cli", "start", ...process.argv.slice(2)], {
      ...process.env,
      ...(web ? { EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL ?? base } : {}),
    });
  }
} catch (error) { console.error(error.message); stop(1); }
