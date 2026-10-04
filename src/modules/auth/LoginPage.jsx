import { useState } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { LogIn, Shield } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";
import { useAuthStore } from "@/lib/store/authStore";
import { authenticate, LEGACY_DEFAULT_PASSWORD } from "@/lib/services/userService";
import { roleLabel } from "@/lib/domain/roles";
import { toast } from "@/lib/toast";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = useState("admin@sgt.local");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Already logged in → go to intended or dashboard
  if (user) {
    const to = location.state?.from?.pathname || "/dashboard";
    return <Navigate to={to} replace />;
  }

  const submit = async (e) => {
    e.preventDefault();

    if (!email.trim() || !password) {
      toast.error("Enter your email and password");
      return;
    }

    setLoading(true);

    try {
      const found = await authenticate({ email, password });

      const session = login({
        id: found.id,
        name: found.name,
        email: found.email,
        role: found.role,
      });

      toast.success(`Welcome, ${session.name} · ${roleLabel(session.role)}`);

      const to = location.state?.from?.pathname || "/dashboard";
      navigate(to, { replace: true });
    } catch (error) {
      toast.error(error?.message || "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-timber-50 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-timber-700 to-timber-500 flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">🪵</span>
          </div>
          <div className="font-extrabold text-xl text-timber-700 tracking-tight">
            Sri Ganesh Timber
          </div>
          <div className="text-xs text-muted mt-1">Business Manager</div>
        </div>

        <form
          onSubmit={submit}
          className="bg-white border border-line rounded-xl p-5 space-y-4"
        >
          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              autoFocus
            />
          </Field>

          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            <LogIn className="h-4 w-4" /> {loading ? "Signing in…" : "Sign in"}
          </Button>

          <div className="flex items-start gap-2 text-[11px] text-muted pt-1">
            <Shield className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <div>
              Your role (admin, manager, sales or viewer) is set by an admin in
              Settings → Users. First time? The default admin password is{" "}
              <span className="font-semibold text-ink">
                {LEGACY_DEFAULT_PASSWORD}
              </span>{" "}
              — change it after signing in.
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}