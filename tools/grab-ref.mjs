import { chromium, devices } from '@playwright/test';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1600 }, userAgent: devices['Desktop Chrome'].userAgent, ignoreHTTPSErrors: true });
const page = await ctx.newPage();
try {
  await page.goto('https://dribbble.com/shots/21114606-Banking-App-UI', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(4000);
  console.log('TITLE=' + (await page.title()));
  const og = await page.evaluate(() => document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '');
  console.log('OG=' + og);
  const imgs = await page.evaluate(() =>
    Array.from(document.querySelectorAll('img')).map((i) => i.currentSrc || i.src).filter((s) => s && s.includes('dribbble')).slice(0, 8));
  console.log('IMGS=' + JSON.stringify(imgs));
  await page.screenshot({ path: 'shots/dribbble-page.png', fullPage: false });
  console.log('shot saved');
} catch (e) { console.log('ERR ' + e.message); }
await browser.close();
