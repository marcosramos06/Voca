// Downloads the Picture Words photos into public/photos. Skips files that already exist.
// Run on GitHub by .github/workflows/photos.yml.
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync("public/lang/pictures.js", "utf8");
const rows = vm.runInNewContext(`${source}; PICTURE_RAW`);
const slug = (name) => name.replace(/\s+/g, "-");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const headers = { "User-Agent": "VocaApp/1.0 (student language-learning project; github.com/marcosramos06/voca)" };
mkdirSync("public/photos", { recursive: true });

let failed = 0;
for (const row of rows) {
  const path = `public/photos/${slug(row[1])}.jpg`;
  if (existsSync(path)) continue;
  const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(row[6])}?width=640`;
  let saved = false;
  for (let attempt = 0; attempt < 5 && !saved; attempt++) {
    const res = await fetch(url, { headers, redirect: "follow" });
    if (res.ok) {
      writeFileSync(path, Buffer.from(await res.arrayBuffer()));
      console.log("saved", path);
      saved = true;
    } else {
      console.log("retry", row[1], res.status);
      await wait(res.status === 429 ? 20000 : 5000);
    }
  }
  if (!saved) { failed++; console.log("FAILED", row[1]); }
  await wait(1500);
}
console.log(`done, ${failed} failed`);
process.exit(failed ? 1 : 0);
