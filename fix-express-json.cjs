const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const globalErrorHandler = `
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Unhandled Error:", err);
  if (!res.headersSent) {
    res.status(err.status || 500).json({ success: false, error: err.message || "Internal Server Error" });
  }
});
`;

if (!code.includes('Unhandled Error:')) {
  code = code.replace(/app\.listen\(PORT, "0\.0\.0\.0", \(\) => \{/, globalErrorHandler + '\n  app.listen(PORT, "0.0.0.0", () => {');
  fs.writeFileSync('server.ts', code);
  console.log("Added global error handler.");
} else {
  console.log("Global error handler already exists.");
}
