// ビルド後に dist/sw.js の事前キャッシュ一覧とバージョンを埋め込む
// 電波のない場所でも遊べるよう、JS・CSS・ピクルくんの画像と、
// 書体のうち「アプリの文に出てくる文字」を含む分割ファイル（woff2）だけを最初に入れておく
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const root = new URL("../", import.meta.url);
const dist = new URL("dist/", root);
const list = (dir) => (existsSync(new URL(dir, dist)) ? readdirSync(new URL(dir, dist)).map((f) => `./${dir}${f}`) : []);

// アプリの文に出てくる文字（src/ の中の文字をすべて集める）
const used = new Set();
const walk = (url) => {
  for (const name of readdirSync(url)) {
    const u = new URL(name, url);
    if (statSync(u).isDirectory()) walk(new URL(`${name}/`, url));
    else if (/\.(tsx?|css)$/.test(name)) for (const ch of readFileSync(u, "utf8")) used.add(ch.codePointAt(0));
  }
};
walk(new URL("src/", root));

// CSS の @font-face から「woff2 のファイル → 受け持つ文字の範囲」を読み、使う文字を含むものだけ残す
const css = list("assets/").filter((f) => f.endsWith(".css")).map((f) => readFileSync(new URL(f.slice(2), dist), "utf8")).join("\n");
const neededFonts = new Set();
for (const [, body] of css.matchAll(/@font-face\{([^}]*)\}/g)) {
  const file = body.match(/url\(\/softtennis-asobi\/(assets\/[^)]+\.woff2)\)/)?.[1];
  const range = body.match(/unicode-range:([^;}]*)/)?.[1];
  if (!file || !range) continue;
  const hit = range.split(",").some((part) => {
    const [a, b] = part.trim().replace(/^U\+/i, "").split("-").map((h) => parseInt(h, 16));
    for (const cp of used) if (cp >= a && cp <= (b ?? a)) return true;
    return false;
  });
  if (hit) neededFonts.add(`./${file}`);
}

const assets = list("assets/").filter((f) => !/\.woff2?$/.test(f) || neededFonts.has(f));

const shell = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-192.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png",
  ...list("hawk/"),
  ...list("voice/").filter((f) => f.endsWith(".mp3") || f.endsWith(".json")),
  ...assets,
];

const version = createHash("sha256").update(shell.join("\n")).digest("hex").slice(0, 10);
const swPath = new URL("sw.js", dist);
const sw = readFileSync(swPath, "utf8")
  .replaceAll("__VERSION__", version)
  .replaceAll("__PRECACHE__", JSON.stringify(shell, null, 2));
writeFileSync(swPath, sw);
const bytes = shell.filter((f) => f.startsWith("./assets/")).reduce((n, f) => n + statSync(new URL(f.slice(2), dist)).size, 0);
console.log(`sw.js: version=${version}, precache=${shell.length} files（書体 ${neededFonts.size} 個、assets 合計 ${(bytes / 1e6).toFixed(1)}MB）`);
