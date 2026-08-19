const fs = require('fs');
const content = `export const guideData = [
  {
    id: "01-getting-started",
    title: "1. Getting Started & Dashboard",
    badge: "Core",
    content: \`Welcome to **ErMate**. The application opens directly to your **Dashboard**, which serves as your clinical command center.
### Dashboard Highlights:
*   **Active Cases List**: Displays all patients currently under your care, sorted chronologically.
*   **Quick Tools**: Access Voice Scribe, Document Scan, Handover Board, and the Pediatric Drug Calculator instantly from the top panel.
*   **Weekly Stats**: Tracks your case volume, average time saved per case, and most common presenting complaints.
*   **Profile Settings**: Access your user settings, display preferences, and team invites via the profile icon in the top right.\`
  },
  {
    id: "02-new-patient",
    title: "2. Adding a New Patient",
    badge: "Clinical",
    content: \`Tap the **+ New Patient** button on the Dashboard. You will see three intake options:
1.  **Voice Scribe**: Dictate the case naturally. ErMate will automatically extract vitals, history, and examination findings into a structured case sheet.
2.  **Scan Document (OCR)**: Snap a picture of a handwritten referral note or paper triage sheet. ErMate will digitize and structure the data instantly.
3.  **Manual Entry**: Open a blank case sheet with guided fields (Adult or Pediatric).\`
  },
  {
    id: "03-voice-scribe",
    title: "3. Voice Scribe & Dictation",
    badge: "ErMate Feature",
    content: \`The **Voice Scribe** allows you to speak your patient assessment naturally (in English, Hindi, Tamil, or other supported vernacular languages).
### How to use Voice Scribe:
1.  Tap **Speak the Case (Voice Scribe)** from the New Patient menu, or tap the **Mic Icon** inside any existing case sheet.
2.  Speak freely. You do not need to follow a strict order. For example: *"50 year old male, chest pain since 2 hours, BP 150/90, heart rate 110, ECG shows ST elevation, plan is to start aspirin and arrange cath lab."*
3.  ErMate Voice API will automatically translate vernacular languages to English, remove filler words, and extract clinical entities (Vitals, Symptoms, Plan) directly into the correct case sheet tabs.
4.  **Note**: Audio recordings are processed in chunks. You can record cases up to **10 minutes** long. Wait for the processing to finish before closing the window.\`
  },
  {
    id: "04-document-scanner",
    title: "4. Document Scanner (OCR)",
    badge: "ErMate Feature",
    content: \`Use the **Document Scanner** to digitize handwritten triage notes, referral letters, or lab reports.
### How to scan:
1.  Tap **Scan Document** from the New Patient menu.
2.  Upload or take a photo of the document.
3.  ErMate's vision AI will process the image, extract relevant clinical data (like vitals, past history, and current medications), and auto-fill the case sheet.
4.  Always review the extracted data for accuracy before saving.\`
  },
  {
    id: "05-case-sheet-tabs",
    title: "5. The 11-Tab Case Sheet",
    badge: "Clinical",
    content: \`ErMate uses a comprehensive **11-Tab Case Sheet** to organize patient data cleanly:
1.  **Chief Complaints**: Primary presentation and triage details.
2.  **Primary Survey**: Airway, Breathing, Circulation, Disability, Exposure (ABCDE), and Vitals.
3.  **SAMPLE History**: Symptoms, Allergies, Medications, Past history, Last meal, Events.
4.  **Secondary Survey**: Head-to-toe examination findings.
5.  **Investigations**: Labs, Imaging, ECG, and Point-of-Care Ultrasound (e.g., EFAST).
6.  **Treatment Orders**: Medications, IV fluids, and interventions given in the ER.
7.  **Clinical Notes**: Free-text progress notes and nursing logs.
8.  **Disposition**: Admission, Discharge, Transfer, or LAMA details, including checklists.
9.  **Pediatrics**: Specialized fields for pediatric patients (PAT triangle, birth history, developmental milestones).
10. **Vital Trends**: Graphical tracking of vital signs over time.
11. **Rounds & Debrief**: Educational debriefs and clinical decision support logs.\`
  },
  {
    id: "06-clinical-decision-support",
    title: "6. Clinical Decision Support",
    badge: "ErMate Feature",
    content: \`ErMate includes an advanced **Clinical Decision Support Engine** to assist with complex cases.
### Features:
*   **Differential Diagnoses**: Based on the current case sheet, tap **Generate Differentials** to receive a ranked list of potential diagnoses with supporting and refuting evidence.
*   **Automated Alert Flags**: Abnormal vital signs and critical lab values (e.g., hyperkalemia, severe tachycardia) are automatically flagged in red.
*   **ABG/VBG Interpretation**: Enter blood gas values to receive automatic acid-base interpretation.\`
  },
  {
    id: "07-discharge-summary",
    title: "7. Auto Discharge Summaries",
    badge: "Clinical",
    content: \`When a patient's disposition is set to **Discharged**, ErMate can generate a complete discharge summary in seconds.
1.  Open a discharged case and tap **Generate Discharge Summary**.
2.  ErMate synthesizes the entire ER course, including presenting complaints, vitals, treatments given, and final instructions.
3.  The summary is formatted into standard clinical tabs (Admin, Clinical History, Course & Plan).
4.  You can edit the summary and export it as a clean PDF for the patient.\`
  },
  {
    id: "08-handover-board",
    title: "8. Shift Handover & Endorsements",
    badge: "Clinical",
    content: \`The **Handover Board** ensures safe transitions between shifts.
1.  **Endorse a Patient**: Go to the **Handover** tab and tap **Add Patient Handover**. Enter the current status, pending tasks (e.g., pending CT, waiting for cross-consult), and key alerts.
2.  **Acknowledge**: The incoming doctor reviews the active handovers and taps **Acknowledge**. This stamps their name and the exact time, ensuring medico-legal safety and closed-loop communication.
3.  **Print Handovers**: Tap **Print / Export** to generate a compact, 1-page PDF of all active handovers to carry during rounds.\`
  },
  {
    id: "09-mortality-audit",
    title: "9. Mortality Audit & M&M",
    badge: "Clinical",
    content: \`For patients who unfortunately expire in the ER, ErMate provides a structured **Mortality Audit** tool for Morbidity & Mortality (M&M) reviews.
1.  Change the patient's disposition to **Death / Expired**.
2.  Tap the **Mortality Audit** button.
3.  ErMate will analyze the case timeline, interventions, and vitals to generate a confidential, structured audit report highlighting potential areas for system improvement or clinical learning.
4.  All PHI (Protected Health Information) is stripped before AI analysis.\`
  },
  {
    id: "10-team-roster",
    title: "10. Team Roster & Roles",
    badge: "Core",
    content: \`ErMate supports role-based access control (RBAC) to manage your ER team.
### Roles:
*   **HOD (Head of Department)**: Can invite members, approve role upgrades, and view department-wide analytics.
*   **Consultant / Attending**: Senior clinicians overseeing cases.
*   **EM Resident**: Standard role for doctors actively charting cases.
*   **Nursing Staff**: Can view cases and add vitals/nursing logs.

### Inviting Team Members:
If you are an HOD, go to the **Team Roster** and tap **Generate Invite Link**. Share this secure, single-use token with new staff to join your hospital's workspace.\`
  },
  {
    id: "11-learn-simulations",
    title: "11. Learn & Simulations",
    badge: "Education",
    content: \`The **Learn** tab provides interactive educational tools for residents and medical students.
*   **Virtual Patient Scenarios**: Run simulated ER cases (e.g., Acute MI, Polytrauma) where you must make diagnostic and treatment decisions in real-time.
*   **Scribe Chat Discussion**: Use the clinical chat to ask ErMate general medical questions, request drug dosages, or discuss hypothetical case presentations.
*   **Educational Insights**: After closing a real case, the Rounds & Debrief tab provides educational pearls based on the patient's presentation.\`
  },
  {
    id: "12-pediatric-calculator",
    title: "12. Pediatric Drug Calculator",
    badge: "Clinical",
    content: \`The **Pediatric Emergency Drug Calculator** automates weight-based dosing.
1.  Tap the calculator icon in the top header.
2.  Enter the child's **Age** or **Weight (kg)**.
3.  Instantly view precise dosages for Resuscitation (Adrenaline, Amiodarone), Sedation (Ketamine, Fentanyl), Anticonvulsants, and Maintenance Fluids.
*Always cross-verify with local guidelines before administration.*\`
  },
  {
    id: "13-privacy-security",
    title: "13. Privacy, DPDP Act & Security",
    badge: "Core",
    content: \`Patient data security is paramount in ErMate.
*   **PHI De-identification**: Before any case data is sent to ErMate AI engines (for differentials, handovers, or mortality audits), all Protected Health Information (Names, Phone Numbers, UHIDs, specific dates) is scrubbed locally on the server.
*   **Compliance**: ErMate is designed with the Indian DPDP Act 2023 in mind.
*   **Data Isolation**: Your hospital's data is isolated. Only invited team members can view the department's cases.
*   **No Training**: Your clinical data is never used to train ErMate's AI models.\`
  },
  {
    id: "14-display-export",
    title: "14. Display Modes & Exports",
    badge: "Nav",
    content: \`### Display Modes:
ErMate supports **Light** and **Dark** modes. You can set it to switch automatically during night shifts (9 PM - 6 AM) to reduce eye strain. Change this in **Profile -> Settings**.

### PDF Exports:
Every case sheet, discharge summary, and handover board can be exported as a clean, professionally formatted PDF.
1.  Open the item.
2.  Tap **Print / Export PDF**.
3.  The system will generate a printable document suitable for physical medical records or sharing with patients.\`
  },
  {
    id: "15-admin-panel",
    title: "15. Admin & Billing",
    badge: "Core",
    content: \`HODs and Hospital Administrators can access the **Admin Panel** to manage the department's ErMate usage.
*   View estimated AI API costs.
*   Manage active subscriptions (ErMate Standard vs ErMate Pro).
*   Review pending role upgrade requests (e.g., a Resident requesting Consultant status).
*   Monitor total active cases and team member activity.\`
  }
];
`;
fs.writeFileSync('src/data/guide.ts', content);
