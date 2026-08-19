sed -i 's/const s = c.secondarySurvey || {};/const s = c;/' src/components/MlcCertificatesView.tsx
sed -i 's/s.headAndNeck/s.secondaryPicle/g' src/components/MlcCertificatesView.tsx
sed -i 's/s.chest/s.secondaryChest/g' src/components/MlcCertificatesView.tsx
sed -i 's/s.abdomen/s.secondaryPa/g' src/components/MlcCertificatesView.tsx
sed -i 's/s.neurological/s.secondaryCns/g' src/components/MlcCertificatesView.tsx
sed -i 's/s.extremities/s.secondaryExtremities/g' src/components/MlcCertificatesView.tsx
