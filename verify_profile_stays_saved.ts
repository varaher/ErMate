import fs from "fs";
const a = fs.readFileSync("src/App.tsx", "utf8");
let f = 0;
const t = (n: string, c: boolean) => { console.log(`${c ? "PASS" : "FAIL"}: ${n}`); if (!c) f++; };
t("sticky flag defined", /isProfileGateCleared = isProfileComplete \|\| \(profile as any\)\?\.onboardingComplete === true/.test(a));
t("gate uses sticky flag", /!isVerifiedTeamUser && !isProfileGateCleared\) \|\| showOnboardingProfile/.test(a));
t("location no longer blocks the gate", !/!hasHospitalLocation\(profile\)\)\) \|\| showOnboardingProfile/.test(a));
t("edit save closes for saved profiles", /wasAlreadyComplete = isProfileGateCleared/.test(a));
process.exit(f ? 1 : 0);