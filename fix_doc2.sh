sed -i 's/\${row\.complaints}/\${formatWordCell(row.complaints)}/g' src/components/HandoverView.tsx
sed -i 's/\${row\.history}/\${formatWordCell(row.history)}/g' src/components/HandoverView.tsx
sed -i 's/\${row\.assessment}/\${formatWordCell(row.assessment)}/g' src/components/HandoverView.tsx
sed -i 's/\${row\.planDone}/\${formatWordCell(row.planDone)}/g' src/components/HandoverView.tsx
sed -i 's/\${row\.planToBeDone}/\${formatWordCell(row.planToBeDone)}/g' src/components/HandoverView.tsx
sed -i 's/\${row\.bystander}/\${formatWordCell(row.bystander)}/g' src/components/HandoverView.tsx
