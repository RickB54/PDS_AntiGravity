import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { quickAccessLogin, getCurrentUser } from "@/lib/auth";

const Portal = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token");
  const user = getCurrentUser();

  useEffect(() => {
    // If token exists, grant customer access then go to portal
    if (token) {
      // Simulate magic-link: set a temporary customer session
      quickAccessLogin("customer");
      navigate("/customer-portal", { replace: true });
      return;
    }

    // If already a customer, go straight to portal
    if (user?.role === "customer") {
      navigate("/customer-portal", { replace: true });
      return;
    }

    // Otherwise, fallback to public site
    navigate("/", { replace: true });
  }, [token, user, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-muted-foreground">Loading customer portal…</p>
    </div>
  );
};

export default Portal;
