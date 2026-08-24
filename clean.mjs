import { rm } from "node:fs/promises";

await Promise.all([
  rm("dist", { recursive: true, force: true }),
  rm("volume-booster-extension.zip", { force: true }),
]);
