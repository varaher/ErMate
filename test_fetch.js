// Just checking if we can redefine fetch in node environment with a getter.
const obj = {};
Object.defineProperty(obj, 'fetch', { get: () => function fetch(){} });
try {
  obj.fetch = function customFetch(){};
} catch(e) {
  console.log("Direct assign failed:", e.message);
}
try {
  Object.defineProperty(obj, 'fetch', { value: function customFetch(){}, writable: true, configurable: true });
  console.log("defineProperty succeeded");
} catch (e) {
  console.log("defineProperty failed:", e.message);
}
