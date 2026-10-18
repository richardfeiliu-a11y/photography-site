// Preview-artifact e2e runner for draft-route regressions (P6-IMP-01).
//
// Mirrors tests/capture/capture.mjs preview-group assembly: explicit fresh
// preview build (draft routes + isolated preview media), isolated assembly
// under .serve-artifacts/e2e-preview (never dist/), static serving on the
// pinned preview-e2e port, then the preview playwright config against it.
// Exit status is the Playwright status. Usage: npm run test:e2e:preview.
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  runBuild,
  assembleArtifact,
  createStaticServer,
  waitForServer,
  previewMediaDir,
} from './artifact.mjs';

// R3 corpus fact: the real archive is published-only. The draft-media store
// (generated/preview-media) only made sense for the retired fixture draft;
// deriving it for a corpus with no draft galleries fails and serves nothing.
// Draft routes return automatically when a draft gallery reappears.
function corpusHasDraftGalleries() {
  const root = join(process.cwd(), 'content', 'galleries');
  if (!existsSync(root)) return false;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const meta = join(root, entry.name, 'meta.yaml');
    if (existsSync(meta) && /^status:\s*draft\s*$/m.test(readFileSync(meta, 'utf8'))) {
      return true;
    }
  }
  return false;
}
const hasDrafts = corpusHasDraftGalleries();

const port = Number(process.env.E2E_PREVIEW_PORT ?? 4182);
const base = 'http://127.0.0.1:' + port;

console.log('[preview-e2e] explicit fresh preview build (stale dist/ never reused)');
const sourceDir = runBuild('preview');
const artifact = hasDrafts
  ? assembleArtifact(sourceDir, 'e2e-preview', { extraMediaDirs: [previewMediaDir()] })
  : assembleArtifact(sourceDir, 'e2e-preview');
const server = createStaticServer(artifact);
await new Promise((ready) => server.listen(port, '127.0.0.1', ready));
console.log('[preview-e2e] serving ' + artifact + ' at ' + base + '/');
let status = 1;
try {
  await waitForServer(base + '/');
  // Async spawn (never spawnSync): the static server lives in THIS process,
  // so the event loop must stay free to answer requests while tests run.
  // A blocking spawnSync starves the server and every navigation times out.
  // tests/e2e-preview/immersive-long-gallery.spec.ts keeps this lane real:
  // the preview build + isolated assembly must serve a 28-photo gallery at
  // the immersive plate measure. An empty suite is a failure, not a pass.
  const child = spawn(
    'npx',
    ['playwright', 'test', '-c', 'playwright.preview.config.ts'],
    {
      stdio: 'inherit',
      env: { ...process.env, E2E_PREVIEW_PORT: String(port), E2E_PREVIEW_BASE: base },
    },
  );
  status = (await new Promise((resolve) => child.on('exit', resolve))) ?? 1;
} finally {
  await new Promise((done) => server.close(done));
}
process.exit(status);
