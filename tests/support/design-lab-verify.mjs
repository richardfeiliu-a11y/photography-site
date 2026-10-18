import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const base = process.env.DESIGN_LAB_URL ?? 'http://127.0.0.1:4340';
const output = process.env.DESIGN_LAB_OUTPUT ?? 'docs/reports/design-lab-2026-10-03';
const harness = process.env.DESIGN_LAB_HARNESS ?? base;
const allSlugs = process.env.DESIGN_LAB_PICKER_SLUGS?.split(',') ?? ['cinema', 'swiss', 'photobook', 'fieldnotes', 'museum', 'lighttable'];
const slugs = process.env.DESIGN_LAB_SLUGS?.split(',') ?? allSlugs;
await mkdir(output, { recursive: true });
const data = await fetch(`${base}/data.json`).then(r => r.json());
assert.equal(data.galleries.length, 6);
assert.ok(data.archive.length >= 6);
const media = new Set(data.archive.flatMap(g => g.photos.flatMap(p => [p.src, p.thumb])));
for (const url of media) {
  const response = await fetch(`${base}${url}`, { method: 'HEAD' });
  assert.equal(response.status, 200, url);
}
const browser = await chromium.launch();
const results = [];
let harnessStatus = 'not-run';
let complete = false;
async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.querySelectorAll('img')].filter(img => { const r = img.getBoundingClientRect(); return img.complete && img.naturalWidth > 0 && r.top < window.innerHeight && r.bottom > 0; }).map(img => img.decode()));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}
async function audit(page, view) {
  const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  return scan.violations.map(v => ({ view, id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, failureSummary: n.failureSummary })) }));
}
try {
  for (const slug of slugs) {
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      console.log(`Checking ${slug} at ${width}px`);
      const errors = [];
      const violations = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      await page.goto(`${base}/variants/${slug}.html`);
      await page.locator('[data-gallery]:visible').first().waitFor();
      await page.locator('img:visible').first().waitFor();
      await page.waitForFunction(() => [...document.querySelectorAll('img')].find(img => img.getClientRects().length > 0)?.naturalWidth > 0);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(overflow <= 1, `${slug} ${width} home overflow: ${overflow}`);
      await settle(page);
      await page.screenshot({ path: `${output}/${slug}-${width}.png` });
      violations.push(...await audit(page, 'home'));
      await page.locator('[data-gallery]:visible').first().click();
      await page.locator('dialog[open]').waitFor();
      assert.ok(await page.locator('dialog img').count() > 0, `${slug}: gallery empty`);
      const ids = await page.locator('dialog .lab-viewer-sequence img').evaluateAll(images => images.map(img => img.getAttribute('src')));
      const selectedTitle = await page.locator('.lab-viewer-title').innerText();
      const gallery = data.archive.find(g => g.title === selectedTitle);
      assert.ok(gallery, `${slug}: unknown gallery title`);
      assert.deepEqual(ids, gallery.photos.map(p => p.src), `${slug}: authored sequence changed`);
      await page.waitForFunction(() => document.querySelector('dialog .lab-viewer-sequence img')?.naturalWidth > 0);
      await settle(page);
      await page.screenshot({ path: `${output}/${slug}-gallery-${width}.png` });
      violations.push(...await audit(page, 'gallery'));
      const nextPhoto = page.getByRole('button', { name: 'Next photograph', exact: true });
      if (await nextPhoto.count()) {
        await nextPhoto.click();
        await page.locator(`.lab-viewer-sequence figure[data-photo-id="${gallery.photos[1].id}"]:visible`).waitFor();
        await page.getByRole('button', { name: 'Previous photograph', exact: true }).click();
        await page.locator(`.lab-viewer-sequence figure[data-photo-id="${gallery.photos[0].id}"]:visible`).waitFor();
      }
      const overview = page.getByRole('button', { name: 'Overview', exact: true });
      if (await overview.count()) {
        await overview.click();
        const sequenceButton = page.getByRole('button', { name: 'Sequence', exact: true }).or(page.getByRole('button', { name: 'Exhibition wall', exact: true }));
        await sequenceButton.click();
        assert.deepEqual(await page.locator('dialog .lab-viewer-sequence figure[data-photo-id]').evaluateAll(figures => figures.map(f => f.dataset.photoId)), gallery.photos.map(p => p.id));
      }
      await page.keyboard.press('Escape');
      await page.locator('dialog').waitFor({ state: 'hidden' });
      for (const view of ['archive', 'places', 'about', 'home']) {
        await page.locator(`[data-view="${view}"]`).first().click();
        await page.locator(`nav [data-view="${view}"][aria-current="page"]`).first().waitFor();
        await page.locator('h1:visible').first().waitFor();
        const horizontal = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        assert.ok(horizontal <= 1, `${slug} ${width} ${view} overflow: ${horizontal}`);
        const h1 = await page.locator('h1:visible').first().innerText();
        assert.ok(h1.trim(), `${slug}: ${view} heading missing`);
        violations.push(...await audit(page, view));
        if (view === 'places') {
          const places = page.locator('[data-place]:visible');
          if (await places.count() > 1) {
            const placeId = await places.nth(1).getAttribute('data-place');
            await places.nth(1).click();
            await page.locator(`[data-place="${placeId}"][aria-pressed=true]`).waitFor();
            await page.waitForFunction(() => [...document.querySelectorAll('[data-gallery]')].filter(el => el.getClientRects().length > 0).length > 0);
            assert.ok(await page.locator('[data-gallery]:visible').count() > 0, `${slug}: place has no collections`);
            const placeGalleries = await page.locator('[data-gallery]:visible').evaluateAll(elements => [...new Set(elements.map(el => el.dataset.gallery))]);
            assert.ok(placeGalleries.every(id => data.archive.find(g => g.id === id)?.places.some(p => p.id === placeId)), `${slug}: place attribution mismatch`);
          }
        }
        if (view === 'archive') {
          assert.equal(await page.locator('[data-gallery]:visible').evaluateAll(elements => new Set(elements.map(el => el.dataset.gallery)).size), data.archive.length, `${slug}: incomplete archive`);
          await settle(page);
          await page.screenshot({ path: `${output}/${slug}-archive-${width}.png` });
          const yearSelect = page.locator('main select:visible');
          const yearButtons = page.locator('[data-year]:not([data-year=all])');
          if (await yearSelect.count()) {
            await yearSelect.first().selectOption({ index: 1 });
            await page.waitForFunction(count => new Set([...document.querySelectorAll('[data-gallery]')].filter(el => el.getClientRects().length > 0).map(el => el.dataset.gallery)).size < count, data.archive.length);
          } else if (await yearButtons.count()) {
            await yearButtons.first().click();
            await page.waitForFunction(count => new Set([...document.querySelectorAll('[data-gallery]')].filter(el => el.getClientRects().length > 0).map(el => el.dataset.gallery)).size < count, data.archive.length);
          }
        }
      }
      results.push({ slug, width, consoleErrors: errors, accessibility: violations });
      assert.deepEqual(errors, [], `${slug} ${width}: browser errors`);
      await context.close();
    }
  }
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(harness);
  for (let i = 0; i < slugs.length; i++) {
    await page.locator('.proto-picker-item:not(.proto-picker-replay)').nth(allSlugs.indexOf(slugs[i])).click();
    await page.frameLocator('iframe').locator('[data-gallery]:visible').first().waitFor();
    assert.match(page.url(), new RegExp(`v=${allSlugs.indexOf(slugs[i]) + 1}`));
    assert.equal(await page.locator('[aria-current="true"]').count(), 1);
  }
  await page.getByLabel('比较页面', { exact: true }).selectOption('archive');
  await page.frameLocator('iframe').locator('nav [data-view=archive][aria-current=page]').first().waitFor();
  await page.locator('.proto-picker-item:not(.proto-picker-replay)').nth(0).click();
  await page.frameLocator('iframe').locator('nav [data-view=archive][aria-current=page]').first().waitFor();
  await page.getByLabel('比较页面', { exact: true }).selectOption('home');
  await page.getByRole('button', { name: '手机宽度' }).click();
  assert.equal(await page.locator('iframe').evaluate(el => el.clientWidth), 390);
  await page.getByRole('button', { name: '评分 / 备注' }).click();
  await page.getByLabel('布局评分', { exact: true }).fill('5');
  await page.locator('#notes').fill('Verification: prefer this layout');
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: '评分 / 备注' }).click();
  assert.equal(await page.getByLabel('布局评分', { exact: true }).inputValue(), '5');
  assert.equal(await page.locator('#notes').inputValue(), 'Verification: prefer this layout');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出比较记录' }).click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), harness.endsWith('/swiss.html') ? 'photography-swiss-glass-comparison.json' : 'photography-design-comparison.json');
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.screenshot({ path: `${output}/comparison.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  const pickerOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(pickerOverflow <= 1, `Picker overflow: ${pickerOverflow}`);
  await page.close();
  harnessStatus = 'passed';
  const allViolations = results.flatMap(r => r.accessibility.map(v => `${r.slug}/${r.width}: ${v.id}`));
  assert.deepEqual(allViolations, [], `Accessibility failures: ${allViolations.join(', ')}`);
  complete = true;
  console.log(`PASS: ${slugs.length} directions × 2 widths; 5 views; authored photo order; ${media.size} media assets; console; WCAG A/AA; picker; ratings persistence; export.`);
} finally {
  await writeFile(`${output}/verification.json`, JSON.stringify({ status: complete ? 'passed' : 'failed', mediaChecked: media.size, results, harness: harnessStatus }, null, 2));
  await browser.close();
}
