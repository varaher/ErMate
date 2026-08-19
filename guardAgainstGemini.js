#!/usr/bin/env node
/**
 * guardAgainstGemini.js
 *
 * STRUCTURAL ENFORCEMENT — scans server and client files for forbidden
 * Gemini usages outside whitelisted vision/OCR and voice transcription routes.
 */

import fs from "fs";
import path from "path";

// ── The ONLY files where Gemini is allowed to appear ─────────────────
// Per your locked model matrix (Rule 1):
// - Handover Synthesis: Claude 3.5 Sonnet -> Gemini Pro fallback
// - Mortality Audit: Claude 3.5 Sonnet -> GPT-4o -> Gemini Pro
// - Vision / OCR: Multimodal EMR image parse
// - Voice Transcription: Audio transcription fallback in server.ts
const GEMINI_WHITELIST = [
  "server.ts",                            // Audio transcription fallback
  "server/routes/extraction.routes.ts",   // Multimodal EMR image OCR/vision scan
  "server/handover.ts",                   // Rule 1: Handover Synthesis Gemini Pro fallback
  "server/mortalityAudit.ts",             // Rule 1: Mortality Audit Gemini Pro fallback
];

const FORBIDDEN_PATTERNS = [
  /gemini-2\.0-flash/i,
  /gemini-2\.5-flash/i,
  /gemini-1\.5-flash/i,
  /gemini-1\.5-pro/i,
];

const SCAN_DIRS = ["server", "src"];

function walkDir(dir, callback) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach((file) => {
    const filepath = path.join(dir, file);
    const stat = fs.statSync(filepath);
    if (stat.isDirectory()) {
      if (file === "node_modules" || file === ".git" || file === "dist") return;
      walkDir(filepath, callback);
    } else if (/\.(ts|tsx|js|jsx)$/.test(file)) {
      callback(filepath);
    }
  });
}

function isWhitelisted(filepath) {
  const normalized = filepath.replace(/\\/g, "/");
  return GEMINI_WHITELIST.some((allowed) => normalized.endsWith(allowed));
}

let violations = [];

SCAN_DIRS.forEach((dir) => {
  walkDir(dir, (filepath) => {
    if (isWhitelisted(filepath)) return;

    const content = fs.readFileSync(filepath, "utf-8");
    const lines = content.split("\n");

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      // Skip comment lines explaining rules or deprecation history
      if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;

      FORBIDDEN_PATTERNS.forEach((pattern) => {
        if (pattern.test(line)) {
          violations.push({
            file: filepath,
            line: idx + 1,
            content: trimmed.substring(0, 100),
          });
        }
      });
    });
  });
});

if (violations.length > 0) {
  console.error("\n🚨 BUILD FAILED — Gemini usage found outside whitelisted vision/OCR and audio transcription routes:\n");
  violations.forEach((v) => {
    console.error(`  ${v.file}:${v.line}`);
    console.error(`    ${v.content}\n`);
  });
  console.error(
    `This violates Rule 1 (Clinical Model Matrix). Gemini is permitted ONLY in whitelisted vision/OCR routes.\n`
  );
  process.exit(1);
} else {
  console.log("✅ Gemini guard passed — no violations outside whitelisted vision/OCR routes.");
  process.exit(0);
}
