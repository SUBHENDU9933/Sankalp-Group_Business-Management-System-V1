import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  Loader2,
  ArrowRight,
  Building2,
  CircleCheck,
  KeyRound,
  Sparkles,
} from "lucide-react";
import { SANKALP_TAGLINE_BN } from "@/lib/brand";

const LOGIN_LOGO = "https://emp.sankalpdesign.com/sankalp-group-logo-email.png";

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
    if (error) {
      toast.error(error.message || "Login failed");
      return;
    }
    toast.success("Welcome back");
    nav("/", { replace: true });
  };

  return (
    <main className="h-[100svh] w-full overflow-hidden bg-[#071225] text-slate-900">
      <div className="relative h-full min-h-0 overflow-hidden lg:p-4 xl:p-5">
        {/* Ambient background — intentionally subtle so the authentication task stays dominant. */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_15%,rgba(31,78,150,.28),transparent_30%),radial-gradient(circle_at_88%_82%,rgba(216,133,43,.13),transparent_28%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.045] [background-image:linear-gradient(rgba(255,255,255,.9)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.9)_1px,transparent_1px)] [background-size:52px_52px]" />

        <div className="relative mx-auto grid h-full min-h-0 max-w-[1440px] overflow-hidden bg-white shadow-[0_30px_100px_rgba(0,0,0,.34)] lg:h-[calc(100svh-2rem)] lg:min-h-[620px] lg:grid-cols-[1.02fr_.98fr] lg:rounded-[28px] xl:h-[calc(100svh-2.5rem)]">
          {/* BRAND / PRODUCT PANEL */}
          <section className="relative min-h-0 overflow-hidden bg-[#f8fafc] px-6 py-5 sm:px-9 sm:py-6 lg:px-10 lg:py-9 xl:px-14 xl:py-10">
            <div className="pointer-events-none absolute -left-24 top-28 h-72 w-72 rounded-full bg-blue-100/50 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-28 right-0 h-80 w-80 rounded-full bg-amber-100/35 blur-3xl" />
            <div className="pointer-events-none absolute bottom-0 right-0 h-[72%] w-[46%] opacity-[0.035] [background-image:linear-gradient(135deg,transparent_49.6%,#12305c_49.8%,#12305c_50.2%,transparent_50.4%)] [background-size:74px_74px]" />

            <div className="relative z-10 flex h-full min-h-0 flex-col">
              <div className="flex shrink-0 items-center justify-between gap-4">
                <div className="flex h-12 items-center rounded-xl border border-slate-200/90 bg-white px-3 shadow-[0_5px_18px_rgba(15,23,42,.06)] sm:h-14 sm:px-4">
                  <img
                    src={LOGIN_LOGO}
                    alt="Sankalp Group & Business Solutions"
                    className="h-8 w-auto max-w-[220px] object-contain sm:h-9 sm:max-w-[250px]"
                  />
                </div>
                <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white/85 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500 shadow-sm sm:flex">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Secure Workspace
                </div>
              </div>

              <div className="min-h-0 flex-1 flex items-center py-5 sm:py-7 lg:py-5">
                <div className="max-w-[610px]">
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-[#174ea6] shadow-sm sm:text-[10px]">
                    <Sparkles className="h-3 w-3" />
                    Business Management System · V1
                  </div>

                  <h1 className="font-display text-[2.25rem] font-bold leading-[1.04] tracking-[-0.04em] text-[#081326] sm:text-[3.1rem] lg:text-[3.25rem] xl:text-[3.75rem]">
                    Your business,
                    <span className="block text-[#174ea6]">beautifully connected.</span>
                  </h1>

                  <p className="mt-4 max-w-[540px] text-sm leading-6 text-slate-500 sm:text-[15px] lg:mt-3">
                    One secure workspace for leads, customers, estimates, projects, collections, vendors and business intelligence.
                  </p>

                  <div className="mt-5 grid max-w-[520px] grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
                    {[
                      [Building2, "Operations"],
                      [CircleCheck, "Control"],
                      [KeyRound, "Access"],
                      [ShieldCheck, "Security"],
                    ].map(([Icon, label]) => (
                      <div key={label} className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/80 px-2.5 py-2 text-[10px] font-semibold text-slate-600 shadow-sm sm:px-3 sm:py-2.5 sm:text-[11px]">
                        <Icon className="h-3.5 w-3.5 shrink-0 text-[#174ea6]" strokeWidth={2} />
                        {label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="hidden shrink-0 border-t border-slate-200/80 pt-4 sm:block lg:pt-3">
                <div className="flex items-end justify-between gap-6">
                  <div>
                    <div className="font-bengali text-xs text-slate-600">"{SANKALP_TAGLINE_BN}"</div>
                    <div className="mt-1 text-[10px] text-slate-400">We Build Spaces. We Manage Business.</div>
                  </div>
                  <div className="text-right text-[10px] text-slate-400">© 2026 Sankalp Group<br />All rights reserved.</div>
                </div>
              </div>
            </div>
          </section>

          {/* AUTHENTICATION PANEL */}
          <section className="relative flex min-h-0 items-center justify-center overflow-hidden bg-[#071225] px-5 py-6 sm:px-8 lg:px-10 xl:px-14">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(39,91,181,.28),transparent_34%),radial-gradient(circle_at_80%_100%,rgba(221,139,42,.11),transparent_27%)]" />
            <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.8)_1px,transparent_1px)] [background-size:46px_46px]" />

            <div className="relative z-10 w-full max-w-[440px]">
              <div className="mb-3 flex items-center justify-between px-1 text-[9px] font-medium uppercase tracking-[0.14em] text-white/45 sm:mb-4 sm:text-[10px]">
                <span>Employee Portal</span>
                <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Protected access</span>
              </div>

              <div className="overflow-hidden rounded-[26px] border border-white/10 bg-white shadow-[0_28px_80px_rgba(0,0,0,.36)]">
                <div className="h-1 bg-gradient-to-r from-[#174ea6] via-[#2d67cf] to-[#d68a2d]" />
                <div className="p-6 sm:p-8 lg:p-9">
                  <div className="mb-6 sm:mb-7">
                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#edf4ff] text-[#174ea6] ring-1 ring-blue-100">
                      <Lock className="h-5 w-5" strokeWidth={2.1} />
                    </div>
                    <h2 className="font-display text-[1.9rem] font-bold tracking-[-0.035em] text-[#081326] sm:text-[2rem]">Welcome back.</h2>
                    <p className="mt-1.5 text-sm text-slate-500">Sign in to access your business workspace.</p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4" data-testid="login-form">
                    <div>
                      <label htmlFor="login-email" className="text-xs font-semibold text-slate-700 sm:text-sm">Email address</label>
                      <div className="relative mt-1.5">
                        <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          id="login-email"
                          type="email"
                          required
                          autoFocus
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@company.com"
                          autoComplete="email"
                          className="h-12 rounded-xl border-slate-200 bg-slate-50 pl-10 text-sm shadow-none transition-all placeholder:text-slate-400 focus-visible:border-[#174ea6] focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-blue-600/10 sm:pl-11 sm:text-[15px]"
                          data-testid="login-email-input"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <label htmlFor="login-password" className="text-xs font-semibold text-slate-700 sm:text-sm">Password</label>
                        <button
                          type="button"
                          className="text-[10px] font-semibold text-[#174ea6] hover:text-[#0e3470] hover:underline sm:text-xs"
                          onClick={() => toast.info("Please contact your administrator to reset your password.")}
                        >
                          Forgot password?
                        </button>
                      </div>
                      <div className="relative mt-1.5">
                        <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          id="login-password"
                          type={showPwd ? "text" : "password"}
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter your password"
                          autoComplete="current-password"
                          className="h-12 rounded-xl border-slate-200 bg-slate-50 pl-10 pr-11 text-sm shadow-none transition-all placeholder:text-slate-400 focus-visible:border-[#174ea6] focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-blue-600/10 sm:pl-11 sm:text-[15px]"
                          data-testid="login-password-input"
                        />
                        <button
                          type="button"
                          aria-label={showPwd ? "Hide password" : "Show password"}
                          onClick={() => setShowPwd(!showPwd)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                        >
                          {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={submitting}
                      className="group h-12 w-full rounded-xl bg-[#174ea6] text-white shadow-[0_10px_24px_rgba(23,78,166,.24)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#123f8b] hover:shadow-[0_14px_30px_rgba(23,78,166,.3)] disabled:translate-y-0"
                      data-testid="login-submit-button"
                    >
                      {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <span className="inline-flex items-center gap-2">Sign in <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" /></span>}
                    </Button>

                    <div className="flex items-center gap-3 pt-1 text-[9px] font-medium uppercase tracking-[0.14em] text-slate-400 sm:text-[10px]">
                      <div className="h-px flex-1 bg-slate-100" />
                      <span>Authorized users only</span>
                      <div className="h-px flex-1 bg-slate-100" />
                    </div>

                    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-center text-[10px] text-slate-500 sm:text-xs">
                      Need access? <span className="font-semibold text-[#174ea6]">Contact your administrator</span>
                    </div>
                  </form>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-center gap-2 text-[9px] text-white/40 sm:mt-4 sm:text-[10px]">
                <ShieldCheck className="h-3 w-3" />
                Secure authentication <span>•</span> Sankalp Group
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
