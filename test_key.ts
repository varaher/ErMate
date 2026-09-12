import dotenv from "dotenv";
dotenv.config();

const apiKey = process.env.SARVAM_API_KEY;
console.log(`SARVAM_API_KEY present: ${!!apiKey}`);

import fetch from "node-fetch";
const SARVAM_API_BASE = "https://api.sarvam.ai";

async function testBatch() {
    try {
        const initReq = await fetch(`${SARVAM_API_BASE}/speech-to-text/job/v1`, {
            method: "POST",
            headers: {
                "api-subscription-key": apiKey || "",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                job_parameters: {
                    model: "saaras:v3",
                    mode: "translate"
                }
            })
        });
        
        console.log(`HTTP status: ${initReq.status}`);
        const resBody = await initReq.text();
        console.log(`Sanitized response body: ${resBody}`);
        
        if (initReq.ok) {
            const initRes = JSON.parse(resBody);
            console.log(`Job ID returned: ${!!initRes.job_id}`);
        } else {
            console.log(`Job ID returned: false`);
        }
    } catch (err: any) {
        console.error("Test failed:", err.message);
    }
}

testBatch();
