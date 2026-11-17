import { readFileSync } from "fs";
import { classifyRotaFile, rotaFileProblem, xlsxToRows, csvToRows, rowsToCsv, excelSerialToText, rowsToRotaText } from "./src/lib/rotaupload";
let fail = 0; const t = (n: string, c: boolean) => { if (!c) { fail++; console.log("FAIL " + n); } };
const read = (p: string) => readFileSync(p, "utf8");
const AT = "@";

// An .xlsx with 2 sheets, real date and time cells, an empty row, an ampersand and an accent.
const XLSX_B64 = "UEsDBBQAAAAIACQAcV1Gx01IlwAAAM0AAAAQAAAAZG9jUHJvcHMvYXBwLnhtbE2PTQvCMBBE/0ro3aS16EFiQdSj6Ml7TDc2kGSXZIX476WCH7cZhvdg9CUjQWYPRdQYUtk2EzNtlCp2gmiKRIJUY3CYo+EiMd8VOuctHNA+IiRWy7ZdK6gMaYRxQV9hM+gdUfDWsMc0nLzNWNCxOFYLQewxkmF/CyCUOBMketYgetnJlVb/4Gy5Qi5z7mX3Hj9dq9+B4QVQSwMEFAAAAAgAJABxXViuhcTuAAAAKwIAABEAAABkb2NQcm9wcy9jb3JlLnhtbM2S3UoDMRBGX6XkfneSLVQJ271RvFIQLCjehWTaBjc/JCObvr1sbLeIPoC3Mx/nOwPT6yh1SPicQsREFvOquNFnqeOWHYmiBMj6iE7lNkT0xY37kJyi3IZ0gKj0hzogdJxvwCEpo0jBDGziQmRDb7TUCRWFdMYbveDjZxorzGjAER16yiBaAWyYG+OpjD1cATOMMLn8PUCzEOv0T2zdADsnS7ZLapqmdlrXXMe5gLenx5d6bmN9JuU1slXJVtIp4pZdml/Xd/e7BzZ0vNs0QjTiZse55ELy2/fZ9YffVdgFY/f2HxtfBIcefv3F8AVQSwMEFAAAAAgAJABxXZlcnCMPBgAAnCcAABMAAAB4bC90aGVtZS90aGVtZTEueG1s7Vpdc5s4FH3Pr9BoZ/ZtazDg2GlIJ/5qd5u0mcTbnT5eYxnUCIkRchL/+x2B7SDA2O06m3Q3fghB0jn3nqsrXYR9+u4hZuiOyJQK7mP7jYXfnR2dwomKSEzQQ8x4egI+jpRKTlqtNIhIDOkbkRD+ELO5kDGo9I2QYWsm4Z7yMGattmV1WjFQjhGHmPj483xOA4ImmhKfHSG05h8xEhOuUt2WtQZM3gSZ5SIS5/3ZiNmtvb7L7tNlOmAS3QHz8T3lM3E/IQ8KIwapGjDpYyv74NaGo2WQnMIJU7soC3Tj7GPSFQgyD9smnQynGz577PaOh2Vv2oY3DfDRaDQY2WXrRTgEAeFlQUUKd9y1+yUPSqANTYMnA8uz3FqaqjfOdppev9/3enU0ToXG3U7TtTruebuOxq3QeA2x6Z8PBp06Gq9C09lOMz7uddxamk6BJmKU324n0VlbTjQDcgonc8E+NLN0LcvqlrLfROmWzbLbLMS54GrHSozhm5BjwZVhnYGiHKllQuYQEB8PIJ5KCo8eZKMIFIaU+oJ0e592C6WBpIny8R8JcFwY++svD+Nxe/g2uzrOW5T/Y+kGx+q7q+txfh04+fV8/LbJyAfgYclIvze0NXZw7FqZkfPBKDPS92xvF1laIvP63b7GumPP2YVVJWzH62d2j4e5yE7HGulr73zoNnKdS5gWuSY0Jin6RO7RtYiBN7pBpvIHoZMIqAGFSMTlzDAQIxUZiE9LYI2APjFn64ukfNaIeL/4Zui5ieRC0SbExyg2EJdCsL6Qzdo/ajeK2hc83OGXXBQB1wB3jW4NSrk1WiQRiSsrz8RExJByxYArCAknCuk+cUtIE/4rpcb8XNJAilTMFfpKUR9ocyAndKrq0R9oDAyWjb5PIjAievkF9QVrNDgkdyYEeAis0Qhhxiy8h4WCuFkVxKwIuQAVNQq5WcrAmLhUSeAhYQKNZiRNG8Gf5dKQ9BEY3ZFZl2wZmxCp6G0j5AKEKEKG4nYQQZw066I8KoJ+T2+FYICuhGr2T5hrWN8LRoHvzqgvlKgf3Jz+pGFUn4y6ZyHNElqpfboeUr5XPWR0KssqXuvhi6qH55I27wvlKrgT8B+tfUNY8CvCo9fS91r6XkvfSyp9O3ek7yx4ZnHLj5HrI+LjqTHedWicU8Zu1JKRi9Ssk6lgdDamjD225u0Z3+Y8m0QDJg1ZrVrsKZyEErJGJIX6i6roJoKE+NjGJQthaviyaUWJSH1sYbNru1PlcflrLspVPsgzX0OZfKAuxSwf51j1AzOha7sld1va360SHG36UDKc4+eSYeeMB9Jhe3vq2DJv36UjbymlmX44pBwBD31sd9q5OpQGwMhMp2kpydfp/PJyPI1gRlZJbu8XVds5dHZ0/3lyFHT0nOfScYgsLwpx9xVSvx6eOs2tXWmeVZqaoqFpeW0lYRzd+7jntT2MAkh8PGegMAriZObjVBdYYCH3caBkeZnUFqH9g18K/ZaIlgJv1Q3bGvYt5S6jTWSqhpBGOXE2qhxdxmtC1fZcPSVPG6vWU6twuvbPqiK/q8lwMp+TQNVmeaGrZDrvqdvvxUIReRPN7tGULeQ1zHzs5stxRlPl4/b6RvrYc1cr1aws9TtT+XuLmg0s/+aEJRGs6mp3+36T01VXxMb/8izUSH5sLsXoqWLn/Iuxa9irX2P3vLFb7R2EE2dWCUQAMZGA9ObgYyFVJEIJSUSDsRRc1UmUQiEGSgcAMf0NvY4MuSsVzrU/OX/FLKNhpK5piCQNfawiSciVWsX7+6za7drH+mwDWxmp7JDVWOgIJTXhmZI7wiZ6M+/oacIoWhen6r5r4LckbKnZ3Fun4fh/exZ19z2LHuLwY0hwD3mGc5vOcIUHsd5zqT3ww3x7z2lre0/4MJ+AipD+4+OAyoARXJGvn9cn4poECm1efCDl49+6q6190zj1sd2tqtK2tYmf5QT8mJI1Ymqn6GW+Hink2paDbTXXDiHkCXLNq0m1mvW9X6bptrp6kR1O48JbUN1Q+WWbfgKafiOBGpI5LJhKW6tW8qAkDNa/vblIVevsaMNwdvQ3UEsDBBQAAAAIACQAcV3s5e0qUQIAAOEHAAAYAAAAeGwvd29ya3NoZWV0cy9zaGVldDEueG1slZVRb9sgEID/CmJSH4Njx17U2tbauNH20Cpqte2Z2JcYFYwH16T79xNOayUZKJufAN3HcZ8Ok++1ebEtAJI3JTtb0Baxv2bM1i0obie6h+5NyY02iqOdaLNltjfAmwFSksVRlDHFRUfLfFhbmTLXryhFBytD7KtS3Py+A6n3BZ3Sj4UnsW3RLbAy7/kWngG/9yvDypyNuzRCQWeF7oiBTUFvp9fLzMUPAT8E7O3RmLhK1lq/uMm3pqCROxBIqNHtwGsUO1iAlG4jSuyv9z3pmNKBx+OP3ZdD7StD1tzCQsufosG2oHNKGtjwV4lPev8V3utJxwNWHHmZG70nxtVZ5rUbuNxYUNE5P89oaJkLW+ZYVhwhZ1jmzM1Z/R5/F4p/bsUGPcAimEDXqI2HqELEveJCeoD74JmQG9+ZlsEMXXMazozej9LiUVpMiR26BwvqGm1XzrJkluVsd6wqDmR50KYT3dYnK4RUhtySK676G7LQPmchkH+BN656CZNaK5+7QynxUSnRJDn7Tuta+pB0fkLMRuTEYDIaTP7JYBKo6tF1t89fCKgMufNpC8WvL2lLPA7m6WyaHX1n2nxI0PSJthk9W0hHj2mggHhKHvWOxFGc+W5xCLvfQag1Q0hlyNWnOJreKCF9f4wqBNaXHIfA6ew6inzXOigj+gs40ZmNOjNvW87P2jL7z7asQkBzSUHma7MkcNUOEnzIhTZjRw+Ee/weuNmKzhIJGyxoNPmcUmIOD8phgrofLK01olbDsAXegHEBKSUbrfFj4t6z8VUv/wBQSwMEFAAAAAgAJABxXbPzet1EAQAAPQIAABgAAAB4bC93b3Jrc2hlZXRzL3NoZWV0Mi54bWx1UtFOwzAM/JUoH7B0SAM0pZHYEIIHpGkT8Jy1bhstiYvj0fH3KN1WISTe7NP5fOdED0iH1AGwOAUfUyk75n6pVKo6CDbNsId4Cr5BCpbTDKlVqSew9TgUvLopilsVrIvS6BHbkNF4ZO8ibEikYwiWvlfgcSjlXF6BrWs7zoAyurct7IDf+g0po9WkUrsAMTmMgqAp5cN8uRr5I+HdwZB+1SIn2SMecvNSl7LIhsBDxVnBVuy+YA3eZyEp0udFU04r8+Dv+qr+NGbfkNjbBGv0H67mrpT3UtTQ2KPnLQ7PcMmzmAw+WrZGEw6Cck6jq1zk3VxKF/N9dkzSaJeMZuPaiARasdEqI6q6TKz+mwh/2Ipw8n9eng/7aql1MQkPDZeymN0tpKCz2XPD2I8Ps0dmDGPZga2BMmEhRYPI1ybfavox5gdQSwMEFAAAAAgAJABxXYt4PsyCAgAA7goAAA0AAAB4bC9zdHlsZXMueG1s3Vbfa9swEP5XjN5bJfFm4iHrYYbCYBuF9mGvSiwnAv3wZLnE++vHWa6TtLrCyvYymyDpPn/f3elOKKwPo5YPRylDdjLa9hU5htB9orTfH6UR/a3rpD0Z3TpvROhvnT/QvvNSND2QjKab1aqgRihLOLODuTOhz/ZusKEi68WUxeFLU5F18YFkUa52jazIOI7jjTE3TUMoZ3TW4Kx19loKDJxZYWT2JHRFaqHVzitgtcIoPUbzBgx7p53PwlEaCWTKWf8rwuu4gvRmHaOs85Pv6GEaIACl9RLAhkQDZ50IQXp7p7SeOJPxFZTN88exkxU5eDGuNx/JmTANPWc75xvpr/KMJs60bAPlzKvDEcbgOgpgCM5QzholDs6KKYZnxjzpOdtLrR+gtj/aK+1Te1GKFRTCLlOl9TyNMnEB+pdqUftCNn+XbNapJxc+DyE4O61/Di7Iey9bdZrWp3bxf6U+988/09+s/7Y8nTfsoipXNVmsGfR2Rb7D4dBniWw3KB2UnVdH1TTSvipNz1kQOy2v9Vcka2QrBh0eF7Ai5/k32ajBlMtX95DW/NV5/hVacF0sB6vnTNlGnmRTz0t/2E3TzB92FVnNDxBeInfTk0YwTsTSCGCYHywCjBNZmJ//KZ8tmk/EsNi2SWSLcrYoJ7JSSD29mJ80pyzLMp1pWeZ5UWA7WtfJCGps34oCfmk1LDZgYH7A05/tNV5tvEPe7gOspm91CJYp3olYpvheA5LeN2CUZbramB9gYFXAegf8p/1AT6U5eQ5VxWLDTjCOlCWGQC+me7QokN0p4E3XBzsleV6WaQSwdAR5jiFwGnEEiwBiwJA8n+7BF/cRfb6n6PkfLv8NUEsDBBQAAAAIACQAcV2XirscwAAAABMCAAALAAAAX3JlbHMvLnJlbHOd0ktqAzEMgOGrDN53lKbQRchk1U12peQCqq15MLYlZJW6tw/JJpnQF9mLn09C2zeKaBPnMk5SmppiLp0bzWQDUPxICUvLQrmm2LMmtNKyDiDoZxwI1qvVM+h1w+22183m8CX0nyL3/eTphf1HomzfhG8mXHNAHcg6VyN8ss7vzHNbU3TNPnRO9+HRwZ2Wn7eDRIYBDcGz0oMoC6lNVC6cwP5VWcp5YgFa3w36+zhUjXKg8DsJRRaip5MIFj+wOwJQSwMEFAAAAAgAJABxXczL8ZhHAQAAqwIAAA8AAAB4bC93b3JrYm9vay54bWy1kt1KxEAMhV+lzAM4dVHBpe2Niz8gu+Iu3qfT1AZnJiWT3VWfXtpSXBDEG68yORnCOR8pjixvNfNb9h58TKXpVPultcl1GCCdcY/xPfiWJYCmM5ZXm3pBaFKHqMHbRZ5f2QAUTVXMu57Enjas6JQ42qoYhBfCY/qeD212oEQ1edKP0oxvjyYLFCnQJzalyU2WOj7es9AnRwW/dcLel+Z8GrygKLkf8nYwuYM6jYpC/QxKXJqrPDdZS5J0/DHuB6d0wB3UU7dXviWvKCtQvBPe9xRfhzW2KuxJjJHDXCeIS/kLRm5bcrhitw8YdeIo6AeDMXXUJ5NFCFiaNR+GNIj60EzJFBRPOMmSmtLIQzOa+z8jG+1QTqwsfrGyGDnNcBpsKWKzhoDJVoUD754kG8oYaXFxeX5tsnbv/Q14t4mPDM3Mer6T6gtQSwMEFAAAAAgAJABxXY33LFq0AAAAiQIAABoAAAB4bC9fcmVscy93b3JrYm9vay54bWwucmVsc8WSMQ6DMAxFr4JyAAy06lBBpy6sFReIwBBEQqLYVeH2VWGASB26oE7W9/D+k+z8gVpyb0dSvaNoMnqkQihmdwWgWqGRFFuH42R0a72RTLH1HThZD7JDyJLkAn7PELd8z4yq2eEvRNu2fY13Wz8NjvwFDC/rB1KILKJK+g65EDDpbU2wjDSejBZR2RTCl00q4N9CWSCUHShEPGukzWbNQf3pwHpWaHBrX+K6DG9y/jhA8Hm3N1BLAwQUAAAACAAkAHFdbqckvB4BAABXBAAAEwAAAFtDb250ZW50X1R5cGVzXS54bWzFlL9OAzEMxl/llLVqUjowoF4XYIUOvEBIfL2oSRzZbrm+PbrrHwlUTlRFYomH2N/P9hdl8bYvwFWXYuZatSLlwRh2LSTLGgvkLsUGKVlhjbQ2xbqNXYOZz2b3xmEWyDKVXkMtF0/Q2G2U6rkTyBww14ogsqoeD4k9q1a2lBiclYDZ7LL/RpkeCZogDjnchsKTLkVlLhL6m58Bx7rXHRAFD9XKkrzYBLUyXTQs+wisxyUu9IhNExx4dNsEWTQXAuu5BZAU9UF0Mk6WFhIczrub+YPMGNCjWxEWNg4JrsedLOmrp4WwAEkYH/FMtKXcPB/0bnvwv2R30XwgbQY/2Azh9h1/9fisf2Uf83/s4x1x89dPvY862ZBPfDP8J8tPUEsBAhQDFAAAAAgAJABxXUbHTUiXAAAAzQAAABAAAAAAAAAAAAAAAIABAAAAAGRvY1Byb3BzL2FwcC54bWxQSwECFAMUAAAACAAkAHFdWK6FxO4AAAArAgAAEQAAAAAAAAAAAAAAgAHFAAAAZG9jUHJvcHMvY29yZS54bWxQSwECFAMUAAAACAAkAHFdmVycIw8GAACcJwAAEwAAAAAAAAAAAAAAgAHiAQAAeGwvdGhlbWUvdGhlbWUxLnhtbFBLAQIUAxQAAAAIACQAcV3s5e0qUQIAAOEHAAAYAAAAAAAAAAAAAACAgSIIAAB4bC93b3Jrc2hlZXRzL3NoZWV0MS54bWxQSwECFAMUAAAACAAkAHFds/N63UQBAAA9AgAAGAAAAAAAAAAAAAAAgIGpCgAAeGwvd29ya3NoZWV0cy9zaGVldDIueG1sUEsBAhQDFAAAAAgAJABxXYt4PsyCAgAA7goAAA0AAAAAAAAAAAAAAIABIwwAAHhsL3N0eWxlcy54bWxQSwECFAMUAAAACAAkAHFdl4q7HMAAAAATAgAACwAAAAAAAAAAAAAAgAHQDgAAX3JlbHMvLnJlbHNQSwECFAMUAAAACAAkAHFdzMvxmEcBAACrAgAADwAAAAAAAAAAAAAAgAG5DwAAeGwvd29ya2Jvb2sueG1sUEsBAhQDFAAAAAgAJABxXY33LFq0AAAAiQIAABoAAAAAAAAAAAAAAIABLREAAHhsL19yZWxzL3dvcmtib29rLnhtbC5yZWxzUEsBAhQDFAAAAAgAJABxXW6nJLweAQAAVwQAABMAAAAAAAAAAAAAAIABGRIAAFtDb250ZW50X1R5cGVzXS54bWxQSwUGAAAAAAoACgCEAgAAaBMAAAAA";

(async () => {
  const rows = await xlsxToRows(new Uint8Array(Buffer.from(XLSX_B64, "base64")));
  t("xlsx: header row", rows[0].join("|") === "Date|Shift|Doctor|Email|Start|End");
  t("xlsx: date cell becomes YYYY-MM-DD", rows[1][0] === "2026-11-20");
  t("xlsx: time cells become HH:MM", rows[1][4] === "08:00" && rows[1][5] === "14:00");
  t("xlsx: night shift times", rows[2][4] === "20:30" && rows[2][5] === "08:00");
  t("xlsx: ampersand unescaped", rows[1][2] === "Dr A & Co");
  t("xlsx: accents kept", rows.some(r => r[2] === "Dr Émile"));
  t("xlsx: text date kept as typed", rows.some(r => r[0] === "21 Nov 2026"));
  t("xlsx: empty row skipped", rows.length === 5);
  t("xlsx: blank cell keeps its column", rows[4][2] === "" && rows[4][3].startsWith("d" + AT));
  t("xlsx: only the first sheet", !rows.some(r => r.includes("ignore")));
  let err = "";
  try { await xlsxToRows(new Uint8Array([1, 2, 3, 4, 5])); } catch (e: any) { err = e.message; }
  t("xlsx: garbage gives a plain message", err.includes("valid .xlsx"));

  const csv = csvToRows('Date,Shift,Doctor,Email,Start,End\r\n20 Nov,Morning,"Dr A, MD",a' + AT + 'x.in,08:00,14:00\r\n\r\n20 Nov,Night,Dr B,b' + AT + 'x.in,20:00,08:00\r\n');
  t("csv: 3 rows, empty skipped", csv.length === 3);
  t("csv: quoted comma kept", csv[1][2] === "Dr A, MD");
  t("csv: BOM stripped", csvToRows("﻿a,b\n1,2")[0][0] === "a");
  t("csv: tab separated also works", csvToRows("a\tb\n1\t2")[1][1] === "2");
  t("csv: round trip", csvToRows(rowsToCsv(csv)).length === 3 && rowsToRotaText(csv).includes('"Dr A, MD"'));
  t("csv: capped at 200 rows", csvToRows(Array.from({ length: 500 }, (_, i) => "r" + i + ",x").join("\n")).length === 200);

  t("serial date", excelSerialToText(46346) === "2026-11-20");
  t("serial time", excelSerialToText(0.8333333333) === "20:00");
  t("serial date and time", excelSerialToText(46346.5) === "2026-11-20 12:00");

  t("kind xlsx", classifyRotaFile("Nov rota.XLSX", "") === "xlsx");
  t("kind csv", classifyRotaFile("rota.csv", "text/csv") === "csv");
  t("kind csv from windows mime", classifyRotaFile("rota.csv", "application/vnd.ms-excel") === "csv");
  t("kind old xls", classifyRotaFile("rota.xls", "application/vnd.ms-excel") === "xls");
  t("kind pdf", classifyRotaFile("rota.pdf", "application/pdf") === "pdf");
  t("kind photo", classifyRotaFile("IMG_1.jpg", "image/jpeg") === "image" && classifyRotaFile("x.heic", "") === "image");
  t("kind unsupported", classifyRotaFile("rota.docx", "") === "unsupported");
  t("xls gets the Save as message", (rotaFileProblem("xls", 10)?.body || "").includes("Save as"));
  t("too large", rotaFileProblem("xlsx", 4 * 1024 * 1024)?.title === "That file is too large.");
  t("empty file", rotaFileProblem("csv", 0)?.title === "That file is empty.");
  t("ok file", rotaFileProblem("image", 500000) === null);

  const modal = read("src/components/shared/WorkspaceRotaSyncModal.tsx");
  t("modal starts on the choose step", modal.includes('useState<Step>("choose")'));
  t("modal has upload button and file input", modal.includes("Upload rota file") && modal.includes('type="file"'));
  t("file input accepts all kinds", modal.includes(".xlsx,.xls,.csv,.txt,.pdf,image/*"));
  t("google stays as second option", modal.includes("Use Google Sheets and send calendar invites"));
  t("upload path never calls Google Calendar", modal.includes('if (source !== "google" || !confirmedToken)'));
  t("upload path still publishes to ErMate", modal.includes("publishRota("));
  t("roster match still required", modal.includes("rosterByEmail.get(rawEmail)"));
  t("photo shrunk before sending", modal.includes("1800 /"));
  const server = read("server.ts");
  const route = server.slice(server.indexOf('app.post("/api/parse-rota"'), server.indexOf('app.post("/api/scan-mnemonic"'));
  t("server accepts image or pdf", route.includes('"application/pdf"') && route.includes("imageOk"));
  t("server caps image size", route.includes("image.length < 8_000_000"));
  t("server temperature 0", route.includes("temperature: 0"));
  t("server still needs auth and credits", server.includes('app.post("/api/parse-rota", requireAuth, meterCredits("parse_rota"'));
  t("tip mentions upload", read("src/lib/coachTours.ts").includes("upload your rota (Excel, CSV, PDF or a photo)"));
  if (fail) { console.log(fail + " failed"); process.exit(1); } console.log("ALL PASS");
})();