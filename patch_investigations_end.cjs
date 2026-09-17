const fs = require('fs');
let code = fs.readFileSync('src/components/CaseSheetView.tsx', 'utf8');

const endInvest = `                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Investigations Ordered Checklist (Extracted from Voice Scribe)  */}`;

const newEndInvest = `                      </span>
                    </button>
                  ))}
                </div>
                </details>
              </div>

              {/* Investigations Ordered Checklist (Extracted from Voice Scribe)  */}`;

code = code.replace(endInvest, newEndInvest);
fs.writeFileSync('src/components/CaseSheetView.tsx', code);
