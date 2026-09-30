#!/usr/bin/env node
/**
 * Publicación automática: verifica, sube a GitHub y Vercel despliega (integración Git).
 *
 * Se ejecuta como hook `Stop` de Claude Code (al terminar cada respuesta) o a mano:
 *   node scripts/auto-deploy.mjs           -> si hay cambios: checks -> commit -> push a main
 *   node scripts/auto-deploy.mjs --force   -> despliega directo con la CLI de Vercel (sin git)
 *
 * Flujo: ¿hay cambios? -> typecheck + lint + tests + build -> git commit + push.
 * Si algo falla NO se sube nada (producción queda intacta) y el error se devuelve
 * a Claude (exit 2) para que lo corrija.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const raiz = process.cwd();
const dirVercel = join(raiz, ".vercel");
const archivoLog = join(dirVercel, "auto-deploy.log");
const RAMA = "main";
const COAUTOR = "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>";

const args = new Set(process.argv.slice(2));

// Pausa manual: si existe el archivo .deploy-hold NO se publica nada (útil cuando el código
// nuevo depende de una migración SQL que aún no se ha ejecutado en Supabase).
if (existsSync(join(raiz, ".deploy-hold")) && !args.has("--force")) {
  log("PAUSADO por .deploy-hold");
  process.exit(0);
}

function log(msg) {
  mkdirSync(dirVercel, { recursive: true });
  appendFileSync(archivoLog, `[${new Date().toISOString()}] ${msg}\n`);
}

/** Respuesta al hook de Claude Code. */
function salir({ codigo = 0, mensaje, error }) {
  if (error) process.stderr.write(`${error}\n`);
  if (mensaje) process.stdout.write(JSON.stringify({ systemMessage: mensaje }) + "\n");
  process.exit(codigo);
}

function ejecutar(comando, argumentos, opciones = {}) {
  const r = spawnSync(comando, argumentos, {
    cwd: raiz,
    encoding: "utf8",
    shell: true,
    maxBuffer: 32 * 1024 * 1024,
    ...opciones,
  });
  return { ok: r.status === 0, salida: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

const git = (...a) => ejecutar("git", a);
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

function fallar(titulo, detalle) {
  log(`FALLO ${titulo}\n${detalle}`);
  const texto = `Publicación cancelada: ${titulo}. No se subió nada; producción no cambió.\n${detalle}`;
  // Con stop_hook_active no se vuelve a bloquear (evita bucles infinitos).
  salir(
    yaReintentando
      ? { mensaje: `Publicación cancelada: ${titulo}.`, error: texto }
      : { codigo: 2, error: texto }
  );
}

// ---------- modo manual directo (CLI de Vercel, sin pasar por git) ----------
if (args.has("--force")) {
  const d = ejecutar("npx", ["--yes", "vercel@latest", "deploy", "--prod", "--yes"], { stdio: "inherit" });
  process.exit(d.ok ? 0 : 1);
}

if (!existsSync(join(raiz, ".git"))) {
  salir({ error: "Auto-deploy: esta carpeta no es un repositorio git." });
}

// ---------- ¿hay algo que publicar? ----------
const estado = git("status", "--porcelain").salida.trim();
const sinSubir = git("rev-list", "--count", `origin/${RAMA}..HEAD`).salida.trim();
const hayCommitsPendientes = Number(sinSubir) > 0;
if (!estado && !hayCommitsPendientes) process.exit(0);

// ---------- verificaciones (si fallan, no se sube nada) ----------
for (const [nombre, cmd] of [
  ["typecheck", ["run", "typecheck"]],
  ["lint", ["run", "lint"]],
  ["pruebas", ["test"]],
  ["build", ["run", "build"]],
]) {
  const r = ejecutar("npm", cmd);
  if (!r.ok) fallar(`falló "${nombre}"`, cola(r.salida));
}

// ---------- commit + push ----------
if (estado) {
  const archivos = estado.split(/\r?\n/).length;
  const add = git("add", "-A");
  if (!add.ok) fallar("git add", cola(add.salida));
  const fecha = new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" });
  const commit = ejecutar("git", [
    "commit", "-q",
    "-m", `"Actualización automática (${archivos} archivos) · ${fecha}"`,
    "-m", `"${COAUTOR}"`,
  ]);
  if (!commit.ok) fallar("git commit", cola(commit.salida));
}

const push = git("push", "origin", RAMA);
if (!push.ok) fallar("git push (¿credenciales de GitHub o red?)", cola(push.salida));

log("OK push a GitHub -> Vercel despliega");
salir({
  mensaje:
    "🚀 Cambios subidos a GitHub; Vercel está desplegando: https://polo-air-cool.vercel.app (≈1 min).",
});
