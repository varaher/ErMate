const fs = require('fs');
let code = fs.readFileSync('src/components/PrimarySurveySection.tsx', 'utf8');

const circBlock = `<div className="grid grid-cols-2 sm:grid-cols-3 gap-2 md:gap-3 mb-2 md:mb-3">
          <VitalInput
            label="HR"
            unit="/min"
            normal="60-100"
            flagHigh={100}
            flagLow={50}
            value={data.circulation?.hr || vitals?.hr || ""}
            onChange={(v) => {
              onChange("circulation.hr", v);
              onUpdateVitals?.("hr", v);
            }}
          />
          <div className="col-span-2 sm:col-span-1"><QuickSelect
            label="Rhythm"
            options={["Regular", "Irregular"]}
            value={data.circulation?.rhythm === "irregular" ? "Irregular" : "Regular"}
            onChange={(v) => onChange("circulation.rhythm", v.toLowerCase())}
          /></div>
          <VitalInput
            label="BP"
            unit="mmHg"
            placeholder="120/80"
            normal="120/80"
            flagHighSBP={160}
            flagLowSBP={90}
            value={
              data.circulation?.sbp && data.circulation?.dbp
                ? \`\${data.circulation.sbp}/\${data.circulation.dbp}\`
                : data.circulation?.sbp || vitals?.bp || ""
            }
            onChange={(v) => {
              const parts = v.split("/");
              onChange("circulation.sbp", parts[0] || "");
              onChange("circulation.dbp", parts[1] || "");
              onUpdateVitals?.("bp", v);
            }}
          />
        </div>`;

const circBlockNew = `<div className="grid grid-cols-2 sm:grid-cols-3 gap-2 md:gap-3 mb-2 md:mb-3">
          <VitalInput
            label="HR"
            unit="/min"
            normal="60-100"
            flagHigh={100}
            flagLow={50}
            value={data.circulation?.hr || vitals?.hr || ""}
            onChange={(v) => {
              onChange("circulation.hr", v);
              onUpdateVitals?.("hr", v);
            }}
          />
          <VitalInput
            label="BP"
            unit="mmHg"
            placeholder="120/80"
            normal="120/80"
            flagHighSBP={160}
            flagLowSBP={90}
            value={
              data.circulation?.sbp && data.circulation?.dbp
                ? \`\${data.circulation.sbp}/\${data.circulation.dbp}\`
                : data.circulation?.sbp || vitals?.bp || ""
            }
            onChange={(v) => {
              const parts = v.split("/");
              onChange("circulation.sbp", parts[0] || "");
              onChange("circulation.dbp", parts[1] || "");
              onUpdateVitals?.("bp", v);
            }}
          />
          <div className="col-span-2 sm:col-span-1"><QuickSelect
            label="Rhythm"
            options={["Regular", "Irregular"]}
            value={data.circulation?.rhythm === "irregular" ? "Irregular" : "Regular"}
            onChange={(v) => onChange("circulation.rhythm", v.toLowerCase())}
          /></div>
        </div>`;

if(code.includes(circBlock)) {
  code = code.replace(circBlock, circBlockNew);
  console.log("Circulation order fixed");
} else {
  console.log("Circulation block not found");
}

fs.writeFileSync('src/components/PrimarySurveySection.tsx', code);
