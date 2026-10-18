import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const output = process.env.DESIGN_LAB_OUTPUT ?? 'docs/reports/swiss-neutral-2026-10-03';
const browser = await chromium.launch();
const results = [];
async function inspect(page, width, view) {
  // 逐张进入视口，触发原有懒加载后再核对实际像素尺寸。
  for (const image of await page.locator('img:visible').all()) await image.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => [...document.querySelectorAll('img')].filter(img => img.getClientRects().length).every(img => img.complete && img.naturalWidth > 0));
  const images = await page.locator('img:visible').evaluateAll(items => items.map(img => {
    const style = window.getComputedStyle(img);
    const rect = img.getBoundingClientRect();
    return { src: img.getAttribute('src'), ratioError: Math.abs(rect.width / rect.height / (img.naturalWidth / img.naturalHeight) - 1), heightError: Math.abs(rect.height - rect.width * img.naturalHeight / img.naturalWidth), background: style.backgroundColor, parentBackground: window.getComputedStyle(img.parentElement).backgroundColor };
  }));
  assert.ok(images.length, `${view}: images missing`);
  for (const img of images) {
    assert.ok(img.heightError <= 1, `${view}: image ratio changed ${JSON.stringify(img)}`);
    assert.equal(img.background, 'rgba(0, 0, 0, 0)', `${view}: image background`);
    assert.equal(img.parentBackground, 'rgba(0, 0, 0, 0)', `${view}: frame background`);
  }
  const styles = await page.locator('button:visible').evaluateAll(items => items.map(el => {
    const s = window.getComputedStyle(el); return [s.color, s.backgroundColor, s.borderColor];
  }).flat());
  assert.ok(!styles.some(value => value.includes('23, 70, 232')), `${view}: cobalt remains`);
  results.push({ width, view, images: images.length, maxRatioError: Math.max(...images.map(img => img.ratioError)) });
}
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto('http://127.0.0.1:4340/variants/swiss-clear.html');
    await page.locator('[data-gallery]').first().waitFor();
    await inspect(page, width, 'home');
    for (const view of ['archive', 'places']) {
      await page.locator(`.nav [data-view=${view}]`).click();
      await page.locator(`.nav [data-view=${view}][aria-current=page]`).waitFor();
      await inspect(page, width, view);
    }
    await page.locator('[data-gallery]:visible').first().click();
    await page.locator('dialog[open]').waitFor();
    await inspect(page, width, 'sequence');
    await page.getByRole('button', { name: 'Overview', exact: true }).click();
    await inspect(page, width, 'overview');
    await page.screenshot({path:`${output}/overview-${width}.png`});
    await page.close();
  }
  await writeFile(`${output}/natural-images.json`, JSON.stringify(results,null,2));
  console.log('PASS: 1440/390px; home/archive/places/sequence/overview; natural image ratios; transparent image/frame backgrounds; no cobalt controls.');
} finally { await browser.close(); }
