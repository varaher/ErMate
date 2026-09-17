const fs = require('fs');
let code = fs.readFileSync('src/components/PrimarySurveySection.tsx', 'utf8');

const awGridOld = `<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">`;
const awGridNew = `<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">`;

const brGrid1Old = `<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <VitalInput
            label="RR"`;
const brGrid1New = `<div className="grid grid-cols-2 sm:grid-cols-3 gap-2 md:gap-3 mb-2 md:mb-3">
          <VitalInput
            label="RR"`;

const brGrid2Old = `<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <QuickSelect
            label="Work of Breathing"`;
const brGrid2New = `<div className="grid grid-cols-2 sm:grid-cols-3 gap-2 md:gap-3">
          <QuickSelect
            label="Work of Breathing"`;

const crGrid1Old = `<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <VitalInput
            label="HR"`;
const crGrid1New = `<div className="grid grid-cols-2 sm:grid-cols-3 gap-2 md:gap-3 mb-2 md:mb-3">
          <VitalInput
            label="HR"`;

const crGrid2Old = `<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <QuickSelect
            label="CRT"`;
const crGrid2New = `<div className="grid grid-cols-2 sm:grid-cols-3 gap-2 md:gap-3 mb-2 md:mb-3">
          <QuickSelect
            label="CRT"`;

const crGrid3Old = `<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TextInput
            label="Peripheral Circulation"`;
const crGrid3New = `<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3">
          <TextInput
            label="Peripheral Circulation"`;

if(code.includes(awGridOld)) code = code.replace(awGridOld, awGridNew);
if(code.includes(brGrid1Old)) code = code.replace(brGrid1Old, brGrid1New);
if(code.includes(brGrid2Old)) code = code.replace(brGrid2Old, brGrid2New);
if(code.includes(crGrid1Old)) code = code.replace(crGrid1Old, crGrid1New);
if(code.includes(crGrid2Old)) code = code.replace(crGrid2Old, crGrid2New);
if(code.includes(crGrid3Old)) code = code.replace(crGrid3Old, crGrid3New);

fs.writeFileSync('src/components/PrimarySurveySection.tsx', code);
console.log("Updated grids 1");
