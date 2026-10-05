import {
  planMateConversation,
} from "../src/mate/mateConversationPlanner";

function expect(
  condition: boolean,
  label: string
) {
  if (!condition) {
    console.error(`❌ ${label}`);
    process.exit(1);
  }

  console.log(`✅ ${label}`);
}

console.log(
  "\n=== MATE CONVERSATION PLANNER TESTS ===\n"
);

const occupancy =
  planMateConversation("Is 10 b occupied?");

expect(
  occupancy.actions.includes("BED_STATUS"),
  `"Is 10 b occupied?" -> BED_STATUS`
);

expect(
  !occupancy.actions.includes("CASE_SUMMARY"),
  `Occupancy question does not invent CASE_SUMMARY`
);

const compound =
  planMateConversation(
    "I think 10 b is occupied, please open bed 10 b and summarise the case"
  );

expect(
  compound.actions.includes("BED_STATUS"),
  `Compound command includes BED_STATUS`
);

expect(
  compound.actions.includes("PATIENT_OPEN"),
  `Compound command includes PATIENT_OPEN`
);

expect(
  compound.actions.includes("CASE_SUMMARY"),
  `Compound command includes CASE_SUMMARY`
);

const openIt =
  planMateConversation("Open it.");

expect(
  openIt.actions.includes("PATIENT_OPEN"),
  `"Open it" -> PATIENT_OPEN`
);

expect(
  openIt.refersToRecentPatient === true,
  `"Open it" requires recent patient context`
);

const summariseHim =
  planMateConversation("Summarise him.");

expect(
  summariseHim.actions.includes("CASE_SUMMARY"),
  `"Summarise him" -> CASE_SUMMARY`
);

expect(
  summariseHim.refersToRecentPatient === true,
  `"Summarise him" requires recent patient context`
);

const caseSheet =
  planMateConversation("Open his case sheet.");

expect(
  caseSheet.actions.includes("CASE_SHEET_OPEN"),
  `"Open his case sheet" -> CASE_SHEET_OPEN`
);

expect(
  caseSheet.refersToRecentPatient === true,
  `"Open his case sheet" uses recent patient context`
);

const previous =
  planMateConversation(
    "Go back to the previous patient"
  );

expect(
  previous.actions.includes("PREVIOUS_PATIENT"),
  `"Go back to previous patient" -> PREVIOUS_PATIENT`
);

const clinicalUpdate =
  planMateConversation(
    "Bed 10B BP is now 90/50"
  );

expect(
  clinicalUpdate.mayContainClinicalUpdate === true,
  `BP update is protected as clinical content`
);

const clinicalCompound =
  planMateConversation(
    "Bed 10B BP is now 90/50, add that and open his case sheet"
  );

expect(
  clinicalCompound.actions.includes("CASE_SHEET_OPEN"),
  `Clinical + action command keeps CASE_SHEET_OPEN`
);

expect(
  clinicalCompound.mayContainClinicalUpdate === true,
  `Clinical + action command preserves Scribe content`
);

const plainClinical =
  planMateConversation(
    "Patient has fever for two days"
  );

expect(
  plainClinical.actions.length === 0,
  `Ordinary clinical dictation is not converted into an app action`
);

expect(
  plainClinical.mayContainClinicalUpdate === false,
  `Ordinary narrative remains normal Scribe input`
);

console.log(
  "\n✅ MATE CONVERSATION PLANNER CONTRACT PASSED\n"
);
