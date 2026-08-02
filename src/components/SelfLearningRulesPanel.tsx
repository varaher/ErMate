import React, { useState, useEffect } from 'react';
import { 
  BrainCircuit, ShieldCheck, Sparkles, CheckCircle2, XCircle, 
  Plus, RefreshCw, AlertTriangle, Filter, Trash2, Edit3, Lock,
  ChevronRight, Activity, ArrowRight, UserCheck, FileText
} from 'lucide-react';
import { 
  LearnedRule, 
  FeedbackCorrection, 
  fetchLearningRulesAndCorrections, 
  extractGeneralizableRules, 
  reviewLearnedRule, 
  createManualRule, 
  deleteLearnedRule 
} from '../services/learningClient';

export function SelfLearningRulesPanel() {
  const [rules, setRules] = useState<LearnedRule[]>([]);
  const [corrections, setCorrections] = useState<FeedbackCorrection[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [extracting, setExtracting] = useState<boolean>(false);
  const [filterTab, setFilterTab] = useState<'all' | 'pending' | 'safety' | 'active'>('all');
  const [actionSuccess, setActionSuccess] = useState<string>('');

  // Modal State for Manual Rule
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newRuleText, setNewRuleText] = useState<string>('');
  const [newRuleKeywords, setNewRuleKeywords] = useState<string>('');
  const [newRuleCaseType, setNewRuleCaseType] = useState<string>('syncope_workup');
  const [newRuleSeverity, setNewRuleSeverity] = useState<'safety_critical' | 'quality'>('safety_critical');

  const loadData = async () => {
    setLoading(true);
    const data = await fetchLearningRulesAndCorrections();
    setRules(data.rules);
    setCorrections(data.corrections);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleExtractPatterns = async () => {
    setExtracting(true);
    const result = await extractGeneralizableRules();
    setExtracting(false);
    if (result.rules && result.rules.length > 0) {
      setRules(result.rules);
      setActionSuccess(`Pattern extraction complete! ${result.newRules.length} new rules extracted for review.`);
      setTimeout(() => setActionSuccess(''), 4000);
    }
  };

  const handleReview = async (ruleId: string, approved: boolean, active: boolean) => {
    const updated = await reviewLearnedRule(ruleId, approved, active, 'Dr. Neeraj');
    if (updated) {
      setRules(prev => prev.map(r => r.id === ruleId ? updated : r));
      setActionSuccess(approved ? 'Rule approved and activated live!' : 'Rule updated successfully.');
      setTimeout(() => setActionSuccess(''), 3000);
    }
  };

  const handleDelete = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this learned rule?')) return;
    const ok = await deleteLearnedRule(ruleId);
    if (ok) {
      setRules(prev => prev.filter(r => r.id !== ruleId));
      setActionSuccess('Rule deleted.');
      setTimeout(() => setActionSuccess(''), 3000);
    }
  };

  const handleCreateManualRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleText.trim()) return;

    const keywords = newRuleKeywords.split(',').map(k => k.trim()).filter(Boolean);
    const created = await createManualRule(
      newRuleText,
      keywords,
      newRuleCaseType,
      newRuleSeverity,
      'Dr. Neeraj'
    );

    if (created) {
      setRules(prev => [created, ...prev]);
      setShowCreateModal(false);
      setNewRuleText('');
      setNewRuleKeywords('');
      setActionSuccess('New clinician rule authored and activated live!');
      setTimeout(() => setActionSuccess(''), 4000);
    }
  };

  const activeRules = rules.filter(r => r.active && r.approved);
  const pendingQueue = rules.filter(r => !r.approved);
  const safetyCritical = rules.filter(r => r.severity === 'safety_critical');

  const filteredRules = rules.filter(r => {
    if (filterTab === 'pending') return !r.approved;
    if (filterTab === 'active') return r.active && r.approved;
    if (filterTab === 'safety') return r.severity === 'safety_critical';
    return true;
  });

  return (
    <div className="space-y-6 font-sans">
      
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 font-mono text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 border border-indigo-500/30">
                <BrainCircuit className="w-3.5 h-3.5 text-indigo-400" />
                Self-Learning Architecture
              </span>
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 border border-emerald-500/30">
                <ShieldCheck className="w-3.5 h-3.5" /> Human Approval Gate Active
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-black font-display tracking-tight">
              Clinician Feedback-Loop & Learned Rules Store
            </h2>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              When doctors edit AI-generated fields, factual corrections are captured as learned patterns. Extract generalizable rules, sign off on human approval gates, and inject rules directly into live shift handover generations.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={handleExtractPatterns}
              disabled={extracting}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer font-mono"
            >
              <Sparkles className={`w-4 h-4 ${extracting ? 'animate-spin' : ''}`} />
              <span>{extracting ? 'Extracting Rules...' : 'Extract Patterns Now'}</span>
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer font-mono"
            >
              <Plus className="w-4 h-4" />
              <span>Author Rule</span>
            </button>
          </div>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400 text-xs font-mono font-bold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* KPI Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider font-mono text-slate-500 dark:text-slate-400">
            Active Approved Rules
          </span>
          <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1">
            {activeRules.length}
          </h3>
          <p className="text-[10px] text-slate-400 mt-1">Injected at generation time</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider font-mono text-slate-500 dark:text-slate-400">
            Pending Review Queue
          </span>
          <h3 className="text-2xl font-black text-amber-500 font-mono mt-1">
            {pendingQueue.length}
          </h3>
          <p className="text-[10px] text-slate-400 mt-1">Awaiting human sign-off</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider font-mono text-slate-500 dark:text-slate-400">
            Safety-Critical Rules
          </span>
          <h3 className="text-2xl font-black text-rose-500 font-mono mt-1">
            {safetyCritical.length}
          </h3>
          <p className="text-[10px] text-slate-400 mt-1">High priority enforcement</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider font-mono text-slate-500 dark:text-slate-400">
            Captured Corrections
          </span>
          <h3 className="text-2xl font-black text-indigo-500 font-mono mt-1">
            {corrections.length}
          </h3>
          <p className="text-[10px] text-slate-400 mt-1">Raw clinician edits logged</p>
        </div>
      </div>

      {/* Review Queue Callout (If pending rules exist) */}
      {pendingQueue.length > 0 && (
        <div className="bg-amber-500/10 border-2 border-amber-500/40 rounded-3xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Human Approval Gate: {pendingQueue.length} Extracted Rule(s) Awaiting Clinician Sign-Off
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
              Sign-Off Required
            </span>
          </div>

          <div className="space-y-3">
            {pendingQueue.map((rule) => (
              <div key={rule.id} className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 space-y-3 shadow-xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold font-mono uppercase ${
                        rule.severity === 'safety_critical' ? 'bg-rose-500/20 text-rose-500' : 'bg-slate-500/20 text-slate-400'
                      }`}>
                        {rule.severity}
                      </span>
                      <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-500 rounded-md text-[10px] font-bold font-mono">
                        Confidence: {rule.confidence}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        Case: {rule.case_type}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white leading-relaxed">
                      "{rule.rule}"
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleReview(rule.id, true, true)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1 font-mono"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approve & Activate
                    </button>
                    <button
                      onClick={() => handleDelete(rule.id)}
                      className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 font-bold text-xs rounded-xl transition-all cursor-pointer font-mono"
                    >
                      Reject
                    </button>
                  </div>
                </div>

                {rule.supporting_examples && rule.supporting_examples.length > 0 && (
                  <div className="text-[11px] bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                    <strong className="text-slate-800 dark:text-slate-200 block mb-0.5">Supporting Clinician Corrections:</strong>
                    {rule.supporting_examples.map((ex, i) => (
                      <div key={i} className="truncate">• {ex}</div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Rules Store Table / Grid */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Learned Rules Store & Live Generation Filters</span>
            </h3>
            <p className="text-xs text-slate-500">
              Approved rules are dynamically injected into prompt context during handover synthesis.
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-mono">
            <button
              onClick={() => setFilterTab('all')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${filterTab === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              All ({rules.length})
            </button>
            <button
              onClick={() => setFilterTab('active')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${filterTab === 'active' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Active ({activeRules.length})
            </button>
            <button
              onClick={() => setFilterTab('pending')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${filterTab === 'pending' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Pending ({pendingQueue.length})
            </button>
            <button
              onClick={() => setFilterTab('safety')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${filterTab === 'safety' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Safety Critical ({safetyCritical.length})
            </button>
          </div>
        </div>

        {/* Rules Cards List */}
        <div className="space-y-3">
          {filteredRules.length === 0 ? (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <BrainCircuit className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-xs font-mono">No rules match the selected filter tab.</p>
            </div>
          ) : (
            filteredRules.map((rule) => (
              <div 
                key={rule.id}
                className={`p-4 rounded-2xl border transition-all space-y-3 ${
                  rule.active && rule.approved
                    ? 'bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800'
                    : 'bg-amber-500/5 border-amber-500/20'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold font-mono uppercase ${
                        rule.severity === 'safety_critical'
                          ? 'bg-rose-500/20 text-rose-500 border border-rose-500/30'
                          : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                      }`}>
                        {rule.severity.replace('_', ' ')}
                      </span>

                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold font-mono uppercase ${
                        rule.active && rule.approved
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-500 border border-amber-500/30'
                      }`}>
                        {rule.active && rule.approved ? 'Active & Approved' : 'Pending Review'}
                      </span>

                      <span className="text-[11px] font-mono text-slate-400">
                        Case: <strong className="text-slate-200">{rule.case_type}</strong>
                      </span>

                      {rule.approvedBy && (
                        <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                          <UserCheck className="w-3 h-3 text-emerald-400" /> Signed off by {rule.approvedBy}
                        </span>
                      )}
                    </div>

                    <p className="text-sm font-semibold text-slate-900 dark:text-white leading-relaxed">
                      {rule.rule}
                    </p>

                    {/* Trigger Keywords Tags */}
                    {rule.trigger_keywords && rule.trigger_keywords.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[10px] text-slate-400 font-mono">Triggers:</span>
                        {rule.trigger_keywords.map((kw, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md text-[10px] font-mono">
                            #{kw}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions & Toggle */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleReview(rule.id, true, !rule.active)}
                      className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                        rule.active
                          ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${rule.active ? 'bg-white animate-pulse' : 'bg-slate-400'}`} />
                      <span>{rule.active ? 'ACTIVE' : 'INACTIVE'}</span>
                    </button>

                    <button
                      onClick={() => handleDelete(rule.id)}
                      className="p-2 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-500/10 transition-all cursor-pointer"
                      title="Delete Rule"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Raw Clinician Corrections Audit Log */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-400" />
              Raw Clinician Feedback Audit Log ({corrections.length})
            </h3>
            <p className="text-xs text-slate-500">
              Every factual correction made by physicians in the UI is recorded here for auditability.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                <th className="pb-2">Field</th>
                <th className="pb-2">AI Generated Output</th>
                <th className="pb-2">Clinician Correction</th>
                <th className="pb-2">Doctor</th>
                <th className="pb-2">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
              {corrections.map((corr) => (
                <tr key={corr.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all">
                  <td className="py-2.5 font-bold text-indigo-600 dark:text-indigo-400">
                    {corr.field}
                  </td>
                  <td className="py-2.5 text-rose-500 line-through max-w-xs truncate">
                    {corr.ai_output}
                  </td>
                  <td className="py-2.5 text-emerald-600 dark:text-emerald-400 font-bold max-w-xs truncate">
                    {corr.corrected_output}
                  </td>
                  <td className="py-2.5 text-slate-400">
                    {corr.corrected_by}
                  </td>
                  <td className="py-2.5 text-slate-500 text-[10px]">
                    {new Date(corr.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Author Manual Rule Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-500" /> Author Clinician Learned Rule
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white font-mono text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateManualRule} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold font-mono uppercase text-slate-500 block">
                  Rule Instruction (Clear directive for generation engine)
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. When source text specifies 'CT Brain + C-Spine', never output 'MRI Brain'."
                  value={newRuleText}
                  onChange={(e) => setNewRuleText(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-900 dark:text-white font-medium focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold font-mono uppercase text-slate-500 block">
                    Trigger Keywords (Comma separated)
                  </label>
                  <input
                    type="text"
                    placeholder="CT Brain, MRI Brain, C-Spine"
                    value={newRuleKeywords}
                    onChange={(e) => setNewRuleKeywords(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold font-mono uppercase text-slate-500 block">
                    Case Category / Type
                  </label>
                  <input
                    type="text"
                    placeholder="syncope_workup"
                    value={newRuleCaseType}
                    onChange={(e) => setNewRuleCaseType(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold font-mono uppercase text-slate-500 block">
                  Severity Guardrail Level
                </label>
                <select
                  value={newRuleSeverity}
                  onChange={(e) => setNewRuleSeverity(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white"
                >
                  <option value="safety_critical">Safety Critical (High Priority Enforcement)</option>
                  <option value="quality">Quality & Formatting Preference</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer font-mono"
                >
                  Save & Authorize Rule
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
