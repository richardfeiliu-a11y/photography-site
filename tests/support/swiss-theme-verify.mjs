import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFile } from 'node:fs/promises';
const output = 'docs/reports/swiss-theme-2026-10-03';
const browser = await chromium.launch();
const results = [];
try {
  for (const width of [320, 390, 768, 1440]) {
    const context = await browser.newContext({viewport:{width,height:1000},colorScheme:'dark'});
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4340/variants/swiss-clear.html');
    await page.locator('[data-gallery]').first().waitFor();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark', 'Initial system preference');
    await page.emulateMedia({colorScheme:'light'});
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
    await page.emulateMedia({colorScheme:'dark'});
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
    await page.getByRole('button',{name:'Switch to light theme',exact:true}).click();
    await page.reload();
    await page.locator('[data-gallery]').first().waitFor();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light', 'Manual selection survives reload/system dark');
    for (const theme of ['light','dark']) {
      if (await page.locator('html').getAttribute('data-theme') !== theme) await page.locator('.nav [data-theme-toggle]').click();
      for (const view of ['home','archive','places','about']) {
        await page.locator(`.nav [data-view=${view}]`).click();
        await page.locator(`.nav [data-view=${view}][aria-current=page]`).waitFor();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth) <= 1, `${width} ${theme} ${view}: overflow`);
        if (width === 390 || width === 1440) {
          const scan = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
          assert.deepEqual(scan.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[],`${width} ${theme} ${view}`);
        }
      }
      await page.locator('.nav [data-view=home]').click();
      await page.locator('[data-gallery]').first().click();
      await page.locator('dialog[open]').waitFor();
      const title = await page.locator('.lab-viewer-title').innerText();
      const sources = await page.locator('dialog .lab-viewer-sequence img').evaluateAll(items=>items.map(i=>i.getAttribute('src')));
      await page.locator('.lab-viewer-title').click();
      await page.keyboard.press('PageDown');
      await page.waitForFunction(() => document.querySelector('dialog').scrollTop > 0);
      // 等待键盘翻页动画结束，避免把仍在进行的滚动误判为主题切换引起。
      await page.evaluate(async () => {
        const dialog = document.querySelector('dialog');
        let previous = dialog.scrollTop;
        let stable = 0;
        while (stable < 12) {
          await new Promise(resolve => requestAnimationFrame(resolve));
          stable = dialog.scrollTop === previous ? stable + 1 : 0;
          previous = dialog.scrollTop;
        }
      });
      const bar = page.locator('[data-glass-controls]');
      const rect = await bar.boundingBox();
      assert.ok(rect.x >= 0 && rect.x+rect.width <= width+1);
      for (const button of await bar.locator('button').all()) {
        const b = await button.boundingBox();
        assert.ok(b.x >= rect.x && b.x+b.width <= rect.x+rect.width+1, 'Viewer button clipped');
      }
      if (width === 390 || width === 1440) {
        const scan = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
        assert.deepEqual(scan.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[],`${width} ${theme} gallery`);
        await page.screenshot({path:`${output}/${theme}-gallery-${width}.png`});
      }
      const scrollTop = await page.locator('dialog').evaluate(el=>el.scrollTop);
      await bar.locator('[data-theme-toggle]').click();
      assert.equal(await page.locator('.lab-viewer-title').innerText(),title);
      assert.deepEqual(await page.locator('dialog .lab-viewer-sequence img').evaluateAll(items=>items.map(i=>i.getAttribute('src'))),sources);
      assert.equal(await page.locator('dialog').evaluate(el=>el.scrollTop),scrollTop,'Theme change moves gallery');
      await bar.locator('[data-theme-toggle]').click();
      await page.keyboard.press('Escape');
      results.push({width,theme,system:'passed',persistence:'passed',views:'passed',viewerSwitch:'passed',axe:[390,1440].includes(width)?'passed':'not scanned'});
    }
    await context.close();
  }
  await writeFile(`${output}/theme-verification.json`,JSON.stringify(results,null,2));
  console.log('PASS: 320/390/768/1440px; system theme; persistent manual preference; four views; viewer switch preserves photos and scroll; light/dark WCAG A/AA at 390/1440px.');
} finally { await browser.close(); }
