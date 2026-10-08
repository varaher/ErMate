import { deidentifyText } from "./deidentify.ts";

/**
 * server/aiProviderFailover.ts
 *
 * Reusable server-side multi-provider failover layer for:
 * 1. /api/case-discussion
 * 2. /api/rounds-debrief
 *
 * Architecture:
 * - PRIMARY: Claude (Anthropic Messages API: claude-sonnet-4-6, claude-sonnet-4-5-20250929)
 * - FALLBACK: OpenAI Responses API (gpt-4o)
 *
 * Invariants:
 * 1. Does NOT call both providers for every request. Calls Claude first; on recoverable failure, falls back to OpenAI.
 * 2. Recoverable failures: timeout, network error, 429/quota, 5xx, model unavailable.
 * 3. Non-recoverable failures (auth failure, validation, missing case) MUST fail closed before calling this helper.
 * 4. DPDP Act 2023 de-identification guaranteed across BOTH provider paths.
 * 5. Provider-neutral output structure:
 *    { success: true, response: string, provider: "anthropic" | "openai", data?: any }
 * 6. Never exposes API keys, stack traces, or raw provider errors to the client.
 */

export interface FailoverCallResult {
  success: boolean;
  response: string;
  provider?: "anthropic" | "openai";
  data?: any;
  error?: string;
}

/**
 * Calls Anthropic Claude Sonnet with timeout and recoverable failure detection.
 */
async function callClaudePrimary(
  prompt: string,
  systemInstruction: string,
  expectJson: boolean
): Promise<{ text: string | null; recoverable: boolean; status?: number }> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey || anthropicKey.trim() === "" || anthropicKey === "MY_ANTHROPIC_API_KEY") {
    return { text: null, recoverable: true, status: 401 };
  }

  const sonnetModels = [
    "claude-sonnet-4-6",
    "claude-sonnet-4-5-20250929"
  ];

  for (const modelName of sonnetModels) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s bound

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json"
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: modelName,
          max_tokens: 4096,
          temperature: 0.0,
          system: expectJson
            ? systemInstruction + " IMPORTANT: Return ONLY valid raw JSON with no preamble, markdown code fences, or formatting wrapper."
            : systemInstruction,
          messages: [{ role: "user", content: prompt }]
        })
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const contentText = data.content?.[0]?.text || "";
        if (contentText && contentText.trim().length > 0) {
          return { text: contentText, recoverable: false, status: 200 };
        }
      } else {
        const errText = await response.text();
        console.warn(`[FailoverLayer] Claude (${modelName}) returned status ${response.status}: ${errText.slice(0, 120)}`);
        // If 429, 5xx, or credit balance / model not found, try next model or fallback
      }
    } catch (err: any) {
      console.warn(`[FailoverLayer] Claude (${modelName}) network/timeout:`, err?.message || err);
    }
  }

  return { text: null, recoverable: true };
}

/**
 * Calls OpenAI Responses API as fallback.
 */
async function callOpenAIFallback(
  prompt: string,
  systemInstruction: string,
  expectJson: boolean
): Promise<{ text: string | null; status?: number }> {
  const openAIKey = process.env.OPENAI_API_KEY;
  if (!openAIKey || openAIKey.trim() === "" || openAIKey === "MY_OPENAI_API_KEY") {
    console.warn("[FailoverLayer] OpenAI API key not configured for fallback");
    return { text: null };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const instructions = expectJson
      ? `${systemInstruction}\n\nIMPORTANT: Return ONLY valid raw JSON matching the required schema with no preamble or code fences.`
      : systemInstruction;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAIKey}`,
        "Content-Type": "application/json"
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "gpt-4o",
        instructions,
        input: prompt,
        temperature: 0.0,
        max_output_tokens: 4096
      })
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      // Extract output text from Responses API output array
      const outputMsg = data.output?.[0]?.content?.[0]?.text || "";
      if (outputMsg && outputMsg.trim().length > 0) {
        return { text: outputMsg, status: 200 };
      }
    } else {
      const errText = await response.text();
      console.warn(`[FailoverLayer] OpenAI Responses API status ${response.status}: ${errText.slice(0, 120)}`);
    }
  } catch (err: any) {
    console.warn("[FailoverLayer] OpenAI Responses API error:", err?.message || err);
  }

  return { text: null };
}

/**
 * Execute Clinical Discuss request with Claude primary → OpenAI Responses API fallback.
 */
export async function executeCaseDiscussionWithFailover(
  conversationPrompt: string,
  systemInstruction: string
): Promise<FailoverCallResult> {
  const safePrompt = deidentifyText(conversationPrompt).deidentified;

  // 1. PRIMARY: Claude
  try {
    const claudeResult = await callClaudePrimary(safePrompt, systemInstruction, false);
    if (claudeResult.text && claudeResult.text.trim().length > 5) {
      return {
        success: true,
        response: claudeResult.text,
        provider: "anthropic"
      };
    }
  } catch (err: any) {
    console.warn("[FailoverLayer] Claude Discuss uncaught exception:", err?.message || err);
  }

  // 2. FALLBACK: OpenAI Responses API
  console.log("[FailoverLayer] Engaging OpenAI fallback for Case Discuss...");
  try {
    const openAIResult = await callOpenAIFallback(safePrompt, systemInstruction, false);
    if (openAIResult.text && openAIResult.text.trim().length > 5) {
      return {
        success: true,
        response: openAIResult.text,
        provider: "openai"
      };
    }
  } catch (err: any) {
    console.warn("[FailoverLayer] OpenAI Discuss uncaught exception:", err?.message || err);
  }

  // 3. BOTH PROVIDERS FAILED
  return {
    success: false,
    response: "I couldn't complete that response right now. Please try again.",
    error: "I couldn't complete that response right now. Please try again."
  };
}

/**
 * Execute Clinical Rounds request with Claude primary → OpenAI Responses API fallback.
 * Strictly preserves the requested clinical lens. Expects structured JSON.
 */
export async function executeRoundsDebriefWithFailover(
  prompt: string,
  systemInstruction: string
): Promise<FailoverCallResult> {
  const safePrompt = deidentifyText(prompt).deidentified;

  const parseJsonSafe = (rawText: string) => {
    const clean = rawText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "").trim();
    try {
      return JSON.parse(clean);
    } catch {
      return null;
    }
  };

  // 1. PRIMARY: Claude
  try {
    const claudeResult = await callClaudePrimary(safePrompt, systemInstruction, true);
    if (claudeResult.text) {
      const parsed = parseJsonSafe(claudeResult.text);
      if (parsed && typeof parsed === "object" && (parsed.content || parsed.response)) {
        const textContent = parsed.content || parsed.response;
        return {
          success: true,
          response: textContent,
          data: {
            ...parsed,
            content: textContent,
            usedLenses: Array.isArray(parsed.usedLenses) ? parsed.usedLenses : []
          },
          provider: "anthropic"
        };
      } else if (claudeResult.text.trim().length > 5) {
        return {
          success: true,
          response: claudeResult.text.trim(),
          data: {
            content: claudeResult.text.trim(),
            usedLenses: []
          },
          provider: "anthropic"
        };
      }
    }
  } catch (err: any) {
    console.warn("[FailoverLayer] Claude Rounds uncaught exception:", err?.message || err);
  }

  // 2. FALLBACK: OpenAI Responses API
  console.log("[FailoverLayer] Engaging OpenAI fallback for Rounds Debrief...");
  try {
    const openAIResult = await callOpenAIFallback(safePrompt, systemInstruction, true);
    if (openAIResult.text) {
      const parsed = parseJsonSafe(openAIResult.text);
      if (parsed && typeof parsed === "object" && (parsed.content || parsed.response)) {
        const textContent = parsed.content || parsed.response;
        return {
          success: true,
          response: textContent,
          data: {
            ...parsed,
            content: textContent,
            usedLenses: Array.isArray(parsed.usedLenses) ? parsed.usedLenses : []
          },
          provider: "openai"
        };
      } else if (openAIResult.text.trim().length > 5) {
        return {
          success: true,
          response: openAIResult.text.trim(),
          data: {
            content: openAIResult.text.trim(),
            usedLenses: []
          },
          provider: "openai"
        };
      }
    }
  } catch (err: any) {
    console.warn("[FailoverLayer] OpenAI Rounds uncaught exception:", err?.message || err);
  }

  // 3. BOTH PROVIDERS FAILED
  return {
    success: false,
    response: "Clinical rounds mentor is temporarily unavailable. Your case data is safe. Please try again shortly.",
    error: "Clinical rounds mentor is temporarily unavailable. Your case data is safe. Please try again shortly."
  };
}
