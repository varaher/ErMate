import fetch from "node-fetch";
import dotenv from "dotenv";
import fs from "fs";

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
    console.log("Job ID:", jobId);

    // Upload Files
    const uploadReq = await fetch(`${SARVAM_API_BASE}/speech-to-text/job/v1/upload-files`, {
        method: "POST",
        headers: { "api-subscription-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
            job_id: jobId,
            files: ["audio.webm"]
        })
    });
    const uploadUrl = (await uploadReq.json()).upload_urls["audio.webm"].file_url;
    console.log("Upload URL:", uploadUrl);

    // Put Audio
    const audioBuffer = Buffer.from("RIFF..."); // dummy
    const putReq = await fetch(uploadUrl, { method: "PUT", body: audioBuffer, headers: { "x-ms-blob-type": "BlockBlob" } }); // Some Azure storage requires x-ms-blob-type
    if(!putReq.ok) {
         console.log("PUT failed", putReq.status, await putReq.text());
    } else {
         console.log("PUT success");
    }

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
    console.log("Status Res:", statusReq.status, await statusReq.text());
}
testBatch();
