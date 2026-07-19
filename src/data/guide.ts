/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface GuideSection {
  id: string;
  title: string;
  content: string;
  badge?: string;
}

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "1-getting-started",
    title: "1. Getting Started",
    badge: "Core",
    content: `
ErMate runs as a **mobile app** (iOS and Android via Expo Go) and as a **web app** in any browser.

### Mobile (recommended):
1. Install **Expo Go** from the App Store or Google Play.
2. Open the camera or Expo Go app and scan the QR code from your hospital's ErMate link.
3. The app loads instantly — no separate download needed.

### Web:
1. Open \`ermate.in\` (or your hospital's custom domain) in Chrome, Safari, or any modern browser.
2. For the best experience on web, tap **Add to Home Screen** when prompted to install the PWA.
    `
  },
  {
    id: "2-signing-in",
    title: "2. Signing In",
    badge: "Access",
    content: `
### Email & Password
1. Enter your registered email and password.
2. Tap **Sign In**.

### Sign in with Google
1. Tap **Sign in with Google**.
2. Choose your Google account.
3. If an account already exists with that email, you will be prompted to enter your existing password to link the accounts — you only need to do this once.

### Sign in with Apple (iOS only)
1. Tap **Continue with Apple**.
2. Use Face ID / Touch ID to confirm.

### Forgot Password
1. Tap **Forgot Password?** below the Sign In button.
2. Enter your email address and tap **Send Reset Link**.
3. Check your inbox for the reset email. If it doesn't arrive within 5 minutes, check your spam/junk folder.
4. Click the link in the email and follow the steps to set a new password.

### First-time Registration
1. Tap **Sign Up** at the bottom of the login screen.
2. Fill in your name, email, password, role (Doctor / Resident / Nurse / Other), and hospital name.
3. Tap **Create Account**.
    `
  },
  {
    id: "3-dashboard",
    title: "3. Dashboard",
    badge: "Nav",
    content: `
The Dashboard is the first screen you see after signing in. It shows:

*   **Active Cases**: Number of cases you opened today
*   **Cases This Week**: Your weekly case count
*   **ErMate Credits**: Credits remaining for ErMate features
*   **My Weekly Stats**: Shortcut to your time-saved statistics

### Quick Actions at the top:
*   **New Case** — starts a full triage → case sheet flow
*   **Quick Case** — jumps straight into a case sheet with minimal patient info (for fast documentation)
    `
  },
  {
    id: "4-starting-case",
    title: "4. Starting a New Case",
    badge: "Workflow",
    content: `
### Full Flow (Recommended)
1. Tap **New Case** on the Dashboard or the **+** button.
2. Complete the **Triage** step (see Section 5).
3. You are taken into the **Case Sheet** automatically.

### Quick Case (Bypass Triage)
1. Tap **Quick Case** on the Dashboard.
2. Enter the patient's name and presenting complaint.
3. You go directly into the Case Sheet — triage data can be filled in later.

> **Tip:** Use Quick Case when the patient is critical and documentation speed is the priority. Use Full Flow for complete documentation from the start.
    `
  },
  {
    id: "5-triage",
    title: "5. Triage",
    badge: "Workflow",
    content: `
The Triage screen captures the first essential data points before opening the case sheet.

### Key Fields to complete:
*   **Patient Name**: Full name
*   **Age**: Automatically routes to Pediatric sheet if **≤ 16 years**
*   **Gender**: Male / Female / Other
*   **Presenting Complaint**: Chief reason for ER visit
*   **Triage Category**: P1 (Immediate) / P2 (Urgent) / P3 (Non-Urgent)
*   **Arrival Mode**: Walk-in / Ambulance / Referred
*   **Vitals**: BP, HR, SpO₂, RR, Temperature, GCS

Once you tap **Proceed**, ErMate creates the case and opens the Case Sheet.
    `
  },
  {
    id: "6-case-sheet-adult",
    title: "6. Case Sheet — Adult",
    badge: "Clinical",
    content: `
The Adult Case Sheet follows the **ATLS framework** with tabbed sections:

### Tabs Overview

1.  **Patient**
    *   View and edit vitals (color-coded for abnormal values)
    *   Patient demographics and triage summary
2.  **History**
    *   **SAMPLE** history: Signs & Symptoms, Allergies, Medications, Past history, Last meal, Events leading up
    *   Social history and family history
    *   Psychological assessment flags
3.  **Primary Assessment (ABCDE)**
    *   **Airway** status
    *   **Breathing** — RR, SpO₂, air entry
    *   **Circulation** — HR, BP, CRT
    *   **Disability** — GCS (E/V/M), GRBS, AVPU
    *   **Exposure** — Temperature, visible injuries
4.  **Secondary Assessment**
    *   Full head-to-toe examination findings
    *   Systems review
5.  **Investigations**
    *   Lab orders and results
    *   Imaging (X-ray, CT, USG, ECG)
    *   Free-text results entry
6.  **Treatment**
    *   Medications / drugs administered (dose, route, time)
    *   IV fluids
    *   Procedures performed (intubation, chest drain, catheter, etc.)
7.  **Progress Notes**
    *   Time-stamped clinical notes
    *   Nursing notes
8.  **ErMate Support**
    *   Clinical Decision Support (see Section 10)

### Saving a Case
*   Tap **Commit to Backend** (the save button) at any point.
*   A green banner confirms the save and shows how many minutes you saved vs paper documentation.
*   Cases auto-save locally as you type.
    `
  },
  {
    id: "7-case-sheet-pediatric",
    title: "7. Case Sheet — Pediatric",
    badge: "Clinical",
    content: `
Patients aged **16 years or under** automatically open the **Pediatric Case Sheet**, which follows **PALS guidelines**.

### Key differences from Adult:
*   Vitals normal ranges are **age-adjusted** and color-coded accordingly
*   Weight-based drug dosing references
*   Pediatric GCS scoring
*   Paediatric AVPU scale
*   PALS-based resuscitation reference card accessible from the sheet

Everything else (tabs, voice, ErMate, export) works the same as the adult sheet.
    `
  },
  {
    id: "8-voice-dictation",
    title: "8. Voice Dictation",
    badge: "ErMate Feature",
    content: `
Voice dictation lets you speak naturally and have the app fill in case sheet fields automatically.

### Smart Dictation (Full History)
Use this to dictate a complete patient history in one go.

1.  Tap the **microphone icon** at the top of the Case Sheet.
2.  Select **Smart Dictation**.
3.  Speak naturally: *"Patient is a 45-year-old male who came with chest pain for 2 hours, radiating to the left arm. He has a history of hypertension and is on amlodipine. No known drug allergies. Last meal 4 hours ago."*
4.  Tap **Stop** when done.
5.  ErMate transcribes your speech (Sarvam) and then uses ErMate to extract and populate the relevant fields — presenting complaint, history, allergies, medications, etc.
6.  Review the auto-filled fields and correct anything if needed.
7.  Tap **Apply** to confirm.

> Consumes **1 ErMate credit** per use.

### Field-Specific Dictation
For individual fields (e.g., just examination findings):

1.  Tap the **microphone icon** next to any specific field.
2.  Speak the content for that field only.
3.  Tap **Stop** — the field is populated automatically.

> **Tip:** Speak clearly and at a normal pace. The system understands medical terminology including drug names, anatomical terms, and clinical findings.
    `
  },
  {
    id: "9-document-scanning",
    title: "9. Document Scanning",
    badge: "ErMate Feature",
    content: `
Scan paper documents (referral letters, old records, lab reports) and have them automatically populate the case sheet.

1.  Tap the **scan icon** (camera with document) in the Case Sheet.
2.  Choose **Take Photo** (camera) or **Choose from Gallery**.
3.  ErMate reads the document using OCR (Sarvam Vision).
4.  ErMate extracts relevant clinical data and maps it to the appropriate fields.
5.  Review the extracted data and tap **Apply to Case**.

> Consumes **1 ErMate credit** per scan.

### Works well with:
*   Printed referral letters
*   Previous discharge summaries
*   Lab result printouts
*   Handwritten notes (clear handwriting)
    `
  },
  {
    id: "10-ai-decision-support",
    title: "10. ErMate Clinical Decision Support",
    badge: "ErMate Feature",
    content: `
Generates a differential diagnosis list based on everything documented in the case sheet.

### Running ErMate Support
1.  Go to the **ErMate Support** tab in the Case Sheet.
2.  Tap **Generate Differential**.
3.  Wait 5–10 seconds.

### Reading the Results
Each diagnosis is labelled:

*   **CONSISTENT**: Strongly supported by current clinical picture
*   **POSSIBLE**: Cannot be ruled out; worth investigating
*   **LESS LIKELY**: Low probability given current findings

Each entry includes:
*   Brief clinical reasoning
*   Relevant guideline citations (PubMed / WikEM references)
*   Suggested next steps

### Acting on Results
*   Tap **Add to Case** to include the diagnosis in the case documentation
*   Tap **Exclude** to dismiss a diagnosis (this teaches ErMate over time)

> An inline **disclaimer banner** is shown: ErMate suggestions are decision support only — clinical judgment takes precedence.
> Consumes **1 ErMate credit** per run.
    `
  },
  {
    id: "11-discharge-summary",
    title: "11. Discharge Summary",
    badge: "Clinical",
    content: `
Once the patient is ready for discharge, generate a structured discharge summary.

1.  From the Case Sheet, tap **Discharge** (bottom of screen or in the top menu).
2.  The Discharge Summary screen opens, pre-filled with data from the case sheet.
3.  Review and edit:
    *   Diagnosis (primary and secondary)
    *   Condition at discharge
    *   Discharge medications with instructions
    *   Follow-up plan
    *   Patient instructions / advice
4.  Optionally tap **ErMate Discharge Summary** to have ErMate draft the narrative sections.
5.  Tap **Save Discharge Summary**.

> ErMate Discharge Summary consumes **1 ErMate credit**.
    `
  },
  {
    id: "12-exporting-documents",
    title: "12. Exporting Documents",
    badge: "Workflow",
    content: `
Export any Case Sheet or Discharge Summary as a PDF or Word document.

1.  Open the completed Case Sheet or Discharge Summary.
2.  Tap the **Export** button (share icon, top right).
3.  Choose format:
    *   **PDF** — best for printing and sharing
    *   **DOCX** — editable in Microsoft Word / Google Docs
4.  The file is generated and your device's share sheet opens.
5.  Share via WhatsApp, email, save to files, or print directly.

> **Tip:** Use PDF for hospital records. Use DOCX if the referral hospital needs to edit the document.
    `
  },
  {
    id: "13-your-cases-list",
    title: "13. Your Cases List",
    badge: "Clinical",
    content: `
Access all your documented cases from the **Cases** tab (bottom navigation).

### List View
*   Cases sorted by most recent
*   Shows patient name, presenting complaint, age, date/time
*   Tap any case to reopen and continue editing

### By Complaint View
*   Tap the **tag icon** (top right of Cases screen) to switch to the grouped view
*   Cases grouped by presenting complaint (e.g., Chest Pain, Breathlessness, Fever)
*   Sorted by frequency — most common complaints at the top
*   Useful for auditing your case mix

### Searching Cases
*   Use the search bar at the top to filter by patient name or complaint
    `
  },
  {
    id: "14-learn-section",
    title: "14. Learn Section",
    badge: "EdTech",
    content: `
The Learn section (graduation cap icon) has three educational modules:

### 1. Simulation-Based Teaching
Interactive clinical case simulations that test your decision-making.
1.  Tap **Simulation**.
2.  Choose a case scenario (chest pain, trauma, pediatric emergency, etc.).
3.  You are presented with a patient presentation and asked to make decisions at each step.
4.  The simulation responds to your choices — investigations reveal findings, patient condition changes.
5.  At the end, a **debrief** explains the ideal management pathway with references.

### 2. EM Reference Library
An ErMate-powered chat for emergency medicine guidelines and drug references.
1.  Tap **EM Reference**.
2.  Type any clinical question: *"STEMI management protocol"*, *"Dose of adrenaline in anaphylaxis"*, *"Ottawa ankle rules"*
3.  Get a concise, evidence-based answer with citations.
> Consumes **1 ErMate credit** per query.

### 3. Trivia Time
Case-based MCQ quizzes to sharpen your knowledge.
1.  Tap **Trivia**.
2.  A clinical vignette is presented with 4 answer choices.
3.  Select your answer.
4.  The correct answer is revealed with a detailed explanation and the key teaching point.
5.  Progress through multiple questions per session.

**Weekly Streak:** Complete at least one quiz per week to build your streak. The streak counter is shown on the Trivia home screen.
    `
  },
  {
    id: "15-profile-settings",
    title: "15. Profile & Settings",
    badge: "Nav",
    content: `
Access from the **Profile** tab (bottom navigation, person icon).

### Account Info
Your name, email, hospital, and current subscription plan are shown at the top.

### Menu Options
*   **My Stats**: View your weekly cases, time saved, and all-time totals
*   **Link to Web**: Connect your phone to the web app (see Section 17)
*   **Upgrade Plan**: View and purchase subscription plans and ErMate credit packs
*   **Change Password**: Update your login password
*   **Set Password**: (Google sign-in users only) Set a password for email login
*   **Notifications**: Manage push notification preferences
*   **Privacy**: View privacy settings, data sharing preferences, biometric lock
*   **Help & Support**: FAQs, contact support
*   **Display Mode**: Switch between Auto / Always Light / Always Dark

### Changing Your Password
1.  Tap **Change Password** (email users) or **Set Password** (Google users).
2.  **Email users:** Enter your current password, then your new password twice.
3.  **Google users:** Enter your desired password twice (no current password needed).
4.  Tap **Update** / **Set Password**.
    `
  },
  {
    id: "16-web-app-access",
    title: "16. Web App Access",
    badge: "Core",
    content: `
The web app at \`ermate.in\` lets you access ErMate from any browser — useful on a hospital desktop or tablet.

### Features available on web:
*   View all your cases
*   Read case details
*   Expand full case notes
*   Access the device linking QR code

### Features only on mobile (Expo Go):
*   Voice dictation
*   Document scanning
*   Camera-based features
*   Native notifications

Log in to the web app the same way as the mobile app — email/password or Google.
    `
  },
  {
    id: "17-phone-linking",
    title: "17. Linking Your Phone to the Web App",
    badge: "Workflow",
    content: `
There are two ways to use your phone login to authenticate the web app.

### Method 1 — QR Code (Easiest)
1.  Open \`ermate.in\` on your desktop/tablet browser.
2.  At the login screen, tap **Sign in with Phone QR**.
3.  A QR code appears on the web screen.
4.  On your phone (already logged into ErMate), go to **Profile → Link to Web**.
5.  Tap **Scan QR Code** and point your phone camera at the QR on the screen.
6.  Tap **Approve** on your phone.
7.  The web app logs in automatically — no password typing needed.

### Method 2 — 6-Digit Code
1.  On your phone, go to **Profile → Link to Web**.
2.  A 6-digit code is shown (valid for a few minutes).
3.  On the web app login screen, enter this code.
4.  The web session is linked to your phone account.
    `
  },
  {
    id: "18-subscription-credits",
    title: "18. Subscription & ErMate Credits",
    badge: "Account",
    content: `
### Subscription Plans

*   **Free**: 10 cases total, no ErMate credits
*   **Base**: Unlimited cases, 20 ErMate credits / month
*   **ErMate Credit Packs**: Additional credits (add-on purchase)

### What uses ErMate Credits?

*   **Smart Dictation (full history)**: 1 credit
*   **Field-specific voice dictation**: 1 credit
*   **Document Scanning**: 1 credit
*   **ErMate Clinical Decision Support**: 1 credit
*   **EM Reference Library query**: 1 credit
*   **ErMate Discharge Summary**: 1 credit

> **ErMate credits never expire** — purchased credits roll over indefinitely.

### Upgrading
1.  Go to **Profile → Upgrade Plan**.
2.  Choose a plan or ErMate credit pack.
3.  Complete payment.
4.  Credits are available immediately.
    `
  },
  {
    id: "19-weekly-stats",
    title: "19. Weekly Stats",
    badge: "Account",
    content: `
See how much time you are saving versus paper documentation.

1.  Go to **Profile → My Stats** or tap the **My Weekly Stats** card on the Dashboard.
2.  The Stats screen shows:
    *   Cases documented this week
    *   **Time saved vs paper** (calculated as: paper average 18 min − digital average 4 min = **~14 min saved per case**)
    *   Your top presenting complaints for the week
    *   All-time case count and total time saved

> Time-saving is calculated automatically in the background as you document cases. No setup required.
    `
  },
  {
    id: "20-night-shift",
    title: "20. Night Shift / Display Mode",
    badge: "Nav",
    content: `
ErMate automatically switches to dark mode during night shift hours (**9 pm – 6 am**) to protect your eyes in a dim hospital environment.

### Display Options:
*   **Auto (9pm–6am)**: Dark mode during night hours, light mode during the day
*   **Always Light**: Light mode at all times
*   **Always Dark**: Dark mode at all times

### Changing Display Mode:
1.  Go to **Profile**.
2.  Scroll to the **Display Mode** section.
3.  Tap your preferred option. Change takes effect immediately.
    `
  },
  {
    id: "21-privacy-security",
    title: "21. Privacy & Security",
    badge: "Core",
    content: `
*   All case data is stored on secure servers and filtered so only **you** can see your cases — no cross-user data access.
*   Passwords are **never stored in plaintext** on the device or server.
*   The silent re-login system encrypts your session credentials using AES-256 encryption.
*   You can request deletion of your data at any time via **Profile → Privacy → Data Deletion Request**.
*   Data handling complies with **Indian Information Technology Act** and standard medical data protection practices.
*   ErMate processing (voice, scan, decision support) is done via secure API calls — patient data is not used to train AI models.
    `
  },
  {
    id: "22-troubleshooting",
    title: "22. Troubleshooting",
    badge: "Core",
    content: `
### "Session expired" / Logged out automatically
Your login session refreshes automatically in the background. If you are logged out, simply sign in again — the app will stay logged in for 30 days after that.

### Reset link not arriving
1.  Check your spam/junk folder.
2.  Make sure you entered the correct email address.
3.  Wait up to 5 minutes.
4.  If still not received, contact support.

### Voice dictation not working
1.  Make sure microphone permission is granted: Settings → ErMate / Expo Go → Microphone → Allow.
2.  Speak clearly in a quiet environment.
3.  Check your internet connection — transcription requires a live connection.

### Document scan not extracting data
1.  Ensure good lighting and the document is flat.
2.  Avoid shadows and blurring.
3.  For printed documents, results are best. Handwritten notes work if handwriting is clear.

### App is slow or loading
1.  Check your internet connection.
2.  Close and reopen the app.
3.  If on the web app, try a hard refresh (Ctrl+Shift+R / Cmd+Shift+R).

### Case not saving
1.  Check the internet connection.
2.  Tap the save/commit button again.
3.  The app saves a local copy — your work is not lost even without connection.
    `
  },
  {
    id: "23-shift-handover",
    title: "23. Shift Handover & Endorsements",
    badge: "Clinical",
    content: `
The **Shift Handover Board** (Endorsement Tracker) is a specialized module for managing and delegating patient care responsibility during clinical shift transitions.

### Key Workflows:
1. **Endorsing a Patient**: When your shift ends, or when transferring a patient to another ward/clinician, open the **Handover** tab. Click **Add Patient Handover** to register the patient's current status, complaints, medical history, initial assessment, and completed vs. pending tasks.
2. **Pending Actions (To Be Done)**: Document any critical outstanding items (e.g., pending CT scan, repeat electrolytes, bystander update) so the incoming doctor can resume care without delay.
3. **Registry View**: Shows all active patient handovers for the current ward/shift, categorized by status and urgency.
4. **Real-time Synchronization**: Handover logs sync instantly with our Firestore database, allowing all team members to view live updates simultaneously.
    `
  },
  {
    id: "24-acknowledgement-function",
    title: "24. Role of Acknowledgement",
    badge: "Clinical",
    content: `
The **Acknowledgement** function is the cornerstone of patient safety and closed-loop communication during clinical handovers.

### Why is Acknowledgement Critical?
* **Medicolegal Safety**: It establishes a clear, timestamped record of exactly *who* took over clinical responsibility of a patient and *when*. 
* **Closed-loop Transfer**: Instead of assuming the incoming doctor read the handover, the incoming doctor must actively review the card and tap **Acknowledge as Dr. [Name]**.
* **Clinical Accountability**: Once clicked, the card turns green, registering that care has been successfully accepted.

### How it Works:
1. Open the **Handover** registry or your Dashboard.
2. Review the patient's clinical state, active plans, and pending items.
3. Tap **Acknowledge** (marked by a checkbox/double-check icon).
4. The system automatically stamps your name and the exact time (e.g., *"Ack'd by Dr. Sarah Smith at 08:30 AM"*).
5. **Real-time Notifications**: The doctor who originally endorsed the patient receives an instant notification showing that the handover has been officially acknowledged, ensuring full peace of mind.
    `
  },
  {
    id: "25-ai-scribe-chat",
    title: "25. AI Clinical Scribe Chat",
    badge: "ErMate Feature",
    content: `
The **ErMate AI Scribe Chat** is a conversational medical companion designed to draft high-quality clinical documentation and clinical notes.

### Major Capabilities:
* **Conversational Notes Drafting**: Discuss clinical cases naturally or dictation-transcribe a patient encounter, and ask ErMate to *"Draft a standard SOAP note"* or *"Formulate a discharge summary outline"*.
* **Smart QuickPaste Integration**: Write a summary or clinical instruction in the scribe chat, click **Copy**, and use the QuickPaste panel to immediately inject the text into handover notes or patient charts.
* **Drug & Guidelines Reference**: Ask rapid clinical questions regarding dosing, contraindications, or emergency protocols directly within the chat window to receive structured answers.
    `
  },
  {
    id: "26-pediatric-drug-calculator",
    title: "26. Pediatric Drug Calculator",
    badge: "Clinical",
    content: `
Emergency pediatric care requires rapid and highly precise weight-based dosing. The **Pediatric Emergency Drug Calculator** solves this by automating complex calculations under pressure.

### How to Use the Calculator:
1. Tap the **Pediatric Drug Calculator** shortcut in the quick tools or Case Sheet view.
2. Enter the patient's **Age** or **Weight** (in kg). If only age is entered, the system estimates the weight based on standardized pediatric growth charts.
3. The calculator instantly generates exact doses, concentrations, and infusion guidelines for:
    * **Resuscitation Drugs**: Adrenaline, Atropine, Amiodarone, Sodium Bicarbonate.
    * **Intubation & Sedation**: Ketamine, Propofol, Fentanyl, Midazolam.
    * **Anticonvulsants**: Phenytoin, Levetiracetam, Diazepam.
    * **Antibiotics & Fluids**: Age/weight-adjusted maintenance fluids and first-line emergency antibiotics.
4. Always cross-verify calculated outputs with PALS references before administration.
    `
  },
  {
    id: "27-mobile-experience",
    title: "27. Mobile & PWA Experience",
    badge: "Nav",
    content: `
ErMate is built with a **Mobile-First Responsive Interface**, optimized to run flawlessly on smartphones, hospital tablets, and desktop computers.

### Smartphone Optimizations:
* **Single-Column Stacking**: On mobile screens, secondary sidebars and wide bento grids automatically stack into highly legible vertical views, keeping active forms readable and prevents horizontal scrolling.
* **Header Collapse & Navigation**: Desktop header text links (e.g., v2.4.0 Updates, Download App) automatically collapse on mobile screens into lightweight icons, saving precious vertical pixels.
* **Floating Quick Action Buttons**: Touch targets are scaled to at least **44px** to allow fast tap interactions during busy ER rounds.
* **PWA Offline Support**: Install ErMate to your home screen using the **Download App** button. This configures the Progressive Web App (PWA) cache, allowing rapid launching and access to local records even with unstable hospital Wi-Fi.
    `
  }
];
