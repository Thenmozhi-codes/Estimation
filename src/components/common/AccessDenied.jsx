import { useNavigate } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/lib/store/authStore";
import { roleLabel } from "@/lib/domain/roles";

export function AccessDenied() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10">
          <ShieldAlert className="h-6 w-6 text-red-500" />
        </div>

        <div className="text-base font-bold text-ink">No access</div>
        <p className="mt-1 text-xs text-muted">
          Your role ({roleLabel(role)}) cannot open this page. Ask an admin if
          you need access.
        </p>

        <Button className="mt-4" size="sm" onClick={() => navigate("/dashboard")}>
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
}

export default AccessDenied;