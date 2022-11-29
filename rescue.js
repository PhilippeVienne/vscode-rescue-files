import fs from "fs/promises";
import path from "path";
import archiver from "archiver";

const pathToRestore = process.argv[2] ?? process.env.HOME;

function resolveVSCodeFolder() {
  // Map to different folders depending on the OS
  const platform = process.platform;
  if (platform === "win32") {
    return path.join(process.env.APPDATA, "Code");
  }
  if (platform === "darwin") {
    return path.join(process.env.HOME, "Library", "Application Support", "Code");
  }
  if (platform === "linux") {
    return path.join(process.env.HOME, ".config", "Code");
  }
  throw new Error(`Unsupported platform: ${platform}`);
}

const vscodeHistoryFolder = path.join(
  resolveVSCodeFolder(),
  "./User/History",
);

if (!await fs.stat(vscodeHistoryFolder).then(() => true).catch(() => false)) {
  console.error("VSCode history folder not found");
  process.exit(1);
}

const vscodeHistoryFiles = await fs.readdir(vscodeHistoryFolder);
const recorvable = [];
for (const file of vscodeHistoryFiles) {
  const filePath = path.join(vscodeHistoryFolder, file);
  const entriesFile = path.join(filePath, "entries.json");

  // if file exists
  if (await fs.stat(entriesFile).catch(() => false)) {
    const entries = JSON.parse(await fs.readFile(entriesFile, "utf-8"));
    if (entries.resource.startsWith("file://" + pathToRestore)) {
      const currentEntries = entries.entries;
      currentEntries.sort((a, b) => b.timestamp - a.timestamp);
      const mostRecent = currentEntries[0];
      recorvable.push({
        relativePath: path.relative(
          pathToRestore,
          entries.resource.replace("file://", ""),
        ),
        content: await fs.readFile(path.join(filePath, mostRecent.id), "utf-8"),
      });
    }
  }
}

// Create archive from recorvable
const archive = archiver("zip", {
  zlib: { level: 9 },
});

archive.on("error", (err) => {
  throw err;
});

archive.pipe(process.stdout);

for (const file of recorvable) {
  archive.append(file.content, { name: file.relativePath });
}

archive.finalize();