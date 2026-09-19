import { initializeApp, getApps, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

export const FIRESTORE_DATABASE_ID: string =
  (firebaseConfig as any)?.firestoreDatabaseId ||
  "ai-studio-ermate-c85078ba-126c-43fd-b799-a4aa8b82bf03";

export const PROJECT_ID: string =
  (firebaseConfig as any)?.projectId || "ermate-e8f01";

if (!FIRESTORE_DATABASE_ID || FIRESTORE_DATABASE_ID === "(default)") {
  throw new Error(
    `[Firebase Admin] Fatal: Invalid or missing named database ID: "${FIRESTORE_DATABASE_ID}". Refusing to fall back to default database.`
  );
}

const app: App =
  getApps().length === 0
    ? initializeApp({
        projectId: PROJECT_ID,
      })
    : getApps()[0];

export const adminAuth = getAuth(app);
export const db: Firestore = getFirestore(app, FIRESTORE_DATABASE_ID);
