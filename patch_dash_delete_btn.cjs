const fs = require('fs');
let content = fs.readFileSync("src/components/DashboardView.tsx", "utf8");

const replacement = `                                  </div>
                                )}
                                
                                {onDeleteCase && (
                                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/50 mt-4">
                                    <button
                                      onClick={() => {
                                        if (window.confirm(\`Are you sure you want to delete the case for "\${c.patient.name}"? This action cannot be undone.\`)) {
                                          onDeleteCase(c.id);
                                        }
                                      }}
                                      className="flex items-center justify-center gap-1.5 w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/20 dark:hover:bg-rose-900/40 dark:text-rose-400 rounded-lg text-xs font-bold transition-all border border-rose-100 dark:border-rose-900/30"
                                    >
                                      <Trash2 className="w-4 h-4" /> Delete Case Record
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );`;

const match = `                                  </div>\n                                )}\n                              </div>\n                            </div>\n                          </div>\n                        )}\n                      </div>\n                    );`;
if(content.includes(match)) {
  content = content.replace(match, replacement);
  fs.writeFileSync("src/components/DashboardView.tsx", content);
  console.log("Replaced successfully in DashboardView");
} else {
  console.log("Could not find match in DashboardView");
}
