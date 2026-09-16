import { useState } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { LogIn, Shield } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Field } from "@/components/ui/Field";
import { useAuthStore } from "@/lib/store/authStore";
import { toast } from "@/lib/toast";

const ROLES = [
  { value: "admin",   label: "Admin — full access" },
  { value: "manager", label: "Manager — operations + price override" },
  { value: "sales",   label: "Sales — create documents" },
  { value: "viewer",  label: "Viewer — read only" },
];

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const login = useAuthStore((s) => s.login);

  const [name, setName] = useState("Admin");
  const [email, setEmail] = useState("admin@sgt.local");
  const [role, setRole] = useState("admin");

  // Already logged in → go to intended or dashboard
  if (user) {
    const to = location.state?.from?.pathname || "/dashboard";
    return <Navigate to={to} replace />;
  }

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      toast.error("Enter your name and email");
      return;
    }
    login({ name: name.trim(), email: email.trim(), role });
    toast.success(`Welcome, ${name}`);
    const to = location.state?.from?.pathname || "/dashboard";
    navigate(to, { replace: true });
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
          <Field label="Your name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Role" hint="For demo — no password required">
            <Select value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </Field>

          <Button type="submit" className="w-full" size="lg">
            <LogIn className="h-4 w-4" /> Sign in
          </Button>

          <div className="flex items-start gap-2 text-[11px] text-muted pt-1">
            <Shield className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <div>
              Demo authentication. Role decides what you can edit — try
              switching roles to see permissions in action.
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}