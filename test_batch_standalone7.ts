import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();
const SARVAM_API_BASE = "https://api.sarvam.ai";
const apiKey = process.env.SARVAM_AI_API_KEY || process.env.SARVAM_API_KEY;
const jobId = "20260912_7fdc649e-1058-4351-a1b0-a949bdb03cbc";

async function testBatch() {
    // Status 1
    let statusReq = await fetch(`${SARVAM_API_BASE}/speech-to-text/job/v1/${jobId}/status`, {
        method: "GET",
        headers: { "api-subscription-key": apiKey }
    });
    console.log("Status Res 1:", statusReq.status, await statusReq.text());
}
testBatch();
