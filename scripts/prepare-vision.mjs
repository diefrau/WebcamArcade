import { mkdir, copyFile } from "node:fs/promises";
const source = new URL(
  "../node_modules/@mediapipe/tasks-vision/wasm/",
  import.meta.url,
);
const destination = new URL("../public/vision/wasm/", import.meta.url);
await mkdir(destination, { recursive: true });
for (const name of [
  "vision_wasm_internal",
  "vision_wasm_nosimd_internal",
  "vision_wasm_module_internal",
]) {
  for (const extension of ["js", "wasm"])
    await copyFile(
      new URL(`${name}.${extension}`, source),
      new URL(`${name}.${extension}`, destination),
    );
}
console.log("Local MediaPipe runtime prepared.");
