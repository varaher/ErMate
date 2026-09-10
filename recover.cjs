const fs = require('fs');
const map = JSON.parse(fs.readFileSync('dist/server.cjs.map', 'utf8'));
map.sources.forEach((source, index) => {
  if (source.includes('/server/')) {
    const content = map.sourcesContent[index];
    const path = source.replace(/^(..\/)+/, ''); // strip ../../
    console.log(`Writing ${path}`);
    fs.mkdirSync(path.substring(0, path.lastIndexOf('/')), { recursive: true });
    fs.writeFileSync(path, content);
  }
});
console.log('Recovery complete!');
