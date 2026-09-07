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
  House,
  PencilRuler,
  Settings2,
  BriefcaseBusiness,
  TrendingUp,
  Users,
  UserRound,
  FileText,
  Receipt,
  Truck,
  BarChart3,
} from "lucide-react";
import { SANKALP_TAGLINE_BN } from "@/lib/brand";

const LOGIN_LOGO = "https://emp.sankalpdesign.com/sankalp-group-logo-email.png";
const HERO_IMAGE =
  "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=2400&q=88";

const SERVICE_STEPS = [
  { icon: House, label: "Plan" },
  { icon: PencilRuler, label: "Design" },
  { icon: Settings2, label: "Execute" },
  { icon: BriefcaseBusiness, label: "Manage" },
  { icon: TrendingUp, label: "Grow" },
];

const MODULES = [
  { icon: Users, title: "Lead Management", desc: "Track and manage leads effectively", tone: "blue" },
  { icon: UserRound, title: "Customer Management", desc: "Manage customer relationships", tone: "orange" },
  { icon: FileText, title: "Project Management", desc: "Plan, execute and deliver projects", tone: "blue" },
  { icon: Receipt, title: "Receipt Management", desc: "Generate and track payment receipts", tone: "orange" },
  { icon: Truck, title: "Vendor Management", desc: "Manage vendors and suppliers", tone: "green" },
  { icon: BarChart3, title: "Analytics & Reports", desc: "Get insights and make better decisions", tone: "orange" },
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
    <main className="h-[100svh] w-full overflow-hidden bg-white text-[#10213f]">
      <div className="flex h-full min-h-0 flex-col">
        {/* Premium visual hero */}
        <section className="relative min-h-0 flex-1 overflow-hidden lg:flex-[0_0_74%]">
          <img
            src={HERO_IMAGE}
            alt="Premium Sankalp workspace interior"
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#f8f5ef]/98 via-[#f8f5ef]/78 via-[42%] to-[#081b35]/28" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#071a31]/55 via-transparent to-transparent" />

          <div className="relative z-10 mx-auto flex h-full min-h-0 max-w-[1700px] flex-col px-5 py-4 sm:px-8 sm:py-6 lg:px-10 lg:py-7 xl:px-12">
            {/* Brand */}
            <div className="flex shrink-0 items-start justify-between gap-4">
              <div className="rounded-xl bg-white/94 px-3 py-2 shadow-[0_10px_35px_rgba(12,34,64,.12)] ring-1 ring-white/70 backdrop-blur-sm sm:px-4 sm:py-2.5">
                <img
                  src={LOGIN_LOGO}
                  alt="Sankalp Group & Business Solutions"
                  className="h-8 w-auto max-w-[205px] object-contain sm:h-10 sm:max-w-[245px]"
                />
              </div>
              <div className="hidden items-center gap-2 rounded-full bg-white/80 px-3.5 py-2 text-[9px] font-bold uppercase tracking-[0.18em] text-[#18345b] shadow-sm backdrop-blur-md sm:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Secure Business Portal
              </div>
            </div>

            <div className="flex min-h-0 flex-1 items-center justify-between gap-5 lg:gap-10">
              {/* Left brand story */}
              <div className="hidden max-w-[430px] shrink-0 lg:block">
                <div className="mb-4 font-script text-[2.7rem] leading-[0.9] text-[#071b38] xl:text-[3.35rem]">
                  Building
                  <br />
                  Better Spaces
                  <br />
                  <span className="relative inline-block">Together<span className="absolute -bottom-1 left-0 h-1 w-20 -rotate-[8deg] bg-[#f4771a]" /></span>
                </div>

                <div className="mt-7 space-y-3">
                  {SERVICE_STEPS.map(({ icon: Icon, label }) => (
                    <div key={label} className="flex items-center gap-3 text-[13px] font-semibold text-[#112846]">
                      <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/78 shadow-sm ring-1 ring-white/80 backdrop-blur-sm">
                        <Icon className="h-4 w-4" strokeWidth={1.8} />
                      </span>
                      {label}
                    </div>
                  ))}
                </div>

                <div className="mt-8 text-[9px] font-semibold uppercase tracking-[0.22em] text-[#17375f]/70">
                  Interiors&nbsp;&nbsp;|&nbsp;&nbsp;Infrastructure&nbsp;&nbsp;|&nbsp;&nbsp;Business Solutions
                </div>
              </div>

              {/* Login card */}
              <div className="flex w-full justify-center lg:justify-end">
                <div className="w-full max-w-[410px] rounded-[22px] bg-white/96 p-5 shadow-[0_28px_80px_rgba(8,27,53,.26)] ring-1 ring-white/80 backdrop-blur-md sm:p-7 lg:max-w-[405px] lg:p-7 xl:max-w-[420px] xl:p-8">
                  <div className="text-center">
                    <img
                      src={LOGIN_LOGO}
                      alt="Sankalp Group"
                      className="mx-auto h-12 w-auto max-w-[245px] object-contain sm:h-14"
                    />
                    <h1 className="mt-4 font-display text-[1.65rem] font-bold tracking-[-0.03em] text-[#10213f] sm:text-[1.8rem]">
                      Welcome Back!
                    </h1>
                    <p className="mt-1 text-xs text-[#6b7d98] sm:text-sm">Login to your Business Management System</p>
                  </div>

                  <form onSubmit={handleSubmit} className="mt-5 space-y-3.5 sm:mt-6 sm:space-y-4" data-testid="login-form">
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#607895]" />
                      <Input
                        id="login-email"
                        type="email"
                        required
                        autoFocus
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email address"
                        autoComplete="email"
                        className="h-11 rounded-xl border-0 bg-[#edf4fc] pl-10 text-sm text-[#10213f] shadow-none placeholder:text-[#6c7f9b] focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-[#2a67c7]/25 sm:h-12 sm:pl-11"
                        data-testid="login-email-input"
                      />
                    </div>

                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#607895]" />
                      <Input
                        id="login-password"
                        type={showPwd ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        autoComplete="current-password"
                        className="h-11 rounded-xl border-0 bg-[#edf4fc] pl-10 pr-11 text-sm text-[#10213f] shadow-none placeholder:text-[#6c7f9b] focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-[#2a67c7]/25 sm:h-12 sm:pl-11"
                        data-testid="login-password-input"
                      />
                      <button
                        type="button"
                        aria-label={showPwd ? "Hide password" : "Show password"}
                        onClick={() => setShowPwd(!showPwd)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#607895] hover:bg-white hover:text-[#10213f]"
                      >
                        {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        className="text-[10px] font-semibold text-[#1858b4] hover:underline sm:text-xs"
                        onClick={() => toast.info("Please contact your administrator to reset your password.")}
                      >
                        Forgot Password?
                      </button>
                    </div>

                    <Button
                      type="submit"
                      disabled={submitting}
                      className="group h-11 w-full rounded-xl bg-[#f87818] text-sm font-bold text-white shadow-[0_9px_20px_rgba(248,120,24,.25)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#ed690b] hover:shadow-[0_13px_25px_rgba(248,120,24,.32)] sm:h-12"
                      data-testid="login-submit-button"
                    >
                      {submitting ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <span className="inline-flex items-center gap-2">Login <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
                      )}
                    </Button>

                    <div className="flex items-center gap-3 text-[10px] text-[#7a8ba4]">
                      <div className="h-px flex-1 bg-[#e5eaf1]" />
                      <span>or</span>
                      <div className="h-px flex-1 bg-[#e5eaf1]" />
                    </div>

                    <button
                      type="button"
                      onClick={() => toast.info("Google sign-in is not enabled for this Business Management System.")}
                      className="h-10 w-full rounded-xl border border-[#cfd9e6] bg-white text-xs font-semibold text-[#233b5d] transition-colors hover:bg-[#f8fafc] sm:h-11"
                    >
                      <span className="inline-flex items-center gap-2.5">
                        <span className="font-bold text-[15px]">G</span>
                        Continue with Google
                      </span>
                    </button>

                    <div className="pt-1 text-center text-[10px] text-[#71839c] sm:text-xs">
                      Don&apos;t have an account? <span className="font-semibold text-[#f26f16]">Contact Admin</span>
                    </div>
                  </form>
                </div>
              </div>
            </div>

            <div className="hidden shrink-0 items-center justify-between text-[9px] text-white/85 sm:flex lg:text-[10px]">
              <span className="rounded-md bg-black/15 px-2 py-1 backdrop-blur-sm">© 2026 Sankalp Group · All rights reserved.</span>
              <span className="rounded-md bg-black/15 px-2 py-1 backdrop-blur-sm">Secure&nbsp;&nbsp;•&nbsp;&nbsp;Reliable&nbsp;&nbsp;•&nbsp;&nbsp;Efficient</span>
            </div>
          </div>
        </section>

        {/* Product capability strip */}
        <section className="relative z-20 shrink-0 bg-white lg:flex-[0_0_26%]">
          <div className="mx-auto grid h-full max-w-[1700px] grid-cols-2 divide-x divide-y divide-[#dfe6ef] sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">
            {MODULES.map(({ icon: Icon, title, desc, tone }) => (
              <div key={title} className="flex min-h-0 items-center justify-center px-3 py-3 text-center sm:px-4 lg:px-5 xl:px-7">
                <div>
                  <div
                    className={`mx-auto mb-2 grid h-9 w-9 place-items-center rounded-xl ${
                      tone === "orange" ? "bg-orange-50 text-[#f4771a]" : tone === "green" ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-[#1760c3]"
                    }`}
                  >
                    <Icon className="h-4.5 w-4.5" strokeWidth={1.8} />
                  </div>
                  <div className="text-[10px] font-bold leading-4 text-[#10213f] sm:text-[11px] lg:text-xs">{title}</div>
                  <div className="mx-auto mt-0.5 max-w-[175px] text-[9px] leading-3.5 text-[#71839c] sm:text-[10px]">{desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden h-7 items-center justify-between border-t border-[#e8edf3] px-5 text-[9px] text-[#71839c] lg:flex xl:px-8">
            <span className="font-bengali">"{SANKALP_TAGLINE_BN}"</span>
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3 w-3" /> Secure · Reliable · Efficient</span>
          </div>
        </section>
      </div>
    </main>
  );
}
