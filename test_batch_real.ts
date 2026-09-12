import { sarvamBatchTranscribe } from "./server/sarvamBatch.js";
import fs from "fs";
import { execSync } from "child_process";

// Generate a real audio file with espeak to test Sarvam translation/transcription
execSync("espeak -w test_speech.wav 'Patient received one gram paracetamol intravenously and was shifted to ICU.'");
// Convert it to webm to simulate browser MediaRecorder output
execSync("ffmpeg -y -i test_speech.wav -c:a libopus dummy_real.webm");

const buffer = fs.readFileSync("dummy_real.webm");

async function run() {
    try {
        console.log("Running batch transcription test on real webm...");
        const result = await sarvamBatchTranscribe(buffer, "dummy_real.webm", "translate");
        console.log("Success! Transcript non-empty:", result.transcript.length > 0);
        console.log("Transcript preview:", result.transcript.substring(0, 50));
    } catch (err: any) {
        console.log("Failed with error:", err.message);
    }
}
run();
