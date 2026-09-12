import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const SARVAM_API_BASE = "https://api.sarvam.ai";
const apiKey = process.env.SARVAM_AI_API_KEY || process.env.SARVAM_API_KEY;

async function testBatch() {
    const initReq = await fetch(`${SARVAM_API_BASE}/speech-to-text/job/v1`, {
        method: "POST",
        headers: {
            "api-subscription-key": apiKey,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            job_parameters: {
                model: "saaras:v3",
                mode: "translate",
                // language_code omitted
            }
        })
    });

    if (!initReq.ok) {
        console.error("Job_parameters Attempt Failed:", initReq.status, await initReq.text());
        return;
    }

    console.log("Success:", await initReq.json());
}
testBatch();
