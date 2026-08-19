const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  '  const server = app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {\n  console.error("Unhandled Error:", err);\n  if (!res.headersSent) {\n    res.status(err.status || 500).json({ success: false, error: err.message || "Internal Server Error" });\n  }\n});\n  app.listen(PORT, "0.0.0.0", () => {\n    console.log(`[ErMate Server] Running on http://0.0.0.0:${PORT}`);\n  });',
  `
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Unhandled Error:", err);
    if (!res.headersSent) {
      res.status(err.status || 500).json({ success: false, error: err.message || "Internal Server Error" });
    }
  });

  const serverInstance = app.listen(PORT, "0.0.0.0", () => {
    console.log(\`[ErMate Server] Running on http://0.0.0.0:\${PORT}\`);
  });
  
  serverInstance.timeout = 900000;
  serverInstance.headersTimeout = 900000;
  serverInstance.keepAliveTimeout = 900000;
`
);

fs.writeFileSync('server.ts', code);
