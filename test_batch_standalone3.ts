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

    // Upload Files
    const uploadReq = await fetch(`${SARVAM_API_BASE}/speech-to-text/job/v1/upload-files`, {
        method: "POST",
        headers: { "api-subscription-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
            job_id: jobId,
            files: ["audio.webm"]
        })
    });
    
    if (!uploadReq.ok) {
        console.error("Upload URL request failed", uploadReq.status, await uploadReq.text());
        return;
    }
    const uploadRes = await uploadReq.json();
    console.log("Upload Res:", uploadRes);
}
testBatch();
