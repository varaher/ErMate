const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Inside ai-discharge
const gptEnd = `    } catch (gptErr: any) {
      console.error("[ai-discharge] GPT-4o fallback also failed:", gptErr?.message);
    }
  }`;

const newFallback = `    } catch (gptErr: any) {
      console.error("[ai-discharge] GPT-4o fallback also failed:", gptErr?.message);
    }
  }

  // ── STEP 3.5: Gemini 1.5 Pro FALLBACK ──
  try {
    const ai = getAI();
    const model = ai.models.get({ model: "gemini-1.5-pro" });
    const response = await model.generateContent({
      contents: prompt,
      config: {
        systemInstruction: finalSysInstruction,
        responseMimeType: "application/json",
        temperature: 0.0
      }
    });
    const data = JSON.parse(response.text || "{}");
    console.log("[ai-discharge] Gemini 1.5 Pro fallback succeeded");
    return res.json({ success: true, data, engine: "gemini-1.5-pro" });
  } catch (geminiErr: any) {
    console.error("[ai-discharge] Gemini fallback also failed:", geminiErr?.message);
  }`;

code = code.replace(gptEnd, newFallback);

fs.writeFileSync('server.ts', code);
console.log("Patched server.ts with Gemini fallback for ai-discharge");
