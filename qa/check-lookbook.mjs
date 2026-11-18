import { chromium } from 'playwright';
const browser=await chromium.launch({executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle'});
await page.locator('#lookbook').scrollIntoViewIfNeeded();
await page.waitForTimeout(1200);
console.log(await page.locator('.lookbook__card').first().evaluate(el=>({rect:el.getBoundingClientRect().toJSON(), style:getComputedStyle(el).clipPath, opacity:getComputedStyle(el).opacity, transform:getComputedStyle(el).transform})));
await browser.close();
