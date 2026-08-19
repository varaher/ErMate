import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth } from "../firebase";

let cachedWorkspaceToken: string | null = null;

export async function authenticateGoogleWorkspace(): Promise<string> {
  if (cachedWorkspaceToken) return cachedWorkspaceToken;
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  provider.addScope("https://www.googleapis.com/auth/drive.readonly");
  provider.addScope("https://www.googleapis.com/auth/spreadsheets.readonly");
  provider.addScope("https://www.googleapis.com/auth/calendar.events");
  
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Could not retrieve access token.");
    }
    cachedWorkspaceToken = credential.accessToken;
    return cachedWorkspaceToken;
  } catch (err: any) {
    console.error("Auth error:", err);
    throw new Error(err?.message || "Failed to authenticate with Google Workspace.");
  }
}

export async function getRecentSpreadsheets(accessToken: string) {
  const url = `https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.spreadsheet'&orderBy=recency desc&pageSize=15&fields=files(id,name)`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
     if (res.status === 401) cachedWorkspaceToken = null;
     throw new Error("Failed to fetch spreadsheets");
  }
  const data = await res.json();
  return data.files || [];
}

export async function getSpreadsheetData(accessToken: string, fileId: string) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values/A1:Z100`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error("Failed to fetch spreadsheet data");
  const data = await res.json();
  return data.values || [];
}
