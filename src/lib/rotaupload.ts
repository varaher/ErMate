/**
 * Rota upload helpers (pure: no network, no Firebase).
 *
 *  - classifyRotaFile: which kind of file was chosen (xlsx, csv, image, pdf, old xls, unsupported).
 *  - xlsxToRows: reads the FIRST sheet of an .xlsx in the browser (an .xlsx is a zip of XML files).
 *  - csvToRows / rowsToCsv: turn text into rows and back into compact CSV for the rota reader.
 *
 * Old .xls (binary) files are not supported: the doctor is asked to save as .xlsx or CSV.
 */

export const ROTA_MAX_ROWS = 200;
export const ROTA_MAX_COLS = 26;
export const ROTA_MAX_XLSX_BYTES = 3 * 1024 * 1024;
export const ROTA_MAX_CSV_BYTES = 1024 * 1024;
export const ROTA_MAX_IMAGE_BYTES = 6 * 1024 * 1024;

export type RotaFileKind = "xlsx" | "csv" | "image" | "pdf" | "xls" | "unsupported";

export function classifyRotaFile(name: string, mime: string): RotaFileKind {
  const n = (name || "").toLowerCase();
  const m = (mime || "").toLowerCase();
  if (n.endsWith(".xlsx") || m === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") return "xlsx";
  if (n.endsWith(".xls") || m === "application/vnd.ms-excel") {
    return n.endsWith(".csv") ? "csv" : "xls";
  }
  if (n.endsWith(".csv") || n.endsWith(".txt") || m === "text/csv" || m === "text/plain") return "csv";
  if (n.endsWith(".pdf") || m === "application/pdf") return "pdf";
  if (m.startsWith("image/") || /\.(jpe?g|png|webp|heic)$/.test(n)) return "image";
  return "unsupported";
}

export interface RotaProblem { title: string; body: string }

export function rotaFileProblem(kind: RotaFileKind, size: number): RotaProblem | null {
  if (kind === "xls") {
    return { title: "That is an old .xls file.", body: "Open it in Excel and choose Save as, Excel Workbook (.xlsx) or CSV. Then upload it again." };
  }
  if (kind === "unsupported") {
    return { title: "ErMate cannot read that file type.", body: "Upload an Excel (.xlsx), CSV, PDF or a photo of the rota." };
  }
  const cap = kind === "xlsx" ? ROTA_MAX_XLSX_BYTES : kind === "csv" ? ROTA_MAX_CSV_BYTES : ROTA_MAX_IMAGE_BYTES;
  if (size > cap) {
    return { title: "That file is too large.", body: `Use a file under ${Math.round(cap / (1024 * 1024))} MB. For a rota, one month on one sheet is enough.` };
  }
  if (size === 0) {
    return { title: "That file is empty.", body: "Choose the rota file again." };
  }
  return null;
}

// ---------- CSV ----------

export function csvToRows(text: string): string[][] {
  const src = (text || "").replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"') {
        if (src[i + 1] === '"') { cur += '"'; i++; } else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === "," || c === "\t") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      rows.push(row); row = [];
    } else cur += c;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return cleanRows(rows);
}

function cleanRows(rows: string[][]): string[][] {
  const out: string[][] = [];
  for (const r of rows) {
    const cells = r.slice(0, ROTA_MAX_COLS).map((c) => String(c ?? "").trim());
    while (cells.length && cells[cells.length - 1] === "") cells.pop();
    if (cells.length === 0) continue; // skip empty rows
    out.push(cells);
    if (out.length >= ROTA_MAX_ROWS) break;
  }
  return out;
}

export function rowsToCsv(rows: string[][]): string {
  return rows
    .map((r) => r.map((c) => (/[",\n\r]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(","))
    .join("\n");
}

// ---------- XLSX ----------

function u16(b: Uint8Array, o: number) { return b[o] | (b[o + 1] << 8); }
function u32(b: Uint8Array, o: number) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream("deflate-raw");
  const stream = new Blob([data as unknown as BlobPart]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readZip(buf: Uint8Array): Promise<Map<string, () => Promise<Uint8Array>>> {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (u32(buf, i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("not a zip");
  const count = u16(buf, eocd + 10);
  let p = u32(buf, eocd + 16);
  const files = new Map<string, () => Promise<Uint8Array>>();
  for (let n = 0; n < count; n++) {
    if (u32(buf, p) !== 0x02014b50) throw new Error("bad zip");
    const method = u16(buf, p + 10);
    const csize = u32(buf, p + 20);
    const nameLen = u16(buf, p + 28);
    const extraLen = u16(buf, p + 30);
    const commentLen = u16(buf, p + 32);
    const local = u32(buf, p + 42);
    const name = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nameLen));
    files.set(name, async () => {
      const lnLen = u16(buf, local + 26);
      const leLen = u16(buf, local + 28);
      const start = local + 30 + lnLen + leLen;
      const raw = buf.subarray(start, start + csize);
      if (method === 0) return raw;
      if (method === 8) return inflateRaw(raw);
      throw new Error("unsupported zip method");
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

function unescapeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, "&");
}

function textOf(xml: string): string {
  const parts: string[] = [];
  const re = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) parts.push(unescapeXml(m[1]));
  return parts.join("");
}

function attr(attrs: string, name: string): string {
  const m = new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attrs);
  return m ? unescapeXml(m[1]) : "";
}

function colIndex(ref: string): number {
  const letters = /^[A-Z]+/i.exec(ref)?.[0].toUpperCase() || "A";
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

const BUILTIN_DATE_FMTS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

function dateStyles(stylesXml: string): Set<number> {
  const custom = new Map<number, string>();
  const nf = /<numFmt\b([^>]*)\/?>/g;
  let m: RegExpExecArray | null;
  while ((m = nf.exec(stylesXml))) {
    custom.set(Number(attr(m[1], "numFmtId")), attr(m[1], "formatCode"));
  }
  const out = new Set<number>();
  const block = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(stylesXml)?.[1] || "";
  const xf = /<xf\b([^>]*?)(?:\/>|>)/g;
  let i = 0;
  while ((m = xf.exec(block))) {
    const id = Number(attr(m[1], "numFmtId"));
    const code = custom.get(id);
    const isDate = BUILTIN_DATE_FMTS.has(id) || (!!code && /[dmyhs]/i.test(code.replace(/"[^"]*"/g, "").replace(/\[[^\]]*\]/g, "")) && !/^0|#/.test(code.trim()));
    if (isDate) out.add(i);
    i++;
  }
  return out;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Excel date or time serial to "YYYY-MM-DD", "HH:MM" or both. */
export function excelSerialToText(serial: number): string {
  const days = Math.floor(serial);
  const frac = serial - days;
  const mins = Math.round(frac * 24 * 60);
  const hh = pad(Math.floor(mins / 60) % 24);
  const mm = pad(mins % 60);
  if (days < 1) return `${hh}:${mm}`;
  const d = new Date(Math.round((days - 25569) * 86400000));
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  return frac > 0 ? `${date} ${hh}:${mm}` : date;
}

export async function xlsxToRows(bytes: Uint8Array): Promise<string[][]> {
  let files: Map<string, () => Promise<Uint8Array>>;
  try { files = await readZip(bytes); } catch { throw new Error("That does not look like a valid .xlsx file."); }
  const text = async (name: string) => {
    const f = files.get(name);
    return f ? new TextDecoder().decode(await f()) : "";
  };

  // First sheet in tab order.
  const wb = await text("xl/workbook.xml");
  const first = /<sheet\b([^>]*)\/?>/.exec(wb);
  let sheetPath = "xl/worksheets/sheet1.xml";
  if (first) {
    const rid = attr(first[1], "r:id");
    const rels = await text("xl/_rels/workbook.xml.rels");
    const re = /<Relationship\b([^>]*)\/?>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(rels))) {
      if (attr(m[1], "Id") === rid) {
        const t = attr(m[1], "Target");
        sheetPath = t.startsWith("/") ? t.slice(1) : "xl/" + t.replace(/^\.\//, "");
        break;
      }
    }
  }
  const sheet = await text(sheetPath);
  if (!sheet) throw new Error("The first sheet of that workbook could not be read.");

  const shared: string[] = [];
  const sst = await text("xl/sharedStrings.xml");
  const si = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let sm: RegExpExecArray | null;
  while ((sm = si.exec(sst))) shared.push(textOf(sm[1]));

  const dates = dateStyles(await text("xl/styles.xml"));

  const rows: string[][] = [];
  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let rm: RegExpExecArray | null;
  while ((rm = rowRe.exec(sheet)) && rows.length < ROTA_MAX_ROWS * 3) {
    const cells: string[] = [];
    const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cm: RegExpExecArray | null;
    while ((cm = cellRe.exec(rm[1]))) {
      const a = cm[1];
      const body = cm[2] || "";
      const idx = colIndex(attr(a, "r"));
      if (idx >= ROTA_MAX_COLS) continue;
      const t = attr(a, "t");
      const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      let val = "";
      if (t === "s") val = shared[Number(v)] ?? "";
      else if (t === "inlineStr") val = textOf(body);
      else if (t === "b") val = v === "1" ? "TRUE" : "FALSE";
      else if (t === "str" || t === "e") val = unescapeXml(v || "");
      else if (v !== undefined && v !== "") {
        const num = Number(v);
        const s = Number(attr(a, "s") || 0);
        val = Number.isFinite(num) && dates.has(s) ? excelSerialToText(num) : unescapeXml(v);
      }
      while (cells.length < idx) cells.push("");
      cells[idx] = val;
    }
    rows.push(cells);
  }
  return cleanRows(rows);
}

/** Compact text sent to the rota reader. */
export function rowsToRotaText(rows: string[][]): string {
  return rowsToCsv(rows);
}