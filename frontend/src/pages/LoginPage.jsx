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
  Users,
  UserCheck,
  FileText,
  Briefcase,
  Truck,
  BarChart3,
  CheckCircle2,
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
    if (error) {
      toast.error(error.message || "Login failed");
      return;
    }
    toast.success("Welcome back");
    nav("/", { replace: true });
  };

  return (
    <main className="min-h-[100svh] w-full bg-slate-950 text-slate-900 overflow-x-hidden">
      <div className="min-h-[100svh] lg:grid lg:grid-cols-[1.08fr_.92fr]">
        {/* Brand panel — compact on mobile/tablet, full experience on desktop */}
        <section className="relative overflow-hidden bg-white px-5 py-6 sm:px-8 sm:py-8 lg:min-h-[100svh] lg:px-12 lg:py-10 xl:px-16">
          <div className="pointer-events-none absolute -right-32 -top-32 h-72 w-72 rounded-full bg-blue-50 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-40 -left-32 h-80 w-80 rounded-full bg-orange-50 blur-3xl" />

          <div className="relative z-10 flex h-full flex-col">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center">
                <img
                  src={LOGIN_LOGO}
                  alt="Sankalp Group & Business Solutions"
                  className="h-12 w-auto max-w-[250px] object-contain sm:h-14 sm:max-w-[310px] lg:h-16 lg:max-w-[360px]"
                />
              </div>
              <div className="hidden shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 shadow-sm sm:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Secure Portal
              </div>
            </div>

            <div className="mt-8 max-w-2xl sm:mt-10 lg:mt-20 xl:mt-24">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                Business Management System · V1
              </div>

              <h1 className="font-display text-3xl font-bold leading-[1.08] tracking-tight text-slate-950 sm:text-4xl md:text-5xl lg:text-6xl xl:text-[4.25rem]">
                One place to manage
                <span className="block bg-gradient-to-r from-blue-800 via-blue-700 to-orange-500 bg-clip-text text-transparent">
                  your business.
                </span>
              </h1>

              <p className="mt-4 max-w-xl text-sm leading-6 text-slate-500 sm:text-base sm:leading-7 lg:mt-6">
                A connected workspace for leads, customers, estimates, projects,
                collections, vendors and business intelligence.
              </p>

              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-slate-600 sm:mt-7 sm:text-sm">
                <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Role-based access</span>
                <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Secure data</span>
                <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Built for growth</span>
              </div>
            </div>

            <div className="hidden flex-1 lg:block" />

            <div className="mt-8 hidden grid-cols-3 gap-x-5 gap-y-6 lg:grid xl:mt-10">
              {FEATURES.map((f) => (
                <div key={f.title} className="group rounded-2xl border border-slate-100 bg-white/75 p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                  <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-slate-50 text-blue-700 ring-1 ring-slate-100 transition-colors group-hover:bg-blue-50">
                    <f.icon className="h-5 w-5" strokeWidth={2.1} />
                  </div>
                  <div className="text-sm font-bold text-slate-900">{f.title}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{f.desc}</div>
                </div>
              ))}
            </div>

            <div className="mt-7 hidden items-end justify-between border-t border-slate-100 pt-5 text-xs text-slate-400 lg:flex">
              <div>
                <div className="font-bengali text-sm text-slate-600">"{SANKALP_TAGLINE_BN}"</div>
                <div className="mt-1">We Build Spaces. We Manage Business.</div>
              </div>
              <div className="text-right">© 2026 Sankalp Group<br />All rights reserved.</div>
            </div>
          </div>
        </section>

        {/* Login panel */}
        <section className="relative flex min-h-[calc(100svh-172px)] items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 px-4 py-8 sm:px-8 sm:py-10 lg:min-h-[100svh] lg:px-10 xl:px-16">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-orange-500/10 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,.7)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.7)_1px,transparent_1px)] [background-size:44px_44px]" />

          <div className="relative z-10 w-full max-w-[460px]">
            <div className="mb-5 flex items-center justify-between px-1 text-xs text-white/55 sm:mb-6">
              <span>Employee access</span>
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Encrypted connection</span>
            </div>

            <div className="rounded-[28px] border border-white/15 bg-white/[0.97] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.35)] sm:p-8 lg:p-9">
              <div className="mb-7 text-center sm:mb-8">
                <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-blue-700 to-blue-900 text-white shadow-lg shadow-blue-900/20">
                  <Lock className="h-5 w-5" strokeWidth={2.2} />
                </div>
                <h2 className="font-display text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Welcome back</h2>
                <p className="mt-1.5 text-sm text-slate-500">Sign in to continue to your workspace</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5" data-testid="login-form">
                <div>
                  <label htmlFor="login-email" className="text-sm font-semibold text-slate-700">Email Address</label>
                  <div className="relative mt-2">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="login-email"
                      type="email"
                      required
                      autoFocus
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      autoComplete="email"
                      className="h-12 rounded-xl border-slate-200 bg-slate-50/70 pl-11 text-[15px] transition-all placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-blue-500/10"
                      data-testid="login-email-input"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor="login-password" className="text-sm font-semibold text-slate-700">Password</label>
                    <button
                      type="button"
                      className="text-xs font-semibold text-blue-700 transition-colors hover:text-blue-900 hover:underline"
                      onClick={() => toast.info("Please contact your administrator to reset your password.")}
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="relative mt-2">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="login-password"
                      type={showPwd ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      className="h-12 rounded-xl border-slate-200 bg-slate-50/70 pl-11 pr-11 text-[15px] transition-all placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-blue-500/10"
                      data-testid="login-password-input"
                    />
                    <button
                      type="button"
                      aria-label={showPwd ? "Hide password" : "Show password"}
                      onClick={() => setShowPwd(!showPwd)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    >
                      {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="group h-12 w-full rounded-xl bg-gradient-to-r from-blue-700 via-blue-700 to-blue-800 text-white shadow-lg shadow-blue-800/20 transition-all duration-300 hover:-translate-y-0.5 hover:from-blue-800 hover:to-blue-900 hover:shadow-xl hover:shadow-blue-900/25 disabled:translate-y-0"
                  data-testid="login-submit-button"
                >
                  {submitting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      Sign in
                      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </span>
                  )}
                </Button>

                <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-400">
                  <div className="h-px flex-1 bg-slate-100" />
                  <span>AUTHORIZED USERS ONLY</span>
                  <div className="h-px flex-1 bg-slate-100" />
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-center text-xs text-slate-500">
                  Don't have an account? <span className="font-semibold text-blue-700">Contact Admin</span>
                </div>
              </form>
            </div>

            <div className="mt-5 flex items-center justify-center gap-2 text-[11px] text-white/45 sm:mt-6">
              <ShieldCheck className="h-3.5 w-3.5" />
              Secure · Reliable · Efficient
              <span className="mx-1">•</span>
              Sankalp Group
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
