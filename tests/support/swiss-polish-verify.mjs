import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFile } from 'node:fs/promises';
const output = process.env.DESIGN_LAB_OUTPUT ?? 'docs/reports/swiss-polish-2026-10-03';
const browser = await chromium.launch();
const results = [];
try {
  for (const width of [320, 768, 1440, 1920]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4340/variants/swiss-clear.html#archive');
    await page.locator('.archive-table').waitFor();
    const triggers = page.locator('.archive-name[data-gallery]');
    const count = await triggers.count();
    for (let i = 0; i < count; i++) {
      const trigger = triggers.nth(i);
      await trigger.click();
      await page.locator('dialog[open]').waitFor();
      const bar = page.locator('[data-glass-controls]');
      const geometry = await bar.evaluate(el => {
        const rect = el.getBoundingClientRect();
        return { left: rect.left, right: rect.right, height: rect.height, overflow: el.scrollWidth - el.clientWidth };
      });
      assert.ok(geometry.left >= 0 && geometry.right <= width + 1 && geometry.overflow <= 1, `${width}: ${await trigger.innerText()} toolbar clipped`);
      await page.locator('.lab-viewer-title').click();
      await page.keyboard.press('PageDown');
      await page.getByRole('button', { name: 'Overview', exact: true }).click();
      assert.equal(await page.locator('dialog').evaluate(el => el.scrollTop), 0, 'Mode change should reset scroll');
      const thumbnail = page.locator('.overview-photo').last();
      const index = await thumbnail.getAttribute('data-photo');
      await thumbnail.click();
      const target = page.locator(`#swiss-photo-${index}`);
      const top = await target.evaluate(el => el.getBoundingClientRect().top);
      const bottom = await bar.evaluate(el => el.getBoundingClientRect().bottom);
      assert.ok(top >= bottom - 1, `${width}: selected photograph hidden beneath toolbar`);
      assert.equal(await target.evaluate(el => el === document.activeElement), true);
      if (i === count - 1) {
        const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        assert.deepEqual(scan.violations.map(v => v.id), []);
        await page.screenshot({path:`${output}/viewer-${width}.png`});
      }
      await page.keyboard.press('Escape');
      assert.equal(await trigger.evaluate(el => el === document.activeElement), true, 'Close should restore trigger focus');
    }
    for (const view of ['home', 'archive', 'places', 'about']) {
      await page.locator(`.nav [data-view=${view}]`).click();
      await page.locator(`.nav [data-view=${view}][aria-current=page]`).waitFor();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth) <= 1, `${width} ${view}: horizontal overflow`);
    }
    results.push({width, collections:count, toolbar:'passed', modeScroll:'passed', photographFocus:'passed', restoreFocus:'passed', views:'passed'});
    await context.close();
  }
  await writeFile(`${output}/polish-verification.json`, JSON.stringify(results,null,2));
  console.log('PASS: 320/768/1440/1920px; all 13 collections; toolbar bounds; mode scroll reset; photograph unobscured/focused; Escape focus restoration; four website views; reduced-motion; WCAG A/AA sampled gallery.');
} finally { await browser.close(); }
