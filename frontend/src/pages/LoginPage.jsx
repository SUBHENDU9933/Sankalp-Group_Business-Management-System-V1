import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Mail, Lock, Eye, EyeOff, ShieldCheck, Loader2, ArrowRight,
  Users, UserCheck, FileText, Briefcase, Truck, BarChart3, CheckCircle2,
} from "lucide-react";
import { SANKALP_TAGLINE_BN } from "@/lib/brand";

const LOGIN_LOGO = "https://emp.sankalpdesign.com/sankalp-group-logo-email.png";
const FEATURES = [
  { icon: Users, title: "Lead Management", desc: "Track opportunities" },
  { icon: UserCheck, title: "Customers", desc: "Manage relationships" },
  { icon: Briefcase, title: "Projects", desc: "Plan & deliver" },
  { icon: FileText, title: "Receipts", desc: "Track collections" },
  { icon: Truck, title: "Vendors", desc: "Manage suppliers" },
  { icon: BarChart3, title: "Analytics", desc: "Business insights" },
];

export default function LoginPage() {
  const { signIn } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signIn(email.trim(), password);
    setSubmitting(false);
    if (error) { toast.error(error.message || "Login failed"); return; }
    toast.success("Welcome back");
    nav("/", { replace: true });
  };

  return (
    <main className="h-[100svh] min-h-0 w-full overflow-hidden bg-slate-950 text-slate-900">
      <div className="grid h-full min-h-0 lg:grid-cols-[1.08fr_.92fr]">
        {/* Brand panel: deliberately constrained to the viewport so desktop never scrolls. */}
        <section className="relative min-h-0 overflow-hidden bg-white px-5 py-4 sm:px-7 sm:py-5 lg:px-9 lg:py-6 xl:px-12">
          <div className="pointer-events-none absolute -right-32 -top-32 h-72 w-72 rounded-full bg-blue-50 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-40 -left-32 h-80 w-80 rounded-full bg-orange-50 blur-3xl" />
          <div className="relative z-10 flex h-full min-h-0 flex-col">
            <div className="flex shrink-0 items-center justify-between gap-3">
              <img src={LOGIN_LOGO} alt="Sankalp Group & Business Solutions" className="h-10 w-auto max-w-[205px] object-contain sm:h-11 sm:max-w-[240px] lg:h-12 lg:max-w-[280px] xl:h-13 xl:max-w-[310px]" />
              <div className="hidden shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500 shadow-sm sm:flex lg:px-3 lg:py-1.5 lg:text-[10px]">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Secure Portal
              </div>
            </div>

            <div className="mt-4 shrink-0 max-w-2xl sm:mt-5 lg:mt-7 xl:mt-8">
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-blue-700 sm:text-[10px]">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-500" /> Business Management System · V1
              </div>
              <h1 className="font-display text-3xl font-bold leading-[1.02] tracking-tight text-slate-950 sm:text-4xl lg:text-[3.25rem] xl:text-[3.7rem]">
                One place to manage
                <span className="block bg-gradient-to-r from-blue-800 via-blue-700 to-orange-500 bg-clip-text text-transparent">your business.</span>
              </h1>
              <p className="mt-2 max-w-xl text-xs leading-5 text-slate-500 sm:text-sm sm:leading-6 lg:mt-3">
                A connected workspace for leads, customers, estimates, projects, collections, vendors and business intelligence.
              </p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-medium text-slate-600 sm:text-xs">
                <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Role-based access</span>
                <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Secure data</span>
                <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Built for growth</span>
              </div>
            </div>

            <div className="min-h-2 flex-1" />

            <div className="hidden shrink-0 grid-cols-3 gap-3 lg:grid xl:gap-4">
              {FEATURES.map((f) => (
                <div key={f.title} className="group rounded-xl border border-slate-100 bg-white/75 px-3 py-2.5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md xl:px-3.5 xl:py-3">
                  <div className="mb-1.5 grid h-7 w-7 place-items-center rounded-lg bg-slate-50 text-blue-700 ring-1 ring-slate-100 group-hover:bg-blue-50 xl:h-8 xl:w-8">
                    <f.icon className="h-4 w-4" strokeWidth={2.1} />
                  </div>
                  <div className="text-[11px] font-bold text-slate-900 xl:text-xs">{f.title}</div>
                  <div className="mt-0.5 text-[9px] text-slate-500 xl:text-[10px]">{f.desc}</div>
                </div>
              ))}
            </div>

            <div className="mt-3 hidden shrink-0 items-end justify-between border-t border-slate-100 pt-2.5 text-[9px] text-slate-400 lg:flex">
              <div><div className="font-bengali text-xs text-slate-600">"{SANKALP_TAGLINE_BN}"</div><div className="mt-0.5">We Build Spaces. We Manage Business.</div></div>
              <div className="text-right">© 2026 Sankalp Group · All rights reserved.</div>
            </div>
          </div>
        </section>

        {/* Login panel: centered inside the exact viewport; no page-level scroll. */}
        <section className="relative flex min-h-0 items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 px-4 py-5 sm:px-7 sm:py-6 lg:px-8 xl:px-12">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-orange-500/10 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,.7)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.7)_1px,transparent_1px)] [background-size:44px_44px]" />

          <div className="relative z-10 w-full max-w-[430px]">
            <div className="mb-3 flex items-center justify-between px-1 text-[10px] text-white/55 sm:mb-4 sm:text-xs">
              <span>Employee access</span>
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Encrypted connection</span>
            </div>
            <div className="rounded-[24px] border border-white/15 bg-white/[0.97] p-5 shadow-[0_25px_75px_rgba(0,0,0,0.35)] sm:p-7 lg:p-8">
              <div className="mb-5 text-center sm:mb-6">
                <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-blue-700 to-blue-900 text-white shadow-lg shadow-blue-900/20 sm:h-11 sm:w-11"><Lock className="h-4.5 w-4.5" strokeWidth={2.2} /></div>
                <h2 className="font-display text-2xl font-bold tracking-tight text-slate-950 sm:text-[1.7rem]">Welcome back</h2>
                <p className="mt-1 text-xs text-slate-500 sm:text-sm">Sign in to continue to your workspace</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-4.5" data-testid="login-form">
                <div>
                  <label htmlFor="login-email" className="text-xs font-semibold text-slate-700 sm:text-sm">Email Address</label>
                  <div className="relative mt-1.5">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input id="login-email" type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" className="h-11 rounded-xl border-slate-200 bg-slate-50/70 pl-10 text-sm transition-all placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-blue-500/10 sm:h-12 sm:pl-11 sm:text-[15px]" data-testid="login-email-input" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between gap-3"><label htmlFor="login-password" className="text-xs font-semibold text-slate-700 sm:text-sm">Password</label><button type="button" className="text-[10px] font-semibold text-blue-700 hover:text-blue-900 hover:underline sm:text-xs" onClick={() => toast.info("Please contact your administrator to reset your password.")}>Forgot Password?</button></div>
                  <div className="relative mt-1.5">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input id="login-password" type={showPwd ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password" className="h-11 rounded-xl border-slate-200 bg-slate-50/70 pl-10 pr-11 text-sm transition-all placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-blue-500/10 sm:h-12 sm:pl-11 sm:text-[15px]" data-testid="login-password-input" />
                    <button type="button" aria-label={showPwd ? "Hide password" : "Show password"} onClick={() => setShowPwd(!showPwd)} className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">{showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                  </div>
                </div>
                <Button type="submit" disabled={submitting} className="group h-11 w-full rounded-xl bg-gradient-to-r from-blue-700 via-blue-700 to-blue-800 text-white shadow-lg shadow-blue-800/20 transition-all duration-300 hover:-translate-y-0.5 hover:from-blue-800 hover:to-blue-900 hover:shadow-xl hover:shadow-blue-900/25 disabled:translate-y-0 sm:h-12" data-testid="login-submit-button">
                  {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <span className="inline-flex items-center gap-2">Sign in <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" /></span>}
                </Button>
                <div className="flex items-center gap-3 pt-0.5 text-[9px] text-slate-400 sm:text-[10px]"><div className="h-px flex-1 bg-slate-100" /><span>AUTHORIZED USERS ONLY</span><div className="h-px flex-1 bg-slate-100" /></div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 text-center text-[10px] text-slate-500 sm:text-xs">Don't have an account? <span className="font-semibold text-blue-700">Contact Admin</span></div>
              </form>
            </div>
            <div className="mt-3 flex items-center justify-center gap-2 text-[9px] text-white/45 sm:mt-4 sm:text-[10px]"><ShieldCheck className="h-3 w-3" /> Secure · Reliable · Efficient <span>•</span> Sankalp Group</div>
          </div>
        </section>
      </div>
    </main>
  );
}
