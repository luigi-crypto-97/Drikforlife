// Build senza dipendenze: produce docs/ (pubblicabile con GitHub Pages) con
// index.html autosufficiente (JS, CSS, font e grafica inclusi), service worker,
// manifest e icone. Uso: node tools/build.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const OUT = join(ROOT, 'docs');

// ---------- bundler minimale per i moduli ES del progetto ----------
const IMPORT_RE = /^import\s*\{([^}]*)\}\s*from\s*'(\.\/[^']+)';[ \t]*$/gm;
const EXPORT_RE = /^export\s+(?:async\s+)?(?:function\*?|const|class)\s+([A-Za-z0-9_$]+)/gm;

function bundle(entry) {
  const order = [];
  const seen = new Map(); // path -> {name, deps}
  const visiting = new Set();
  const visit = (file) => {
    if (seen.has(file)) return;
    if (visiting.has(file)) throw new Error('import circolare: ' + file);
    visiting.add(file);
    const code = readFileSync(file, 'utf8');
    const nImports = (code.match(/^\s*import\b/gm) || []).length;
    if (nImports !== [...code.matchAll(IMPORT_RE)].length) throw new Error('forma di import non supportata in ' + file);
    if (/^\s*export\s+(default|\{|\*|let|var)/m.test(code)) throw new Error('forma di export non supportata in ' + file);
    const deps = [];
    for (const m of code.matchAll(IMPORT_RE)) {
      const dep = resolve(dirname(file), m[2]);
      deps.push({ names: m[1].split(',').map((s) => s.trim()).filter(Boolean), file: dep });
      visit(dep);
    }
    const exports = [...code.matchAll(EXPORT_RE)].map((m) => m[1]);
    visiting.delete(file);
    const name = '__m_' + relative(SRC, file).replace(/[^A-Za-z0-9]/g, '_');
    seen.set(file, { name, deps, exports, code });
    order.push(file);
  };
  visit(entry);
  let out = '';
  for (const file of order) {
    const m = seen.get(file);
    let body = m.code.replace(IMPORT_RE, '').replace(/^export\s+/gm, '');
    const imports = m.deps.map((d) => {
      const dep = seen.get(d.file);
      for (const n of d.names) if (!dep.exports.includes(n)) throw new Error(n + ' non esportato da ' + d.file);
      return 'const { ' + d.names.join(', ') + ' } = ' + dep.name + ';';
    }).join('\n');
    out += '// ---- ' + relative(SRC, file) + '\nconst ' + m.name + ' = (function () {\n\'use strict\';\n' + imports + '\n' + body +
      '\nreturn { ' + m.exports.join(', ') + ' };\n})();\n';
  }
  return out;
}

// ---------- CSS con font incorporati ----------
function inlineCss() {
  const css = readFileSync(join(SRC, 'css', 'style.css'), 'utf8');
  return css.replace(/url\('\.\.\/fonts\/([^']+\.woff2)'\)/g, (_, f) => {
    const b64 = readFileSync(join(SRC, 'fonts', f)).toString('base64');
    return "url('data:font/woff2;base64," + b64 + "')";
  });
}

// ---------- icone (render dello stemma con Chromium, se disponibile) ----------
async function buildIcons() {
  const { iconSvg } = await import(join(SRC, 'js', 'symbols.js'));
  const svg = iconSvg();
  writeFileSync(join(OUT, 'icon.svg'), svg);
  let chromium = null;
  for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright/index.js']) {
    try { chromium = (await import(p)).chromium || (await import(p)).default.chromium; break; } catch (e) { /* prova il prossimo */ }
  }
  if (!chromium) {
    console.warn('Playwright non disponibile: icone PNG non rigenerate.');
    return;
  }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
  await page.setContent('<html><body style="margin:0;background:transparent">' + svg.replace('<svg ', '<svg width="512" height="512" ') + '</body></html>');
  await page.waitForTimeout(200);
  for (const size of [512, 192, 180]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent('<html><body style="margin:0;background:#12030a">' + svg.replace('<svg ', '<svg width="' + size + '" height="' + size + '" ') + '</body></html>');
    await page.waitForTimeout(150);
    await page.screenshot({ path: join(OUT, 'icon-' + size + '.png'), omitBackground: false });
  }
  await browser.close();
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const js = bundle(join(SRC, 'js', 'main.js'));
  const css = inlineCss();
  let html = readFileSync(join(SRC, 'index.html'), 'utf8');
  const linkTag = '<link rel="stylesheet" href="css/style.css">';
  const scriptTag = '<script type="module" src="js/main.js"></script>';
  if (!html.includes(linkTag) || !html.includes(scriptTag)) throw new Error('index.html: tag css/js non trovati');
  html = html.replace(linkTag, () => '<style>\n' + css + '\n</style>');
  html = html.replace(scriptTag, () => '<script>\n' + js.replace(/<\/script/gi, '<\\/script') + '\n</script>');
  writeFileSync(join(OUT, 'index.html'), html);

  const version = createHash('sha256').update(html).digest('hex').slice(0, 12);
  writeFileSync(join(OUT, 'manifest.webmanifest'), JSON.stringify({
    name: 'Il Grimorio del Mixologist',
    short_name: 'Grimorio',
    description: 'Slot a premi in consumazioni: 10 giri gratis per ogni drink.',
    lang: 'it',
    start_url: './',
    scope: './',
    display: 'fullscreen',
    orientation: 'any',
    background_color: '#12030a',
    theme_color: '#12030a',
    icons: [
      { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }, null, 2));
  writeFileSync(join(OUT, 'sw.js'), `// Service worker: funzionamento offline dopo il primo caricamento.
const CACHE = 'grimorio-${version}';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-180.png'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request)));
});
`);
  writeFileSync(join(OUT, '.nojekyll'), '');
  await buildIcons();
  const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
  console.log('docs/index.html ' + kb + ' KB · versione ' + version + (existsSync(join(OUT, 'icon-512.png')) ? ' · icone ok' : ''));
}

main().catch((e) => { console.error(e); process.exit(1); });
