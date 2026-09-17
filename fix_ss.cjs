const fs = require('fs');
let code = fs.readFileSync('src/components/SecondarySurveySection.tsx', 'utf8');

code = code.replace(`                </div>
              </div>
            );
          }`, `                </div>
              </AccordionItem>
            );
          }`);

code = code.replace(`            </div>
          </div>
        )})}
      </div>
    </div>
  );
}`, `            </div>
          </div>
          </AccordionItem>
        );
      })}
      </div>
    </div>
  );
}`);

fs.writeFileSync('src/components/SecondarySurveySection.tsx', code);
