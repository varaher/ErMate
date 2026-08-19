import { initializeApp } from 'firebase/app';
import { getFirestore, collection } from 'firebase/firestore';
const app = initializeApp({ projectId: "test" });
const db = getFirestore(app);
try {
  collection(db, "cases", undefined, "scribeChatMessages");
} catch (e) {
  console.log("Error:", e.message);
}
