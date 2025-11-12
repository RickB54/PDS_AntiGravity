import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { quickAccessLogin } from "@/lib/auth";

const QuickLogin = () => {
  const navigate = useNavigate();
  const params = useParams();
  const roleParam = (params.role || "customer") as "admin" | "employee" | "customer";

  useEffect(() => {
    try {
      quickAccessLogin(roleParam);
    } catch (e) {
      // Fallback to customer if invalid role
      quickAccessLogin("customer");
    }
    // After quick login, route to role dashboard so sidebar is visible
    navigate("/dashboard", { replace: true });
  }, [roleParam, navigate]);

  return null;
};

export default QuickLogin;
