const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const badBlock = `    const claudeResult = await callClaudeSonnetOnly(prompt, sysInstruction, true);
    if (claudeResult && Array.isArray(claudeResult) && claudeResult.length > 0) {
      return res.json({ success: true, data: claudeResult, model: "claude-sonnet-4-6" });
    }
    
    return res.json({ success: false, error: "Clinical assistant busy — try again in a moment", reply: "Clinical assistant busy — try again in a moment" });
  } catch (error: any) {
    console.error("[Clinical Reasoning] CDS Error:", error?.message || error);
    return res.json({ success: false, error: "Clinical assistant busy — try again in a moment", reply: "Clinical assistant busy — try again in a moment" });
  }
});`;

const goodBlock = `    const claudeResult = await callClaudeSonnetOnly(prompt, sysInstruction, true);
    if (claudeResult) {
      return claudeResult;
    }
  } catch (error) {
    console.error("Clinical summary error:", error);
  }
  return {
    summary: "",
    workingDiagnosis: [],
    keyPoints: [],
    references: [],
    alerts: []
  };
}`;

if (code.includes(badBlock)) {
  code = code.replace(badBlock, goodBlock);
  fs.writeFileSync('server.ts', code);
  console.log("Fixed successfully!");
} else {
  console.log("Could not find bad block.");
}
