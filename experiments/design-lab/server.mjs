import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as yaml from 'js-yaml';
import sharp from 'sharp';

// Light Field variant: build-time ambient color per gallery.
// Mean color of the cover derivative -> OKLCH -> clamped so the field never
// threatens text contrast or photo color judgment (see
// docs/proposals/2026-10-04-independent/proposal-light-field/PROPOSAL.md).
function srgbToOklch(r8, g8, b8) {
  const f = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const r = f(r8), g = f(g8), b = f(b8);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const b2 = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  let h = Math.atan2(b2, a) * 180 / Math.PI;
  if (h < 0) h += 360;
  return { L, C: Math.hypot(a, b2), H: h };
}
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round3 = v => Math.round(v * 1000) / 1000;
async function ambientFor(cover) {
  try {
    const file = resolve(root, 'generated', '.' + cover.thumb);
    const stats = await sharp(file).resize(24, 24, { fit: 'cover' }).stats();
    const [r, g, b] = stats.channels.map(c => c.mean);
    const { L, C, H } = srgbToOklch(r, g, b);
    return {
      dark: { l: round3(clamp(L * 0.3, 0.105, 0.175)), c: round3(Math.min(C * 0.5, 0.04)), h: round3(H) },
      light: { l: 0.945, c: round3(Math.min(C * 0.7, 0.03)), h: round3(H) },
    };
  } catch {
    return { dark: { l: 0.135, c: 0.01, h: 265 }, light: { l: 0.945, c: 0.008, h: 265 } };
  }
}

const lab = dirname(fileURLToPath(import.meta.url));
const root = resolve(lab, '../..');
const manifest = JSON.parse(await readFile(resolve(root, 'generated/asset-manifest.json'), 'utf8')).manifest.records;
const home = yaml.load(await readFile(resolve(root, 'content/site/home.yaml'), 'utf8'));
const folders = await readdir(resolve(root, 'content/galleries'));
const galleries = [];
const placeFolders = await readdir(resolve(root, 'content/places'));
const placeNames = new Map();
for (const folder of placeFolders) {
  const place = yaml.load(await readFile(resolve(root, 'content/places', folder), 'utf8'));
  placeNames.set(place.id, { title: place.title ?? place.name, country: place.country ?? '', region: place.region ?? '' });
}
for (const folder of folders) {
  const gallery = yaml.load(await readFile(resolve(root, 'content/galleries', folder, 'meta.yaml'), 'utf8'));
  if (gallery.status !== 'published') continue;
  const photos = gallery.photos.map(photo => {
    const records = manifest.filter(r => r.photo_id === photo.id && r.format === 'avif' && r.purpose === 'gallery_display');
    records.sort((a, b) => a.width - b.width);
    const display = records.find(r => r.width >= 1600) ?? records.at(-1);
    const thumb = records.find(r => r.width >= 480);
    if (!display) throw new Error(`Missing derived image: ${photo.id}`);
    return { id: photo.id, src: display.public_url, thumb: thumb.public_url, srcset: records.map(r => `${r.public_url} ${r.width}w`).join(', '), width: display.width, height: display.height, alt: photo.alt_text, caption: photo.caption ?? gallery.title, rhythm: photo.rhythm_after ?? 'base' };
  });
  const cover = photos.find(p => p.id === gallery.cover_photo_id);
  galleries.push({ id: gallery.id, slug: gallery.slug, title: gallery.title, description: gallery.description, date: gallery.photographed_start, published: gallery.published_at, next: gallery.next_gallery_id ?? null, places: gallery.places.map(id => ({ id, ...(placeNames.get(id) ?? { title: id, country: '', region: '' }) })), count: photos.length, cover, ambient: await ambientFor(cover), photos });
}
galleries.sort((a, b) => a.id === home.featured_gallery_id ? -1 : b.id === home.featured_gallery_id ? 1 : b.published.localeCompare(a.published) || a.id.localeCompare(b.id));
const selected = galleries.slice(0, 6);
let about = null;
try {
  about = yaml.load(await readFile(resolve(root, 'content/site/about.yaml'), 'utf8')) ?? null;
} catch { about = null; }
const data = JSON.stringify({ author: 'Richard', about, galleries: selected, archive: galleries });
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.avif': 'image/avif', '.woff2': 'font/woff2', '.json': 'application/json; charset=utf-8' };
const port = Number(process.env.DESIGN_LAB_PORT ?? 4340);
createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, `http://127.0.0.1:${port}`).pathname);
    if (pathname === '/data.json') { res.writeHead(200, { 'Content-Type': mime['.json'] }); res.end(data); return; }
    const base = pathname.startsWith('/media/') ? resolve(root, 'generated') : pathname.startsWith('/fonts/') ? resolve(root, 'public') : lab;
    const file = resolve(base, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!file.startsWith(base + sep)) { res.writeHead(403); res.end(); return; }
    const body = await readFile(file);
    const extension = file.slice(file.lastIndexOf('.'));
    res.writeHead(200, { 'Content-Type': mime[extension] ?? 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Design Lab: http://127.0.0.1:${port}/ — ${selected.length} galleries; existing derivatives only`));
