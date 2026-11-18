import { chromium } from 'playwright';
const browser=await chromium.launch({executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle'}); await page.waitForTimeout(1200);
await page.locator('#lookbook').scrollIntoViewIfNeeded(); await page.waitForTimeout(1200);
console.log(await page.locator('#lookbook').evaluate(el=>({rect:el.getBoundingClientRect().toJSON(), height:el.getBoundingClientRect().height, cards:[...el.querySelectorAll('.lookbook__card')].map(c=>({r:c.getBoundingClientRect().toJSON(),clip:getComputedStyle(c).clipPath,display:getComputedStyle(c).display,vis:getComputedStyle(c).visibility}))})));
await browser.close();
