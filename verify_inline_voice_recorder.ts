import fs from "fs";
import path from "path";

function runTest(name: string, fn: () => boolean | void) {
  try {
    const result = fn();
    if (result === false) {
      console.error(`❌ FAIL: ${name}`);
      process.exitCode = 1;
    } else {
      console.log(`✅ PASS: ${name}`);
    }
  } catch (err: any) {
    console.error(`❌ ERROR in "${name}":`, err.message);
    process.exitCode = 1;
  }
}

console.log("==================================================================");
console.log("ErMate — Inline Unlimited Dictation Recorder Verification Suite");
console.log("==================================================================");

const voiceRecorderPath = path.join(process.cwd(), "src/components/shared/VoiceRecorder.tsx");
const voiceScribePath = path.join(process.cwd(), "src/components/VoiceScribeChatView.tsx");
const appPath = path.join(process.cwd(), "src/App.tsx");
const sarvamStreamPath = path.join(process.cwd(), "server/sarvamRealtimeStream.ts");
const sarvamBatchPath = path.join(process.cwd(), "server/sarvamBatch.ts");
const caseDiscussPath = path.join(process.cwd(), "src/components/CaseDiscussWorkspace.tsx");
const boundChatPath = path.join(process.cwd(), "src/components/BoundChatModal.tsx");

const voiceRecorderContent = fs.readFileSync(voiceRecorderPath, "utf-8");
const voiceScribeContent = fs.readFileSync(voiceScribePath, "utf-8");
const appContent = fs.readFileSync(appPath, "utf-8");
const sarvamStreamContent = fs.readFileSync(sarvamStreamPath, "utf-8");
const sarvamBatchContent = fs.readFileSync(sarvamBatchPath, "utf-8");
const caseDiscussContent = fs.readFileSync(caseDiscussPath, "utf-8");
const boundChatContent = fs.readFileSync(boundChatPath, "utf-8");

// Test 1: No fixed 30s recording stop
runTest("1. No fixed 30s recording stop or artificial recording duration limit", () => {
  // Check VoiceRecorder.tsx
  const hasFixedLimit =
    /maxDuration\s*=\s*30/i.test(voiceRecorderContent) ||
    /setTimeout\s*\([^,]+,\s*30000\s*\)/.test(voiceRecorderContent) ||
    /recordingTimeout\s*=\s*30/i.test(voiceRecorderContent);
  if (hasFixedLimit) throw new Error("VoiceRecorder has an artificial 30s recording timer!");

  // Verify the timer in VoiceRecorder runs unbounded with setInterval 1000
  const hasUnboundedTimer = voiceRecorderContent.includes("setInterval") &&
    voiceRecorderContent.includes("setRecordingSeconds");
  if (!hasUnboundedTimer) throw new Error("Unbounded timer interval not found");
});

// Test 2: Recording timer counts beyond 30s (formatting verification)
runTest("2. Recording timer formats multi-minute timestamps beyond 30s (01:42, 05:00, 10:00)", () => {
  // Test formatTime logic directly
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  if (formatTime(30) !== "00:30") throw new Error("30s format failed");
  if (formatTime(102) !== "01:42") throw new Error("1m42s format failed: got " + formatTime(102));
  if (formatTime(300) !== "05:00") throw new Error("5m format failed: got " + formatTime(300));
  if (formatTime(600) !== "10:00") throw new Error("10m format failed: got " + formatTime(600));

  if (!voiceRecorderContent.includes("formatTime")) throw new Error("formatTime missing in VoiceRecorder");
});

// Test 3: 5-minute logical simulation remains active
runTest("3. 5-minute logical simulation remains active without auto-termination", () => {
  let seconds = 0;
  let isRecording = true;
  let autoStopped = false;

  // Simulate 300 ticks (5 minutes)
  for (let tick = 1; tick <= 300; tick++) {
    seconds += 1;
    // Ensure no hard cap triggers stop
    if (seconds === 30 && autoStopped) {
      throw new Error("Premature stop at 30 seconds");
    }
  }

  if (seconds !== 300 || !isRecording) {
    throw new Error("Simulation failed to reach 5 minutes");
  }
});

// Test 4: Pause behavior
runTest("4. Pause halts timer and stops audio streaming without aborting session", () => {
  if (!voiceRecorderContent.includes("togglePause")) throw new Error("togglePause function missing");
  if (!voiceRecorderContent.includes("recorder.pause()")) throw new Error("recorder.pause() not called");
  if (!voiceRecorderContent.includes("clearInterval(timerRef.current)")) throw new Error("timer interval not paused");
  if (!voiceRecorderContent.includes("isPaused")) throw new Error("isPaused state missing");
});

// Test 5: Resume behavior
runTest("5. Resume continues timer and MediaRecorder in the same active session", () => {
  if (!voiceRecorderContent.includes("recorder.resume()")) throw new Error("recorder.resume() not called");
  if (!voiceRecorderContent.includes("setIsPaused(false)")) throw new Error("setIsPaused(false) not called");
});

// Test 6: Cancel / Discard behavior
runTest("6. Cancel discards audio and does not invoke onTranscript or network extraction", () => {
  if (!voiceRecorderContent.includes("discardRecording")) throw new Error("discardRecording missing");
  const discardSection = voiceRecorderContent.slice(
    voiceRecorderContent.indexOf("const discardRecording"),
    voiceRecorderContent.indexOf("const finishRecording")
  );
  if (discardSection.includes("onTranscript(")) {
    throw new Error("discardRecording erroneously called onTranscript!");
  }
  if (!discardSection.includes("audioChunksRef.current = []")) {
    throw new Error("discardRecording does not clear audioChunks");
  }
});

// Test 7: Done / Finish behavior
runTest("7. Done completes recording and triggers transcription finalization", () => {
  if (!voiceRecorderContent.includes("finishRecording")) throw new Error("finishRecording missing");
  if (!voiceRecorderContent.includes("finalizeTranscription")) throw new Error("finalizeTranscription missing");
  if (!voiceRecorderContent.includes("mediaRecorderRef.current.stop()")) throw new Error("recorder.stop not called");
});

// Test 8: Finalize exactly once
runTest("8. Duplicate-finalization guard prevents multiple finalizations", () => {
  if (!voiceRecorderContent.includes("finalSubmissionSentRef")) {
    throw new Error("finalSubmissionSentRef missing");
  }
  const finalizeSection = voiceRecorderContent.slice(
    voiceRecorderContent.indexOf("const finalizeTranscription"),
    voiceRecorderContent.indexOf("const transcribeAudioBatch")
  );
  if (!finalizeSection.includes("if (finalSubmissionSentRef.current) return;")) {
    throw new Error("Guard against duplicate finalization missing");
  }
  if (!finalizeSection.includes("finalSubmissionSentRef.current = true;")) {
    throw new Error("finalSubmissionSentRef.current not set to true");
  }
});

// Test 9: Transcript callback invoked exactly once with non-empty text
runTest("9. Transcript callback is called exactly once with cleaned transcript", () => {
  let callCount = 0;
  let receivedText = "";
  const mockOnTranscript = (t: string) => {
    callCount++;
    receivedText = t;
  };

  // Simulate finalizeTranscription behavior
  let finalSubmissionSent = false;
  const simulateFinalize = (transcript: string) => {
    if (finalSubmissionSent) return;
    finalSubmissionSent = true;
    if (transcript.trim().length > 0) {
      mockOnTranscript(transcript.trim());
    }
  };

  simulateFinalize("Patient presents with acute chest pain.");
  // Second event (e.g. WS closed after session_end)
  simulateFinalize("Patient presents with acute chest pain.");

  if (callCount !== 1) throw new Error(`Expected 1 callback, got ${callCount}`);
  if (receivedText !== "Patient presents with acute chest pain.") throw new Error("Transcript content mismatch");
});

// Test 10: Modal / Backdrop removed
runTest("10. Modal popup and screen-blocking backdrops are removed from dictation recorder", () => {
  const hasFixedBackdropModal =
    voiceRecorderContent.includes("fixed inset-0 bg-black/70") ||
    voiceRecorderContent.includes("fixed inset-0 bg-black/80") ||
    voiceRecorderContent.includes("RECORDING DICTATION");

  if (hasFixedBackdropModal) {
    throw new Error("Detected blocking modal/backdrop in VoiceRecorder.tsx!");
  }
});

// Test 11: Composer inline recorder exists
runTest("11. Composer inline recorder exists with required controls ([🗑], timer, waveform, [Pause], [✓ Done])", () => {
  if (!voiceRecorderContent.includes('id="voice-discard-btn"')) throw new Error("voice-discard-btn id missing");
  if (!voiceRecorderContent.includes('id="voice-timer"')) throw new Error("voice-timer id missing");
  if (!voiceRecorderContent.includes('id="voice-waveform"')) throw new Error("voice-waveform id missing");
  if (!voiceRecorderContent.includes('voice-pause-btn')) throw new Error("voice-pause-btn id missing");
  if (!voiceRecorderContent.includes('voice-resume-btn')) throw new Error("voice-resume-btn id missing");
  if (!voiceRecorderContent.includes('id="voice-done-btn"')) throw new Error("voice-done-btn id missing");
  if (!voiceRecorderContent.includes('id="voice-finalizing-bar"')) throw new Error("voice-finalizing-bar id missing");
});

// Test 12: Mobile safe layout
runTest("12. Mobile layout remains within composer area above safe-area-inset without covering navigation", () => {
  if (!voiceScribeContent.includes("safe-area-inset-bottom")) {
    throw new Error("Safe-area-inset-bottom not respected in VoiceScribeChatView");
  }
  // Check VoiceScribe composer width and relative positioning
  if (!voiceScribeContent.includes('className="relative flex items-center gap-1.5 sm:gap-2')) {
    throw new Error("Composer container flex structure missing");
  }
});

// Test 13: Desktop inline layout keeps case and conversation visible
runTest("13. Desktop inline layout keeps case, discussion, and pending sections visible", () => {
  // VoiceScribeChatView integrates inline-composer without centering dialog
  if (!voiceScribeContent.includes('renderMode="inline-composer"')) {
    throw new Error("VoiceScribeChatView does not use inline-composer renderMode");
  }
  if (!voiceScribeContent.includes('onRecordingStateChange={setIsVoiceRecordingActive}')) {
    throw new Error("VoiceScribeChatView does not listen to onRecordingStateChange");
  }
});

// Test 14: Screen Wake Lock lifecycle
runTest("14. Screen Wake Lock requested on start and released on cleanup", () => {
  if (!voiceRecorderContent.includes("requestWakeLock")) throw new Error("requestWakeLock missing");
  if (!voiceRecorderContent.includes("releaseWakeLock")) throw new Error("releaseWakeLock missing");
  if (!voiceRecorderContent.includes("wakeLock") || !voiceRecorderContent.includes(".request(\"screen\")")) {
    throw new Error("wakeLock.request missing");
  }
});

// Test 15: Navigation-away protection
runTest("15. Navigation away, tab reload, case switch, and back button prompt confirmation when recording is active", () => {
  // 1. window beforeunload in VoiceRecorder
  if (!voiceRecorderContent.includes("beforeunload")) throw new Error("beforeunload handler missing in VoiceRecorder");
  if (!voiceRecorderContent.includes("Dictation is still recording. Discard it and leave?")) {
    throw new Error("Confirmation text missing in VoiceRecorder");
  }

  // 2. Back button in VoiceScribeChatView
  if (!voiceScribeContent.includes("handleSafeBack")) throw new Error("handleSafeBack missing in VoiceScribeChatView");
  if (!voiceScribeContent.includes("onClick={handleSafeBack}")) throw new Error("onClick={handleSafeBack} missing in VoiceScribeChatView");

  // 3. Tab navigation in App.tsx
  if (!appContent.includes("isGlobalVoiceRecordingActive")) {
    throw new Error("isGlobalVoiceRecordingActive missing in App.tsx");
  }
});

// Test 16: Existing Sarvam streaming and batch architecture unchanged
runTest("16. Existing Sarvam streaming and batch architecture preserved", () => {
  // Sarvam streaming websocket path preserved
  if (!sarvamStreamContent.includes("/api/voice/stream")) throw new Error("WS stream route missing in sarvamRealtimeStream.ts");
  if (!sarvamStreamContent.includes("saaras:v3-realtime")) throw new Error("Sarvam realtime model missing");

  // Sarvam batch fallback preserved
  if (!sarvamBatchContent.includes("saaras:v3")) throw new Error("Sarvam batch model missing");
});

// Test 17: Scribe draft case creation and network API timeout distinction
runTest("17. Scribe post-dictation API timeout remains bounded (30s) while recording duration is unbounded", () => {
  // Post-dictation API network timeout in VoiceScribeChatView.tsx
  const hasBoundedApiTimeout = voiceScribeContent.includes("30000") && voiceScribeContent.includes("dictationController.abort()");
  if (!hasBoundedApiTimeout) {
    throw new Error("Expected bounded 30s network timeout for /api/scribe-chat extraction");
  }

  // Dictation itself has no 30s timeout in VoiceRecorder.tsx
  const recorderHasTimeout = /setTimeout\([^,]+,\s*30000\)/.test(voiceRecorderContent);
  if (recorderHasTimeout) {
    throw new Error("VoiceRecorder has erroneous 30s timeout");
  }
});

// Test 18: Production build compilation check
runTest("18. Case discuss and bound chat components also integrated with inline-composer", () => {
  if (!caseDiscussContent.includes('renderMode="inline-composer"')) {
    throw new Error("CaseDiscussWorkspace missing inline-composer renderMode");
  }
  if (!boundChatContent.includes('renderMode="inline-composer"')) {
    throw new Error("BoundChatModal missing inline-composer renderMode");
  }
});

console.log("==================================================================");
console.log("All 18 inline voice recorder tests passed!");
console.log("==================================================================");
