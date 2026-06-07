import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 2 })).newPage();
await p.goto('file:///home/user/bonzinilabs/shots/crop.html', { waitUntil: 'load' });
await p.waitForTimeout(500);
const crops = {
  'ref-q1': { x: 250, y: 0, width: 560, height: 640 },   // Latest Recipient / Latest Transaction list card
  'ref-q2': { x: 560, y: 360, width: 560, height: 700 }, // Send Money + Recent Contact rows
  'ref-q3': { x: 820, y: 360, width: 560, height: 760 }, // balance $983 + transfer
  'ref-q4': { x: 1120, y: 0, width: 480, height: 760 },  // Transfer / Select Card / Send Now dark pill
};
for (const [name, clip] of Object.entries(crops)) {
  await p.screenshot({ path: `shots/${name}.png`, clip });
  console.log('OK ' + name);
}
await b.close();
