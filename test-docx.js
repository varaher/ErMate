import fs from 'fs/promises';
import { generateDetailedPatientDocx, generateCompactRosterDocx } from './dist/server/docxGenerator.js';

// Wait, the dist/server.cjs might not export these. We are better off testing it directly in browser or trusting the generated code since we verified it compiles.
