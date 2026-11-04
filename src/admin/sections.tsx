import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  api, inr, count, day, dateTime, ago, place, featureLabel, providerLabel, PROVIDER_COLORS, go, downloadCsv,
} from "./api";

// ───────────────────────── shared pieces ─────────────────────────

function useLoad<T>(path: string | null, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    if (!path) return;
    setLoading(true); setError("");
    api<T>(path).then(d => setData(d)).catch(e => setError(e.message || "Could not load.")).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);
  useEffect(() => { load(); }, [load]);
  return { data, error, loading, reload: load };
}

function Header({ title, sub, right }: { title: string; sub?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>{title}</h1>
        {sub && <p style={{ margin: "4px 0 0", fontSize: 14, color: "var(--adm-muted)" }}>{sub}</p>}
      </div>
      {right && <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>{right}</div>}
    </div>
  );
}

const RANGES = [{ d: 1, l: "Today" }, { d: 7, l: "7 days" }, { d: 30, l: "30 days" }, { d: 90, l: "90 days" }];
function RangePicker({ value, onChange }: { value: number; onChange: (d: number) => void }) {
  return (
    <div role="group" aria-label="Date range" style={{ display: "flex", background: "#E5E5EA", padding: 3, borderRadius: 10 }}>
      {RANGES.map(r => (
        <button key={r.d} type="button" aria-pressed={value === r.d} onClick={() => onChange(r.d)}
          style={{
            border: 0, font: "inherit", fontSize: 13, padding: "6px 12px", borderRadius: 8, cursor: "pointer", minHeight: 32,
            background: value === r.d ? "#fff" : "transparent", fontWeight: value === r.d ? 600 : 400,
            color: value === r.d ? "var(--adm-ink)" : "#3A3A40", boxShadow: value === r.d ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
          }}>{r.l}</button>
      ))}
    </div>
  );
}

function useRange(initial = 30) {
  const [days, setDays] = useState(() => {
    try { const v = Number(localStorage.getItem("ermate-admin-range")); return [1, 7, 30, 90].includes(v) ? v : initial; } catch { return initial; }
  });
  const set = (d: number) => { setDays(d); try { localStorage.setItem("ermate-admin-range", String(d)); } catch { /* private mode */ } };
  return [days, set] as const;
}

type TagKind = "Actual" | "Estimated" | "No data";
function Tag({ kind, title }: { kind: TagKind; title?: string }) {
  const c = kind === "Actual" ? ["var(--adm-emerald)", "var(--adm-emerald-soft)"] : kind === "Estimated" ? ["var(--adm-amber)", "var(--adm-amber-soft)"] : ["var(--adm-muted)", "#F0F0F3"];
  return <span title={title} style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 999, color: c[0], background: c[1], whiteSpace: "nowrap" }}>{kind}</span>;
}

function Pill({ text, tone }: { text: string; tone: "purple" | "green" | "amber" | "red" | "blue" | "grey" }) {
  const c: Record<string, [string, string]> = {
    purple: ["var(--adm-purple)", "var(--adm-purple-soft)"], green: ["var(--adm-emerald)", "var(--adm-emerald-soft)"],
    amber: ["var(--adm-amber)", "var(--adm-amber-soft)"], red: ["var(--adm-red)", "var(--adm-red-soft)"],
    blue: ["#1D4ED8", "#EAF0FE"], grey: ["var(--adm-muted)", "#F0F0F3"],
  };
  return <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 9px", borderRadius: 999, color: c[tone][0], background: c[tone][1], whiteSpace: "nowrap" }}>{text}</span>;
}
const planTone = (p: string): "purple" | "green" | "amber" | "red" | "blue" | "grey" =>
  p === "Paid" ? "green" : p === "Trial" ? "purple" : p === "Hospital plan" ? "blue" : p === "Grace" ? "amber" : p === "Expired" ? "red" : "grey";

function Kpi({ label, value, sub, tag, tagTitle, subTone }: { label: string; value: string; sub?: string; tag: TagKind; tagTitle?: string; subTone?: "good" | "bad" }) {
  return (
    <div className="adm-card" style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 13, color: "var(--adm-muted)" }}>{label}</span>
        <Tag kind={tag} title={tagTitle} />
      </div>
      <strong className="adm-num" style={{ fontSize: 26, fontWeight: 700 }}>{value}</strong>
      {sub && <span style={{ fontSize: 12, color: subTone === "good" ? "var(--adm-emerald)" : subTone === "bad" ? "var(--adm-red)" : "var(--adm-muted)" }}>{sub}</span>}
    </div>
  );
}

function Card({ title, right, children, style }: { title?: string; right?: React.ReactNode; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <section className="adm-card" style={{ padding: 18, minWidth: 0, ...style }}>
      {(title || right) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
          {title && <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

function TableBox({ children, minWidth = 720 }: { children: React.ReactNode; minWidth?: number }) {
  return <div style={{ overflowX: "auto" }}><table className="adm-table" style={{ minWidth }}>{children}</table></div>;
}

function State({ loading, error, onRetry }: { loading: boolean; error: string; onRetry?: () => void }) {
  if (error) return (
    <div className="adm-card" role="alert" style={{ padding: 18, color: "var(--adm-red)", fontSize: 14, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      {error} {onRetry && <button className="adm-btn adm-btn-ghost" onClick={onRetry}>Try again</button>}
    </div>
  );
  if (loading) return <p style={{ color: "var(--adm-muted)", fontSize: 14 }}>Loading…</p>;
  return null;
}

const grid = (min: number): React.CSSProperties => ({ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 14 });
const linkBtn: React.CSSProperties = { background: "none", border: 0, padding: 0, font: "inherit", fontSize: 13, fontWeight: 600, color: "var(--adm-purple)", cursor: "pointer" };

function Bars({ items }: { items: { label: string; value: number; color: string; right: string }[] }) {
  const max = Math.max(1, ...items.map(i => i.value));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {items.map(i => (
        <div key={i.label}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6, gap: 8 }}>
            <span style={{ fontWeight: 500 }}>{i.label}</span>
            <span className="adm-num" style={{ color: "#3A3A40" }}>{i.right}</span>
          </div>
          <div style={{ height: 10, background: "#F0F0F3", borderRadius: 999, overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 999, background: i.color, width: `${Math.max(2, (i.value / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ───────────────────────── Overview ─────────────────────────

export function OverviewPage() {
  const [days, setDays] = useRange();
  const { data: d, error, loading, reload } = useLoad<any>(`/overview?days=${days}`, [days]);
  const rangeText = RANGES.find(r => r.d === days)?.l.toLowerCase() || `${days} days`;
  return (
    <>
      <Header title="Overview" sub={`Platform at a glance · ${days === 1 ? "today" : `last ${rangeText}`} (IST)`} right={<RangePicker value={days} onChange={setDays} />} />
      <State loading={loading && !d} error={error} onRetry={reload} />
      {d && (
        <>
          <div style={{ ...grid(210), marginBottom: 14 }}>
            <Kpi label="Registered doctors" value={count(d.users.total)} sub={`+${d.users.newInRange} in range`} subTone={d.users.newInRange ? "good" : undefined} tag="Actual" />
            <Kpi label="Active doctors" value={count(d.users.activeInRange)} sub="Signed in or used the app in range" tag="Actual" />
            <Kpi label="Hospital teams" value={count(d.hospitals.withTeams)} sub={`${d.hospitals.inDirectory} in directory · ${d.hospitals.verifiedInDirectory} verified`} tag="Actual" />
            <Kpi label="Cases documented" value={count(d.cases.inRange)} sub={`${count(d.cases.total)} all time · counts only`} tag="Actual" />
            <Kpi label="Revenue (net)" value={inr(d.revenue.netInr)} sub={`${d.revenue.activations} × ₹600 · ${d.revenue.renewals} × ₹350 · ${d.revenue.recharges} recharges`} tag="Actual" tagTitle="From verified Razorpay webhooks (creditLedger), minus refunds" />
            <Kpi label="AI cost" value={d.ai.daysWithData ? inr(d.ai.costInr) : "—"} sub={d.ai.daysWithData ? `${count(d.ai.calls)} calls · ${count(d.ai.failed)} failed` : "Logging starts with this release"} tag={d.ai.daysWithData ? "Estimated" : "No data"} tagTitle="Real token and audio counts × the price table. Reconcile with vendor bills on Provider Dues." />
            <Kpi label="Profit after AI" value={d.ai.daysWithData ? inr(d.profitAfterAi) : "—"} sub="Before cloud and fixed costs" subTone={d.profitAfterAi >= 0 ? "good" : "bad"} tag={d.ai.daysWithData ? "Estimated" : "No data"} />
            <Kpi label="AI cost per credit"
              value={d.costPerCredit.perCredit === null ? "—" : inr(d.costPerCredit.perCredit)}
              sub={`Price ₹${d.costPerCredit.priceInr} · target ₹${d.costPerCredit.targetInr} · ${count(d.costPerCredit.creditsUsed)} credits used`}
              subTone={d.costPerCredit.perCredit === null ? undefined : d.costPerCredit.perCredit <= d.costPerCredit.targetInr ? "good" : "bad"}
              tag={d.costPerCredit.perCredit === null ? "No data" : "Estimated"}
              tagTitle="AI cost of doctors who were charged credits ÷ credits they used" />
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
            <Card title="Needs attention" style={{ flex: "1 1 340px" }}>
              <Alerts items={[
                d.alerts.hodPending && { tone: "var(--adm-amber)", title: `${d.alerts.hodPending} HOD request${d.alerts.hodPending === 1 ? "" : "s"} waiting`, action: "Review", to: "hod-requests" },
                d.alerts.autopayIssues && { tone: "var(--adm-red)", title: `${d.alerts.autopayIssues} AutoPay renewal${d.alerts.autopayIssues === 1 ? "" : "s"} pending or failed`, action: "Revenue", to: "revenue" },
                d.alerts.paymentProblems && { tone: "var(--adm-red)", title: `${d.alerts.paymentProblems} payment mismatch${d.alerts.paymentProblems === 1 ? "" : "es"} to check`, action: "Revenue", to: "revenue" },
                d.users.locationMissing && { tone: "var(--adm-muted)", title: `${d.users.locationMissing} doctor${d.users.locationMissing === 1 ? " has" : "s have"} no state in their profile`, action: "Users", to: "users" },
              ].filter(Boolean) as any[]} />
            </Card>
            <Card title="AI spend by provider" right={<button style={linkBtn} onClick={() => go("api-usage")}>Details</button>} style={{ flex: "1 1 340px" }}>
              {d.ai.byProvider.length === 0 ? <p style={{ margin: 0, fontSize: 13, color: "var(--adm-muted)" }}>No AI calls logged in this range yet.</p> : (
                <Bars items={d.ai.byProvider.map((p: any) => ({
                  label: providerLabel(p.provider), value: p.costInr, color: PROVIDER_COLORS[p.provider] || "#8E8E93",
                  right: `${inr(p.costInr)} · ${d.ai.costInr ? Math.round((p.costInr / d.ai.costInr) * 100) : 0}%`,
                }))} />
              )}
            </Card>
          </div>

          <Card title="Recent sign-ups" right={<button style={linkBtn} onClick={() => go("users")}>All users</button>} style={{ marginTop: 14 }}>
            <TableBox minWidth={640}>
              <thead><tr><th>Doctor</th><th>Hospital</th><th>Location</th><th>Plan</th><th>Joined</th></tr></thead>
              <tbody>
                {d.recentSignups.map((u: any) => (
                  <tr key={u.uid}>
                    <td><div style={{ fontWeight: 500 }}>{u.name || "No name"}</div><div style={{ fontSize: 12, color: "var(--adm-muted)" }}>{u.email}</div></td>
                    <td>{u.hospital || "—"}</td>
                    <td style={{ color: u.state ? undefined : "var(--adm-muted)" }}>{place(u)}</td>
                    <td><Pill text={u.plan} tone={planTone(u.plan)} /></td>
                    <td style={{ color: "var(--adm-muted)" }}>{ago(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </TableBox>
          </Card>
        </>
      )}
    </>
  );
}

function Alerts({ items }: { items: { tone: string; title: string; action: string; to: string }[] }) {
  if (!items.length) return <p style={{ margin: 0, fontSize: 13, color: "var(--adm-muted)" }}>Nothing needs attention.</p>;
  return (
    <div>
      {items.map((a, i) => (
        <div key={i} style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 0", borderTop: i ? "1px solid #F0F0F3" : 0 }}>
          <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 999, background: a.tone, flex: "none" }} />
          <div style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{a.title}</div>
          <button style={linkBtn} onClick={() => go(a.to)}>{a.action}</button>
        </div>
      ))}
    </div>
  );
}

// ───────────────────────── Users ─────────────────────────

export function UsersPage() {
  const { data, error, loading, reload } = useLoad<any>("/users");
  const [q, setQ] = useState("");
  const [plan, setPlan] = useState("All");
  const [state, setState] = useState("All");
  const [ws, setWs] = useState("All");
  const [editing, setEditing] = useState<any | null>(null);

  const users: any[] = data?.users || [];
  const states = useMemo(() => [...new Set(users.map(u => u.state).filter(Boolean))].sort(), [users]);
  const plans = useMemo(() => [...new Set(users.map(u => u.plan))].sort(), [users]);
  const rows = users.filter(u =>
    (!q || [u.name, u.email, u.hospital, u.place, u.district].some(v => String(v || "").toLowerCase().includes(q.toLowerCase()))) &&
    (plan === "All" || u.plan === plan) &&
    (state === "All" || (state === "Not given" ? !u.state : u.state === state)) &&
    (ws === "All" || u.workspace === ws));

  const exportCsv = () => downloadCsv(`ermate-users-${new Date().toISOString().slice(0, 10)}.csv`,
    ["Name", "Email", "Email verified", "Joined", "Last active", "Workspace", "Hospital", "Role", "Place", "District", "State", "Plan", "Plan days left", "Credits", "AI calls 30d", "AI cost 30d (INR, est.)"],
    rows.map(u => [u.name, u.email, u.emailVerified ? "yes" : "no", u.createdAt, u.lastActiveAt, u.workspace, u.hospital, u.role, u.place, u.district, u.state, u.plan, u.planDaysLeft, u.credits, u.aiCalls30d, u.aiCost30d]));

  return (
    <>
      <Header title="Users" sub={data ? `${count(users.length)} doctors · ${count(users.filter(u => u.lastActiveAt && Date.now() - Date.parse(u.lastActiveAt) < 7 * 86400000).length)} active in the last 7 days` : undefined}
        right={<button className="adm-btn adm-btn-ghost" onClick={exportCsv} disabled={!data}>Export CSV</button>} />
      <State loading={loading && !data} error={error} onRetry={reload} />
      {data && (
        <>
          <div className="adm-card" style={{ padding: 14, display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14, alignItems: "flex-end" }}>
            <Field label="Search" grow={2}><input className="adm-input" type="search" placeholder="Name, email, hospital or place" value={q} onChange={e => setQ(e.target.value)} /></Field>
            <Field label="Plan"><select className="adm-input" value={plan} onChange={e => setPlan(e.target.value)}><option>All</option>{plans.map(p => <option key={p}>{p}</option>)}</select></Field>
            <Field label="State"><select className="adm-input" value={state} onChange={e => setState(e.target.value)}><option>All</option>{states.map(s => <option key={s}>{s}</option>)}<option>Not given</option></select></Field>
            <Field label="Workspace"><select className="adm-input" value={ws} onChange={e => setWs(e.target.value)}><option>All</option><option>Hospital team</option><option>Independent</option></select></Field>
          </div>

          {editing && <CreditAdjust user={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); reload(); }} />}

          <Card style={{ padding: "6px 6px 10px" }}>
            <TableBox minWidth={980}>
              <thead><tr><th>Doctor</th><th>Hospital / role</th><th>Location</th><th>Plan</th><th className="r">Credits</th><th className="r">AI cost 30d</th><th>Last active</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {rows.map(u => (
                  <tr key={u.uid}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{u.name || "No name"}</div>
                      <div style={{ fontSize: 12, color: "var(--adm-muted)" }}>{u.email}{!u.emailVerified && u.email ? " · not verified" : ""}</div>
                      <div style={{ fontSize: 12, color: "var(--adm-muted)" }}>Joined {day(u.createdAt)}</div>
                    </td>
                    <td><div>{u.hospital || "—"}</div><div style={{ fontSize: 12, color: "var(--adm-muted)" }}>{u.workspace}{u.role ? ` · ${u.role}` : ""}</div></td>
                    <td style={{ color: u.state ? undefined : "var(--adm-muted)" }}>{place(u)}</td>
                    <td>
                      <Pill text={u.plan} tone={planTone(u.plan)} />
                      <div style={{ fontSize: 12, color: "var(--adm-muted)", marginTop: 4 }}>
                        {u.planState === "trial" && u.planDaysLeft ? `${u.planDaysLeft} days left` : u.planState === "paid" && u.planEndsAt ? `Until ${day(u.planEndsAt)}` : u.planState === "grace" ? `${u.planDaysLeft} days grace` : ""}
                        {u.autopayStatus && u.autopayStatus !== "none" ? `${u.planState === "trial" || u.planState === "paid" ? " · " : ""}AutoPay ${u.autopayStatus}` : ""}
                      </div>
                    </td>
                    <td className="r adm-num">{u.credits === null ? "—" : count(u.credits)}</td>
                    <td className="r adm-num">{u.aiCalls30d ? inr(u.aiCost30d) : "—"}<div style={{ fontSize: 12, color: "var(--adm-muted)" }}>{u.aiCalls30d ? `${count(u.aiCalls30d)} calls` : ""}</div></td>
                    <td style={{ color: "var(--adm-muted)", whiteSpace: "nowrap" }}>{ago(u.lastActiveAt)}</td>
                    <td className="r">{u.hasProfile && <button className="adm-btn adm-btn-soft" style={{ fontSize: 13, padding: "7px 12px", minHeight: 36, whiteSpace: "nowrap" }} onClick={() => setEditing(u)}>Adjust credits</button>}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={8} style={{ color: "var(--adm-muted)" }}>No doctors match these filters.</td></tr>}
              </tbody>
            </TableBox>
          </Card>
        </>
      )}
    </>
  );
}

function Field({ label, children, grow = 1 }: { label: string; children: React.ReactNode; grow?: number }) {
  return <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--adm-muted)", flex: `${grow} 1 ${grow > 1 ? 240 : 150}px` }}>{label}{children}</label>;
}

function CreditAdjust({ user, onClose, onDone }: { user: any; onClose: () => void; onDone: () => void }) {
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const n = Number(delta);
  const valid = Number.isInteger(n) && n !== 0 && Math.abs(n) <= 10000 && reason.trim().length >= 3;
  const save = async () => {
    setBusy(true); setError("");
    try { await api("/credits/adjust", { body: { uid: user.uid, delta: n, reason: reason.trim() } }); onDone(); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  return (
    <section className="adm-card" aria-label="Adjust credits" style={{ padding: 18, marginBottom: 14, border: "2px solid var(--adm-purple)" }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 16 }}>Adjust credits · {user.name || user.email}</h2>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--adm-muted)" }}>
        Current balance {user.credits ?? 0}. The change is added or removed (never below 0) and logged with your reason.
        {Number.isInteger(n) && n !== 0 ? ` New balance: ${Math.max(0, (user.credits ?? 0) + n)}.` : ""}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
        <Field label="Change (+ or −)"><input className="adm-input" type="number" step={1} placeholder="+50" value={delta} onChange={e => setDelta(e.target.value)} /></Field>
        <Field label="Reason (required)" grow={2}><input className="adm-input" type="text" maxLength={300} placeholder="e.g. Refund for failed discharge drafts on 2 Nov" value={reason} onChange={e => setReason(e.target.value)} /></Field>
        <button className="adm-btn adm-btn-primary" disabled={!valid || busy} onClick={save}>{busy ? "Saving…" : "Save change"}</button>
        <button className="adm-btn adm-btn-ghost" onClick={onClose}>Cancel</button>
      </div>
      {error && <p role="alert" style={{ color: "var(--adm-red)", fontSize: 13, margin: "10px 0 0" }}>{error}</p>}
    </section>
  );
}

// ───────────────────────── Hospitals ─────────────────────────

export function HospitalsPage() {
  const { data, error, loading, reload } = useLoad<any>("/hospitals");
  const [q, setQ] = useState("");
  const rows: any[] = (data?.hospitals || []).filter((h: any) => !q || [h.name, h.place, h.district, h.state].some(v => String(v || "").toLowerCase().includes(q.toLowerCase())));
  const dirTone = (s: string) => (s === "verified" ? "green" : s === "unverified" ? "amber" : "grey") as any;
  return (
    <>
      <Header title="Hospitals" sub={data ? `${data.hospitals.filter((h: any) => h.hasTeam).length} with ErMate teams · ${data.hospitals.length} in total` : undefined}
        right={<input className="adm-input" type="search" aria-label="Search hospitals" placeholder="Search hospital or place" value={q} onChange={e => setQ(e.target.value)} />} />
      <State loading={loading && !data} error={error} onRetry={reload} />
      {data && (
        <Card style={{ padding: "6px 6px 10px" }}>
          <TableBox minWidth={900}>
            <thead><tr><th>Hospital</th><th>Location</th><th>Directory</th><th>HOD</th><th className="r">Team members</th><th className="r">Doctors listing it</th><th>Hospital plan</th><th className="r">Cases</th></tr></thead>
            <tbody>
              {rows.map(h => (
                <tr key={h.hospitalId}>
                  <td style={{ fontWeight: 500 }}>{h.name}</td>
                  <td style={{ color: h.state ? undefined : "var(--adm-muted)" }}>{place(h)}</td>
                  <td><Pill text={h.directoryStatus === "not in directory" ? "Not listed" : h.directoryStatus === "verified" ? "Verified" : "Unverified"} tone={dirTone(h.directoryStatus)} /></td>
                  <td>{h.hods.length ? h.hods.join(", ") : <span style={{ color: "var(--adm-muted)" }}>None</span>}</td>
                  <td className="r adm-num">{h.hasTeam ? `${h.members}${h.verifiedMembers !== h.members ? ` (${h.verifiedMembers} verified)` : ""}` : "No team"}</td>
                  <td className="r adm-num">{count(h.doctorsListingIt)}</td>
                  <td>{h.subscriptionActive ? <Pill text="Active" tone="green" /> : <span style={{ color: "var(--adm-muted)" }}>—</span>}</td>
                  <td className="r adm-num">{h.cases === null ? "—" : count(h.cases)}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={8} style={{ color: "var(--adm-muted)" }}>No hospitals match.</td></tr>}
            </tbody>
          </TableBox>
        </Card>
      )}
    </>
  );
}

// ───────────────────────── Locations ─────────────────────────

export function LocationsPage() {
  const users = useLoad<any>("/users");
  const hospitals = useLoad<any>("/hospitals");
  const [open, setOpen] = useState<string | null>(null);
  const byState = useMemo(() => {
    const m = new Map<string, { doctors: number; active: number; districts: Map<string, number>; hospitals: number }>();
    for (const u of users.data?.users || []) {
      const s = u.state || "Not given";
      const e = m.get(s) || { doctors: 0, active: 0, districts: new Map(), hospitals: 0 };
      e.doctors++;
      if (u.lastActiveAt && Date.now() - Date.parse(u.lastActiveAt) < 30 * 86400000) e.active++;
      const d = u.district || u.place || "Not given";
      e.districts.set(d, (e.districts.get(d) || 0) + 1);
      m.set(s, e);
    }
    for (const h of hospitals.data?.hospitals || []) {
      const s = h.state || "Not given";
      const e = m.get(s) || { doctors: 0, active: 0, districts: new Map(), hospitals: 0 };
      e.hospitals++;
      m.set(s, e);
    }
    return [...m.entries()].sort((a, b) => (a[0] === "Not given" ? 1 : b[0] === "Not given" ? -1 : b[1].doctors - a[1].doctors));
  }, [users.data, hospitals.data]);
  const max = Math.max(1, ...byState.map(([, v]) => v.doctors));
  return (
    <>
      <Header title="Locations" sub="Where doctors and hospitals are, from their profiles. No GPS or IP tracking." />
      <State loading={(users.loading && !users.data) || (hospitals.loading && !hospitals.data)} error={users.error || hospitals.error} onRetry={() => { users.reload(); hospitals.reload(); }} />
      {users.data && hospitals.data && (
        <Card style={{ padding: "6px 6px 10px" }}>
          <TableBox minWidth={640}>
            <thead><tr><th>State</th><th style={{ width: "36%" }}>Doctors</th><th className="r">Active 30d</th><th className="r">Hospitals</th><th><span className="sr-only">Districts</span></th></tr></thead>
            <tbody>
              {byState.map(([s, v]) => (
                <React.Fragment key={s}>
                  <tr>
                    <td style={{ fontWeight: 500, color: s === "Not given" ? "var(--adm-muted)" : undefined }}>{s}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ flex: 1, height: 10, background: "#F0F0F3", borderRadius: 999, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${(v.doctors / max) * 100}%`, background: s === "Not given" ? "#C7C7CC" : "var(--adm-purple)", borderRadius: 999 }} />
                        </div>
                        <span className="adm-num" style={{ minWidth: 32, textAlign: "right" }}>{v.doctors}</span>
                      </div>
                    </td>
                    <td className="r adm-num">{v.active}</td>
                    <td className="r adm-num">{v.hospitals}</td>
                    <td className="r"><button style={linkBtn} aria-expanded={open === s} onClick={() => setOpen(open === s ? null : s)}>{open === s ? "Hide districts" : "Districts"}</button></td>
                  </tr>
                  {open === s && (
                    <tr><td colSpan={5} style={{ background: "#FAFAFC" }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {[...v.districts.entries()].sort((a, b) => b[1] - a[1]).map(([d, n]) => <Pill key={d} text={`${d} · ${n}`} tone={d === "Not given" ? "grey" : "purple"} />)}
                      </div>
                    </td></tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </TableBox>
        </Card>
      )}
    </>
  );
}

// ───────────────────────── HOD Requests ─────────────────────────

export function HodPage() {
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
  const { data, error, loading, reload } = useLoad<any>(`/hod-claims?status=${tab}`, [tab]);
  const changed = () => { reload(); window.dispatchEvent(new Event("admin:hod-changed")); };
  return (
    <>
      <Header title="HOD Requests" sub="Approving makes the doctor HOD of that hospital. Every decision is logged." />
      <div role="tablist" aria-label="Request status" style={{ display: "inline-flex", background: "#E5E5EA", padding: 3, borderRadius: 10, marginBottom: 16 }}>
        {(["pending", "approved", "rejected"] as const).map(t => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            style={{ border: 0, font: "inherit", fontSize: 13, padding: "7px 16px", borderRadius: 8, cursor: "pointer", minHeight: 34, background: tab === t ? "#fff" : "transparent", fontWeight: tab === t ? 600 : 400, color: "var(--adm-ink)" }}>
            {t[0].toUpperCase() + t.slice(1)}{t === "pending" && tab === "pending" && data ? ` (${data.claims.length})` : ""}
          </button>
        ))}
      </div>
      <State loading={loading} error={error} onRetry={reload} />
      {data && !loading && (tab === "pending" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {data.claims.length === 0 && <p style={{ color: "var(--adm-muted)", fontSize: 14 }}>No pending requests.</p>}
          {data.claims.map((c: any) => <ClaimCard key={c.id} c={c} onChanged={changed} />)}
        </div>
      ) : (
        <Card style={{ padding: "6px 6px 10px" }}>
          <TableBox minWidth={720}>
            <thead><tr><th>Doctor</th><th>Hospital</th><th>Decision</th><th>Reason</th><th>Decided</th></tr></thead>
            <tbody>
              {data.claims.map((c: any) => (
                <tr key={c.id}>
                  <td><div style={{ fontWeight: 500 }}>{c.claimedByName}</div><div style={{ fontSize: 12, color: "var(--adm-muted)" }}>{c.claimedByEmail}</div></td>
                  <td>{c.resolvedHospitalName || c.hospital}</td>
                  <td><Pill text={tab === "approved" ? "Approved" : "Rejected"} tone={tab === "approved" ? "green" : "red"} /></td>
                  <td style={{ color: "var(--adm-muted)" }}>{c.rejectionNote || "—"}</td>
                  <td style={{ color: "var(--adm-muted)" }}>{day(c.reviewedAt)}</td>
                </tr>
              ))}
              {data.claims.length === 0 && <tr><td colSpan={5} style={{ color: "var(--adm-muted)" }}>None yet.</td></tr>}
            </tbody>
          </TableBox>
        </Card>
      ))}
    </>
  );
}

function ClaimCard({ c, onChanged }: { c: any; onChanged: () => void }) {
  const [mode, setMode] = useState<"idle" | "rejecting" | "confirming">("idle");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [serverWarnings, setServerWarnings] = useState<string[]>([]);
  const initials = (c.claimedByName || "?").replace(/^dr\.?\s*/i, "").split(/\s+/).map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();

  const approve = async (confirmWarnings: boolean) => {
    setBusy(true); setError("");
    try {
      await api("/api/team/approve-hod-claim", { body: { claimId: c.id, hospitalName: c.hospital, confirmWarnings } });
      onChanged();
    } catch (e: any) {
      if (e.status === 409 && e.data?.warnings) { setServerWarnings(e.data.warnings); setMode("confirming"); }
      else setError(e.message);
    } finally { setBusy(false); }
  };
  const reject = async () => {
    setBusy(true); setError("");
    try { await api(`/hod-claims/${encodeURIComponent(c.id)}/reject`, { body: { reason: reason.trim() } }); onChanged(); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  const warnings: string[] = c.warnings || [];

  return (
    <article className="adm-card" style={{ padding: 18 }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start", minWidth: 0 }}>
          <div aria-hidden="true" style={{ width: 44, height: 44, borderRadius: 999, background: "var(--adm-purple-soft)", color: "var(--adm-purple)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flex: "none" }}>{initials}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{c.claimedByName}</div>
            <div style={{ fontSize: 13, color: "var(--adm-muted)", marginTop: 2 }}>{c.claimedByEmail} · submitted {ago(c.createdAt)}</div>
          </div>
        </div>
        <Pill text="Pending" tone="amber" />
      </div>
      <dl style={{ ...grid(170), gap: "12px 20px", margin: "16px 0 0", fontSize: 13 }}>
        <Dd t="Hospital" v={c.hospital} />
        <Dd t="Place · District" v={[c.place, c.district].filter(Boolean).join(", ") || "Not given"} />
        <Dd t="State · PIN" v={[c.state, c.pincode].filter(Boolean).join(" · ") || "Not given"} />
        <Dd t="ER beds" v={c.beds === null ? "Not given" : String(c.beds)} />
        <Dd t="Email verified" v={c.emailVerified ? "Yes" : "No"} color={c.emailVerified ? "var(--adm-emerald)" : "var(--adm-red)"} />
        <Dd t="Hospital directory" v={c.directoryStatus === "not in directory" ? "Not listed" : c.directoryStatus === "verified" ? "Verified" : "Unverified"} />
      </dl>
      {c.reason && <p style={{ margin: "14px 0 0", fontSize: 13, color: "#3A3A40" }}><strong>Doctor's note:</strong> {c.reason}</p>}
      {warnings.length > 0 && (
        <div role="note" style={{ marginTop: 14, padding: "12px 14px", borderRadius: 12, background: "var(--adm-amber-soft)", color: "#7C2D12", fontSize: 13, lineHeight: 1.45 }}>
          <strong>Check before approving:</strong> {warnings.join(" ")}
        </div>
      )}
      {mode === "confirming" && (
        <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 13, flex: "1 1 260px" }}>{serverWarnings.join(" ")} Approve anyway?</span>
          <button className="adm-btn adm-btn-green" disabled={busy} onClick={() => approve(true)}>Yes, approve</button>
          <button className="adm-btn adm-btn-ghost" onClick={() => setMode("idle")}>Cancel</button>
        </div>
      )}
      {mode === "rejecting" && (
        <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
          <Field label="Reason (shown to the doctor)" grow={2}><input className="adm-input" maxLength={500} placeholder="e.g. Could not confirm you are HOD at this hospital" value={reason} onChange={e => setReason(e.target.value)} /></Field>
          <button className="adm-btn adm-btn-danger" disabled={busy || reason.trim().length < 3} onClick={reject}>Confirm reject</button>
          <button className="adm-btn adm-btn-ghost" onClick={() => setMode("idle")}>Cancel</button>
        </div>
      )}
      {mode === "idle" && (
        <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 10 }}>
          <button className="adm-btn adm-btn-green" disabled={busy} onClick={() => (warnings.length ? (setServerWarnings(warnings), setMode("confirming")) : approve(false))}>Approve as HOD</button>
          <button className="adm-btn adm-btn-ghost" style={{ color: "var(--adm-red)" }} onClick={() => setMode("rejecting")}>Reject</button>
          {c.claimedByEmail && <a className="adm-btn" style={{ background: "transparent", color: "var(--adm-purple)", textDecoration: "none", display: "inline-flex", alignItems: "center" }} href={`mailto:${c.claimedByEmail}?subject=${encodeURIComponent("Your ErMate HOD request")}`}>Email doctor</a>}
        </div>
      )}
      {error && <p role="alert" style={{ color: "var(--adm-red)", fontSize: 13, margin: "10px 0 0" }}>{error}</p>}
    </article>
  );
}

function Dd({ t, v, color }: { t: string; v: string; color?: string }) {
  return <div><dt style={{ color: "var(--adm-muted)" }}>{t}</dt><dd style={{ margin: "2px 0 0", fontWeight: 500, color }}>{v}</dd></div>;
}

// ───────────────────────── API Usage ─────────────────────────

const units = (r: any) => r.provider === "sarvam"
  ? (r.audioSeconds ? `${count(Math.round(r.audioSeconds / 60))} min audio` : "—")
  : (r.inputTokens + r.outputTokens ? `${(r.inputTokens / 1e6).toFixed(2)}M in · ${(r.outputTokens / 1e6).toFixed(2)}M out` : "—");

export function UsagePage() {
  const [days, setDays] = useRange();
  const { data: d, error, loading, reload } = useLoad<any>(`/usage?days=${days}`, [days]);
  const exportCsv = () => d && downloadCsv(`ermate-ai-usage-${d.from}.csv`,
    ["Feature", "Provider", "Model", "Calls", "Failed", "Input tokens", "Output tokens", "Audio seconds", "Cost INR (est.)"],
    d.rows.map((r: any) => [featureLabel(r.feature), r.provider, r.model, r.calls, r.failed, r.inputTokens, r.outputTokens, r.audioSeconds, r.costInr]));
  return (
    <>
      <Header title="API Usage" sub="Every AI call, by feature and model. Costs are real token and audio counts × the price table."
        right={<><RangePicker value={days} onChange={setDays} /><button className="adm-btn adm-btn-ghost" onClick={exportCsv} disabled={!d}>Export CSV</button></>} />
      <State loading={loading && !d} error={error} onRetry={reload} />
      {d && (d.daysWithData === 0 ? (
        <Card><p style={{ margin: 0, fontSize: 14, color: "var(--adm-muted)" }}>No AI calls logged in this range. Logging starts with this release; earlier usage was never recorded.</p></Card>
      ) : (
        <>
          <div style={{ ...grid(200), marginBottom: 14 }}>
            <Kpi label="Total AI cost" value={inr(d.totals.costInr)} sub={`${count(d.totals.calls)} calls`} tag="Estimated" tagTitle={`USD prices converted at ₹${d.usdInrRate}`} />
            {d.byProvider.map((p: any) => (
              <Kpi key={p.provider} label={providerLabel(p.provider)} value={inr(p.costInr)}
                sub={`${count(p.calls)} calls · ${p.failed} failed${p.calls ? ` (${((p.failed / p.calls) * 100).toFixed(1)}%)` : ""}`}
                subTone={p.calls && p.failed / p.calls > 0.05 ? "bad" : undefined} tag="Estimated" />
            ))}
          </div>
          <DailyChart daily={d.daily} />
          <Card title="By feature and model" style={{ padding: "18px 6px 10px", marginTop: 14 }}>
            <TableBox minWidth={860}>
              <thead><tr><th>Feature</th><th>Provider · model</th><th className="r">Calls</th><th className="r">Units</th><th className="r">Cost</th><th className="r">Failed</th></tr></thead>
              <tbody>
                {d.rows.map((r: any, i: number) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 500 }}>{featureLabel(r.feature)}</td>
                    <td><span aria-hidden="true" style={{ display: "inline-block", width: 8, height: 8, borderRadius: 999, marginRight: 8, background: PROVIDER_COLORS[r.provider] || "#8E8E93" }} />{providerLabel(r.provider)} · {r.model}</td>
                    <td className="r adm-num">{count(r.calls)}</td>
                    <td className="r adm-num" style={{ color: "#3A3A40" }}>{units(r)}</td>
                    <td className="r adm-num" style={{ fontWeight: 600 }}>{inr(r.costInr)}</td>
                    <td className="r adm-num" style={{ color: r.calls && r.failed / r.calls > 0.05 ? "var(--adm-red)" : "#3A3A40" }}>{count(r.failed)}</td>
                  </tr>
                ))}
              </tbody>
            </TableBox>
            <p style={{ margin: "10px 10px 0", fontSize: 12, color: "var(--adm-muted)" }}>A feature listed under two models means a fallback model answered some calls.</p>
          </Card>
          <Card title="Doctors by AI cost" style={{ padding: "18px 6px 10px", marginTop: 14 }}>
            <TableBox minWidth={560}>
              <thead><tr><th>Doctor</th><th className="r">Calls</th><th className="r">Cost</th></tr></thead>
              <tbody>
                {d.byUser.slice(0, 25).map((u: any, i: number) => (
                  <tr key={i}>
                    <td><div style={{ fontWeight: 500 }}>{u.name || u.uid || "Unknown"}</div><div style={{ fontSize: 12, color: "var(--adm-muted)" }}>{u.email}</div></td>
                    <td className="r adm-num">{count(u.calls)}</td>
                    <td className="r adm-num" style={{ fontWeight: 600 }}>{inr(u.costInr)}</td>
                  </tr>
                ))}
              </tbody>
            </TableBox>
          </Card>
        </>
      ))}
    </>
  );
}

function DailyChart({ daily }: { daily: any[] }) {
  if (!daily.length) return null;
  const providers = ["anthropic", "sarvam", "openai", "google"];
  const totals = daily.map(d => providers.reduce((s, p) => s + (d[p] || 0), 0));
  const max = Math.max(1, ...totals);
  const W = 720, H = 180, pad = 28, bw = Math.max(4, Math.min(28, (W - pad) / daily.length - 4));
  return (
    <Card title="AI cost per day" right={
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12, color: "var(--adm-muted)" }}>
        {providers.map(p => <span key={p} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 3, background: PROVIDER_COLORS[p] }} />{providerLabel(p)}</span>)}
      </div>}>
      <svg viewBox={`0 0 ${W} ${H + 24}`} role="img" aria-label={`AI cost per day, highest ${inr(max)}`} style={{ width: "100%", height: "auto", display: "block" }}>
        <line x1={pad} x2={W} y1={H} y2={H} stroke="#E5E5EA" />
        <text x={0} y={12} fontSize={11} fill="#5F5F66">{inr(max)}</text>
        {daily.map((d, i) => {
          const x = pad + i * ((W - pad) / daily.length) + 2;
          let y = H;
          return (
            <g key={d.day}>
              <title>{`${day(d.day + "T12:00:00+05:30")}: ${inr(totals[i])}`}</title>
              {providers.map(p => {
                const h = ((d[p] || 0) / max) * (H - 20);
                y -= h;
                return h > 0 ? <rect key={p} x={x} y={y} width={bw} height={h} fill={PROVIDER_COLORS[p]} /> : null;
              })}
              {(i === 0 || i === daily.length - 1 || daily.length <= 10) && <text x={x + bw / 2} y={H + 16} fontSize={11} textAnchor="middle" fill="#5F5F66">{d.day.slice(8)}/{d.day.slice(5, 7)}</text>}
            </g>
          );
        })}
      </svg>
    </Card>
  );
}

// ───────────────────────── Provider Dues ─────────────────────────

export function ProvidersPage() {
  const { data, error, loading, reload } = useLoad<any>("/providers");
  return (
    <>
      <Header title="Provider Dues" sub={data ? `What each vendor has cost this month (${data.month}) and what is left` : undefined} />
      <State loading={loading && !data} error={error} onRetry={reload} />
      {data && (
        <>
          <div style={grid(280)}>
            {data.providers.map((p: any) => <ProviderCard key={p.id} p={p} onSaved={reload} />)}
          </div>
          <p style={{ fontSize: 12, color: "var(--adm-muted)", marginTop: 14, lineHeight: 1.5 }}>
            Spend comes from ErMate's own per-call log × the price table. Balances and bills are what you enter from each vendor's dashboard.
            "Balance left" = your last entry minus the spend logged since that day. Automatic sync from vendor billing comes in the next phase.
          </p>
        </>
      )}
    </>
  );
}

function ProviderCard({ p, onSaved }: { p: any; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const kindText: Record<string, string> = { prepaid: "Prepaid", postpaid: "Postpaid", deducted: "Deducted", fixed: "Fixed" };
  const enterLabel = p.kind === "prepaid" ? "Balance on vendor dashboard (₹)" : p.kind === "postpaid" ? "Current bill (₹)" : "Amount this month (₹)";
  const save = async () => {
    setBusy(true); setError("");
    try { await api(`/providers/${p.id}`, { body: { amountInr: Number(amount), note } }); setEditing(false); setAmount(""); setNote(""); onSaved(); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  const low = p.daysLeftAtCurrentUse !== null && p.daysLeftAtCurrentUse <= 7;
  return (
    <div className="adm-card" style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <strong style={{ fontSize: 15 }}>{p.name}</strong>
        <Pill text={kindText[p.kind] || p.kind} tone={p.kind === "prepaid" ? "green" : p.kind === "postpaid" ? "blue" : "grey"} />
      </div>
      {p.spentThisMonth !== null && <Row l="Spent this month" v={inr(p.spentThisMonth)} tag="Estimated" />}
      {p.kind === "prepaid" && (
        <Row l="Balance left" v={p.estimatedBalanceLeft === null ? "Enter balance" : inr(p.estimatedBalanceLeft)} strong color={low ? "var(--adm-red)" : undefined}
          tag={p.estimatedBalanceLeft === null ? "No data" : "Estimated"} />
      )}
      {p.kind !== "prepaid" && <Row l={p.kind === "postpaid" ? "Bill entered" : "Entered"} v={p.entered ? inr(p.entered.amountInr) : "Not entered"} strong tag={p.entered ? "Actual" : "No data"} />}
      <div style={{ fontSize: 12, color: low ? "var(--adm-red)" : "var(--adm-muted)", borderTop: "1px solid #F0F0F3", paddingTop: 8, lineHeight: 1.45 }}>
        {p.daysLeftAtCurrentUse !== null ? `About ${p.daysLeftAtCurrentUse} days left at the last 7 days' rate. ` : ""}
        {p.entered ? `Entered ${dateTime(p.entered.enteredAt)}${p.entered.note ? ` · ${p.entered.note}` : ""}` : "Nothing entered yet."}
      </div>
      {editing ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Field label={enterLabel}><input className="adm-input" type="number" min={0} step="0.01" value={amount} onChange={e => setAmount(e.target.value)} /></Field>
          <Field label="Note (optional)"><input className="adm-input" maxLength={200} value={note} onChange={e => setNote(e.target.value)} /></Field>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="adm-btn adm-btn-primary" disabled={busy || amount === "" || Number(amount) < 0} onClick={save}>Save</button>
            <button className="adm-btn adm-btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
          </div>
          {error && <p role="alert" style={{ color: "var(--adm-red)", fontSize: 13, margin: 0 }}>{error}</p>}
        </div>
      ) : (
        <button className="adm-btn adm-btn-soft" style={{ alignSelf: "flex-start", fontSize: 13, padding: "8px 12px", minHeight: 36 }} onClick={() => setEditing(true)}>
          {p.entered ? "Update" : p.kind === "prepaid" ? "Enter balance" : "Enter amount"}
        </button>
      )}
    </div>
  );
}

function Row({ l, v, strong, color, tag }: { l: string; v: string; strong?: boolean; color?: string; tag?: TagKind }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, alignItems: "center" }}>
      <span style={{ color: "var(--adm-muted)" }}>{l}</span>
      <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
        <span className="adm-num" style={{ fontWeight: strong ? 700 : 600, color }}>{v}</span>{tag && <Tag kind={tag} />}
      </span>
    </div>
  );
}

// ───────────────────────── Revenue ─────────────────────────

export function RevenuePage() {
  const [days, setDays] = useRange();
  const { data: d, error, loading, reload } = useLoad<any>(`/revenue?days=${days}`, [days]);
  const exportCsv = () => d && downloadCsv(`ermate-payments-${days}d.csv`, ["Date", "Doctor", "Email", "Type", "Amount INR", "Credits", "Refunded INR", "Payment ID"],
    d.payments.map((p: any) => [p.at, p.name, p.email, p.type, p.amountInr, p.credits, p.refundedInr, p.paymentId]));
  return (
    <>
      <Header title="Revenue" sub="From verified Razorpay webhooks only" right={<><RangePicker value={days} onChange={setDays} /><button className="adm-btn adm-btn-ghost" onClick={exportCsv} disabled={!d}>Export CSV</button></>} />
      <State loading={loading && !d} error={error} onRetry={reload} />
      {d && (
        <>
          <div style={{ ...grid(200), marginBottom: 14 }}>
            <Kpi label="Net revenue" value={inr(d.totals.netInr)} sub={`Gross ${inr(d.totals.grossInr)} · refunds ${inr(d.totals.refundsInr)}`} tag="Actual" />
            <Kpi label="Activations (₹600)" value={count(d.totals.activations)} tag="Actual" />
            <Kpi label="Renewals (₹350)" value={count(d.totals.renewals)} tag="Actual" />
            <Kpi label="Credit recharges" value={count(d.totals.recharges)} sub={`${count(d.totals.creditsSold)} credits sold in total`} tag="Actual" />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 14 }}>
            <Card title="AutoPay" style={{ flex: "1 1 320px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                {Object.entries(d.autopay.statusCounts).map(([s, n]: any) => <Pill key={s} text={`${s} · ${n}`} tone={s === "active" ? "green" : ["pending", "halted"].includes(s) ? "red" : "grey"} />)}
                {Object.keys(d.autopay.statusCounts).length === 0 && <span style={{ fontSize: 13, color: "var(--adm-muted)" }}>No AutoPay subscriptions yet.</span>}
              </div>
              {d.autopay.issues.map((a: any) => (
                <div key={a.uid} style={{ fontSize: 13, padding: "8px 0", borderTop: "1px solid #F0F0F3" }}>
                  <strong>{a.name || a.email || a.uid}</strong> · {a.status}{a.lastFailureAt ? ` · failed ${ago(a.lastFailureAt)}` : ""}{a.nextChargeAt ? ` · next try ${day(a.nextChargeAt)}` : ""}
                </div>
              ))}
            </Card>
            <Card title="Payment problems" style={{ flex: "1 1 320px" }}>
              {d.problems.length === 0 ? <p style={{ margin: 0, fontSize: 13, color: "var(--adm-muted)" }}>No mismatched payments.</p> : d.problems.map((p: any) => (
                <div key={p.id} style={{ fontSize: 13, padding: "8px 0", borderTop: "1px solid #F0F0F3" }}>
                  <strong>{p.source}</strong> · {p.name || p.email || p.uid || "Unknown"} · {p.reason || "mismatch"} · {ago(p.at)}
                </div>
              ))}
            </Card>
          </div>
          <Card title="Payments" style={{ padding: "18px 6px 10px" }}>
            <TableBox minWidth={760}>
              <thead><tr><th>Date</th><th>Doctor</th><th>Type</th><th className="r">Amount</th><th className="r">Credits</th><th className="r">Refunded</th></tr></thead>
              <tbody>
                {d.payments.map((p: any) => (
                  <tr key={p.paymentId}>
                    <td style={{ whiteSpace: "nowrap" }}>{dateTime(p.at)}</td>
                    <td><div style={{ fontWeight: 500 }}>{p.name || "—"}</div><div style={{ fontSize: 12, color: "var(--adm-muted)" }}>{p.email}</div></td>
                    <td>{p.type}</td>
                    <td className="r adm-num" style={{ fontWeight: 600 }}>{inr(p.amountInr)}</td>
                    <td className="r adm-num">{p.credits ? count(p.credits) : "—"}</td>
                    <td className="r adm-num" style={{ color: p.refundedInr ? "var(--adm-red)" : undefined }}>{p.refundedInr ? inr(p.refundedInr) : "—"}</td>
                  </tr>
                ))}
                {d.payments.length === 0 && <tr><td colSpan={6} style={{ color: "var(--adm-muted)" }}>No payments in this range.</td></tr>}
              </tbody>
            </TableBox>
          </Card>
        </>
      )}
    </>
  );
}

// ───────────────────────── Audit ─────────────────────────

export function AuditPage() {
  const { data, error, loading, reload } = useLoad<any>("/audit");
  const [src, setSrc] = useState("All");
  const rows = (data?.rows || []).filter((r: any) => src === "All" || r.source === src);
  return (
    <>
      <Header title="Audit Log" sub="Admin actions, team changes and role changes, newest first"
        right={<select className="adm-input" aria-label="Filter by source" value={src} onChange={e => setSrc(e.target.value)}><option>All</option><option>Admin</option><option>Team</option><option>Role change</option></select>} />
      <State loading={loading && !data} error={error} onRetry={reload} />
      {data && (
        <Card style={{ padding: "6px 6px 10px" }}>
          <TableBox minWidth={820}>
            <thead><tr><th>When</th><th>Source</th><th>Action</th><th>By</th><th>Details</th></tr></thead>
            <tbody>
              {rows.map((r: any, i: number) => (
                <tr key={i}>
                  <td style={{ whiteSpace: "nowrap" }}>{dateTime(r.at)}</td>
                  <td><Pill text={r.source} tone={r.source === "Admin" ? "purple" : r.source === "Team" ? "blue" : "grey"} /></td>
                  <td style={{ fontWeight: 500 }}>{String(r.action || "").replace(/_/g, " ")}</td>
                  <td style={{ color: "var(--adm-muted)" }}>{r.actor || "—"}</td>
                  <td style={{ fontSize: 12, color: "#3A3A40", wordBreak: "break-word" }}>{r.detail}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={5} style={{ color: "var(--adm-muted)" }}>Nothing logged yet.</td></tr>}
            </tbody>
          </TableBox>
        </Card>
      )}
    </>
  );
}