import { db } from "./src/firebase";
import { doc, setDoc } from "firebase/firestore";

setDoc(doc(db, "test", "test"), { a: undefined })
  .then(() => console.log("Success"))
  .catch((e) => console.log("Failed:", e.message));
