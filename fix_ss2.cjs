const fs = require('fs');
let code = fs.readFileSync('src/components/SecondarySurveySection.tsx', 'utf8');

code = code.replace(`                </div>
              </AccordionItem>
            );
          }`, `                </div>
                </div>
              </AccordionItem>
            );
          }`);

fs.writeFileSync('src/components/SecondarySurveySection.tsx', code);
