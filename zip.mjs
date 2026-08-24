import JSZip from "jszip";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

const zip = new JSZip();

const addDirectory = async (dirPath, rootDir = dirPath) => {
  const entries = await readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      await addDirectory(fullPath, rootDir);
      continue;
    }

    const relPath = relative(rootDir, fullPath).replaceAll("\\", "/");
    zip.file(relPath, await readFile(fullPath));
  }
};

await addDirectory("dist");

const manifest = JSON.parse(await readFile("dist/manifest.json", "utf8"));
const zipBuffer = await zip.generateAsync({
  type: "nodebuffer",
  compression: "DEFLATE",
  compressionOptions: { level: 9 },
});

const zipFileName = "volume-booster-extension.zip";
await writeFile(zipFileName, zipBuffer);

const sizeKb = (zipBuffer.length / 1024).toFixed(1);
console.log(`${zipFileName} (${manifest.version}, ${sizeKb} KB)`);
