const existingMatch = {
    id: "case-123",
    isPediatric: true,
    patient: {
        name: "Test",
        age: 5,
        gender: "Female"
    }
};

const extracted = {
    age: null,
    isPediatric: undefined
};

const parsedAge = (extracted.age !== null && extracted.age !== undefined && extracted.age !== "") ? Number(extracted.age) : null;
const isAgeValid = parsedAge !== null && !isNaN(parsedAge);
const finalAge = isAgeValid ? parsedAge : null;

const updatedCase = {
    patient: {
        age: finalAge !== null ? finalAge : existingMatch?.patient.age || null,
    },
    isPediatric: extracted.isPediatric !== undefined ? Boolean(extracted.isPediatric) : (finalAge !== null && finalAge <= 16),
};

console.log("Updated Case:", updatedCase);
