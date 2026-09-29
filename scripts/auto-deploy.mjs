#!/usr/bin/env node
/**
 * Despliegue automático a Vercel (producción) cuando el código cambió.
 *
 * Se ejecuta como hook `Stop` de Claude Code (al terminar cada respuesta) o a mano:
 *   node scripts/auto-deploy.mjs             -> despliega si hay cambios
 *   node scripts/auto-deploy.mjs --baseline  -> marca el código actual como ya desplegado
 *   node scripts/auto-deploy.mjs --force     -> despliega aunque no haya cambios
 *
 * Flujo: huella del código -> typecheck + lint + tests -> vercel deploy --prod.
 * Si algo falla NO se despliega (producción queda intacta) y el error se devuelve
 * a Claude (exit 2) para que lo corrija.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, appendFileSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";

const raiz = process.cwd();
const dirVercel = join(raiz, ".vercel");
const archivoHuella = join(dirVercel, "last-deploy-hash");
const archivoLog = join(dirVercel, "auto-deploy.log");

const IGNORAR_DIRS = new Set(["node_modules", ".next", ".vercel", ".git", ".claude", "coverage"]);
const IGNORAR_ARCHIVOS = /^(\.env.*|.*\.log|tsconfig\.tsbuildinfo|next-env\.d\.ts)$/;

const args = new Set(process.argv.slice(2));

function log(msg) {
  mkdirSync(dirVercel, { recursive: true });
  appendFileSync(archivoLog, `[${new Date().toISOString()}] ${msg}\n`);
}

/** Hook: responde a Claude Code. */
function salir({ codigo = 0, mensaje, error }) {
  if (error) process.stderr.write(`${error}\n`);
  if (mensaje) process.stdout.write(JSON.stringify({ systemMessage: mensaje }) + "\n");
  process.exit(codigo);
}

function huellaDelCodigo() {
  const hash = createHash("sha256");
  const recorrer = (dir) => {
    for (const nombre of readdirSync(dir).sort()) {
      const ruta = join(dir, nombre);
      const st = statSync(ruta);
      if (st.isDirectory()) {
        if (!IGNORAR_DIRS.has(nombre)) recorrer(ruta);
      } else if (!IGNORAR_ARCHIVOS.test(nombre)) {
        hash.update(relative(raiz, ruta).replaceAll("\\", "/"));
        hash.update(readFileSync(ruta));
      }
    }
  };
  recorrer(raiz);
  return hash.digest("hex");
}

function ejecutar(comando, argumentos) {
  const r = spawnSync(comando, argumentos, { cwd: raiz, encoding: "utf8", shell: true, maxBuffer: 32 * 1024 * 1024 });
  return { ok: r.status === 0, salida: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

const cola = (texto, n = 25) => texto.trim().split(/\r?\n/).slice(-n).join("\n");

// ---------- stdin del hook (evita bucles si Claude ya está corrigiendo) ----------
let entrada = {};
try {
  const crudo = readFileSync(0, "utf8");
  if (crudo.trim()) entrada = JSON.parse(crudo);
} catch {
  /* ejecución manual: sin stdin */
}
const yaReintentando = entrada.stop_hook_active === true;

// ---------- ¿hay cambios? ----------
const huella = huellaDelCodigo();
const anterior = existsSync(archivoHuella) ? readFileSync(archivoHuella, "utf8").trim() : "";

if (args.has("--baseline")) {
  mkdirSync(dirVercel, { recursive: true });
  writeFileSync(archivoHuella, huella);
  console.log("Huella actual registrada como desplegada.");
  process.exit(0);
}

if (!args.has("--force") && huella === anterior) process.exit(0);

if (!existsSync(join(dirVercel, "project.json"))) {
  salir({ error: "Auto-deploy: falta .vercel/project.json (ejecuta `npx vercel link`)." });
}

// ---------- verificaciones (si fallan, no se despliega) ----------
for (const [nombre, cmd] of [
  ["typecheck", ["run", "typecheck"]],
  ["lint", ["run", "lint"]],
  ["tests", ["test"]],
]) {
  const r = ejecutar("npm", cmd);
  if (!r.ok) {
    const detalle = cola(r.salida);
    log(`FALLO ${nombre}\n${detalle}`);
    const texto = `Auto-deploy cancelado: falló "${nombre}". Producción no se modificó. Corrige y vuelve a terminar.\n${detalle}`;
    // Con stop_hook_active no se vuelve a bloquear (evita bucles infinitos).
    salir(yaReintentando ? { mensaje: `Auto-deploy cancelado: falló ${nombre}.`, error: texto } : { codigo: 2, error: texto });
  }
}

// ---------- despliegue ----------
const d = ejecutar("npx", ["--yes", "vercel@latest", "deploy", "--prod", "--yes"]);
if (!d.ok) {
  const detalle = cola(d.salida, 40);
  log(`FALLO deploy\n${detalle}`);
  const texto = `Auto-deploy: Vercel rechazó el despliegue (revisa el build). Producción no cambió.\n${detalle}`;
  salir(yaReintentando ? { mensaje: "Auto-deploy: falló el build en Vercel.", error: texto } : { codigo: 2, error: texto });
}

const url = /Production URL:\s*(https?:\/\/\S+?)"/.exec(d.salida)?.[1] ?? "https://polo-air-cool.vercel.app";
writeFileSync(archivoHuella, huella);
log(`OK desplegado -> ${url}`);
salir({ mensaje: `🚀 Cambios desplegados en Vercel: ${url}` });
