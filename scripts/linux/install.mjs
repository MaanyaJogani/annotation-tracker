import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const data = process.env.XDG_DATA_HOME || join(homedir(), ".local/share");
const config = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
const applications = join(data, "applications");
const units = join(config, "systemd/user");
const icons = join(data, "icons/hicolor/scalable/apps");

function unitArg(value) {
  return '"' + value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('%', '%%') + '"';
}

function desktopArg(value) {
  const quoted = value.replace(/["`$\\]/g, '\\$&').replaceAll('%', '%%');
  return '"' + quoted.replaceAll('\\', '\\\\') + '"';
}

for (const dir of [applications, units, icons]) mkdirSync(dir, { recursive: true });
const service = [
  "[Unit]", "Description=Annotation Tracker local app", "",
  "[Service]", "Type=simple",
  "Environment=" + unitArg("PATH=" + dirname(process.execPath) + ":/usr/local/bin:/usr/bin:/bin"),
  ...(process.env.PG_BIN ? ["Environment=" + unitArg("PG_BIN=" + process.env.PG_BIN)] : []),
  "ExecStart=:" + unitArg(process.execPath) + " " + unitArg(join(root, "scripts/local.mjs")) + " dev",
  "",
];
writeFileSync(join(units, "annotation-tracker.service"), service.join("\n"));
copyFileSync(join(root, "src/app/icon.svg"), join(icons, "annotation-tracker.svg"));
const entry = [
  "[Desktop Entry]", "Type=Application", "Name=Annotation Tracker",
  "Comment=Track annotation tasks, time, and payouts",
  "Exec=" + desktopArg(join(root, "scripts/linux/open-tracker")), "Icon=annotation-tracker",
  "Terminal=false", "Categories=Office;ProjectManagement;",
  "StartupWMClass=brave-127.0.0.1__-Default", "",
].join("\n");
writeFileSync(join(applications, "annotation-tracker.desktop"), entry);
// KDE associates Brave's app window with this desktop ID.
writeFileSync(join(applications, "brave-127.0.0.1__-Default.desktop"), entry + "NoDisplay=true\n");
execFileSync("systemctl", ["--user", "daemon-reload"], { stdio: "inherit" });
console.log("Open Annotation Tracker from your applications menu.");
