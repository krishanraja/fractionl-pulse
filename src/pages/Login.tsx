import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ArrowRight } from 'lucide-react';
import fractionlLogo from '@/assets/fractionl-logo.png';
import fractionlIcon from '@/assets/fractionl-icon.png';

const Login = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 1000);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-sm space-y-8"
        >
          {/* Logo - Full logo only on login page */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-center space-y-4"
          >
            <img 
              src={fractionlLogo} 
              alt="Fractionl AI" 
              className="h-10 mx-auto object-contain"
            />
            <div>
              <h1 className="text-xl font-semibold text-foreground">Welcome back</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Sign in to access your dashboard
              </p>
            </div>
          </motion.div>

          {/* Form */}
          <motion.form 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            onSubmit={handleSubmit} 
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button type="button" className="text-xs text-primary hover:underline">
                  Forgot password?
                </button>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                className="h-11"
              />
            </div>

            <Button type="submit" className="w-full h-11" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign in'}
              <ArrowRight size={16} className="ml-2" />
            </Button>
          </motion.form>

          {/* Divider */}
          <div className="relative">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-3 text-xs text-muted-foreground">
              or continue with
            </span>
          </div>

          {/* Social Login */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <Button variant="outline" className="w-full h-11">
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </Button>
          </motion.div>

          {/* Sign up link */}
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center text-sm text-muted-foreground"
          >
            Don't have an account?{' '}
            <button type="button" className="text-primary hover:underline font-medium">
              Create account
            </button>
          </motion.p>
        </motion.div>
      </div>

      {/* Right Panel - Branding (Desktop only) */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-primary/5 via-secondary/10 to-primary/5 items-center justify-center p-12 relative overflow-hidden">
        {/* Decorative gradient orbs */}
        <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-48 h-48 bg-secondary/20 rounded-full blur-3xl" />
        
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="max-w-md space-y-8 relative z-10"
        >
          {/* Large icon for branding */}
          <motion.img 
            src={fractionlIcon}
            alt="Fractionl"
            className="w-20 h-20 object-contain"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
          />
          
          <div className="space-y-4">
            <h2 className="text-3xl font-semibold text-foreground leading-tight">
              Real-time intelligence on the fractional economy
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Track demand, supply, and cultural adoption signals across the fractional executive market. Make informed decisions with data-driven insights.
            </p>
          </div>
          
          {/* Stats preview */}
          <div className="grid grid-cols-3 gap-4 pt-4">
            <div className="text-center p-4 glass-card">
              <div className="text-2xl font-bold text-primary">0-100</div>
              <div className="text-xs text-muted-foreground mt-1">Index Scale</div>
            </div>
            <div className="text-center p-4 glass-card">
              <div className="text-2xl font-bold text-success">3</div>
              <div className="text-xs text-muted-foreground mt-1">Sub-Indices</div>
            </div>
            <div className="text-center p-4 glass-card">
              <div className="text-2xl font-bold text-accent">Live</div>
              <div className="text-xs text-muted-foreground mt-1">Data Pipeline</div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
