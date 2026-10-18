// Shared test-side wait: one-shot entrance reveals (R3 §5) must be at their
// final transform/opacity before any GEOMETRY assertion — a mid-flight
// translateY(8-16px) shifts getBoundingClientRect and would read as rhythm
// drift. Reuses the same settled contract as tests/support/axe.ts.
export async function waitRevealsSettled(page, timeout = 10000) {
  await page.evaluate(async () => {
    const step = Math.max(200, Math.floor(window.innerHeight * 0.75));
    for (let y = 0; y <= document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 40));
    }
    window.scrollTo(0, 0);
  });
  // Two consecutive stable reads 120ms apart: opacity can reach 1 while the
  // transform transition still has its last frames under CPU load.
  const readSettled = () =>
    page.evaluate(() => {
      const els = Array.from(document.querySelectorAll("[data-reveal]"));
      return els.every((el) => {
        const s = window.getComputedStyle(el);
        return (
          parseFloat(s.opacity) === 1 &&
          (s.transform === "none" || s.transform === "matrix(1, 0, 0, 1, 0, 0)")
        );
      });
    });
  const deadline = Date.now() + timeout;
  let stable = false;
  while (Date.now() < deadline) {
    if ((await readSettled()) && (await new Promise((r) => setTimeout(r, 120)).then(readSettled))) {
      stable = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!stable) {
    throw new Error("reveals never settled (opacity/transform) within timeout");
  }
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      }),
  );
  await page.waitForTimeout(300);
}
