import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();
const SARVAM_API_BASE = "https://api.sarvam.ai";
const apiKey = process.env.SARVAM_AI_API_KEY || process.env.SARVAM_API_KEY;

async function testBatch() {
    const statusReq = await fetch(`${SARVAM_API_BASE}/speech-to-text/job/v1?job_id=abc`, {
        method: "GET",
        headers: { "api-subscription-key": apiKey }
    });
    console.log("Status Res 1:", statusReq.status, await statusReq.text());

    const statusReq2 = await fetch(`${SARVAM_API_BASE}/speech-to-text/job/v1/status/abc`, {
        method: "GET",
        headers: { "api-subscription-key": apiKey }
    });
    console.log("Status Res 2:", statusReq2.status, await statusReq2.text());
}
testBatch();
