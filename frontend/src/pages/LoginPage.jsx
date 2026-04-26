import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Mail, Lock, Eye, EyeOff, ShieldCheck, Loader2,
  Users, UserCheck, FileText, Briefcase, Truck, BarChart3 } from "lucide-react";
import { Logo, SANKALP_TAGLINE_BN } from "@/lib/brand";

const HERO_BG =
  "https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&w=1600";

const FEATURES = [
  { icon: Users, color: "bg-blue-50 text-blue-600", title: "Lead Management", desc: "Track and manage leads effectively" },
  { icon: UserCheck, color: "bg-orange-50 text-orange-600", title: "Customer Management", desc: "Manage customer relationships" },
  { icon: Briefcase, color: "bg-blue-50 text-blue-600", title: "Project Management", desc: "Plan, execute and deliver projects" },
  { icon: FileText, color: "bg-emerald-50 text-emerald-600", title: "Receipt Management", desc: "Generate and track payment receipts" },
  { icon: Truck, color: "bg-violet-50 text-violet-600", title: "Vendor Management", desc: "Manage vendors and suppliers" },
  { icon: BarChart3, color: "bg-blue-50 text-blue-600", title: "Analytics & Reports", desc: "Get insights and make better decisions" },
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
    <div className="min-h-screen w-full grid lg:grid-cols-2 bg-white">
      {/* LEFT — branded hero */}
      <div className="relative bg-white p-8 sm:p-12 flex flex-col overflow-hidden">
        <div className="inline-flex items-center justify-center bg-white rounded-2xl shadow-sm border border-slate-100 p-3 w-fit">
          <Logo className="h-14 w-auto" />
        </div>

        <div className="mt-10">
          <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
            <span className="text-slate-900">Business Management</span><br />
            <span className="text-orange-500">System V1</span>
          </h1>
          <div className="mt-6 font-bengali text-slate-700 text-xl">"{SANKALP_TAGLINE_BN}"</div>
          <div className="text-slate-500 text-sm mt-1">We Build Spaces. We Manage Business.</div>

          <div className="flex items-center gap-3 mt-8">
            <div className="h-px flex-1 bg-slate-200" />
            <div className="label-uppercase text-blue-700">Sankalp Group · Business Solutions</div>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="grid grid-cols-3 gap-x-6 gap-y-8 mt-10">
            {FEATURES.map((f) => (
              <div key={f.title} className="text-center">
                <div className={`mx-auto w-14 h-14 rounded-2xl grid place-items-center ${f.color} shadow-sm border border-slate-100`}>
                  <f.icon className="w-6 h-6" strokeWidth={2.2} />
                </div>
                <div className="font-semibold text-slate-900 text-sm mt-3">{f.title}</div>
                <div className="text-xs text-slate-500 leading-relaxed mt-1">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1" />

        <div className="relative -mx-8 sm:-mx-12 -mb-8 sm:-mb-12 mt-10 h-32">
          <svg viewBox="0 0 1200 200" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
            <path d="M0,120 C400,40 800,200 1200,80 L1200,200 L0,200 Z" fill="#1E3FAD" opacity="0.95" />
            <path d="M0,160 C400,90 800,200 1200,140 L1200,200 L0,200 Z" fill="#F97316" opacity="0.95" />
          </svg>
          <div className="absolute bottom-4 left-8 sm:left-12 right-8 sm:right-12 flex items-center justify-between text-white text-xs">
            <div className="inline-flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Secure · Reliable · Efficient</div>
            <div>© 2026 Sankalp Group. All rights reserved.</div>
          </div>
        </div>
      </div>

      {/* RIGHT — login card on bg image */}
      <div className="relative flex items-center justify-center p-6 sm:p-12"
           style={{ backgroundImage: `linear-gradient(rgba(30,63,173,0.55), rgba(15,23,42,0.65)), url(${HERO_BG})`,
                    backgroundSize: "cover", backgroundPosition: "center" }}>
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 sm:p-10 border border-white/40">
          <div className="text-center">
            <h2 className="font-display text-3xl font-bold text-slate-900">Welcome Back!</h2>
            <p className="text-sm text-slate-500 mt-1">Login to access your dashboard</p>
            <div className="flex items-center gap-3 mt-5">
              <div className="h-px flex-1 bg-slate-200" />
              <div className="w-9 h-9 rounded-full bg-blue-50 grid place-items-center"><Lock className="w-4 h-4 text-blue-600" /></div>
              <div className="h-px flex-1 bg-slate-200" />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5" data-testid="login-form">
            <div>
              <label className="text-sm font-semibold text-slate-700">Email Address</label>
              <div className="relative mt-1.5">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  type="email" required autoFocus value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="pl-10 h-12 rounded-xl border-slate-200 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-0"
                  data-testid="login-email-input"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">Password</label>
              <div className="relative mt-1.5">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  type={showPwd ? "text" : "password"} required value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="pl-10 pr-10 h-12 rounded-xl border-slate-200 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-0"
                  data-testid="login-password-input"
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="text-right mt-2">
                <a className="text-sm font-semibold text-blue-700 hover:underline" href="#" onClick={(e) => { e.preventDefault(); toast.info("Please contact your administrator to reset your password."); }}>
                  Forgot Password?
                </a>
              </div>
            </div>

            <Button type="submit" disabled={submitting}
                    className="w-full h-12 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-semibold tracking-wide shadow-lg shadow-blue-600/20"
                    data-testid="login-submit-button">
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Login"}
            </Button>

            <div className="text-center text-sm text-slate-500">
              Don't have an account? <span className="font-semibold text-blue-700">Contact Admin</span>
            </div>
          </form>
        </div>

        <div className="absolute bottom-4 right-6 inline-flex items-center gap-1.5 text-white/80 text-xs">
          <Lock className="w-3 h-3" /> Secure System
        </div>
      </div>
    </div>
  );
}
