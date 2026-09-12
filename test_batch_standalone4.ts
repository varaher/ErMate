import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();
const SARVAM_API_BASE = "https://api.sarvam.ai";
const apiKey = process.env.SARVAM_AI_API_KEY || process.env.SARVAM_API_KEY;

async function testBatch() {
    const initReq = await fetch(`${SARVAM_API_BASE}/speech-to-text/job/v1`, {
        method: "POST",
        headers: { "api-subscription-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
            job_parameters: { model: "saaras:v3", mode: "translate" }
        })
    });
    const jobId = (await initReq.json()).job_id;

    // Start 
    const startReq = await fetch(`${SARVAM_API_BASE}/speech-to-text/job/v1/${jobId}/start`, {
        method: "POST",
        headers: { "api-subscription-key": apiKey, "Content-Type": "application/json" }
    });
    console.log("Start Res:", startReq.status, await startReq.text());

    // Status
    const statusReq = await fetch(`${SARVAM_API_BASE}/speech-to-text/job/v1/${jobId}`, {
        method: "GET",
        headers: { "api-subscription-key": apiKey, "Content-Type": "application/json" }
    });
    console.log("Status Res:", statusReq.status, await statusReq.json());
}
testBatch();
