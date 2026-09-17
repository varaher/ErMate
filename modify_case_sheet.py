import re

with open('src/components/CaseSheetView.tsx', 'r') as f:
    content = f.read()

# 1. Add state variable
state_var = '  const [showSafetyModal, setShowSafetyModal] = useState<boolean>(false);\n'
if 'showSafetyModal' not in content:
    content = re.sub(r'(const \[showPostSaveModal, setShowPostSaveModal\] = useState<boolean>\(false\);)', r'\1\n' + state_var, content)

# 2. Add hasSafetyData variable near the top or before the menu
has_safety_data = '''
  const hasSafetyData = 
    Object.values(currentCase.ipsgChecklist || {}).some(v => v === true || v === "Low" || v === "Medium" || v === "High") ||
    Object.values(currentCase.vulnerableAssessment || {}).some(v => v === true || (typeof v === "string" && v !== "")) ||
    Object.values(currentCase.consentTimeOut || {}).some(v => v === true);
'''
if 'hasSafetyData' not in content:
    content = re.sub(r'(const handleSave = async \(\) => \{)', has_safety_data + r'\n  \1', content)

# 3. Add to More Menu
more_menu_item = '''                  <button onClick={() => setShowSafetyModal(true)} className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-between font-medium">
                    <div className="flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5" /> Safety & Accreditation <span className="text-[9px] text-slate-400 font-normal ml-1">(Optional)</span>
                    </div>
                    {hasSafetyData && <div className="w-2 h-2 rounded-full bg-emerald-500" title="Data entered"></div>}
                  </button>
                  <div className="h-px bg-slate-100 dark:bg-slate-800 my-1.5" />'''

if 'Safety & Accreditation' not in content:
    content = re.sub(
        r'(<button onClick=\{\(\) => triggerPrintWithTip\(\)\} className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-2">\s*<Printer className="w-3.5 h-3.5" /> Print\s*</button>\s*<div className="h-px bg-slate-100 dark:bg-slate-800 my-1.5" />)',
        r'\1\n' + more_menu_item,
        content
    )

# 4. Extract Safety & Accreditation Block (JCI & NABH Accreditation Audit Form)
# It's inside `{activeTab === "disposition" && ( ... )}`
# Let's find it.
jci_pattern = r'\{/\* JCI/NABH Accreditation & Patient Safety Tab  \*/\}.*?\{activeTab === "disposition" && \(\s*<div className="space-y-4">\s*(<div className="border-b pb-2\.5 flex items-center justify-between">.*?Procedure "Time-Out".*?</div>\s*</label>\s*</div>\s*</div>)\s*</div>\s*\)\}'

jci_match = re.search(jci_pattern, content, re.DOTALL)
if jci_match:
    jci_inner_jsx = jci_match.group(1)
    
    # We will remove this whole block from content
    content = content[:jci_match.start()] + content[jci_match.end():]
    
    # And we will build the modal
    modal_jsx = f'''
      {{showSafetyModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-white">Safety & Accreditation</h3>
                  <p className="text-[10px] text-slate-500">Optional documentation — complete when applicable</p>
                </div>
              </div>
              <button onClick={{() => setShowSafetyModal(false)}} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
              {jci_inner_jsx}
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end gap-3">
              <button 
                onClick={{() => setShowSafetyModal(false)}} 
                className="px-4 py-2 font-bold text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
              >
                Close
              </button>
              <button 
                onClick={{async () => {{ await handleSave(); setShowSafetyModal(false); }}}}
                className="px-6 py-2 font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}}
'''
    # Append modal before the last div
    last_div_idx = content.rfind('</div>')
    if last_div_idx != -1:
        content = content[:last_div_idx] + modal_jsx + '\n' + content[last_div_idx:]

# 5. Remove Open Cases Card
open_cases_pattern = r'\{/\* OPEN CASES - TAP TO SWITCH  \*/\}.*?\{allCases && allCases\.length > 0 && \(\s*<div className="bg-slate-50.*?</svg>.*?</button>.*?</div>\s*</div>\s*\)\}'
# Wait, my regex might fail. Let's just find the string "{/* OPEN CASES - TAP TO SWITCH  */}" and remove up to ")}  </div>"
open_cases_start = content.find('{/* OPEN CASES - TAP TO SWITCH  */}')
if open_cases_start != -1:
    open_cases_end = content.find(')}', open_cases_start)
    # The block ends with )} which is the end of allCases condition
    if open_cases_end != -1:
        content = content[:open_cases_start] + content[open_cases_end + 2:]

with open('src/components/CaseSheetView.tsx', 'w') as f:
    f.write(content)

