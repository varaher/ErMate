import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, getDoc, setLogLevel } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const dbId = (firebaseConfig as any).firestoreDatabaseId;
// Offline cache (IndexedDB): edits made offline or just before the phone kills the app are kept on the
// device and sent when the connection returns. Falls back to the default in-memory instance if
// IndexedDB is unavailable (private mode, blocked storage) or the instance was already created.
function createDb() {
  try {
    const settings = { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) };
    return dbId ? initializeFirestore(app, settings, dbId) : initializeFirestore(app, settings);
  } catch {
    return dbId ? getFirestore(app, dbId) : getFirestore(app);
  }
}
export const db = createDb();

// Set Firestore log level to silent to prevent noisy transient connection/offline warnings
setLogLevel('silent');

export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMsg = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.warn(`[Firestore Error - ${operationType}] (${path}):`, errMsg);

  // If client is offline or unavailable, do not throw fatal crash
  if (errMsg.includes('offline') || errMsg.includes('unavailable') || operationType === OperationType.LIST) {
    return;
  }

  throw new Error(JSON.stringify(errInfo));
}

