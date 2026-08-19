import { useMutation } from "@tanstack/react-query";
import { Eye, EyeOff, Check } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { authApi, type JwtUser } from "../../lib/api/auth.api";
import { PipelineFlow } from "../../components/PipelineFlow";

// ─── Theme (GlobalLogic brand — scoped to auth screen only) ───────────────────────────────────────────────
const C = {
  accentTeal:  "#FF5F2D",  // Impact Orange
  accentHover: "#CF3708",  // Deep Orange
  heroBg:      "#181A24",  // Steel Gray 100
  danger:      "#CF3708",  // Deep Orange
  pageBg:      "#F2F3F6",  // Light Steel
  subtleBg:    "#FFCEB9",  // Light Orange
  fg1:         "#181A24",  // Steel Gray 100
  fg2:         "#484F6B",  // Steel Gray 75
  fg3:         "#858A9B",  // Steel Gray 50
  onDark2:     "#C8CAD3",  // Steel Gray 25
  border:      "#C8CAD3",  // Steel Gray 25
  borderSub:   "#F2F3F6",  // Light Steel
  focusRing:   "0 0 0 3px rgba(255,95,45,0.35)",
} as const;

// ─── Shared input style ───────────────────────────────────────────────────────
function inputStyle(hasError: boolean): React.CSSProperties {
  return {
    width: "100%", padding: "8px 12px", border: `1px solid ${hasError ? C.danger : C.border}`,
    borderRadius: 8, fontSize: 13, color: C.fg1, outline: "none", boxSizing: "border-box" as const,
    backgroundColor: "#fff",
  };
}

// ─── Field wrapper with label + inline error ──────────────────────────────────
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 500, color: C.fg2 }}>
        {label} <span style={{ color: C.danger }}>*</span>
      </label>
      {children}
      {error && <p style={{ marginTop: 3, fontSize: 11, color: C.danger }}>{error}</p>}
    </div>
  );
}

// ─── Hero (left pane) ─────────────────────────────────────────────────────────
function HeroPane() {
  const benefits = [
    "Evidence-backed talent matching",
    "IRC-level staffing transparency",
    "One workspace for candidates, managers, and HR",
  ];
  return (
    <div style={{
      flex: 1, minWidth: 380, maxWidth: 560, background: C.heroBg,
      padding: "40px 48px", display: "flex", flexDirection: "column", justifyContent: "center",
    }} className="hero-pane">
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 28 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, background: C.accentTeal,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 700, fontSize: 14, color: "#fff", fontFamily: "var(--font-display)",
        }}>T</div>
        <span style={{ color: "#fff", fontWeight: 600, fontSize: 16, fontFamily: "var(--font-display)" }}>
          TalentLens AI
        </span>
      </div>
      {/* Headline */}
      <h1 style={{
        color: "#fff", fontWeight: 600, fontSize: 26, lineHeight: 1.25, maxWidth: 420,
        marginBottom: 10, fontFamily: "var(--font-display)",
      }} className="hero-headline">
        See talent clearly.<br />Move opportunities forward.
      </h1>
      {/* Subhead */}
      <p style={{ color: C.onDark2, fontSize: 13, lineHeight: 1.6, maxWidth: 400, marginBottom: 18 }}>
        TalentLens AI brings candidate evidence, staffing pipelines, and hiring progress into one focused workspace.
      </p>
      {/* Benefits */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        {benefits.map(b => (
          <div key={b} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 18, height: 18, borderRadius: "50%", background: "rgba(255,95,45,0.35)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <Check size={10} color="#fff" strokeWidth={3} />
            </div>
            <span style={{ color: "#fff", fontSize: 12.5 }}>{b}</span>
          </div>
        ))}
      </div>
      {/* Animated pipeline flow diagram (desktop only) */}
      <div className="hero-cards">
        <PipelineFlow />
      </div>
    </div>
  );
}

// ─── Login form ───────────────────────────────────────────────────────────────
type DemoRole = "manager" | "hr" | "candidate";

function LoginForm({ onSuccess }: { onSuccess: (t: string, u: JwtUser) => void }) {
  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");
  const [showPwd,   setShowPwd]   = useState(false);
  const [remember,  setRemember]  = useState(false);
  const [demoRole,  setDemoRole]  = useState<DemoRole | null>(null);
  const [errors,    setErrors]    = useState<Record<string, string>>({});

  const loginMut = useMutation({
    mutationFn: () => authApi.login({ email, password }),
    onSuccess:  ({ token, user }) => onSuccess(token, user),
    onError:    (e: any) => setErrors({ api: e?.response?.data?.message ?? "Invalid credentials" }),
  });
  const demoMut = useMutation({
    mutationFn: (role: DemoRole) => authApi.demoLogin(role),
    onSuccess:  ({ token, user }) => onSuccess(token, user),
    onError:    () => setErrors({ api: "Demo login failed. Is the server running?" }),
  });

  function validate() {
    const errs: Record<string, string> = {};
    if (!email.trim()) errs.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Enter a valid email.";
    if (!password) errs.password = "Password is required.";
    else if (password.length < 6) errs.password = "Password must be at least 6 characters.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validate()) loginMut.mutate();
  }

  const busy = loginMut.isPending || demoMut.isPending;

  return (
    <form onSubmit={handleSubmit}>
      {errors.api && <p style={{ marginBottom: 14, fontSize: 13, color: C.danger }}>{errors.api}</p>}
      <Field label="Email address" error={errors.email}>
        <input type="email" value={email} placeholder="you@globallogic.com"
          onChange={e => setEmail(e.target.value)} style={inputStyle(!!errors.email)}
          onFocus={e => Object.assign(e.target.style, { borderColor: C.accentTeal, boxShadow: C.focusRing })}
          onBlur={e => Object.assign(e.target.style, { borderColor: errors.email ? C.danger : C.border, boxShadow: "none" })} />
      </Field>
      <Field label="Password" error={errors.password}>
        <div style={{ position: "relative" }}>
          <input type={showPwd ? "text" : "password"} value={password}
            onChange={e => setPassword(e.target.value)}
            style={{ ...inputStyle(!!errors.password), paddingRight: 38 }}
            onFocus={e => Object.assign(e.target.style, { borderColor: C.accentTeal, boxShadow: C.focusRing })}
            onBlur={e => Object.assign(e.target.style, { borderColor: errors.password ? C.danger : C.border, boxShadow: "none" })} />
          <button type="button" onClick={() => setShowPwd(s => !s)} style={{
            position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
            background: "none", border: "none", cursor: "pointer", color: C.fg3, padding: 0,
          }}>{showPwd ? <EyeOff size={16} /> : <Eye size={16} />}</button>
        </div>
      </Field>
      {/* Remember me + Forgot */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.fg2, cursor: "pointer" }}>
          <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
            style={{ accentColor: C.accentTeal, width: 15, height: 15 }} />
          Remember me
        </label>
        <a href="#" style={{ fontSize: 13, fontWeight: 600, color: C.accentTeal, textDecoration: "none" }}>
          Forgot password?
        </a>
      </div>
      {/* Demo login box */}
      <div style={{ background: C.subtleBg, borderRadius: 8, padding: 10, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginBottom: 6 }}>
          <span style={{ fontWeight: 700, fontSize: 11.5, textTransform: "uppercase" as const, letterSpacing: "0.03em", color: C.fg1 }}>
            Login as
          </span>
          <span style={{ fontSize: 11.5, color: C.fg3 }}>(demo only)</span>
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          {(["manager", "hr", "candidate"] as DemoRole[]).map(role => (
            <button key={role} type="button" disabled={busy}
              onClick={() => { setDemoRole(role); demoMut.mutate(role); }}
              style={{
                flex: 1, borderRadius: 7, padding: "7px 4px", fontSize: 12, fontWeight: 600,
                cursor: "pointer", textTransform: "capitalize" as const,
                background: demoRole === role && demoMut.isPending ? C.accentTeal : demoRole === role ? C.accentTeal : "#fff",
                color: demoRole === role ? "#fff" : C.fg2,
                border: `1px solid ${demoRole === role ? C.accentTeal : C.border}`,
              }}>
              {demoMut.isPending && demoRole === role ? "…" : role.charAt(0).toUpperCase() + role.slice(1)}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 11.5, color: C.fg3 }}>Demo access — choose a role to preview the relevant workspace.</p>
      </div>
      {/* Submit */}
      <button type="submit" disabled={busy} style={{
        width: "100%", background: busy ? C.border : C.accentTeal, color: busy ? C.fg3 : "#fff",
        border: "none", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 600,
        cursor: busy ? "not-allowed" : "pointer",
      }}>{loginMut.isPending ? "Logging in…" : "Log in"}</button>
    </form>
  );
}

// ─── Signup form ──────────────────────────────────────────────────────────────
function SignupForm({ onSuccess }: { onSuccess: (t: string, u: JwtUser) => void }) {
  const [form,    setForm]    = useState({ name: "", email: "", password: "", confirm: "", role: "manager", terms: false });
  const [showPwd, setShowPwd] = useState(false);
  const [errors,  setErrors]  = useState<Record<string, string>>({});

  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));

  const signupMut = useMutation({
    mutationFn: () => authApi.signup({ name: form.name, email: form.email, password: form.password, role: form.role }),
    onSuccess:  ({ token, user }) => onSuccess(token, user),
    onError:    (e: any) => setErrors({ api: e?.response?.data?.message ?? "Signup failed" }),
  });

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Full name is required.";
    if (!form.email.trim()) errs.email = "Work email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = "Enter a valid email.";
    if (!form.password) errs.password = "Password is required.";
    else if (form.password.length < 8) errs.password = "Use 8+ characters with a mix of letters and numbers.";
    if (form.password !== form.confirm) errs.confirm = "Passwords do not match.";
    if (!form.terms) errs.terms = "You must agree to the Terms of Service.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit(e: React.FormEvent) { e.preventDefault(); if (validate()) signupMut.mutate(); }

  const busy = signupMut.isPending;
  const inputFocus = (e: React.FocusEvent<HTMLInputElement>) =>
    Object.assign(e.target.style, { borderColor: C.accentTeal, boxShadow: C.focusRing });
  const inputBlur = (key: string) => (e: React.FocusEvent<HTMLInputElement>) =>
    Object.assign(e.target.style, { borderColor: errors[key] ? C.danger : C.border, boxShadow: "none" });

  return (
    <form onSubmit={handleSubmit}>
      {errors.api && <p style={{ marginBottom: 14, fontSize: 13, color: C.danger }}>{errors.api}</p>}
      <Field label="Full name" error={errors.name}>
        <input value={form.name} onChange={e => set("name", e.target.value)} style={inputStyle(!!errors.name)}
          onFocus={inputFocus} onBlur={inputBlur("name")} />
      </Field>
      <Field label="Work email" error={errors.email}>
        <input type="email" value={form.email} placeholder="you@globallogic.com"
          onChange={e => set("email", e.target.value)} style={inputStyle(!!errors.email)}
          onFocus={inputFocus} onBlur={inputBlur("email")} />
      </Field>
      <Field label="Password" error={errors.password}>
        <div style={{ position: "relative" }}>
          <input type={showPwd ? "text" : "password"} value={form.password}
            onChange={e => set("password", e.target.value)}
            style={{ ...inputStyle(!!errors.password), paddingRight: 38 }}
            onFocus={inputFocus} onBlur={inputBlur("password")} />
          <button type="button" onClick={() => setShowPwd(s => !s)} style={{
            position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
            background: "none", border: "none", cursor: "pointer", color: C.fg3, padding: 0,
          }}>{showPwd ? <EyeOff size={16} /> : <Eye size={16} />}</button>
        </div>
        {!errors.password && (
          <p style={{ marginTop: 4, fontSize: 12, color: C.fg3 }}>Use 8+ characters with a mix of letters and numbers.</p>
        )}
      </Field>
      <Field label="Confirm password" error={errors.confirm}>
        <input type="password" value={form.confirm} onChange={e => set("confirm", e.target.value)}
          style={inputStyle(!!errors.confirm)} onFocus={inputFocus} onBlur={inputBlur("confirm")} />
      </Field>
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: C.fg2, cursor: "pointer" }}>
          <input type="checkbox" checked={form.terms} onChange={e => set("terms", e.target.checked)}
            style={{ accentColor: C.accentTeal, width: 15, height: 15, marginTop: 1, flexShrink: 0 }} />
          I agree to the Terms of Service and Privacy Policy.
        </label>
        {errors.terms && <p style={{ marginTop: 4, fontSize: 12, color: C.danger }}>{errors.terms}</p>}
      </div>
      <button type="submit" disabled={busy} style={{
        width: "100%", background: busy ? C.border : C.accentTeal, color: busy ? C.fg3 : "#fff",
        border: "none", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 600,
        cursor: busy ? "not-allowed" : "pointer",
      }}>{busy ? "Creating account…" : "Create account"}</button>
    </form>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export function LoginPage() {
  const [tab, setTab] = useState<"login" | "signup">("login");
  const { login }     = useAuth();
  const navigate      = useNavigate();

  function handleSuccess(token: string, user: JwtUser) {
    login(token, user); navigate("/dashboard", { replace: true });
  }

  const tabHeadings = {
    login:  { h: "Welcome back",         sub: "Sign in to continue to your TalentLens AI workspace." },
    signup: { h: "Create your account",  sub: "Set up your TalentLens AI access in a few steps." },
  };

  return (
    <>
      <style>{`
        .login-root { min-height: 100vh; display: flex; flex-direction: row; background: ${C.pageBg}; }
        .hero-pane  { display: flex; }
        .hero-cards { display: flex; }
        @media (max-width: 920px) {
          .login-root { flex-direction: column; }
          .hero-pane  { min-width: unset !important; max-width: unset !important; padding: 32px 24px !important; }
          .hero-headline { font-size: 26px !important; }
          .hero-cards { display: none !important; }
          .auth-pane  { align-items: flex-start !important; padding: 24px 20px 40px !important; }
        }
      `}</style>
      <div className="login-root">
        <HeroPane />
        {/* Right auth pane */}
        <div className="auth-pane" style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        }}>
          <div style={{
            maxWidth: 380, width: "100%", background: "#fff",
            border: `1px solid ${C.borderSub}`, borderRadius: 12, padding: 22,
            boxShadow: "0 2px 4px rgba(0,0,0,0.06)",
          }}>
            {/* Tab switcher */}
            <div style={{
              background: C.pageBg, borderRadius: 8, padding: 3,
              display: "flex", marginBottom: 16,
            }}>
              {(["login", "signup"] as const).map(t => (
                <button key={t} type="button" onClick={() => setTab(t)} style={{
                  flex: 1, border: "none", borderRadius: 7, padding: "9px", fontSize: 13,
                  fontWeight: 600, cursor: "pointer",
                  background:  tab === t ? "#fff"        : "transparent",
                  color:       tab === t ? C.accentTeal  : C.fg3,
                  boxShadow:   tab === t ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                }}>
                  {t === "login" ? "Log in" : "Sign up"}
                </button>
              ))}
            </div>
            {/* Heading */}
            <h2 style={{ margin: "0 0 3px", fontSize: 18, fontWeight: 600, color: C.fg1, fontFamily: "var(--font-display)" }}>
              {tabHeadings[tab].h}
            </h2>
            <p style={{ margin: "0 0 16px", fontSize: 12, color: C.fg3 }}>{tabHeadings[tab].sub}</p>
            {tab === "login"
              ? <LoginForm  onSuccess={handleSuccess} />
              : <SignupForm onSuccess={handleSuccess} />}
          </div>
        </div>
      </div>
    </>
  );
}
