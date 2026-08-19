async function test() {
  try {
    const res = await fetch('http://localhost:3000/api/ai-discharge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseData: { patient: { name: "Test" } }
      })
    });
    
    const text = await res.text();
    console.log("RESPONSE:", res.status, text);
  } catch (err) {
    console.error("Test failed:", err);
  }
}

test();
