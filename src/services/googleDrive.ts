import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth } from "../firebase";

let cachedDriveToken: string | null = null;

export async function authenticateGoogleDrive(): Promise<string> {
  if (cachedDriveToken) return cachedDriveToken;
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  provider.addScope("https://www.googleapis.com/auth/drive.readonly");
  provider.addScope("https://www.googleapis.com/auth/spreadsheets.readonly");
  
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Could not retrieve access token.");
    }
    cachedDriveToken = credential.accessToken;
    return cachedDriveToken;
  } catch (err: any) {
    console.error("Auth error:", err);
    throw new Error(err?.message || "Failed to authenticate.");
  }
}

export async function getRecentSpreadsheets(accessToken: string) {
  const url = `https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.spreadsheet'&orderBy=recency desc&pageSize=10&fields=files(id,name)`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error("Failed to fetch spreadsheets");
  const data = await res.json();
  return data.files || [];
}

export async function getSpreadsheetCsv(accessToken: string, fileId: string) {
  // We can fetch the first sheet's values directly via Sheets API
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values/A1:Z100`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error("Failed to fetch spreadsheet data");
  const data = await res.json();
  return data.values || [];
}
