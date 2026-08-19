async function test() {
  try {
    const res = await fetch('http://localhost:3000/api/scribe-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userInput: "Thw pt came with fever cough running nose since today morning . His primary survery is within normal limits , VBG normal ecg /bed side echo not done ..signs same as explained rest all fine . Secondary survey all normal except for sinus tendeness. Investigation cbc crp , treatment injection paracetamol 1 gm iv stat ,ns 250 ml /hr . Dx is h1n1 , uri . Plan review reports symptomtomc treatment and discharge",
        chatHistory: [],
        existingCaseSheet: { id: 'C-test' },
        patientAgeYears: 30
      })
    });
    
    const text = await res.text();
    // console.log("RESPONSE:", text);
  } catch (err) {
    console.error("Test failed:", err);
  }
}

test();
