const formData = new FormData();
// create a 2MB buffer
const buf = new Uint8Array(2 * 1024 * 1024).fill(0);
const blob = new Blob([buf], { type: "audio/webm" });
formData.append("file", blob, "test.webm");

fetch("http://localhost:3000/api/voice/transcribe", {
  method: "POST",
  body: formData
}).then(async res => {
  console.log("Status:", res.status);
  console.log("Headers:", res.headers.get("content-type"));
  const text = await res.text();
  console.log("Response:", text.substring(0, 200));
}).catch(console.error);
