import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import CustomerPortal from "./CustomerPortal";

const Index = () => {
  const user = getCurrentUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      // Auto-redirect authenticated users to dashboard
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  // If user is logged in, show loading state while redirecting
  if (user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  // Show public homepage (CustomerPortal) for non-authenticated users
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <CustomerPortal />
    </div>
  );
};

export default Index;
