import {
  collection, query,
  onSnapshot, getDocFromServer, doc,
  SnapshotMetadata, clearIndexedDbPersistence
} from 'firebase/firestore';
import { db } from '../firebase';

export function debugSync(
  dbInstance: any,
  currentUser: any,
  collectionName: string,
  queryConstraints: any[]
) {
  console.group(`🔍 [SyncDebug] ${collectionName}`);
  console.log('User UID:', currentUser?.uid);
  console.log('Platform:', /Mobi/.test(navigator.userAgent) ? 'MOBILE' : 'DESKTOP');
  console.log('Time:', new Date().toISOString());

  const q = query(
    collection(dbInstance, collectionName),
    ...queryConstraints
  );

  const unsubscribe = onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snapshot) => {
      const meta: SnapshotMetadata = snapshot.metadata;

      console.group('📦 Snapshot received');
      console.log('Source:', meta.fromCache ? '⚠️ CACHE' : '✅ SERVER');
      console.log('Has pending writes:', meta.hasPendingWrites);
      console.log('Doc count:', snapshot.docs.length);
      console.log('Is empty:', snapshot.empty);

      snapshot.docs.forEach((d, i) => {
        const data = d.data();
        console.group(`Doc ${i}: ${d.id}`);
        console.log('updatedAt:', data.updatedAt?.toDate?.() || data.updatedAt || 'NOT SET');
        console.log('createdBy:', data.createdBy);
        console.log('Data preview:', JSON.stringify(data).slice(0, 200));
        console.groupEnd();
      });

      if (meta.fromCache) {
        console.warn(
          '⚠️ DATA IS FROM CACHE — not server.',
          'If this persists after network is ready, offline persistence may be stale.'
        );
      }

      console.groupEnd();
    },
    (error) => {
      console.error('❌ Snapshot error:', error);
    }
  );

  // Force a server fetch comparison
  setTimeout(async () => {
    console.group('🌐 Force server fetch comparison');
    try {
      const serverSnap = await getDocFromServer(
        doc(dbInstance, collectionName, 'test_doc_id')
      );
      console.log('Server doc exists:', serverSnap.exists());
      console.log('Server updatedAt:', serverSnap.data()?.updatedAt?.toDate?.());
    } catch (err: any) {
      console.log('Server fetch error:', err.message);
    }
    console.groupEnd();
  }, 2000);

  return unsubscribe;
}

export async function clearFirestoreCache() {
  try {
    await clearIndexedDbPersistence(db);
    console.log('[Firestore] Cache cleared successfully');
    window.location.reload();
  } catch (err) {
    console.error('[Firestore] Clear cache failed:', err);
  }
}

// Attach to window object for runtime console debugging
if (typeof window !== 'undefined') {
  (window as any).clearFirestoreCache = clearFirestoreCache;
}
