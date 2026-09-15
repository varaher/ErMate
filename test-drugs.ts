import { cleanExtractionOutput } from "./server/extractionCleanup.ts";

const raw = {
  "treatment": [
    {
      "drugName": "tranexamic acid",
      "dose": null,
      "route": null,
      "instruction": null,
      "timeGiven": null
    },
    {
      "drugName": "Sompraz",
      "dose": null,
      "route": null,
      "instruction": null,
      "timeGiven": null
    },
    {
      "drugName": "Emeset",
      "dose": null,
      "route": null,
      "instruction": null,
      "timeGiven": null
    },
    {
      "drugName": "analgesia appropriate for child's weight",
      "dose": null,
      "route": null,
      "instruction": null,
      "timeGiven": null
    }
  ]
};

console.log(JSON.stringify(cleanExtractionOutput(raw as any).drugs, null, 2));
