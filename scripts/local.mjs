import { spawnSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

// This cluster belongs only to this project; never use the system PostgreSQL service.
const root = fileURLToPath(new URL("../", import.meta.url));
process.chdir(root);
process.umask(0o077);
const local = path.join(root, ".local");
const data = path.join(local, "postgres");
const configPath = path.join(local, "database.json");
const action = process.argv[2] ?? "dev";
if (!["dev", "start", "db", "stop", "migrate", "backup"].includes(action)) {
  throw new Error(`Unknown action: ${action}`);
}
const versions = existsSync("/usr/lib/postgresql")
  ? readdirSync("/usr/lib/postgresql").sort((a, b) => Number(b) - Number(a)) : [];
const clusterVersion = existsSync(path.join(data, "PG_VERSION"))
  ? readFileSync(path.join(data, "PG_VERSION"), "utf8").trim() : versions[0];
const bin = process.env.PG_BIN ?? (clusterVersion ? `/usr/lib/postgresql/${clusterVersion}/bin` : "");
const binary = (name) => bin ? path.join(bin, name) : name;
function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { stdio: "inherit", env });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${path.basename(command)} failed (${result.status})`);
}
mkdirSync(local, { recursive: true, mode: 0o700 });
if (action === "stop") {
  if (existsSync(path.join(data, "postmaster.pid"))) {
    run(binary("pg_ctl"), ["-D", data, "-m", "fast", "-w", "stop"]);
  }
  process.exit(0);
}
if (!existsSync(configPath)) {
  if (existsSync(data)) throw new Error("Database directory exists without its configuration; restore .local/database.json before continuing.");
  writeFileSync(configPath, JSON.stringify({
    port: 55432, user: "annotation", database: "annotation_tracker",
    password: randomBytes(24).toString("hex"),
  }), { mode: 0o600, flag: "wx" });
}
const config = JSON.parse(readFileSync(configPath, "utf8"));
if (!existsSync(path.join(data, "PG_VERSION"))) {
  const passwordFile = path.join(local, "init-password");
  writeFileSync(passwordFile, config.password, { mode: 0o600 });
  try {
    run(binary("initdb"), ["-D", data, "-U", config.user, "--auth-local=scram-sha-256", "--auth-host=scram-sha-256", `--pwfile=${passwordFile}`]);
  } finally {
    unlinkSync(passwordFile);
  }
  writeFileSync(path.join(data, "postgresql.auto.conf"),
    `listen_addresses = '127.0.0.1'\nport = ${config.port}\nunix_socket_directories = '${local.replaceAll("'", "''")}'\n`);
}
if (spawnSync(binary("pg_ctl"), ["-D", data, "status"], { stdio: "ignore" }).status !== 0) {
  run(binary("pg_ctl"), ["-D", data, "-l", path.join(local, "postgres.log"), "-w", "start"]);
}
const connection = { host: "127.0.0.1", port: config.port, user: config.user, password: config.password };
const admin = new pg.Client({ ...connection, database: "postgres" });
await admin.connect();
try {
  const found = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [config.database]);
  if (!found.rowCount) {
    await admin.query(`CREATE DATABASE "${config.database.replaceAll('"', '""')}"`);
  }
} finally {
  await admin.end();
}
const databaseUrl = `postgresql://${encodeURIComponent(config.user)}:${encodeURIComponent(config.password)}@127.0.0.1:${config.port}/${encodeURIComponent(config.database)}`;
const env = { ...process.env, DATABASE_URL: databaseUrl };
console.log(`Annotation database: 127.0.0.1:${config.port}/${config.database}`);
if (action === "backup") {
  const backups = path.join(root, "backups");
  mkdirSync(backups, { recursive: true, mode: 0o700 });
  const output = path.join(backups, `annotation-${new Date().toISOString().replaceAll(":", "-")}.dump`);
  run(binary("pg_dump"), ["-h", connection.host, "-p", String(config.port), "-U", config.user, "-d", config.database, "-Fc", "-f", output], { ...process.env, PGPASSWORD: config.password });
  console.log(`Backup saved: ${output}`);
} else if (action !== "db") {
  run(process.execPath, ["node_modules/drizzle-kit/bin.cjs", "migrate"], env);
  if (action === "dev" || action === "start") {
    const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", action, "--hostname", "127.0.0.1", "--port", process.env.ANNOTATION_UI_PORT ?? "3100"], { stdio: "inherit", env });
    for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
    child.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
    child.on("exit", (code) => { process.exitCode = code ?? 0; });
  }
}
