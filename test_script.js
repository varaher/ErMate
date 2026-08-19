const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));

  await page.goto('http://localhost:3000');
  
  // Wait for the app to load
  await page.waitForTimeout(3000);
  
  // Check if we need to log in or mock auth (the app uses Firebase auth)
  // If we can't log in, maybe we can mock the auth context?
  // Let's just see what happens first.
  
  await browser.close();
})();
