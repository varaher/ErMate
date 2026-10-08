import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('--- Verifying Google Sign-In Custom Auth Domain Configuration ---');

// 1. Inspect firebase-applet-config.json
const firebaseAppletConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
assert.strictEqual(firebaseAppletConfig.authDomain, 'ermate.in', 'authDomain in firebase-applet-config.json must be "ermate.in"');
assert.strictEqual(firebaseAppletConfig.projectId, 'ermate-e8f01', 'projectId must remain "ermate-e8f01"');
assert.strictEqual(firebaseAppletConfig.appId, '1:1018674231904:web:a632edc200737ad10b2105', 'appId must remain unchanged');
assert.strictEqual(firebaseAppletConfig.apiKey, 'AIzaSyDVZB5xMBtLsYTRNgvSR0cgV-w3XDLK850', 'apiKey must remain unchanged');
assert.strictEqual(firebaseAppletConfig.firestoreDatabaseId, 'ai-studio-ermate-c85078ba-126c-43fd-b799-a4aa8b82bf03', 'firestoreDatabaseId must remain unchanged');
console.log('✓ Check 1: firebase-applet-config.json authDomain is "ermate.in" and project credentials are preserved.');

// 2. Inspect vite.config.ts for PWA navigateFallbackDenylist
const viteConfigContent = fs.readFileSync('./vite.config.ts', 'utf8');
assert.ok(viteConfigContent.includes('/^\\/__\\//'), 'vite.config.ts workbox navigateFallbackDenylist must exclude /__/.');
console.log('✓ Check 2: vite.config.ts excludes /__/ from PWA navigation fallback.');

// 3. Inspect public/sw.js
const swContent = fs.readFileSync('./public/sw.js', 'utf8');
assert.ok(swContent.includes("url.includes('/__/')"), 'public/sw.js must exclude /__/ from service worker interception.');
console.log('✓ Check 3: public/sw.js excludes /__/ from service worker cache and fetch handler.');

// 4. Inspect server.ts production fallback
const serverContent = fs.readFileSync('./server.ts', 'utf8');
assert.ok(serverContent.includes('req.path.startsWith("/__/")'), 'server.ts production fallback must skip /__/ reserved namespace.');
console.log('✓ Check 4: server.ts production SPA fallback passes through Firebase reserved /__/ namespace.');

// 5. Inspect src/firebase.ts initialization
const firebaseTsContent = fs.readFileSync('./src/firebase.ts', 'utf8');
assert.ok(firebaseTsContent.includes("initializeApp(firebaseConfig)"), 'src/firebase.ts must pass firebaseConfig containing authDomain.');
console.log('✓ Check 5: src/firebase.ts initializes Firebase with the custom authDomain.');

console.log('All 5 custom auth domain checks PASSED!');
