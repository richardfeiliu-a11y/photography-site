import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const base = process.env.DESIGN_LAB_URL ?? 'http://127.0.0.1:4340';
const output = process.env.DESIGN_LAB_OUTPUT ?? 'docs/reports/swiss-glass-2026-10-03';
const slugs = process.env.DESIGN_LAB_SLUGS?.split(',') ?? ['swiss-controls', 'swiss-floating'];
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
let complete = false;
async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    const images = [...document.querySelectorAll('img')].filter(img => img.complete && img.naturalWidth > 0);
    await Promise.all(images.map(img => img.decode()));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}
async function accessible(page, label) {
  const report = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  assert.deepEqual(report.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })), [], label);
}
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    await page.goto(`${base}/variants/swiss.html`);
    await page.locator('[data-gallery]').first().waitFor();
    await page.waitForFunction(() => document.querySelector('img')?.naturalWidth > 0);
    await settle(page);
    const original = PNG.sync.read(await page.screenshot());
    for (const slug of slugs) {
      console.log(`Glass-specific checks: ${slug} at ${width}px`);
      await page.goto(`${base}/variants/${slug}.html`);
      await page.locator('[data-gallery]').first().waitFor();
      await page.waitForFunction(() => document.querySelector('img')?.naturalWidth > 0);
      await settle(page);
      const current = PNG.sync.read(await page.screenshot({ path: `${output}/${slug}-initial-${width}.png` }));
      const pixels = pixelmatch(original.data, current.data, undefined, width, 900, { threshold: 0.1 });
      if (slug === 'swiss-clear') assert.ok(pixels > 0, 'Natural photo layout must differ from the framed baseline');
      else assert.equal(pixels, 0, `${slug} ${width}: changed Swiss initial layout`);
      await page.locator('[data-gallery]').first().click();
      await page.locator('dialog[open]').waitFor();
      const glass = page.locator('[data-glass-controls]:visible').first();
      await glass.waitFor();
      const material = await glass.evaluate(el => {
        const style = window.getComputedStyle(el);
        return { filter: style.backdropFilter, background: style.backgroundColor, radius: style.borderRadius };
      });
      assert.ok(material.filter.includes('blur'), `${slug}: glass blur absent`);
      if (slug === 'swiss-clear') {
        const alpha = Number(material.background.match(/,\s*([\d.]+)\)$/)?.[1]);
        assert.ok(alpha >= 0.3 && alpha <= 0.55, `Clear glass alpha ${alpha}`);
        const highlight = await glass.evaluate(el => window.getComputedStyle(el).boxShadow);
        assert.ok(highlight.includes('inset'), 'Clear glass edge highlight absent');
      }
      await page.locator('.lab-viewer-title').click();
      await page.keyboard.press('PageDown');
      await page.waitForFunction(() => document.querySelector('dialog').scrollTop > 0);
      await settle(page);
      await page.screenshot({ path: `${output}/${slug}-controls-${width}.png` });
      await accessible(page, `${slug} ${width}: scrolled gallery`);
      const overflow = await page.locator('dialog').evaluate(el => el.scrollWidth - el.clientWidth);
      assert.ok(overflow <= 1, `${slug}: gallery overflow ${overflow}`);
      await page.keyboard.press('Escape');
      await page.locator('dialog').waitFor({ state: 'hidden' });
      if (slug === 'swiss-floating') {
        const nav = page.locator('[data-glass-nav]');
        assert.equal(await nav.isVisible(), false, 'Floating nav visible at top');
        await page.evaluate(() => window.scrollTo(0, 700));
        await nav.waitFor({ state: 'visible' });
        await page.waitForFunction(() => window.getComputedStyle(document.querySelector('[data-glass-nav]')).opacity === '1');
        await settle(page);
        await page.screenshot({ path: `${output}/${slug}-navigation-${width}.png` });
        await accessible(page, `${slug} ${width}: floating nav`);
        const bounds = await nav.boundingBox();
        assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1, 'Floating nav outside viewport');
        await nav.locator('[data-view=places]').click();
        await page.getByRole('heading', { name: /^Places/ }).waitFor();
        await nav.waitFor({ state: 'hidden' });
        await page.locator('.masthead .nav [data-view=home]').click();
        await page.waitForFunction(() => window.location.hash === '#home');
        await page.locator('[data-gallery]').first().waitFor();
        await settle(page);
        await page.evaluate(() => window.scrollTo(0, 700));
        await nav.waitFor({ state: 'visible' });
        await page.locator('[data-gallery]').first().click();
        await page.locator('dialog[open]').waitFor();
        assert.equal(await nav.isVisible(), false, 'Floating site nav visible while modal open');
        await page.keyboard.press('Escape');
        await page.evaluate(() => window.scrollTo(0, 0));
        await nav.waitFor({ state: 'hidden' });
      } else {
        assert.equal(await page.locator('[data-glass-nav]').count(), 0);
      }
      results.push({ slug, width, initialChangedPixels: pixels, material, controls: 'passed', navigation: slug === 'swiss-floating' ? 'passed' : 'unchanged' });
    }
    await context.close();
  }
  complete = true;
  console.log('PASS: expected initial layout; glass controls; floating navigation where present; 1440/390px; WCAG A/AA.');
} finally {
  await writeFile(`${output}/glass-verification.json`, JSON.stringify({ status: complete ? 'passed' : 'failed', results }, null, 2));
  await browser.close();
}
