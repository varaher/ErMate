const fs = require('fs');

let content = fs.readFileSync('src/components/DischargeSummaryView.tsx', 'utf8');

const startTag = `<div className="p-8 md:p-10 font-sans leading-relaxed text-[11px] text-slate-900 bg-white space-y-5 select-text max-w-full print:p-0 print:m-0 print:w-full print:max-w-full" id="print-sheet-content">`;
const endTag = `              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}`;

let startIdx = content.indexOf(startTag);
if (startIdx === -1) {
    console.error("Start tag not found.");
    process.exit(1);
}

// Find the end of the div
let divCount = 0;
let idx = startIdx;
while (idx < content.length) {
    if (content.substr(idx, 4) === '<div') divCount++;
    if (content.substr(idx, 5) === '</div') divCount--;
    if (divCount === 0) {
        idx += 6; // Include closing tag
        break;
    }
    idx++;
}
let endIdx = idx;

const newContent = `
<div className="p-8 md:p-10 font-sans leading-relaxed text-[12px] text-slate-900 bg-white space-y-4 select-text max-w-full print:p-0 print:m-0 print:w-full print:max-w-full print:text-[12px] whitespace-pre-wrap" id="print-sheet-content">
  <div className="font-bold mb-4 text-[14px]">Discharge Summary</div>

  <div><span className="font-bold">MLC:</span> {isMlc === "Yes" ? \`Yes (\${mlcNo})\` : "No"}</div>

  <div><span className="font-bold">Allergy :</span> {allergies}</div>

  <div className="font-bold mt-4">Vitals at the time of arrival:</div>
  <div>HR-{arrivalHr} ,BP-{arrivalBp} ,RR-{arrivalRr} ,SpO2-{arrivalSpo2} ,GCS-{arrivalGcs} ,Pain Score-{arrivalPainScore} ,GRBS-{arrivalGrbs} ,Temp-{arrivalTemp}</div>

  <div className="font-bold mt-4">Presenting Complaints:</div>
  <div>{presentingComplaints}</div>

  <div className="font-bold mt-4">History of Present Illness:</div>
  <div>{historyOfPresentIllness}</div>

  <div className="font-bold mt-4">Past Medical/Surgical Histories:</div>
  <div>{pastMedicalHistory}</div>

  <div><span className="font-bold">Family / Gynae History :</span> {familyGynaeHistory}</div>
  <div><span className="font-bold">LMP :</span> {lmp}</div>

  <div className="font-bold mt-4">General Examination / Systemic examination:</div>
  <div>{generalExamination}</div>
  
  <div className="font-bold mt-4">Primary Assessment:</div>
  <div><span className="font-bold">Airway &rarr;</span> {primaryAirway} ,Intervention- {primaryAirwayIntervention}</div>
  <div><span className="font-bold">Breathing &rarr;</span> Work of breathing- {primaryBreathingWork} ,Air entry- {primaryBreathingAirEntry}</div>
  <div><span className="font-bold">Circulation &rarr;</span> CRT- {primaryCirculationCrt} , Distended Neck Veins- {primaryCirculationDnv} , PCT- {primaryCirculationPct}</div>
  <div>Long bone deformity- {primaryCirculationDeformity} ,FAST- {primaryCirculationFast} ,Interventions- {primaryCirculationInterventions}</div>
  <div><span className="font-bold">Disability &rarr;</span> AVPU/GCS- {primaryDisabilityAvpuGcs} ,Pupils- {primaryDisabilityPupils} ,GRBS- {primaryDisabilityGrbs}</div>
  <div><span className="font-bold">Exposure &rarr;</span> Temp- {primaryExposureTemp} | Trauma- {primaryExposureTrauma}</div>

  <div className="font-bold mt-4">Secondary Assesment:</div>
  <div>Pallor Icterus Cyanosis Clubbing Lymphadenopathy Edema : {secondaryPicle}</div>
  <div><span className="font-bold">CHEST-</span> {secondaryChest}</div>
  <div><span className="font-bold">CVS-</span> {secondaryCvs}</div>
  <div><span className="font-bold">P/A-</span> {secondaryPa}</div>
  <div><span className="font-bold">CNS-</span> {secondaryCns}</div>
  <div><span className="font-bold">EXTREMITIES-</span> {secondaryExtremities}</div>

  <div className="font-bold mt-4">Course in Hospital with Medications and Procedure:</div>
  <div>{courseInHospital}</div>
  <div>{dischargeMedications}</div>

  <div className="font-bold mt-4">Investigations:</div>
  <div>{investigationsResults}</div>

  <div className="font-bold mt-4">Condition at time of discharge:</div>
  <div>({dischargeCondition})</div>

  <div className="font-bold mt-4">Vitals at the time of Discharge:</div>
  <div>HR-{dischargeHr} ,BP-{dischargeBp} ,RR-{dischargeRr} ,SpO2-{dischargeSpo2} ,GCS-{dischargeGcs} ,Pain Score-{dischargePainScore} ,GRBS-{dischargeGrbs} ,Temp-{dischargeTemp}</div>

  <div className="font-bold mt-4">Follow-Up Advice:</div>
  <div>{followUpPlan}</div>

  <div className="mt-8 flex gap-8">
    <div><span className="font-bold">ED Resident:</span> {emResidentName}</div>
    <div><span className="font-bold">ED Consultant:</span> {emConsultantName}</div>
  </div>

  <div className="flex gap-8 mt-2">
    <div><span className="font-bold">Sign and Time:</span> ___________________</div>
    <div><span className="font-bold">Sign and Time:</span> ___________________</div>
  </div>
  
  <div className="mt-2"><span className="font-bold">Date:</span> {new Date().toLocaleDateString([], { dateStyle: 'short' })}</div>

  <div className="mt-8">In case of emergency, contact: 0484-2905100</div>
  <div className="mt-2 font-bold">Hospital Address and Contact Information:</div>
  <div>Chunangamvely, Aluva, Ernakulam, Kerala - 683 112</div>
  <div>Phone: 0484-2905000 / 0484-2905100</div>

  <div className="mt-8 text-[11px] leading-snug">This discharge summary provides clinical information meant to facilitate continuity of patient care. For statutory purposes, a physical copy of this record must be preserved.</div>

</div>`;

content = content.substring(0, startIdx) + newContent.trim() + content.substring(endIdx);
fs.writeFileSync('src/components/DischargeSummaryView.tsx', content);

