const fs = require('fs');

async function test() {
  const url = "https://api.sarvam.ai/speech-to-text-translate";
  const formData = new FormData();
  // Provide a dummy 1KB wav file
  const buffer = Buffer.alloc(1024);
  const blob = new Blob([buffer], { type: 'audio/wav' });
  formData.append('file', blob, 'test.wav');
  formData.append('prompt', '');

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "api-subscription-key": process.env.SARVAM_API_KEY || "8953158c-c6cf-44b4-afba-28b9fb6c5c0d" },
      body: formData
    });
    console.log(res.status);
    console.log(await res.text());
  } catch (err) {
    console.error(err);
  }
}
test();
