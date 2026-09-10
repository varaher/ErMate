require('dotenv').config();
const anthropicKey = process.env.ANTHROPIC_API_KEY;
if (!anthropicKey) {
  console.log("No key");
  process.exit(0);
}

const models = [
  "claude-3-7-sonnet-20250219",
  "claude-3-5-sonnet-20241022",
  "claude-3-5-sonnet-20240620",
  "claude-3-sonnet-20240229",
  "claude-3-5-sonnet-latest",
  "claude-3-7-sonnet-latest"
];

async function test() {
  for (const m of models) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: m,
          max_tokens: 10,
          messages: [{ role: "user", content: "Hi" }]
        })
    });
    console.log(m, res.status);
  }
}
test();
