import { VOICE_EXTRACTION_PROMPT } from "./voiceExtraction.ts";
import { extractClinicalData } from "./extraction.ts";
import { SCRIBE_EXTRACTION_GUARDRAILS } from "./scribeExtractionGuardrails.ts";

/**
 * Shared Scribe clinical extraction model call.
 *
 * IMPORTANT:
 * Behaviour is intentionally preserved from the original inline callback
 * in server.ts. Provider/fallback changes will be made separately.
 */
export async function callScribeExtractionModel({
  model,
  temperature,
  deidentifiedInput,
  patientAgeYears,
  pendingClarification,
}: {
  model: "gpt-4o-mini" | "claude-3.5-haiku";
  temperature: number;
  deidentifiedInput: string;
  patientAgeYears: number | null;
  pendingClarification?: string;
}): Promise<any> {

            let rawText: any = "";
            const promptSuffix = pendingClarification 
              ? `\n\nCRITICAL CONTEXT: The system just asked the user to clarify the patient's ${pendingClarification}. Evaluate the user's input primarily as the answer to this clarification. For example, if pendingClarification is 'age' and the input is '25', you MUST extract age as 25.`
              : "";
            try {
              if (model === "gpt-4o-mini" && process.env.OPENAI_API_KEY) {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 25000);
                const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
                  method: "POST",
                  headers: {
                    "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                    "Content-Type": "application/json"
                  },
                  signal: controller.signal,
                  body: JSON.stringify({
                    model: "gpt-4o-mini",
                    temperature: 0.0,
                    response_format: { type: "json_object" },
                    messages: [
                      {
  role: "system",
  content: VOICE_EXTRACTION_PROMPT + SCRIBE_EXTRACTION_GUARDRAILS
},
                      { role: "user", content: `Transcript:\n"""\n${deidentifiedInput}\n"""` }
                    ]
                  })
                });
                clearTimeout(timeoutId);
                const json = await openaiRes.json();
                rawText = json?.choices?.[0]?.message?.content || "";
              }
            } catch (err) {
              console.warn("[ScribeTurn] OpenAI extraction failed, using fallback:", err);
            }

            if (!rawText) {
              // Fallback extraction call
              const fbResult = await extractClinicalData(deidentifiedInput);
              rawText = fbResult.extracted || fbResult.data || {};
            }

            let parsed: any = {};
            if (rawText && typeof rawText === "object") {
              parsed = rawText;
            } else if (typeof rawText === "string") {
              const cleanJson = rawText.replace(/```json\n?|\n?```/g, "").trim();
              try {
                parsed = JSON.parse(cleanJson);
              } catch (parseErr) {
                console.error("[ScribeTurn] JSON parse error on extraction output:", parseErr);
                throw new Error("Failed to parse clinical extraction JSON output");
              }
            } else {
              throw new Error("Empty or invalid extraction output received from model");
            }
            return parsed;
          
}
