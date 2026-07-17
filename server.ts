import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import multer from "multer";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

const upload = multer({ storage: multer.memoryStorage() });

// Lazy initializer for Google GenAI
let aiInstance: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
    throw new Error("GEMINI_API_KEY is not configured. Please add your Gemini API key in the Secrets panel in AI Studio.");
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiInstance;
}

// API Routes

// Health Check
app.get("/api/health", (req, res) => {
  const hasKey = !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY";
  const hasSarvamKey = !!process.env.SARVAM_API_KEY && process.env.SARVAM_API_KEY !== "MY_SARVAM_API_KEY";
  res.json({ status: "ok", geminiConfigured: hasKey, sarvamConfigured: hasSarvamKey });
});

// Sarvam AI Speech-to-Text (ASR)
// Helper for shared transcription logic (Layer 3)
async function performTranscription(file: Express.Multer.File, languageCode: string, model: string): Promise<{ success: boolean; transcript: string; method: string }> {
  const sarvamKey = process.env.SARVAM_API_KEY;

  // Reject files smaller than 5KB (Validation: Audio capture too short)
  if (file.size < 5 * 1024) {
    throw new Error("Audio capture too short. Please dictate for a longer duration.");
  }

  // Force Gemini fallback if file size > 900KB (Sarvam hard limit) OR Sarvam API key not set
  const useGeminiFallback = file.size > 900 * 1024 || !sarvamKey || sarvamKey === "MY_SARVAM_API_KEY" || sarvamKey.trim() === "";

  if (useGeminiFallback) {
    console.log(`[Transcription] Routing to Gemini (size: ${file.size} bytes, hasSarvamKey: ${!!sarvamKey})`);
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          inlineData: {
            mimeType: file.mimetype || "audio/webm",
            data: file.buffer.toString("base64"),
          },
        },
        `You are an expert medical transcriptionist. Transcribe the following clinical voice dictation. Translate any non-English Indian language portions into clean, professional clinical medical English. Return ONLY the transcription with no conversational preamble or extra text.`,
      ],
    });

    return {
      success: true,
      transcript: response.text?.trim() || "",
      method: "gemini"
    };
  }

  // Attempt Sarvam API transcription
  try {
    console.log(`[Transcription] Querying Sarvam Speech-to-Text (model: ${model}, lang: ${languageCode})`);
    const formData = new globalThis.FormData();
    const audioBlob = new globalThis.Blob([file.buffer], { type: file.mimetype || "audio/webm" });
    formData.append("file", audioBlob, file.originalname || "recording.webm");
    formData.append("model", model);
    formData.append("language_code", languageCode);

    // Call modern Sarvam speech-to-text endpoint
    const response = await fetch("https://api.sarvam.ai/speech-to-text", {
      method: "POST",
      headers: {
        "api-subscription-key": sarvamKey
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Sarvam API status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    let transcript = data.transcript || data.transcription || "";

    // Translate to English using Gemini if language is an Indian language (non en-IN)
    if (languageCode !== "en-IN" && transcript.trim()) {
      try {
        const ai = getAI();
        const translatePrompt = `Translate the following clinical dictation transcript into professional, standard clinical English. Keep all medical terms intact and preserve all details. Do not add explanations or headers.

Transcript: "${transcript}"`;
        const translationRes = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: translatePrompt,
        });
        transcript = translationRes.text?.trim() || transcript;
      } catch (transError) {
        console.warn("Failed to translate Sarvam transcript to English via Gemini:", transError);
      }
    }

    return {
      success: true,
      transcript,
      method: "sarvam"
    };
  } catch (sarvamError: any) {
    console.warn(`Sarvam transcription failed: ${sarvamError.message}. Falling back automatically to Gemini.`);
    
    // Automatic fallback to Gemini Audio Transcription on Sarvam failures
    try {
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          {
            inlineData: {
              mimeType: file.mimetype || "audio/webm",
              data: file.buffer.toString("base64"),
            },
          },
          `You are an expert medical transcriptionist. Transcribe the following clinical voice dictation. Translate any non-English Indian language portions into clean, professional clinical medical English. Return ONLY the transcription with no conversational preamble or extra text.`,
        ],
      });

      return {
        success: true,
        transcript: response.text?.trim() || "",
        method: "gemini_fallback"
      };
    } catch (geminiError: any) {
      console.error("Gemini fallback transcription also failed:", geminiError);
      throw new Error(`ASR transcription failed on all systems. ${sarvamError.message}`);
    }
  }
}

// 4a. Legacy endpoint proxy (Layer 3 compliant)
app.post("/api/sarvam-asr", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: "No audio file provided." });
  }

  const model = req.body.model || "saaras:v3";
  const language_code = req.body.language_code || "en-IN";

  try {
    const result = await performTranscription(req.file, language_code, model);
    res.json(result);
  } catch (error: any) {
    console.error("ASR Controller Error:", error);
    res.status(error.message.includes("too short") ? 400 : 500).json({
      success: false,
      error: error.message || "An error occurred during speech transcription."
    });
  }
});

// 4b. Upgraded Unified Transcription Endpoint (Layer 3)
app.post("/api/voice/transcribe", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: "No audio file provided." });
  }

  const model = req.body.model || "saaras:v3";
  const language_code = req.body.language_code || "en-IN";

  try {
    const result = await performTranscription(req.file, language_code, model);
    res.json(result);
  } catch (error: any) {
    console.error("ASR Controller Error:", error);
    res.status(error.message.includes("too short") ? 400 : 500).json({
      success: false,
      error: error.message || "An error occurred during speech transcription."
    });
  }
});

// 4c. Upgraded Post-processing Clinical Scribe Extractor with Credit Check (Layer 4)
app.post("/api/voice/extract-clinical", async (req, res) => {
  const { dictation, aiCredits } = req.body;

  if (!dictation || !dictation.trim()) {
    return res.status(400).json({ success: false, error: "Dictation content is empty." });
  }

  // Credit Gating Validation
  if (aiCredits === undefined || aiCredits === null || Number(aiCredits) < 1) {
    return res.status(403).json({ 
      success: false, 
      error: "Insufficient AI scribe credits. Please refill your credits in the Team & Billing settings." 
    });
  }

  try {
    const ai = getAI();
    const prompt = `
      You are an elite Emergency Medicine Scribe.
      Analyze the following continuous voice dictation (or clinician notes) and extract as much structured medical information as possible to fill out an emergency department case sheet.
      
      DICTATED TEXT:
      "${dictation}"

      Extract and map the details to the following JSON structure. If any field is not mentioned, provide a reasonable blank string or null.
      
      Demographics:
      - patientName: string (default "Unidentified Patient" if not mentioned)
      - age: number or null (e.g. 45 or null)
      - gender: string (must be exactly "Male", "Female", or "Other")
      - presentingComplaint: string (what complaints the patient presented with)
      - triageCategory: string (must be exactly "P1 (Immediate)", "P2 (Urgent)", or "P3 (Non-Urgent)". Infer from vitals/complaint if not explicitly specified. Red flags are P1, moderate is P2, minor is P3)
      - caseType: string (must be exactly "Medical" or "Trauma")
      - arrivalMode: string (must be exactly "Walk-in", "Ambulance", or "Referred")

      Vitals:
      - bp: string (e.g. "120/80")
      - hr: string (e.g. "88")
      - spo2: string (e.g. "97")
      - rr: string (e.g. "18")
      - temp: string (e.g. "37.1")
      - gcs: string (composite out of 15, default "15")
      - grbs: string (blood glucose, e.g. "110" or "")
      - painScore: string (0-10, e.g. "6")

      SAMPLE History:
      - symptoms: string (detailed signs and symptoms)
      - allergies: string (e.g. "Penicillin" or "NKDA" or "None")
      - medications: string (outpatient meds)
      - pastHistory: string (chronic conditions, previous surgeries)
      - lastMeal: string (last oral intake time/type)
      - events: string (preceding circumstances)

      Primary Assessment (ABCDE):
      - airway: string (description of airway findings)
      - airwayStatus: string (either "Normal" or "Abnormal")
      - breathing: string (breathing assessment, e.g., clear bilateral chest)
      - breathingStatus: string (either "Normal" or "Abnormal")
      - circulation: string (pulses, capillary refill, skin turgor)
      - circulationStatus: string (either "Normal" or "Abnormal")
      - disability: string (pupils, orientation, power)
      - disabilityStatus: string (either "Normal" or "Abnormal")
      - exposure: string (rashes, trauma signs, temperature check)
      - exposureStatus: string (either "Normal" or "Abnormal")

      Secondary Assessment:
      - secondaryAssessment: string (head-to-toe or systemic exam findings)
      
      ProgressNotes:
      - progressNotes: string (notes about clinical course or plan)
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are an expert ER scribe. Extract clinician notes into structured emergency medicine records. Only return valid JSON matching the schema.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            patientName: { type: Type.STRING },
            age: { type: Type.INTEGER, nullable: true },
            gender: { type: Type.STRING },
            presentingComplaint: { type: Type.STRING },
            triageCategory: { type: Type.STRING },
            caseType: { type: Type.STRING },
            arrivalMode: { type: Type.STRING },
            vitals: {
              type: Type.OBJECT,
              properties: {
                bp: { type: Type.STRING },
                hr: { type: Type.STRING },
                spo2: { type: Type.STRING },
                rr: { type: Type.STRING },
                temp: { type: Type.STRING },
                gcs: { type: Type.STRING },
                grbs: { type: Type.STRING },
                painScore: { type: Type.STRING }
              }
            },
            sampleHistory: {
              type: Type.OBJECT,
              properties: {
                symptoms: { type: Type.STRING },
                allergies: { type: Type.STRING },
                medications: { type: Type.STRING },
                pastHistory: { type: Type.STRING },
                lastMeal: { type: Type.STRING },
                events: { type: Type.STRING }
              }
            },
            primaryAssessment: {
              type: Type.OBJECT,
              properties: {
                airway: { type: Type.STRING },
                airwayStatus: { type: Type.STRING },
                breathing: { type: Type.STRING },
                breathingStatus: { type: Type.STRING },
                circulation: { type: Type.STRING },
                circulationStatus: { type: Type.STRING },
                disability: { type: Type.STRING },
                disabilityStatus: { type: Type.STRING },
                exposure: { type: Type.STRING },
                exposureStatus: { type: Type.STRING }
              }
            },
            secondaryAssessment: { type: Type.STRING },
            progressNotes: { type: Type.STRING }
          },
          required: [
            "patientName", "age", "gender", "presentingComplaint", "triageCategory", "caseType", "arrivalMode",
            "vitals", "sampleHistory", "primaryAssessment", "secondaryAssessment", "progressNotes"
          ]
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    res.json({ 
      success: true, 
      data, 
      remainingCredits: Number(aiCredits) - 1 
    });
  } catch (error: any) {
    console.error("Clinical Extraction Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to extract clinical fields." });
  }
});

// Sarvam AI Text-to-Speech (TTS)
app.post("/api/sarvam-tts", async (req, res) => {
  const { text, language_code, speaker, model } = req.body;
  const sarvamKey = process.env.SARVAM_API_KEY;

  if (!text || !text.trim()) {
    return res.status(400).json({ success: false, error: "Text content is empty." });
  }

  const targetLang = language_code || "en-IN";
  const ttsSpeaker = speaker || "meera";
  const ttsModel = model || "bulbul:v1";

  // Fallback / simulation if key is not configured
  if (!sarvamKey || sarvamKey === "MY_SARVAM_API_KEY" || sarvamKey.trim() === "") {
    console.warn("SARVAM_API_KEY is not configured. Returning mock base64 audio.");
    const mockWavBase64 = "UklGRiQAAABXQVZFRm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
    return res.json({
      success: true,
      audio: mockWavBase64,
      simulated: true,
      info: "Sarvam AI API key not set; returned a simulated audio response."
    });
  }

  try {
    const response = await fetch("https://api.sarvam.ai/v1/speech/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-subscription-key": sarvamKey
      },
      body: JSON.stringify({
        inputs: [text],
        target_language_code: targetLang,
        speaker: ttsSpeaker,
        model: ttsModel
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Sarvam TTS responded with status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const audioBase64 = data.audios && data.audios[0] ? data.audios[0] : "";
    
    res.json({
      success: true,
      audio: audioBase64,
      simulated: false
    });
  } catch (error: any) {
    console.error("Sarvam TTS Error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "An error occurred during text-to-speech synthesis."
    });
  }
});

// 1. AI Clinical Decision Support (CDS) / Differential Diagnosis
app.post("/api/clinical-decision-support", async (req, res) => {
  const { patient, history, vitals, primaryAssessment } = req.body;

  try {
    const ai = getAI();
    const prompt = `
      You are an Emergency Medicine expert Clinical Decision Support assistant.
      Analyze the following patient data and generate a list of 3-5 potential differential diagnoses.
      Label each as "CONSISTENT", "POSSIBLE", or "LESS LIKELY".
      Provide brief medical reasoning, citations (e.g. PubMed, WikEM, PALS/ATLS guidelines), and suggested next steps (investigations/treatment).

      Patient Demographics & Complaint:
      - Name: ${patient?.name || "Unknown"}
      - Age: ${patient?.age || "Unknown"} years
      - Gender: ${patient?.gender || "Unknown"}
      - Presenting Complaint: ${patient?.presentingComplaint || "Not specified"}
      - Triage Category: ${patient?.triageCategory || "Not specified"}

      Vitals:
      - BP: ${vitals?.bp || "Not recorded"}
      - HR: ${vitals?.hr || "Not recorded"} bpm
      - SpO2: ${vitals?.spo2 || "Not recorded"}%
      - RR: ${vitals?.rr || "Not recorded"} /min
      - Temp: ${vitals?.temp || "Not recorded"}°C
      - GCS: ${vitals?.gcs || "Not recorded"}

      History (SAMPLE):
      - Signs & Symptoms: ${history?.symptoms || "Not recorded"}
      - Allergies: ${history?.allergies || "Not recorded"}
      - Medications: ${history?.medications || "Not recorded"}
      - Past History: ${history?.pastHistory || "Not recorded"}
      - Last Meal: ${history?.lastMeal || "Not recorded"}
      - Events: ${history?.events || "Not recorded"}

      Primary Assessment (ABCDE):
      - Airway: ${primaryAssessment?.airway || "Not recorded"}
      - Breathing: ${primaryAssessment?.breathing || "Not recorded"}
      - Circulation: ${primaryAssessment?.circulation || "Not recorded"}
      - Disability: ${primaryAssessment?.disability || "Not recorded"}
      - Exposure: ${primaryAssessment?.exposure || "Not recorded"}
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are a clinical decision support system for emergency room physicians. Only return valid JSON matching the schema.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              diagnosis: { type: Type.STRING, description: "Name of the differential diagnosis" },
              status: { type: Type.STRING, description: "CONSISTENT, POSSIBLE, or LESS LIKELY" },
              reasoning: { type: Type.STRING, description: "Brief evidence-based reasoning in 2-3 sentences" },
              citations: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "Guideline reference citations (e.g. WikEM, PALS, ACC/AHA)" 
              },
              nextSteps: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "Next diagnostic tests or immediate therapies to order" 
              }
            },
            required: ["diagnosis", "status", "reasoning", "citations", "nextSteps"]
          }
        }
      }
    });

    const data = JSON.parse(response.text || "[]");
    res.json({ success: true, data });
  } catch (error: any) {
    console.error("Gemini CDS Error:", error);
    // Simulated backup in case API key is missing/fails
    const backupData = [
      {
        diagnosis: "Acute Coronary Syndrome (ACS) / Myocardial Infarction",
        status: "CONSISTENT",
        reasoning: "Given chest pain radiating to the left arm in an adult patient with a cardiovascular risk history, acute ischemia must be ruled out immediately.",
        citations: ["ACC/AHA 2021 Chest Pain Guidelines", "WikEM: Acute Coronary Syndrome"],
        nextSteps: ["Perform immediate 12-lead ECG", "Order serial Troponin I/T levels", "Administer Aspirin 324mg PO if no contraindications"]
      },
      {
        diagnosis: "Aortic Dissection",
        status: "POSSIBLE",
        reasoning: "Although less common, severe radiating pain must alert clinicians to thoracic aortic dissection, especially in hypertensive patients.",
        citations: ["AHA 2022 Aortic Disease Guidelines"],
        nextSteps: ["Assess BP in bilateral arms", "Urgent CT Angiography of the Chest/Abdomen"]
      },
      {
        diagnosis: "Gastroesophageal Reflux Disease (GERD) / Esophageal Spasm",
        status: "LESS LIKELY",
        reasoning: "Symptoms may mimic angina, but cardiac etiologies must be excluded first before attributing symptoms to gastrointestinal causes.",
        citations: ["ACG Clinical Guidelines: GERD"],
        nextSteps: ["Trial of antacid/H2 blocker", "Reassess pain after resolution of cardiac rule-out"]
      }
    ];
    res.json({ 
      success: false, 
      error: error.message || "An error occurred", 
      data: backupData,
      simulated: true 
    });
  }
});

// 2. AI Voice Dictation Parser
app.post("/api/voice-dictation", async (req, res) => {
  const { speechText, aiCredits } = req.body;

  if (!speechText) {
    return res.status(400).json({ error: "No speech text provided" });
  }

  // Credit Gating Validation (Layer 4)
  if (aiCredits !== undefined && aiCredits !== null && Number(aiCredits) < 1) {
    return res.status(403).json({ 
      success: false, 
      error: "Insufficient AI Scribe credits. Please refill your credits in the Team & Billing settings." 
    });
  }
  try {
    const ai = getAI();
    const prompt = `
      You are an expert ER scribe AI and professional medical translator.
      
      The user is an Emergency Medicine physician or practitioner who has dictated clinical findings. 
      The dictated text may be spoken in English, in any Indian language (such as Hindi, Tamil, Telugu, Kannada, Malayalam, Bengali, Marathi, Gujarati, etc.), or in a mixed/code-switched format (such as Hinglish, Tanglish, etc.).

      YOUR CRITICAL TASKS:
      1. First, translate the entire dictated text into professional, standard medical clinical English.
      2. Analyze the translated English clinical narration and extract all clinical variables.
      3. Map the extracted clinical details to patient demographics, SAMPLE history, and basic vitals if mentioned.
      4. Crucially, also extract any investigations (ordered or conducted) and any medications/procedures administered or treatments ordered.
      5. If a field is not mentioned or cannot be reasonably inferred, return null or an empty array/string. Do not hallucinate or guess any physiological numbers.

      Dictated Speech (potentially in an Indian language or mixed):
      "${speechText}"
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are an expert ER medical scribe and multi-language translator. You convert clinical dictations (English, Hindi, Tamil, Telugu, Kannada, Malayalam, Bengali, Marathi, Gujarati, or code-switched speech) into clean, standard clinical English and extract structured clinical fields. Return JSON only.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            patientName: { type: Type.STRING, description: "Patient name if mentioned" },
            age: { type: Type.INTEGER, description: "Patient age if mentioned" },
            gender: { type: Type.STRING, description: "Gender: Male, Female, Other" },
            presentingComplaint: { type: Type.STRING, description: "Chief complaint or reason for visit translated to clinical English" },
            sampleHistory: {
              type: Type.OBJECT,
              properties: {
                symptoms: { type: Type.STRING, description: "Signs & symptoms translated to English" },
                allergies: { type: Type.STRING, description: "Known drug/food allergies" },
                medications: { type: Type.STRING, description: "Current outpatient medications" },
                pastHistory: { type: Type.STRING, description: "Past medical/surgical history" },
                lastMeal: { type: Type.STRING, description: "Time or description of last meal" },
                events: { type: Type.STRING, description: "Events leading up to presentation" }
              }
            },
            vitals: {
              type: Type.OBJECT,
              properties: {
                bp: { type: Type.STRING, description: "Blood pressure (e.g. 120/80)" },
                hr: { type: Type.STRING, description: "Heart rate (e.g. 88)" },
                spo2: { type: Type.STRING, description: "Oxygen saturation (e.g. 98)" },
                rr: { type: Type.STRING, description: "Respiratory rate (e.g. 16)" },
                temp: { type: Type.STRING, description: "Temperature in Celsius (e.g. 37.0)" },
                gcs: { type: Type.STRING, description: "Glasgow Coma Scale score (e.g. 15)" }
              }
            },
            investigations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Array of any lab tests or diagnostic investigations ordered (e.g. ['CBC', 'ECG', 'Troponin'])"
            },
            treatments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  drugName: { type: Type.STRING, description: "Name of the drug or procedure (e.g. Paracetamol, Aspirin)" },
                  dose: { type: Type.STRING, description: "Dose of the drug (e.g. 1g, 300mg, 500ml)" },
                  route: { type: Type.STRING, description: "Route of administration (e.g. IV, IM, PO, IO, PR)" }
                },
                required: ["drugName", "dose"]
              },
              description: "Array of any treatments or medications administered"
            }
          },
          required: ["patientName", "age", "gender", "presentingComplaint", "sampleHistory", "vitals", "investigations", "treatments"]
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    res.json({ 
      success: true, 
      data,
      remainingCredits: aiCredits !== undefined && aiCredits !== null ? Number(aiCredits) - 1 : undefined
    });
  } catch (error: any) {
    console.error("Gemini Dictation Error:", error);
    // Simulated backup parsing for clinical presentation demo
    const textLower = speechText.toLowerCase();
    const isPediatric = textLower.includes("child") || textLower.includes("pediatric") || textLower.includes("year old") && parseInt(speechText.match(/\d+/)?.[0] || "99") <= 16;
    const isMale = textLower.includes("male") || textLower.includes("he ") || textLower.includes("his ") || textLower.includes("पुरुष") || textLower.includes("ஆண்") || textLower.includes("పురుషుడు");
    
    // Quick heuristic backup parse for Indian language samples
    let mockName = speechText.match(/patient\s+is\s+([A-Z][a-z]+)/)?.[1] || "";
    let mockAge = parseInt(speechText.match(/(\d+)\s*-?year/i)?.[1] || (isPediatric ? "8" : "45"));
    let mockComplaint = "Chest pain / breathing discomfort";

    // If Hindi detected
    if (textLower.includes("छाती") || textLower.includes("दर्द") || textLower.includes("मरीज")) {
      mockComplaint = "Chest pain radiating to left arm (translated from Hindi: छाती में तेज दर्द)";
      mockName = "Ramesh Kumar";
      mockAge = 52;
    }
    // If Tamil detected
    if (textLower.includes("நெஞ்சு") || textLower.includes("வலி") || textLower.includes("நோயாளி")) {
      mockComplaint = "Severe chest tightness (translated from Tamil: நெஞ்சு வலி)";
      mockName = "Subramanian";
      mockAge = 58;
    }

    const backupData = {
      patientName: mockName,
      age: mockAge,
      gender: isMale ? "Male" : "Female",
      presentingComplaint: mockComplaint,
      sampleHistory: {
        symptoms: speechText.match(/(?:pain|cough|fever|dyspnea|दर्द|வலி)[^,\.]*/i)?.[0] || "Chest discomfort radiating to left arm",
        allergies: textLower.includes("no known") || textLower.includes("no allergies") || textLower.includes("कोई एलर्जी नहीं") ? "NKDA" : "None specified",
        medications: textLower.includes("on ") || textLower.includes("लेता") ? "Amlodipine 5mg OD" : "Unknown",
        pastHistory: textLower.includes("history of") || textLower.includes("बीमारी") ? "Hypertension" : "None recorded",
        lastMeal: "3-4 hours ago",
        events: "Presented following sudden acute onset of chest symptoms"
      },
      vitals: {
        bp: "130/80",
        hr: "88",
        spo2: "97",
        rr: "16",
        temp: "36.8",
        gcs: "15"
      },
      investigations: [],
      treatments: []
    };
    res.json({ 
      success: false, 
      error: error.message || "An error occurred", 
      data: backupData,
      simulated: true 
    });
  }
});

// 3. AI Document Scanner (OCR Extraction Simulation)
app.post("/api/document-scan", async (req, res) => {
  const { imageText } = req.body;

  const rawText = imageText || "MEMORIAL HOSPITAL DISCHARGE RECORD\nPatient: Robert Miller, Age: 68\nAllergies: Penicillin (Anaphylaxis)\nMedications: Lisinopril 20mg daily, Metoprolol 50mg BID\nPast History: CABG x3 in 2021, Type 2 Diabetes\nAdmitted: 02/03/2026 for acute heart failure exacerbation.";

  try {
    const ai = getAI();
    const prompt = `
      You are an expert clinical OCR processing system.
      Read the following text extracted from a medical record scan and compile structured clinical variables.
      Extract patient details, allergies, outpatient medications, and relevant past history.

      Scan Text:
      "${rawText}"
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You map dirty OCR text into clean clinical data modules. Return JSON only.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            extractedSummary: { type: Type.STRING, description: "General summary of the document" },
            patientName: { type: Type.STRING },
            age: { type: Type.INTEGER },
            allergies: { type: Type.STRING },
            medications: { type: Type.STRING },
            pastHistory: { type: Type.STRING },
            diagnoses: { type: Type.STRING }
          },
          required: ["extractedSummary", "patientName", "allergies", "medications", "pastHistory"]
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    res.json({ success: true, data });
  } catch (error: any) {
    console.error("Gemini OCR Scan Error:", error);
    // Simple mock backup extraction
    const backupData = {
      extractedSummary: "Discharge Record from Memorial Hospital detailing acute heart failure episode and medication regimen.",
      patientName: "Robert Miller",
      age: 68,
      allergies: "Penicillin (Anaphylaxis)",
      medications: "Lisinopril 20mg daily, Metoprolol 50mg BID",
      pastHistory: "CABG x3 in 2021, Type 2 Diabetes Mellitus",
      diagnoses: "Acute Decompensated Heart Failure"
    };
    res.json({ 
      success: false, 
      error: error.message || "An error occurred", 
      data: backupData,
      simulated: true 
    });
  }
});

// 4. EM Reference Library Query
app.post("/api/em-reference", async (req, res) => {
  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ error: "Query is required" });
  }

  try {
    const ai = getAI();
    const prompt = `
      You are an Emergency Medicine reference chatbot. Answer the user's clinical question concisely, citing guidelines, medical societies, and standard pediatric or adult emergency medicine references (like Tintinalli, WikEM, PALS, or ATLS).
      Provide an evidence-based, concise answer. Outline the single key teaching point at the end.

      Physician Query: "${query}"
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are a professional Emergency Medicine AI library with zero fluff. Keep responses dense, clinical, and precise. Format output as JSON.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            answer: { type: Type.STRING, description: "Detailed clinical guidelines, protocols, or dosage info in Markdown format" },
            citations: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "Guideline sources or references" 
            },
            keyTeachingPoint: { type: Type.STRING, description: "One-sentence high-yield teaching point" }
          },
          required: ["answer", "citations", "keyTeachingPoint"]
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    res.json({ success: true, data });
  } catch (error: any) {
    console.error("Gemini EM Reference Error:", error);
    // Dynamic mock response based on keywords
    let answer = "### Anaphylaxis Management Protocol (Adult)\n1. **Adrenaline (Epinephrine):** Administer **0.5 mg** IM (1:1000 dilution) in the anterolateral thigh. Repeat every 5-15 mins if no response.\n2. **Airway Management:** High-flow O₂. Prepare for advanced airway if laryngeal edema is suspected.\n3. **IV Fluids:** 1-2L Normal Saline bolus for hypotension.\n4. **Adjunctive Therapies:**\n   - H1 blocker: Cetirizine 10mg IV or Diphenhydramine 25-50mg IV\n   - H2 blocker: Ranitidine 50mg IV or Famotidine 20mg IV\n   - Corticosteroid: Methylprednisolone 125mg IV";
    let citations = ["AHA Anaphylaxis Guidelines", "WikEM: Anaphylaxis", "PALS Resuscitation"];
    let keyTeachingPoint = "Intramuscular adrenaline in the lateral thigh is the first-line and most critical intervention; never delay adrenaline for secondary medications.";

    if (req.body.query.toLowerCase().includes("stemi")) {
      answer = "### Acute STEMI Management Protocol\n1. **Antiplatelets:** Aspirin 162-325 mg PO (chewed), Clopidogrel 300-600 mg loading dose (or Ticagrelor 180 mg).\n2. **Anticoagulation:** Unfractionated heparin bolus + infusion, or Enoxaparin.\n3. **Reperfusion Strategy:**\n   - **Primary PCI:** Goal door-to-balloon time < 90 minutes.\n   - **Fibrinolysis:** If PCI is not available within 120 minutes, initiate thrombolytic therapy within 30 minutes of arrival.\n4. **Symptom Relief:** Nitroglycerin SL (caution in right ventricular infarct) and Morphine IV for refractory pain.";
      citations = ["ACC/AHA 2023 STEMI Guidelines", "ESC Acute Coronary Syndromes Guideline"];
      keyTeachingPoint = "Time is muscle. Reperfusion (PCI or lysis) must be initiated rapidly; obtain a 12-lead ECG within 10 minutes of arrival for all chest pain patients.";
    }

    res.json({
      success: false,
      error: error.message || "An error occurred",
      data: { answer, citations, keyTeachingPoint },
      simulated: true
    });
  }
});

// 5. AI Discharge Summary Narrative Generator
app.post("/api/ai-discharge", async (req, res) => {
  const { caseData } = req.body;

  try {
    const ai = getAI();
    const prompt = `
      You are an expert ER Clinical Scribe AI.
      Create a highly professional, comprehensive clinical Discharge Summary conforming to JCI (Joint Commission International) and NABH (National Accreditation Board for Hospitals & Healthcare Providers) hospital accreditation standards.
      Analyze the complete Emergency Room Case Record provided below.

      ER Case Record:
      - Patient Name: ${caseData?.patient?.name || "Unknown"}
      - Age: ${caseData?.patient?.age || "N/A"} years (${caseData?.isPediatric ? "PEDIATRIC" : "ADULT"})
      - Gender: ${caseData?.patient?.gender || "N/A"}
      - Chief Complaint: ${caseData?.patient?.presentingComplaint || "N/A"}
      - Case Type: ${caseData?.patient?.caseType || "Medical"}
      - Triage Category: ${caseData?.patient?.triageCategory || "N/A"}
      
      Vitals on Admission:
      - BP: ${caseData?.vitals?.bp || "N/A"}, HR: ${caseData?.vitals?.hr || "N/A"} bpm, SpO2: ${caseData?.vitals?.spo2 || "N/A"}%
      - RR: ${caseData?.vitals?.rr || "N/A"} /min, Temp: ${caseData?.vitals?.temp || "N/A"}°C, GCS: ${caseData?.vitals?.gcs || "N/A"}
      
      Clinical SAMPLE History:
      - Symptoms: ${caseData?.sampleHistory?.symptoms || "N/A"}
      - Allergies: ${caseData?.sampleHistory?.allergies || "None/NKDA"}
      - Outpatient Medications: ${caseData?.sampleHistory?.medications || "None"}
      - Past History: ${caseData?.sampleHistory?.pastHistory || "No significant medical history"}
      - Events Leading to Presentation: ${caseData?.sampleHistory?.events || "N/A"}

      Emergency Assessments:
      - Primary Assessment: Airway: ${caseData?.primaryAssessment?.airway || "N/A"}, Breathing: ${caseData?.primaryAssessment?.breathing || "N/A"}, Circulation: ${caseData?.primaryAssessment?.circulation || "N/A"}
      - Secondary Assessment / Survey: ${caseData?.secondaryAssessment || "N/A"}

      ER Investigations & Diagnostics:
      ${JSON.stringify(caseData?.investigations || [])}

      Treatments & Interventions Administered:
      ${JSON.stringify(caseData?.treatments || [])}

      Continuous Progress Notes:
      ${caseData?.progressNotes || "N/A"}

      Disposition Details:
      - Disposition: ${caseData?.dispositionDetails?.dispositionType || "Discharge"}
      - Observation Notes: ${caseData?.dispositionDetails?.observationNotes || "N/A"}

      YOUR TASK:
      Generate a professionally formatted JCI/NABH-compliant discharge summary JSON with the following fields:
      1. primaryDiagnosis: Extract the most likely or confirmed primary diagnosis.
      2. secondaryDiagnosis: Extract secondary comorbidities or chronic medical conditions.
      3. conditionAtDischarge: Synthesize a professional statement of their current status (e.g. stabilized, symptoms resolved, patient is hemodynamically stable. For pediatric, mention alert, active, age-appropriate behavior).
      4. dischargeMedications: Synthesize a list of recommended outpatient discharge medications with dose, frequency, and duration, based on the treatments administered in the ER and their history.
      5. followUpPlan: Exactly who to see (e.g. Primary Care, Cardiologist, Pediatrician), when (e.g. 3-5 days), and what tests or clinic.
      6. patientInstructions: Compassionate, plain-English summary of what they were treated for in the ER, lifestyle advice, and specific RED-FLAG symptoms (like sudden dyspnea, chest pain, high fever) that should prompt them to immediately return to the ER.
      7. courseInHospital: Synthesize a detailed, professional clinical narrative of the patient's emergency department course. This must summarize their presentation, key diagnostic workup, the treatments and interventions given (with medication details), and their overall response and progress.
      8. dischargeNarrative: A simplified plain language summary (backward-compatible field).
      9. patientAdvice: A detailed plain-language advice and warning instructions (backward-compatible field).
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You generate JCI and NABH compliant professional clinical discharge summaries in structured JSON only.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            primaryDiagnosis: { type: Type.STRING },
            secondaryDiagnosis: { type: Type.STRING },
            conditionAtDischarge: { type: Type.STRING },
            dischargeMedications: { type: Type.STRING },
            followUpPlan: { type: Type.STRING },
            patientInstructions: { type: Type.STRING },
            courseInHospital: { type: Type.STRING, description: "Detailed clinical narrative of the patient's ER course, investigations, treatments, and response to therapy." },
            dischargeNarrative: { type: Type.STRING, description: "A plain language summary of what the patient was treated for" },
            patientAdvice: { type: Type.STRING, description: "Specific warning advice on when to return to the ER" }
          },
          required: [
            "primaryDiagnosis",
            "secondaryDiagnosis",
            "conditionAtDischarge",
            "dischargeMedications",
            "followUpPlan",
            "patientInstructions",
            "courseInHospital",
            "dischargeNarrative",
            "patientAdvice"
          ]
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    res.json({ success: true, data });
  } catch (error: any) {
    console.error("Gemini Discharge Summary Error:", error);
    // backup instructions
    const name = caseData?.patient?.name || "Patient";
    const complaint = caseData?.patient?.presentingComplaint || "acute presentation";
    const isPediatric = !!caseData?.isPediatric;
    const backupData = {
      primaryDiagnosis: caseData?.dischargeInfo?.primaryDiagnosis || (isPediatric ? "Acute Reactive Airways Disease / Influenza A" : "Acute Coronary Syndrome Rule Out"),
      secondaryDiagnosis: caseData?.dischargeInfo?.secondaryDiagnosis || (isPediatric ? "History of Asthma" : "Essential Hypertension, Hyperlipidemia"),
      conditionAtDischarge: "Hemodynamically stable, pain free, acute symptoms fully resolved in ER.",
      dischargeMedications: "Tab. Lisinopril 10mg once daily in morning, Tab. Paracetamol 650mg TDS PRN for fever or pain.",
      followUpPlan: "Follow up with primary care physician or attending cardiologist in 3 to 5 days for repeat outpatient clinic check.",
      patientInstructions: `Dear ${name}, you were evaluated and stabilized in our Emergency Department for ${complaint}. Your acute symptoms have been successfully managed. Please rest, keep hydrated, and strictly follow the outpatient medication plan.`,
      courseInHospital: `Patient presented with ${complaint}. Immediate airway, breathing, and circulation were assessed and found to be stable. Initial vitals showed a heart rate of ${caseData?.vitals?.hr || "N/A"} and blood pressure of ${caseData?.vitals?.bp || "N/A"}. Underwent necessary emergency diagnostics and received medical stabilization. Symptoms resolved, and patient was monitored prior to safe disposition.`,
      dischargeNarrative: `Dear ${name}, you were evaluated in the emergency department for ${complaint}. Your clinical assessment and diagnostics are consistent with acute episode, which was successfully stabilized.`,
      patientAdvice: "RETURN TO THE ER IMMEDIATELY if you experience any of the following: worsening or chest pain radiating to your neck or arm, shortness of breath, severe dizziness, fainting, high fevers, or sudden weakness/numbness."
    };
    res.json({
      success: false,
      error: error.message || "An error occurred",
      data: backupData,
      simulated: true
    });
  }
});

// 5.5. Unlimited Clinical Rounds & 7-Lens Case Debrief API
app.post("/api/rounds-debrief", async (req, res) => {
  const { caseData, lens, userMessage, chatHistory } = req.body;

  if (!caseData) {
    return res.status(400).json({ error: "Patient case data is required" });
  }

  try {
    const ai = getAI();
    
    const patientName = caseData.patient?.name || "Anonymous Patient";
    const age = caseData.patient?.age || "N/A";
    const gender = caseData.patient?.gender || "N/A";
    const presentingComplaint = caseData.patient?.presentingComplaint || "Acute presentation";
    
    const hr = caseData.vitals?.hr || "N/A";
    const bp = caseData.vitals?.bp || "N/A";
    const rr = caseData.vitals?.rr || "N/A";
    const spo2 = caseData.vitals?.spo2 || "N/A";
    const temp = caseData.vitals?.temp || "N/A";
    const grbs = caseData.vitals?.grbs || "N/A";
    const gcs = caseData.vitals?.gcs || "N/A";

    const sampleHistory = caseData.sampleHistory || {};
    const primaryAssessment = caseData.primaryAssessment || {};
    const investigations = caseData.investigations || [];
    const treatments = caseData.treatments || [];
    const progressNotes = caseData.progressNotes || "";
    const differentials = caseData.differentials || [];

    const prompt = `
      You are a world-class Emergency Medicine Clinical Educator leading Clinical Rounds for an attending physician or medical resident.
      We are analyzing this active ER patient case:
      - Name: ${patientName} (${age}y, ${gender})
      - Chief Complaint: ${presentingComplaint}
      - Vitals: HR ${hr} bpm, BP ${bp} mmHg, RR ${rr} cpm, SpO2 ${spo2}%, Temp ${temp}°F, GRBS ${grbs} mg/dL, GCS ${gcs}
      - SAMPLE History: Symptoms: ${sampleHistory.symptoms || "N/A"}, Allergies: ${sampleHistory.allergies || "None"}, Meds: ${sampleHistory.medications || "None"}, Past Hx: ${sampleHistory.pastHistory || "None"}, Last Meal: ${sampleHistory.lastMeal || "N/A"}, Events: ${sampleHistory.events || "N/A"}
      - Primary Survey: Airway: ${primaryAssessment.airwayStatus || "N/A"}, Breathing: ${primaryAssessment.breathingStatus || "N/A"}, Circulation: ${primaryAssessment.circulationStatus || "N/A"}
      - Diagnostics Ordered/Done: ${JSON.stringify(investigations)}
      - Treatments/Medications Administered: ${JSON.stringify(treatments)}
      - Progress & Observation Notes: ${progressNotes}
      - Differential Diagnoses considered: ${JSON.stringify(differentials)}

      Analyze this case deeply through the lens: "${lens}".
      
      Requirements for each lens (ensure your markdown content is structured, detailed, and dense with medical terminology):
      1. "first-principles": Deconstruct the presentation starting from absolute physiological and physical truths (e.g., Starling's Law of the heart, alveolo-capillary diffusion gradients, receptor agonism/antagonism, cellular energy deficits). No rules of thumb; trace everything to fundamental clinical science.
      2. "devils-advocate": Act as a hyper-critical medical examiner. Challenge our assumptions. Are we anchoring on a specific diagnosis? What dangerous cognitive biases (confirmation bias, premature closure) could lead us astray? What if this is actually a lethal mimic (e.g. pericardial tamponade instead of standard asthma)?
      3. "pathophysiology": Outline a detailed mechanical, cellular, and immunologic timeline of the disease's underlying biology in this patient.
      4. "rare-but-real": Spotlight 3-4 rare, critical, or life-threatening mimics and complications of this presentation that must not be missed. List key clinical triggers/red flags for each.
      5. "guidelines": Detail the gold-standard society recommendations (e.g., ACC/AHA, GINA, GOLD, KDIGO, Surviving Sepsis, NICE) relevant to this presentation. Include precise target thresholds, drug choices, and timing criteria.
      6. "disease-snapshot": A super-dense clinical chest-sheet for the primary suspected diagnosis. Include: Core diagnostic criteria, gold-standard investigation, standard discharge/outpatient medication plan (drug, dose, frequency, duration), and 3 high-yield clinical pearls.
      7. "full-debrief": Comprehensive performance review of how the case was managed. Validate critical interventions done (like treatments and labs), assess triage accuracy, and note potential blindspots or optimizations.
      8. "rounds-chat": Engage in interactive clinical rounds discussion. Answer this custom query: "${userMessage || ""}" specifically in the context of this case.

      If this is "rounds-chat", also reference this previous rounds chat conversation history:
      ${JSON.stringify(chatHistory || [])}

      Format your response strictly as JSON. Do not write any markdown outside the JSON.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are an expert Emergency Medicine Clinical Mentor with zero fluff. Keep responses dense, clinical, and precise. Format output strictly as JSON.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            content: { type: Type.STRING, description: "Detailed clinical analysis in Markdown format. Use clear headings, bullet points, and bold text." },
            keyTakeaway: { type: Type.STRING, description: "One-sentence punchy high-yield clinical learning pearl." },
            memoryKey: { type: Type.STRING, description: "Short, permanent clinical memory entry (e.g. 'Posterior STEMI can present with isolated ST-depression in V1-V3; obtain V7-V9 ECG')" },
            suggestedQuestions: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "Three highly relevant, challenging clinical follow-up questions about this case or diagnosis" 
            }
          },
          required: ["content", "keyTakeaway", "memoryKey", "suggestedQuestions"]
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    res.json({ success: true, data });
  } catch (error: any) {
    console.error("Gemini Rounds Debrief Error:", error);
    
    // Offline simulated backup response generator based on lens and complaint
    const complaint = caseData.patient?.presentingComplaint?.toLowerCase() || "";
    let content = "### Clinical Rounds Discussion\n\nBased on your patient's presentation, we should prioritize hemodynamics, fluid status, and airway protection. Let's review the physiological markers.";
    let keyTakeaway = "Continuous monitoring of vitals and early escalation are key to avoiding clinical decompensation.";
    let memoryKey = "Always maintain a high index of suspicion for atypical presentations in elderly or immunocompromised individuals.";
    let suggestedQuestions = [
      "What are the absolute contraindications to fibrinolytic therapy in this patient?",
      "How would you adjust the drug dosages if this patient had moderate renal impairment?",
      "What are the diagnostic criteria for early acute respiratory distress syndrome (ARDS) here?"
    ];

    if (lens === "first-principles") {
      content = "### 🔬 First Principles Deconstruction\n\n* **Oxygen Delivery ($DO_2$):** Product of cardiac output ($CO$) and arterial oxygen content ($CaO_2$). In respiratory distress, V/Q mismatching decreases $SaO_2$, lowering $CaO_2$. To compensate, sympathetic activation increases heart rate ($HR$) to defend oxygen delivery.\n* **Starling Forces:** Fluid filtration across pulmonary capillaries is governed by hydrostatic pressure gradients vs colloid osmotic gradients. Left ventricular dysfunction increases pulmonary venous pressure, driving fluid transudation into alveolar spaces and creating severe compliance deficits.\n* **Vascular Resistance:** Sympathetic discharge activates alpha-1 receptors on arterioles, causing vasoconstriction to prioritize perfusion to vital organs (brain and heart) at the expense of mesenteric and peripheral tissue.";
      keyTakeaway = "Oxygen delivery is defended by reflexic sympathetic cardiac acceleration when alveolar diffusion gradients fail.";
      memoryKey = "Calculate DO2 = CO x CaO2; early PEEP recruits closed alveoli to reverse the diffusion surface area loss.";
    } else if (lens === "devils-advocate") {
      content = "### 😈 Devil's Advocate Analysis\n\n* **Anchoring Bias:** We have anchored heavily on standard obstructive lung disease or congestive cardiac dysfunction. What if we are missing an underlying acute pulmonary embolism (PE)? Tachycardia and mild hypoxia are atypical but highly consistent with PE.\n* **Confirmation Bias:** The wheezing is assumed to be airway bronchospasm. However, recall the classic aphorism: 'All that wheezes is not asthma.' Pulmonary congestion ('cardiac asthma') or an aspirated foreign body could create focal or generalized wheezing.\n* **Premature Closure:** Sepsis from an occult pneumonia or urinary source can present initially as isolated tachypnea and tachycardia before overt hypotension develops. Are we ignoring a potential infectious source?";
      keyTakeaway = "Do not anchor on bronchospasm when pulmonary congestion or vascular thromboembolism can produce identical physical findings.";
      memoryKey = "Actively rule out 'cardiac asthma' and pulmonary embolism before discharging patients labeled with 'refractory bronchospasm'.";
    } else if (lens === "rare-but-real") {
      content = "### 🚨 Rare but Real Red Flags\n\n1. **Aortic Dissection Masquerading as Acute Dyspnea:** Stanford Type A dissections can retrograde propagate into the aortic root, causing severe acute aortic regurgitation and flash pulmonary edema without classic tearing chest pain.\n2. **Myocardial Infarction presenting as isolated Dyspnea:** In elderly patients, diabetics, and women, myocardial ischemia frequently presents with 'anginal equivalents'—primarily dyspnea, nausea, or profound fatigue, rather than crushing chest pressure.\n3. **Myocarditis / Acute Cardiomyopathy:** Occult viral myocarditis can present in young, otherwise healthy individuals as mild breathlessness, which rapidly decompensates into severe biventricular failure.";
      keyTakeaway = "Flash pulmonary edema can be the primary presentation of a painless aortic dissection retrograde propagating into the coronary ostia.";
      memoryKey = "Perform a bedside focused cardiac ultrasound to check for pericardial effusion and aortic root dilation in atypical dyspnea.";
    } else if (lens === "guidelines") {
      content = "### 📋 Society Guideline Highlights\n\n* **AHA/ACC Heart Failure & ACS Guidelines:** Immediate 12-lead ECG within 10 minutes of arrival. If acute decompensated heart failure is suspected, maintain upright positioning, administer high-flow oxygen to maintain $SpO_2 > 90\\%$, and initiate non-invasive positive pressure ventilation (NIPPV/CPAP) early to reduce pre-load and after-load.\n* **GINA / GOLD Bronchospasm Guidelines:** For severe asthma/COPD exacerbations, administer inhaled short-acting beta-agonists (SABA) combined with anticholinergics (SAMA - Ipratropium) every 20 minutes for 3 doses, followed by systemic corticosteroids (e.g., Methylprednisolone 40-125mg IV or Prednisone 50mg PO) to resolve airway inflammation.";
      keyTakeaway = "NIPPV reduces the need for endotracheal intubation by 50% in acute cardiogenic pulmonary edema when instituted early.";
      memoryKey = "GINA guidelines recommend systemic corticosteroids within 1 hour of ER arrival for all moderate-to-severe bronchospastic exacerbations.";
    } else if (lens === "disease-snapshot") {
      content = "### 📸 Disease Snapshot & Outpatient Plan\n\n* **Primary Suspected Diagnosis:** Acute Exacerbation of Airway / Cardiac Dysfunction.\n* **Core Diagnostic Criteria:** Chest X-ray demonstrating vascular congestion or hyperinflation, elevated BNP/NT-proBNP (>300/450 pg/mL), or bedside ultrasound demonstrating multiple lung B-lines (interstitial syndrome).\n* **Gold-Standard Investigation:** High-resolution CT or formal echocardiography (for structural and valvular metrics).\n* **Standard Outpatient Prescription Plan:**\n  1. **Tab. Furosemide** 40mg PO once daily (for fluid clearance)\n  2. **Tab. Metoprolol Succinate** 25mg PO once daily (beta-blockade once stable)\n  3. **Tab. Ramipril** 2.5mg PO once daily (ACE-inhibitor for afterload reduction)\n  4. **Inhaler Budesonide/Formoterol** 160/4.5 mcg: 2 puffs twice daily (for airway reactivity)";
      keyTakeaway = "Echocardiography within 24-48 hours of discharge is mandatory to guide long-term neurohormonal therapy.";
      memoryKey = "Never initiate beta-blocker therapy in the acute, decompensated phase of heart failure; wait until the patient is euvolemic.";
    }

    res.json({
      success: false,
      error: error.message || "An error occurred",
      data: { content, keyTakeaway, memoryKey, suggestedQuestions },
      simulated: true
    });
  }
});

// 6. AI Shift Handover Assistant
app.post("/api/handover-chat", async (req, res) => {
  const { messages, currentPatients } = req.body;

  try {
    const ai = getAI();
    const prompt = `
      You are an expert Emergency Medicine Clinical Lead. You are taking a shift handover from an outgoing ER physician.
      Analyze the conversation history and the current patients list.
      
      Conversation History:
      ${JSON.stringify(messages)}

      Current Patients in Handover List:
      ${JSON.stringify(currentPatients)}

      Based on the latest user message, perform two tasks:
      1. Formulate a friendly, brief, clinical conversational reply (2-3 sentences max). If they described a patient, acknowledge it and ask highly relevant follow-ups (e.g., about receiving doctor, allergies, or discharge disposition if they weren't mentioned). If they are done, congratulate them on a safe shift.
      2. Extract and update the structured patient lists. If a new patient was described or an existing patient's details were updated, represent them in the "extractedPatients" array.
         Every patient must have:
         - "bed": string (e.g. "Bed 4", "Resus 1" or "Unknown")
         - "name": string
         - "ageGender": string (e.g. "52M", "6F")
         - "complaint": string (e.g. "chest pain")
         - "status": string (must be exactly "Critical" or "Unstable" or "Stable" or "For Discharge")
         - "treatment": string (e.g. "Aspirin, GTN")
         - "pendingActions": string (e.g. "Echo, Cath lab transfer")
         - "allergies": string (e.g. "NKDA" or "Penicillin")
         - "receivingDoctor": string (e.g. "Dr. Sarah Jenkins")
      
      Set "isReady" to true if you have adequate details for all mentioned patients and the user indicates they want to finish or if we have at least 1-2 fully filled patients.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are an expert ER Clinical Lead coordinating shift handovers. Only return valid JSON matching the schema.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            replyText: { type: Type.STRING },
            isReady: { type: Type.BOOLEAN },
            extractedPatients: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  bed: { type: Type.STRING },
                  name: { type: Type.STRING },
                  ageGender: { type: Type.STRING },
                  complaint: { type: Type.STRING },
                  status: { type: Type.STRING, description: "Critical, Unstable, Stable, or For Discharge" },
                  treatment: { type: Type.STRING },
                  pendingActions: { type: Type.STRING },
                  allergies: { type: Type.STRING },
                  receivingDoctor: { type: Type.STRING }
                },
                required: ["bed", "name", "ageGender", "complaint", "status", "treatment", "pendingActions", "allergies", "receivingDoctor"]
              }
            }
          },
          required: ["replyText", "isReady", "extractedPatients"]
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    res.json({ success: true, data });
  } catch (error: any) {
    console.error("Gemini Handover Error:", error);
    // backup response
    const backupData = {
      replyText: "Understood. I have logged that patient on the board. Do we have a receiving specialist assigned, and are there any allergies or pending labs I should track?",
      isReady: true,
      extractedPatients: [
        {
          bed: "Resus 2",
          name: "James Cole",
          ageGender: "45M",
          complaint: "Anaphylaxis post wasp sting",
          status: "Stable",
          treatment: "Adrenaline 0.5mg IM, Hydrocortisone 200mg IV",
          pendingActions: "Observe for biphasic reaction, discharge in 4 hours if clear",
          allergies: "Wasp venom",
          receivingDoctor: "Dr. Jenkins"
        }
      ]
    };
    res.json({
      success: false,
      error: error.message || "An error occurred",
      data: backupData,
      simulated: true
    });
  }
});

// 5b. AI Scribe Dictation Extractor
app.post("/api/scribe-extract", async (req, res) => {
  const { dictation } = req.body;

  if (!dictation || !dictation.trim()) {
    return res.status(400).json({ success: false, error: "Dictation content is empty." });
  }

  try {
    const ai = getAI();
    const prompt = `
      You are an elite Emergency Medicine Scribe.
      Analyze the following continuous voice dictation (or clinician notes) and extract as much structured medical information as possible to fill out an emergency department case sheet.
      
      DICTATED TEXT:
      "${dictation}"

      Extract and map the details to the following JSON structure. If any field is not mentioned, provide a reasonable blank string or null.
      
      Demographics:
      - name: string (default "Unidentified Patient" if not mentioned)
      - age: number or null (e.g. 45 or null)
      - gender: string (must be exactly "Male", "Female", or "Other")
      - presentingComplaint: string (what complaints the patient presented with)
      - triageCategory: string (must be exactly "P1 (Immediate)", "P2 (Urgent)", or "P3 (Non-Urgent)". Infer from vitals/complaint if not explicitly specified. Red flags are P1, moderate is P2, minor is P3)
      - caseType: string (must be exactly "Medical" or "Trauma")
      - arrivalMode: string (must be exactly "Walk-in", "Ambulance", or "Referred")

      Vitals:
      - bp: string (e.g. "120/80")
      - hr: string (e.g. "88")
      - spo2: string (e.g. "97")
      - rr: string (e.g. "18")
      - temp: string (e.g. "37.1")
      - gcs: string (composite out of 15, default "15")
      - grbs: string (blood glucose, e.g. "110" or "")
      - painScore: string (0-10, e.g. "6")

      SAMPLE History:
      - symptoms: string (detailed signs and symptoms)
      - allergies: string (e.g. "Penicillin" or "NKDA" or "None")
      - medications: string (outpatient meds)
      - pastHistory: string (chronic conditions, previous surgeries)
      - lastMeal: string (last oral intake time/type)
      - events: string (preceding circumstances)

      Primary Assessment (ABCDE):
      - airway: string (description of airway findings)
      - airwayStatus: string (either "Normal" or "Abnormal")
      - breathing: string (breathing assessment, e.g., clear bilateral chest)
      - breathingStatus: string (either "Normal" or "Abnormal")
      - circulation: string (pulses, capillary refill, skin turgor)
      - circulationStatus: string (either "Normal" or "Abnormal")
      - disability: string (pupils, orientation, power)
      - disabilityStatus: string (either "Normal" or "Abnormal")
      - exposure: string (rashes, trauma signs, temperature check)
      - exposureStatus: string (either "Normal" or "Abnormal")

      Secondary Assessment:
      - secondaryAssessment: string (head-to-toe or systemic exam findings)
      
      ProgressNotes:
      - progressNotes: string (notes about clinical course or plan)
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are an expert ER scribe. Extract clinician notes into structured emergency medicine records. Only return valid JSON matching the schema.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            age: { type: Type.INTEGER, nullable: true },
            gender: { type: Type.STRING },
            presentingComplaint: { type: Type.STRING },
            triageCategory: { type: Type.STRING },
            caseType: { type: Type.STRING },
            arrivalMode: { type: Type.STRING },
            bp: { type: Type.STRING },
            hr: { type: Type.STRING },
            spo2: { type: Type.STRING },
            rr: { type: Type.STRING },
            temp: { type: Type.STRING },
            gcs: { type: Type.STRING },
            grbs: { type: Type.STRING },
            painScore: { type: Type.STRING },
            symptoms: { type: Type.STRING },
            allergies: { type: Type.STRING },
            medications: { type: Type.STRING },
            pastHistory: { type: Type.STRING },
            lastMeal: { type: Type.STRING },
            events: { type: Type.STRING },
            airway: { type: Type.STRING },
            airwayStatus: { type: Type.STRING },
            breathing: { type: Type.STRING },
            breathingStatus: { type: Type.STRING },
            circulation: { type: Type.STRING },
            circulationStatus: { type: Type.STRING },
            disability: { type: Type.STRING },
            disabilityStatus: { type: Type.STRING },
            exposure: { type: Type.STRING },
            exposureStatus: { type: Type.STRING },
            secondaryAssessment: { type: Type.STRING },
            progressNotes: { type: Type.STRING }
          },
          required: [
            "name", "age", "gender", "presentingComplaint", "triageCategory", "caseType", "arrivalMode",
            "bp", "hr", "spo2", "rr", "temp", "gcs", "grbs", "painScore",
            "symptoms", "allergies", "medications", "pastHistory", "lastMeal", "events",
            "airway", "airwayStatus", "breathing", "breathingStatus", "circulation", "circulationStatus", "disability", "disabilityStatus", "exposure", "exposureStatus",
            "secondaryAssessment", "progressNotes"
          ]
        }
      }
    });

    const parsedData = JSON.parse(response.text || "{}");
    
    // Map flat JSON structure to nested structure expected by handleSaveExtractedVoiceCase in App.tsx
    const formattedData = {
      patientName: parsedData.name || "Unidentified Patient",
      age: parsedData.age,
      gender: parsedData.gender || "Male",
      presentingComplaint: parsedData.presentingComplaint || "Dictated presentation transcript.",
      triageCategory: parsedData.triageCategory,
      arrivalMode: parsedData.arrivalMode || "Walk-in",
      caseType: parsedData.caseType || "Medical",
      vitals: {
        bp: parsedData.bp || "",
        hr: parsedData.hr || "",
        spo2: parsedData.spo2 || "",
        rr: parsedData.rr || "",
        temp: parsedData.temp || "",
        gcs: parsedData.gcs || "15",
        grbs: parsedData.grbs || "",
        painScore: parsedData.painScore || "0"
      },
      sampleHistory: {
        symptoms: parsedData.symptoms || "",
        allergies: parsedData.allergies || "",
        medications: parsedData.medications || "",
        pastHistory: parsedData.pastHistory || "",
        lastMeal: parsedData.lastMeal || "",
        events: parsedData.events || ""
      },
      primaryAssessment: {
        airway: parsedData.airway || "",
        airwayStatus: parsedData.airwayStatus || "Normal",
        breathing: parsedData.breathing || "",
        breathingStatus: parsedData.breathingStatus || "Normal",
        circulation: parsedData.circulation || "",
        circulationStatus: parsedData.circulationStatus || "Normal",
        disability: parsedData.disability || "",
        disabilityStatus: parsedData.disabilityStatus || "Normal",
        exposure: parsedData.exposure || "",
        exposureStatus: parsedData.exposureStatus || "Normal"
      },
      secondaryAssessment: parsedData.secondaryAssessment || "",
      progressNotes: parsedData.progressNotes || ""
    };

    res.json({ success: true, data: formattedData });
  } catch (error: any) {
    console.error("Gemini Scribe Extraction Error:", error);
    
    const text = dictation || "";
    
    // Simple regex matching for demographics
    let name = "Arthur Pendelton";
    const nameMatch = text.match(/(?:patient(?:\s+name)?(?:\s+is)?|name:\s*)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
    if (nameMatch) name = nameMatch[1];

    let age: number | null = 62;
    const ageMatch = text.match(/(?:age|aged|is)\s*(\d{1,2})\s*(?:years|yr|y\.?o\.?|old)/i);
    if (ageMatch) age = parseInt(ageMatch[1], 10);

    let gender = "Male";
    if (/\b(female|woman|girl|she|her)\b/i.test(text)) {
      gender = "Female";
    } else if (/\b(other|non-binary)\b/i.test(text)) {
      gender = "Other";
    }

    // Try to extract Vitals
    let bp = "142/88";
    const bpMatch = text.match(/(?:bp|blood\s*pressure)\s*(?:is\s*|:\s*)?(\d{2,3}\/\d{2,3})/i);
    if (bpMatch) bp = bpMatch[1];

    let hr = "94";
    const hrMatch = text.match(/(?:hr|heart\s*rate|pulse)\s*(?:is\s*|:\s*)?(\d{2,3})/i);
    if (hrMatch) hr = hrMatch[1];

    let spo2 = "95";
    const spo2Match = text.match(/(?:spo2|oximetry|saturation|o2\s*sat)\s*(?:is\s*|:\s*)?(\d{2,3})%/i);
    if (spo2Match) spo2 = spo2Match[1];

    let rr = "18";
    const rrMatch = text.match(/(?:rr|resp(?:\s*rate)?|respiratory\s*rate)\s*(?:is\s*|:\s*)?(\d{1,2})/i);
    if (rrMatch) rr = rrMatch[1];

    let temp = "37.2";
    const tempMatch = text.match(/(?:temp|temperature)\s*(?:is\s*|:\s*)?(\d{2}(?:\.\d)?)/i);
    if (tempMatch) temp = tempMatch[1];

    let gcs = "15";
    const gcsMatch = text.match(/(?:gcs)\s*(?:is\s*|:\s*)?(\d{1,2})/i);
    if (gcsMatch) gcs = gcsMatch[1];

    let grbs = "120";
    const grbsMatch = text.match(/(?:grbs|glucose|sugar|bs)\s*(?:is\s*|:\s*)?(\d{2,3})/i);
    if (grbsMatch) grbs = grbsMatch[1];

    let painScore = "6";
    const painMatch = text.match(/(?:pain|pain\s*score)\s*(?:is\s*|:\s*)?(\d{1,2})/i);
    if (painMatch) painScore = painMatch[1];

    // Other fields
    let presentingComplaint = "Shortness of breath / Chest discomfort";
    const complaintMatch = text.match(/(?:presenting with|complaining of|complaint is|presenting complaint|complaint:\s*)\s*([^.,\n]+)/i);
    if (complaintMatch) presentingComplaint = complaintMatch[1].trim();

    // Triage Category
    let triageCategory = "P2 (Urgent)";
    if (/\b(P1|immediate|severe distress|arrest|unconscious|unresponsive|troponin positive)\b/i.test(text)) {
      triageCategory = "P1 (Immediate)";
    } else if (/\b(P3|non-urgent|minor|mild|stable)\b/i.test(text)) {
      triageCategory = "P3 (Non-Urgent)";
    }

    const backupData = {
      patientName: name,
      age,
      gender,
      presentingComplaint,
      triageCategory,
      caseType: /\b(trauma|accident|fall|fracture|bleed|cut|wound|mva|mvc)\b/i.test(text) ? "Trauma" : "Medical",
      arrivalMode: /\b(ambulance|ems|paramedic)\b/i.test(text) ? "Ambulance" : /\b(referred|transfer)\b/i.test(text) ? "Referred" : "Walk-in",
      vitals: {
        bp,
        hr,
        spo2,
        rr,
        temp,
        gcs,
        grbs,
        painScore
      },
      sampleHistory: {
        symptoms: text.slice(0, 300) || "Chest pressure, shortness of breath, mild diaphoresis.",
        allergies: text.match(/(?:allergies|allergic to|allergy:\s*)\s*([^.,\n]+)/i)?.[1] || "None",
        medications: text.match(/(?:medications|meds|on|medication:\s*)\s*([^.,\n]+)/i)?.[1] || "None",
        pastHistory: text.match(/(?:history of|past medical history|known case of|history:\s*)\s*([^.,\n]+)/i)?.[1] || "Hypertension, Hyperlipidemia",
        lastMeal: "Light snack 3 hours ago",
        events: "Worsening symptoms leading to direct ED evaluation."
      },
      primaryAssessment: {
        airway: "Patent, speaking in full sentences",
        airwayStatus: "Normal",
        breathing: "Reduced breath sounds at bases, tachypneic but talking",
        breathingStatus: /\b(wheeze|crepitation|crackles|stridor|dyspnea|shortness of breath)\b/i.test(text) ? "Abnormal" : "Normal",
        circulation: "Capillary refill < 2 seconds, radial pulses symmetric",
        circulationStatus: "Normal",
        disability: "GCS 15, pupils equal and reactive",
        disabilityStatus: "Normal",
        exposure: "No trauma or active rash, body temperature checked",
        exposureStatus: "Normal"
      },
      secondaryAssessment: "Auscultation of chest reveals normal heart sounds, soft non-tender abdomen.",
      progressNotes: "Obtain immediate ECG, cardiac enzymes, basic metabolic panel. Maintain continuous telemetry."
    };

    res.json({ success: true, data: backupData, simulated: true });
  }
});

// 5c. AI Scribe Chat Assistant with Textbook References
app.post("/api/scribe-chat", async (req, res) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ success: false, error: "Messages array is required." });
  }

  try {
    const ai = getAI();
    
    // Map client-side message format to Gemini contents
    const contentsArray = messages.map((m: any) => ({
      role: m.sender === "user" ? "user" : "model",
      parts: [{ text: m.text }]
    }));

    const systemInstruction = `
      You are ErMate AI Scribe and an Emergency Medicine Expert Senior Consultant.
      The user is a physician in the Emergency Department.
      Answer the user's questions or comments. You can ask any medical, clinical, or general emergency department questions.
      Your response MUST be clear, highly clinical, and formatted in clean Markdown.

      CRITICAL REQUIREMENT:
      Every clinical, medical, or diagnostic answer you provide MUST contain references from the following sources, labeled clearly and detailed with specific chapter, section, guidelines, or protocols:
      1. Tintinalli's Emergency Medicine (Tintinalli book)
      2. Rosen's Emergency Medicine (Rosen's book of emergency medicine)
      3. Harrison's Principles of Internal Medicine (Harrisons)
      4. WikEM (wikkiem)
      5. UpToDate (up-to-date)

      Format these references under a clear "📚 Reference Citations" header at the end of your response, with dedicated sub-headers for each of the five sources. Give precise, realistic citations (e.g. Chapter titles, specific treatment thresholds, or diagnostic algorithms) rather than generic place-holders.

      Keep the tone professional, objective, and supportive. Use professional medical formatting.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contentsArray,
      config: {
        systemInstruction: systemInstruction,
      }
    });

    res.json({ success: true, reply: response.text });
  } catch (error: any) {
    console.error("Gemini Scribe Chat Error:", error);
    // Dynamic backup response generator if Gemini key fails
    const lastMsgText = messages[messages.length - 1]?.text || "";
    let reply = `Based on your clinical query: "${lastMsgText}", here is the standard emergency medical response:\n\n### Clinical Management Summary\nEnsure patient airway protection, establish bilateral wide-bore IV access, and start continuous telemetry monitoring. Standard resuscitation protocols should be followed immediately.\n\n### 📚 Reference Citations\n* **Tintinalli's Emergency Medicine**: Chapter 22: Cardiac Rhythm Disturbances and Resuscitation guidelines.\n* **Rosen's Emergency Medicine**: Chapter 12: Resuscitation and Airway Management protocols.\n* **Harrison's Principles of Internal Medicine**: Section 5: Cardinal Manifestations of Disease, detailing electrophysiological pathways.\n* **WikEM**: Detailed emergency medicine guidelines for resuscitation and therapeutic interventions.\n* **UpToDate**: Evidence-based guidelines for initial management of unstable emergency department presentations.`;
    res.json({ success: true, reply, simulated: true });
  }
});

// 5d. AI Scribe Document Scanner (OCR & Mapping)
app.post("/api/scribe-ocr-scan", async (req, res) => {
  const { image, mimeType, imageText } = req.body;

  try {
    const ai = getAI();
    let response;

    const schema = {
      type: Type.OBJECT,
      properties: {
        hospitalName: { type: Type.STRING, description: "Name of the hospital/clinic that issued this letter" },
        patientName: { type: Type.STRING },
        age: { type: Type.INTEGER, nullable: true },
        gender: { type: Type.STRING, description: "Male, Female, or Other" },
        presentingComplaint: { type: Type.STRING },
        triageCategory: { type: Type.STRING, description: "P1 (Immediate), P2 (Urgent), or P3 (Non-Urgent)" },
        caseType: { type: Type.STRING, description: "Medical or Trauma" },
        arrivalMode: { type: Type.STRING, description: "Walk-in, Ambulance, or Referred" },
        bp: { type: Type.STRING },
        hr: { type: Type.STRING },
        spo2: { type: Type.STRING },
        rr: { type: Type.STRING },
        temp: { type: Type.STRING },
        gcs: { type: Type.STRING },
        grbs: { type: Type.STRING },
        painScore: { type: Type.STRING },
        symptoms: { type: Type.STRING },
        allergies: { type: Type.STRING },
        medications: { type: Type.STRING },
        pastHistory: { type: Type.STRING },
        lastMeal: { type: Type.STRING },
        events: { type: Type.STRING },
        airway: { type: Type.STRING },
        airwayStatus: { type: Type.STRING },
        breathing: { type: Type.STRING },
        breathingStatus: { type: Type.STRING },
        circulation: { type: Type.STRING },
        circulationStatus: { type: Type.STRING },
        disability: { type: Type.STRING },
        disabilityStatus: { type: Type.STRING },
        exposure: { type: Type.STRING },
        exposureStatus: { type: Type.STRING },
        secondaryAssessment: { type: Type.STRING },
        progressNotes: { type: Type.STRING },
        clinicalNarrative: { type: Type.STRING, description: "A structured concise medical summary of this reference letter for the physician" }
      },
      required: [
        "hospitalName", "patientName", "age", "gender", "presentingComplaint", "triageCategory", "caseType", "arrivalMode",
        "bp", "hr", "spo2", "rr", "temp", "gcs", "grbs", "painScore",
        "symptoms", "allergies", "medications", "pastHistory", "lastMeal", "events",
        "airway", "airwayStatus", "breathing", "breathingStatus", "circulation", "circulationStatus", "disability", "disabilityStatus", "exposure", "exposureStatus",
        "secondaryAssessment", "progressNotes", "clinicalNarrative"
      ]
    };

    if (image) {
      // Multimodal image OCR scan
      const imagePart = {
        inlineData: {
          mimeType: mimeType || "image/jpeg",
          data: image,
        },
      };
      const textPart = {
        text: `You are an expert clinical OCR processing system. Extract patient details, clinical history, vitals, allergies, and the chief reasons for transfer from this scanned hospital reference/referral letter. Fill out all properties in the schema correctly.`
      };

      response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: { parts: [imagePart, textPart] },
        config: {
          systemInstruction: "You are an expert emergency medical OCR processing system. Convert clinical reference/referral images into accurate structured clinical data in JSON.",
          responseMimeType: "application/json",
          responseSchema: schema
        }
      });
    } else {
      // Text-based OCR parser
      const prompt = `
        You are an expert clinical OCR processing system.
        Extract patient details, clinical history, vitals, allergies, and chief reasons for transfer from this hospital reference/referral letter text:
        
        "${imageText}"
      `;

      response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: "You map clinical referral text into clean structured medical data modules. Return JSON only.",
          responseMimeType: "application/json",
          responseSchema: schema
        }
      });
    }

    const data = JSON.parse(response.text || "{}");
    res.json({ success: true, data });
  } catch (error: any) {
    console.error("Gemini OCR Scan Error:", error);
    // Mock referral data backup
    const backupData = {
      hospitalName: "Metro Heart & General Hospital",
      patientName: "Robert Miller",
      age: 68,
      gender: "Male",
      presentingComplaint: "Acute shortness of breath and chest pressure",
      triageCategory: "P1 (Immediate)",
      caseType: "Medical",
      arrivalMode: "Referred",
      bp: "165/95",
      hr: "98",
      spo2: "91",
      rr: "24",
      temp: "37.1",
      gcs: "15",
      grbs: "135",
      painScore: "7",
      symptoms: "Worsening dyspnea over 2 days, orthopnea, paroxysmal nocturnal dyspnea, bilateral pitting pedal edema.",
      allergies: "Penicillin (Anaphylaxis)",
      medications: "Lisinopril 20mg OD, Metoprolol succinate 50mg OD, Furosemide 40mg OD",
      pastHistory: "Congestive Heart Failure, CABG x2 in 2020, Chronic Kidney Disease Stage 3",
      lastMeal: "Light breakfast 5 hours ago",
      events: "Transferred from Metro Heart clinic for cardiology review and advanced diuretic therapy due to decompensation.",
      airway: "Clear, speaking in partial sentences",
      airwayStatus: "Normal",
      breathing: "Tachypneic, diffuse fine crepitations in bilateral lung bases, accessory muscle use",
      breathingStatus: "Abnormal",
      circulation: "Bilateral 2+ pitting pedal edema up to mid-shin, warm extremities, bounding peripheral pulses",
      circulationStatus: "Normal",
      disability: "Pupils equal and reactive, GCS 15, slightly anxious but fully oriented",
      disabilityStatus: "Normal",
      exposure: "No active rashes, warm skin, temp 37.1 C",
      exposureStatus: "Normal",
      secondaryAssessment: "Moderate respiratory distress, jugular venous distention present (~8 cm H2O).",
      progressNotes: "Plan immediate IV furosemide challenge, continuous pulse oximetry, cardiac telemetry, and obtain chest X-ray.",
      clinicalNarrative: "Metro Heart Clinic Referral: 68 y/o Male with acute decompensated heart failure exacerbation, penicillin anaphylaxis allergy, needing urgent inpatient cardiology intervention."
    };
    res.json({
      success: true,
      data: backupData,
      simulated: true
    });
  }
});

// Setup Vite Dev Server / Static Asset Serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[ErMate Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
