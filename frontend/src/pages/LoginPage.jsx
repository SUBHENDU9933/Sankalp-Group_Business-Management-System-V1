import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowRight, Loader2 } from "lucide-react";

const BG_IMG =
  "https://images.pexels.com/photos/30783645/pexels-photo-30783645.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=900&w=1400";

export default function LoginPage() {
  const { signIn } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    <div className="min-h-screen w-full grid lg:grid-cols-2 bg-stone-100">
      {/* Left: Hero */}
      <div
        className="hidden lg:flex flex-col justify-between p-12 relative bg-stone-900 text-white"
        style={{
          backgroundImage: `linear-gradient(rgba(28,25,23,0.7), rgba(28,25,23,0.85)), url(${BG_IMG})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500 grid place-items-center font-display font-bold text-xl">S</div>
          <div className="font-display text-lg tracking-tight">SANKALP GROUP</div>
        </div>

        <div>
          <div className="label-uppercase text-orange-400 mb-6">Internal Operating System v1</div>
          <h1 className="font-display text-5xl xl:text-6xl font-bold leading-[0.95] tracking-tight">
            Build it.<br />
            Track it.<br />
            <span className="text-orange-500">Deliver it.</span>
          </h1>
          <p className="mt-8 text-stone-300 max-w-md leading-relaxed">
            One control room for leads, customers, receipts, projects, expenses and vendors —
            engineered for the Interior &amp; Infrastructure business.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-0 border-t border-stone-700 pt-6">
          <div className="border-r border-stone-700 pr-4">
            <div className="label-uppercase text-stone-500">Module</div>
            <div className="font-display text-lg mt-1">Leads</div>
          </div>
          <div className="border-r border-stone-700 px-4">
            <div className="label-uppercase text-stone-500">Module</div>
            <div className="font-display text-lg mt-1">Receipts</div>
          </div>
          <div className="pl-4">
            <div className="label-uppercase text-stone-500">Module</div>
            <div className="font-display text-lg mt-1">Projects</div>
          </div>
        </div>
      </div>

      {/* Right: Form */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md bg-white border border-stone-200 p-8 sm:p-12">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-9 h-9 bg-orange-500 grid place-items-center font-display font-bold text-white">S</div>
            <div className="font-display text-base">SANKALP GROUP</div>
          </div>
          <div className="label-uppercase mb-3">Sign In</div>
          <h2 className="font-display text-3xl font-bold tracking-tight mb-1">Welcome back.</h2>
          <p className="text-sm text-stone-600 mb-8">Sign in with your team credentials.</p>

          <form onSubmit={handleSubmit} className="space-y-5" data-testid="login-form">
            <div className="space-y-2">
              <Label htmlFor="email" className="label-uppercase">Email</Label>
              <Input
                id="email"
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-none h-11 border-stone-300 focus-visible:ring-stone-900 focus-visible:ring-2 focus-visible:ring-offset-0"
                placeholder="you@sankalpgroup.in"
                data-testid="login-email-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="label-uppercase">Password</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-none h-11 border-stone-300 focus-visible:ring-stone-900 focus-visible:ring-2 focus-visible:ring-offset-0"
                placeholder="••••••••"
                data-testid="login-password-input"
              />
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-11 rounded-none bg-stone-900 hover:bg-stone-800 text-white font-medium tracking-wide group"
              data-testid="login-submit-button"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Sign In <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-10 pt-6 border-t border-stone-200">
            <div className="label-uppercase text-stone-500 mb-2">Need access?</div>
            <p className="text-sm text-stone-600">Contact your administrator to provision an account.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
