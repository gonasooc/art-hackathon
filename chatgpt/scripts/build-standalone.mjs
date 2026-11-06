import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = ['src/portfolio-data.js', 'src/sample-art.js', 'src/timeline.js', 'src/resources.js', 'src/typing.js', 'src/keyboard.js', 'src/audio.js', 'src/presentation.js', 'src/app.js'];
let code = (await Promise.all(files.map(f => readFile(path.join(root, f), 'utf8')))).map(source => source
  .replace(/^import .+ from ['"].+['"];?\s*$/gm, '')
  .replace(/^export (?=(?:const|let|class|function)\b)/gm, '')).join('\n\n');
const assets = [...new Set(code.match(/\.\/public\/assets\/[\w/.-]+\.(?:svg|png|jpg|wav|mp3|mp4)/g) || [])];
for (const asset of assets) {
  const ext = path.extname(asset);
  const mime = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4' }[ext];
  const bytes = await readFile(path.join(root, asset));
  code = code.replaceAll(asset, `data:${mime};base64,${bytes.toString('base64')}`);
}
let html = await readFile(path.join(root, 'index.html'), 'utf8');
for (const stylesheet of ['styles.css', 'chat.css', 'presentation.css', 'player.css']) {
  const css = await readFile(path.join(root, stylesheet), 'utf8');
  html = html.replace(`<link rel="stylesheet" href="./${stylesheet}">`, `<style>${css.replaceAll('</style', '<\\/style')}</style>`);
}
html = html.replace('<script type="module" src="./src/app.js"></script>', '')
  .replace('</body>', `<script type="module">\n${code.replaceAll('</script', '<\\/script')}\n</script>\n</body>`);
await mkdir(path.join(root, 'dist'), { recursive: true });
const output = path.join(root, 'dist', '딸깍.html');
await writeFile(output, html);
console.log(`Built dist/딸깍.html (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB). Open directly in a browser; no server or network required.`);
