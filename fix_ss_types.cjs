const fs = require('fs');
let code = fs.readFileSync('src/components/SecondarySurveySection.tsx', 'utf8');

code = code.replace(/<AccordionItem\\s+key=\\{key\\}\\s+title=\\{label \\+ \" Examination\"\\}\\s+summary=\\{summary\\}\\s+iconLetter=\\{icon\\}/g, 
  `<AccordionItem
                key={key}
                title={label + " Examination"}
                summary={summary}
                iconLetter={icon}
                iconBgClass="bg-blue-100 dark:bg-blue-900"
                iconTextClass="text-blue-700 dark:text-blue-300"`);

code = code.replace(/<AccordionItem\\s+key=\\{key\\}\\s+title=\\{label\\}\\s+summary=\\{summary\\}\\s+iconLetter=\\{icon\\}/g, 
  `<AccordionItem
            key={key}
            title={label}
            summary={summary}
            iconLetter={icon}
            iconBgClass="bg-blue-100 dark:bg-blue-900"
            iconTextClass="text-blue-700 dark:text-blue-300"`);

fs.writeFileSync('src/components/SecondarySurveySection.tsx', code);
