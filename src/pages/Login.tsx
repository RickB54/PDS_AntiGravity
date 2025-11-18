import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { quickAccessLogin, beginLogin, isIdentityEnabled, isSupabaseEnabled, loginSupabase, signupSupabase } from "@/lib/auth";
import { Briefcase, Shield } from "lucide-react";
import logo from "@/assets/logo-3inch.png";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleQuickAccess = (role: 'employee' | 'admin') => {
    if (isIdentityEnabled()) {
      beginLogin(role);
      const go = () => navigate('/dashboard', { replace: true });
      // Navigate after auth state updates
      window.addEventListener('auth-changed', go as EventListener, { once: true } as any);
    } else {
      quickAccessLogin(role);
      navigate('/dashboard', { replace: true });
    }
  };

  const handleSupabaseLogin = async () => {
    setLoading(true);
    const u = await loginSupabase(email, password);
    setLoading(false);
    if (u) navigate(u.role === 'customer' ? '/customer-dashboard' : '/dashboard', { replace: true });
  };

  const handleSupabaseSignup = async () => {
    setLoading(true);
    const u = await signupSupabase(email, password);
    setLoading(false);
    if (u) navigate('/customer-dashboard', { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-4">
          <img src={logo} alt="Prime Detail Solutions" className="w-48 mx-auto" />
          <h1 className="text-3xl font-bold text-foreground">Welcome</h1>
          <p className="text-muted-foreground">Precision, Protection, Perfection</p>
          <div className="mt-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/">Back to Website</Link>
            </Button>
          </div>
        </div>

        <Card className="p-6 space-y-6">
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Sign In</h2>
            <p className="text-sm text-muted-foreground">Choose your role to continue.</p>
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Button
                onClick={() => handleQuickAccess('employee')}
                variant="outline"
                type="button"
                className="flex-col h-auto py-4 gap-2"
              >
                <Briefcase className="h-6 w-6" />
                <span className="text-xs">Employee Login</span>
              </Button>
              <Button
                onClick={() => handleQuickAccess('admin')}
                variant="outline"
                type="button"
                className="flex-col h-auto py-4 gap-2"
              >
                <Shield className="h-6 w-6" />
                <span className="text-xs">Admin Login</span>
              </Button>
            </div>
            {isSupabaseEnabled() && (
              <div className="mt-4 border-t pt-4 space-y-3">
                <p className="text-sm text-muted-foreground">Sign in or create an account with email and password.</p>
                <div className="space-y-2">
                  <input
                    type="email"
                    placeholder="email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-md border px-3 py-2 bg-background"
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-md border px-3 py-2 bg-background"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Button onClick={handleSupabaseLogin} variant="default" type="button" disabled={loading}>
                    {loading ? 'Signing in...' : 'Sign In'}
                  </Button>
                  <Button onClick={handleSupabaseSignup} variant="outline" type="button" disabled={loading}>
                    {loading ? 'Creating...' : 'Sign Up'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Login;
