import { chromium } from 'playwright'
const browser = await chromium.launch({headless:true, executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'})
for (const v of [{width:1440,height:900,name:'desk'},{width:390,height:844,name:'mobile'}]) {
 const page=await browser.newPage({viewport:{width:v.width,height:v.height}})
 const errors=[]; page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle'}); await page.waitForTimeout(1200); await page.screenshot({path:`_qa/v2-${v.name}.png`,fullPage:false});
 console.log(v.name, await page.title(), errors)
 await page.close()
}
await browser.close()
