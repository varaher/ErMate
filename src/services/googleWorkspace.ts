import { reauthenticateWithPopup, linkWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth } from "../firebase";
import { describeAuthError, describeGoogleError, missingScopes, GoogleApiName } from "../lib/rotasync";

let cachedWorkspaceToken: string | null = null;

/** Error with a plain title and next step, ready to show on the sync screen. */
export class WorkspaceError extends Error {
  title: string;
  ourSide: boolean;
  constructor(title: string, body: string, ourSide = false) {
    super(body);
    this.name = "WorkspaceError";
    this.title = title;
    this.ourSide = ourSide;
  }
}

async function failFromResponse(res: Response, api: GoogleApiName): Promise<never> {
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) cachedWorkspaceToken = null;
  const t = describeGoogleError(res.status, String(data?.error?.message || ""), api);
  throw new WorkspaceError(t.title, t.body, t.ourSide);
}

/**
 * Asks Google for Drive, Sheets and Calendar access for the account that is ALREADY signed in to ErMate.
 * It re-checks the signed-in account (it never switches to a different one), then confirms every box was ticked.
 */
export async function authenticateGoogleWorkspace(): Promise<string> {
  if (cachedWorkspaceToken) return cachedWorkspaceToken;
  const user = auth.currentUser;
  if (!user) throw new WorkspaceError("You are signed out.", "Sign in to ErMate and try again.");

  const provider = new GoogleAuthProvider();
  if (user.email) provider.setCustomParameters({ login_hint: user.email });
  provider.addScope("https://www.googleapis.com/auth/drive.readonly");
  provider.addScope("https://www.googleapis.com/auth/spreadsheets.readonly");
  provider.addScope("https://www.googleapis.com/auth/calendar.events");

  let token: string | undefined;
  try {
    const hasGoogle = user.providerData.some((p) => p.providerId === "google.com");
    const result = hasGoogle ? await reauthenticateWithPopup(user, provider) : await linkWithPopup(user, provider);
    token = GoogleAuthProvider.credentialFromResult(result)?.accessToken || undefined;
  } catch (err: any) {
    console.error("Auth error:", err);
    const t = describeAuthError(String(err?.code || ""));
    if (t) throw new WorkspaceError(t.title, t.body);
    throw new WorkspaceError("Could not connect to Google.", "Tap Try again. If it keeps happening, sign out and sign in to ErMate again.");
  }
  if (!token) throw new WorkspaceError("Google did not return access.", "Tap Try again and finish all the steps on the Google screen.");

  // Google lets people untick items one by one. Check all three were allowed.
  try {
    const info = await fetch("https://oauth2.googleapis.com/tokeninfo?access_token=" + encodeURIComponent(token));
    if (info.ok) {
      const miss = missingScopes(String((await info.json())?.scope || ""));
      if (miss.length > 0) {
        throw new WorkspaceError(
          `Google did not give ErMate access to your ${miss.join(", ")}.`,
          "Tap Try again, and on the Google screen tick Drive, Sheets and Calendar."
        );
      }
    }
  } catch (e) {
    if (e instanceof WorkspaceError) throw e; // network trouble on the check itself: carry on, the real calls will say
  }

  cachedWorkspaceToken = token;
  return token;
}

export function clearWorkspaceToken() {
  cachedWorkspaceToken = null;
}

export async function getRecentSpreadsheets(accessToken: string) {
  const url = `https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.spreadsheet'&orderBy=recency desc&pageSize=15&fields=files(id,name)`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) await failFromResponse(res, "drive");
  const data = await res.json();
  return data.files || [];
}

export async function getSpreadsheetData(accessToken: string, fileId: string) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values/A1:Z100`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) await failFromResponse(res, "sheets");
  const data = await res.json();
  return data.values || [];
}