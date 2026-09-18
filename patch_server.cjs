const fs = require('fs');

let content = fs.readFileSync('server.ts', 'utf8');

// Add import
const importStatement = 'import logbookRouter from "./server/routes/logbook.routes.js";\n';
content = content.replace(
  'import extractionRouter from "./server/routes/extraction.routes.ts";',
  'import extractionRouter from "./server/routes/extraction.routes.ts";\n' + importStatement
);

// Add route
content = content.replace(
  'app.use(extractionRouter);',
  'app.use(extractionRouter);\napp.use("/api/logbook", logbookRouter);'
);

fs.writeFileSync('server.ts', content);
