const anthropicKey = process.env.ANTHROPIC_API_KEY;

async function listModels() {
    try {
        const res = await fetch("https://api.anthropic.com/v1/models", {
            method: "GET",
            headers: {
                "x-api-key": anthropicKey,
                "anthropic-version": "2023-06-01",
            }
        });
        const data = await res.json();
        console.log(JSON.stringify(data, null, 2));
    } catch(e) {
        console.error(e);
    }
}
listModels();
