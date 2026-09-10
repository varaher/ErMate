require('dotenv').config();
const anthropicKey = process.env.ANTHROPIC_API_KEY;

async function test() {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: "claude-3-haiku-20240307",
          max_tokens: 10,
          messages: [{ role: "user", content: "Hi" }]
        })
    });
    console.log(res.status, await res.text());
}
test();
