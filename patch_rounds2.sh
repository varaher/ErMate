sed -i -e '/{roundsUserMessage.trim() === "" ? (/,/<\/button>\n                        )}/c\
                        <button\
                          type="button"\
                          onClick={() => handleRoundsChatSend()}\
                          disabled={roundsChatLoading || roundsUserMessage.trim() === ""}\
                          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-md ${roundsUserMessage.trim() === "" ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95 cursor-pointer"}`}\
                          title="Send message"\
                        >\
                          <Send className="w-4.5 h-4.5" />\
                        </button>' src/components/CaseSheetView.tsx
