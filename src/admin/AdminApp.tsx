import React, { useEffect, useState } from "react";
import {
  onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, signOut, type User,
} from "firebase/auth";
import { adminAuthClient, api, ApiError, go } from "./api";
import {
  OverviewPage, UsersPage, HospitalsPage, LocationsPage, HodPage, UsagePage, ProvidersPage, RevenuePage, AuditPage,
} from "./sections";

export const SECTIONS = [
  { path: "", label: "Overview", page: OverviewPage },
  { path: "users", label: "Users", page: UsersPage },
  { path: "hospitals", label: "Hospitals", page: HospitalsPage },
  { path: "locations", label: "Locations", page: LocationsPage },
  { path: "hod-requests", label: "HOD Requests", page: HodPage },
  { path: "api-usage", label: "API Usage", page: UsagePage },
  { path: "provider-dues", label: "Provider Dues", page: ProvidersPage },
  { path: "revenue", label: "Revenue", page: RevenuePage },
  { path: "audit", label: "Audit Log", page: AuditPage },
] as const;

function currentSection(): string {
  const p = window.location.pathname.replace(/^\/admin\/?/, "").replace(/\/$/, "");
  return SECTIONS.some(s => s.path === p) ? p : "";
}

export default function AdminApp() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [allowed, setAllowed] = useState<"checking" | "yes" | "no">("checking");
  const [denyReason, setDenyReason] = useState("");

  useEffect(() => onAuthStateChanged(adminAuthClient, u => { setUser(u); setAllowed("checking"); }), []);

  useEffect(() => {
    if (!user) return;
    api("/me").then(() => setAllowed("yes")).catch((e: ApiError) => {
      setDenyReason(e.code === "EMAIL_NOT_VERIFIED" ? e.message : "This account cannot open the admin portal.");
      setAllowed("no");
    });
  }, [user]);

  if (user === undefined) return <Centered><p style={{ color: "var(--adm-muted)" }}>Loading…</p></Centered>;
  if (!user) return <SignIn />;
  if (allowed === "checking") return <Centered><p style={{ color: "var(--adm-muted)" }}>Checking access…</p></Centered>;
  if (allowed === "no") {
    return (
      <Centered>
        <div className="adm-card" style={{ padding: 28, maxWidth: 420 }}>
          <h1 style={{ margin: "0 0 8px", fontSize: 20 }}>Not available</h1>
          <p style={{ margin: "0 0 18px", color: "var(--adm-muted)", fontSize: 14 }}>{denyReason}</p>
          <button className="adm-btn adm-btn-ghost" onClick={() => signOut(adminAuthClient)}>Sign out</button>
        </div>
      </Centered>
    );
  }
  return <Shell user={user} />;
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>{children}</div>;
}

function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div aria-hidden="true" style={{ width: 34, height: 34, borderRadius: 10, background: "var(--adm-purple)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>E</div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <strong style={{ fontSize: 15 }}>ErMate Admin</strong>
        <span style={{ fontSize: 12, color: "var(--adm-muted)" }}>admin.ermate.in</span>
      </div>
    </div>
  );
}

function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<any>) => {
    setBusy(true); setError("");
    try { await fn(); } catch (e: any) { setError(e?.code === "auth/popup-closed-by-user" ? "" : "Sign-in failed. Check the details and try again."); }
    finally { setBusy(false); }
  };
  return (
    <Centered>
      <div className="adm-card" style={{ padding: 28, width: "100%", maxWidth: 400, boxSizing: "border-box" }}>
        <Logo />
        <h1 style={{ margin: "22px 0 6px", fontSize: 22 }}>Sign in</h1>
        <p style={{ margin: "0 0 18px", color: "var(--adm-muted)", fontSize: 14 }}>Platform admin only.</p>
        <button className="adm-btn adm-btn-primary" style={{ width: "100%" }} disabled={busy}
          onClick={() => run(() => signInWithPopup(adminAuthClient, new GoogleAuthProvider()))}>
          Continue with Google
        </button>
        <form onSubmit={e => { e.preventDefault(); run(() => signInWithEmailAndPassword(adminAuthClient, email.trim(), password)); }}
          style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 18, paddingTop: 18, borderTop: "1px solid var(--adm-line)" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--adm-muted)" }}>Email
            <input className="adm-input" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--adm-muted)" }}>Password
            <input className="adm-input" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required />
          </label>
          <button className="adm-btn adm-btn-ghost" type="submit" disabled={busy}>Sign in with email</button>
        </form>
        {error && <p role="alert" style={{ color: "var(--adm-red)", fontSize: 13, margin: "12px 0 0" }}>{error}</p>}
      </div>
    </Centered>
  );
}

function Shell({ user }: { user: User }) {
  const [section, setSection] = useState(currentSection());
  const [hodPending, setHodPending] = useState<number | null>(null);

  useEffect(() => {
    const on = () => setSection(currentSection());
    window.addEventListener("popstate", on);
    window.addEventListener("admin:navigate", on);
    return () => { window.removeEventListener("popstate", on); window.removeEventListener("admin:navigate", on); };
  }, []);

  useEffect(() => {
    const load = () => api("/hod-claims?status=pending").then(d => setHodPending(d.claims.length)).catch(() => {});
    load();
    window.addEventListener("admin:hod-changed", load);
    return () => window.removeEventListener("admin:hod-changed", load);
  }, []);

  const active = SECTIONS.find(s => s.path === section) || SECTIONS[0];
  const Page = active.page;

  useEffect(() => {
    document.title = `${active.label} · ErMate Admin`;
    // On phones the section menu is a sideways-scrolling row: keep the current section in view.
    document.querySelector('nav[aria-label="Admin sections"] [aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active.label]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexWrap: "wrap", alignItems: "flex-start" }}>
      <aside style={{ flex: "1 1 232px", maxWidth: 260, minWidth: 0, alignSelf: "stretch", boxSizing: "border-box", padding: "24px 16px", background: "rgba(255,255,255,0.72)", borderRight: "1px solid var(--adm-line)", minHeight: "100vh" }}
        className="max-[860px]:!basis-full max-[860px]:!max-w-full max-[860px]:!min-h-0 max-[860px]:!border-r-0 max-[860px]:border-b max-[860px]:border-[var(--adm-line)] max-[860px]:!pb-3">
        <div style={{ padding: "0 8px 20px" }}><Logo /></div>
        <nav aria-label="Admin sections" className="flex flex-col gap-0.5 max-[860px]:flex-row max-[860px]:overflow-x-auto max-[860px]:pb-1">
          {SECTIONS.map(s => {
            const on = s.path === active.path;
            return (
              <a key={s.path} href={s.path ? `/admin/${s.path}` : "/admin"} aria-current={on ? "page" : undefined}
                onClick={e => { e.preventDefault(); go(s.path); }}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "10px 12px", borderRadius: 10,
                  fontSize: 14, textDecoration: "none", whiteSpace: "nowrap", minHeight: 24,
                  background: on ? "var(--adm-purple)" : "transparent", color: on ? "#fff" : "var(--adm-ink)", fontWeight: on ? 600 : 400,
                }}>
                {s.label}
                {s.path === "hod-requests" && hodPending ? (
                  <b style={{ background: on ? "#fff" : "var(--adm-amber)", color: on ? "var(--adm-purple)" : "#fff", fontSize: 11, padding: "2px 7px", borderRadius: 999 }}>{hodPending}</b>
                ) : null}
              </a>
            );
          })}
        </nav>
        <div className="max-[860px]:hidden" style={{ marginTop: 24, padding: 12, borderRadius: 12, background: "var(--adm-bg)", fontSize: 12, color: "var(--adm-muted)", lineHeight: 1.5 }}>
          Signed in as {user.email}
          <div><button className="adm-btn" style={{ padding: 0, minHeight: 0, background: "none", color: "var(--adm-purple)", fontSize: 12, marginTop: 6 }} onClick={() => signOut(adminAuthClient)}>Sign out</button></div>
        </div>
      </aside>
      <main style={{ flex: "999 1 560px", minWidth: 0, boxSizing: "border-box", padding: "28px clamp(16px, 3vw, 32px) 48px", maxWidth: 1180 }}>
        <Page />
      </main>
    </div>
  );
}