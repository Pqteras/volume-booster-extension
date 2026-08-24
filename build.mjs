import { build } from "esbuild";
import { cp, mkdir, readFile } from "node:fs/promises";
import sharp from "sharp";

await mkdir("dist/fonts", { recursive: true });
await mkdir("dist/webfonts", { recursive: true });
await mkdir("dist/icons", { recursive: true });

await build({
  entryPoints: [
    { in: "src/background/index.ts", out: "background" },
    { in: "src/content/index.ts", out: "content" },
    { in: "src/popup/popup.ts", out: "popup" },
  ],
  outdir: "dist",
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "chrome110",
  minify: true,
  legalComments: "none",
});

await Promise.all([
  cp("src/manifest.json", "dist/manifest.json"),
  cp("src/popup/popup.html", "dist/popup.html"),
  cp("public/logo.svg", "dist/logo.svg"),
]);

const logoSvg = await readFile("public/logo.svg", "utf8");
const pathMatch = logoSvg.match(/d="([^"]+)"/);
if (!pathMatch?.[1]) {
  throw new Error("public/logo.svg is missing path data");
}

const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640">
  <defs>
    <linearGradient id="limeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#e2fa7a"/>
      <stop offset="100%" stop-color="#b6ef1e"/>
    </linearGradient>
  </defs>
  <rect width="640" height="640" rx="140" fill="url(#limeGrad)"/>
  <g transform="translate(70, 70) scale(0.78)">
    <path fill="#121514" d="${pathMatch[1]}"/>
  </g>
</svg>`;

await Promise.all(
  [16, 32, 48, 128].map((size) =>
    sharp(Buffer.from(iconSvg)).resize(size, size).png().toFile(`dist/icons/icon-${size}.png`)
  )
);

await Promise.all([
  cp(
    "node_modules/@fontsource/space-grotesk/files/space-grotesk-latin-400-normal.woff2",
    "dist/fonts/space-grotesk-latin-400-normal.woff2"
  ),
  cp(
    "node_modules/@fontsource/space-grotesk/files/space-grotesk-latin-500-normal.woff2",
    "dist/fonts/space-grotesk-latin-500-normal.woff2"
  ),
  cp(
    "node_modules/@fontsource/space-grotesk/files/space-grotesk-latin-600-normal.woff2",
    "dist/fonts/space-grotesk-latin-600-normal.woff2"
  ),
  cp(
    "node_modules/@fontsource/dm-mono/files/dm-mono-latin-400-normal.woff2",
    "dist/fonts/dm-mono-latin-400-normal.woff2"
  ),
  cp(
    "node_modules/@fontsource/dm-mono/files/dm-mono-latin-500-normal.woff2",
    "dist/fonts/dm-mono-latin-500-normal.woff2"
  ),
  cp(
    "node_modules/@fortawesome/fontawesome-free/webfonts/fa-solid-900.woff2",
    "dist/webfonts/fa-solid-900.woff2"
  ),
]);

console.log("build ok");
