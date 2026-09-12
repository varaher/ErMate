import fetch from "node-fetch";

async function test() {
    const res = await fetch("https://api.sarvam.ai/speech-to-text/job/v1", {
        method: "POST",
        headers: {
            "api-subscription-key": "dummy",
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "saaras:v3",
            mode: "translate",
            // omitted language_code
        })
    });
    console.log(res.status, await res.text());
}
test();
