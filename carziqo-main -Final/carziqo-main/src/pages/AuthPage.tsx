import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Eye, EyeOff, TrendingUp, Shield, Wallet, Gift, Info, Download } from 'lucide-react';

export default function AuthPage({ onShowAbout }: { onShowAbout: () => void }) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    if (mode === 'login') {
      const { error } = await signIn(email, password);
      if (error) setError(error);
    } else {
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        setSubmitting(false);
        return;
      }
      const { error } = await signUp(email, password, fullName, phone, referralCode || undefined);
      if (error) {
        if (error.includes('Database error') || error.includes('User already registered')) {
          setError('This email is already registered. Try signing in instead.');
        } else {
          setError(error);
        }
      }
    }
    setSubmitting(false);
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left side - branding */}
      <div className="lg:w-1/2 gradient-primary relative overflow-hidden flex items-center justify-center p-8 lg:p-16">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-cyan-300 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 max-w-md text-white">
          <div className="flex items-center gap-3 mb-12">
            <img src="/carziqo.webp" alt="Carziqo.Ltd" className="w-12 h-12 rounded-xl object-cover bg-white" />
            <div>
              <h1 className="text-2xl font-bold">Carziqo.Ltd</h1>
              <p className="text-blue-100 text-sm">Car Rental Earning Platform</p>
            </div>
          </div>

          <h2 className="text-4xl font-bold mb-4 leading-tight">
            Invest in premium cars. <span className="text-cyan-200">Earn daily returns.</span>
          </h2>
          <p className="text-blue-100 text-lg mb-12 leading-relaxed">
            Rent luxury vehicles, earn daily profits over 30 or 60 day holding periods.
          </p>

          <div className="space-y-5">
            <FeatureRow icon={<TrendingUp className="w-5 h-5" />} title="Up to 5% daily returns" desc="Competitive rates on premium car rentals" />
            <FeatureRow icon={<Wallet className="w-5 h-5" />} title="Flexible withdrawal" desc="Cash out your earnings anytime" />
            <FeatureRow icon={<Shield className="w-5 h-5" />} title="Secure transactions" desc="Admin-verified payments and payouts" />
          </div>
        </div>
      </div>

      {/* Right side - auth form */}
      <div className="lg:w-1/2 flex items-center justify-center p-8 bg-[#0a0e1a]">
        <div className="w-full max-w-md animate-slide-up">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="text-gray-400">
              {mode === 'login'
                ? 'Sign in to manage your investments'
                : 'Start earning daily returns today'}
            </p>
          </div>

          <div className="flex gap-2 mb-6 p-1 bg-[#131825] rounded-xl">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                mode === 'login' ? 'gradient-primary text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setMode('register')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                mode === 'register' ? 'gradient-primary text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <Field label="Full Name">
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="input-field"
                    placeholder="John Doe"
                  />
                </Field>
                <Field label="Phone Number">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="input-field"
                    placeholder="+1 234 567 890"
                  />
                </Field>
                <Field label="Referral Code (Optional)">
                  <div className="relative">
                    <Gift className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="text"
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                      className="input-field pl-10 uppercase"
                      placeholder="Enter referral code"
                      maxLength={6}
                    />
                  </div>
                </Field>
              </>
            )}
            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input-field"
                placeholder="you@example.com"
              />
            </Field>
            <Field label="Password">
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="input-field pr-12"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </Field>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm animate-fade-in">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full gradient-primary text-white font-semibold py-3.5 rounded-xl transition-all hover:opacity-90 disabled:opacity-50 hover:shadow-lg hover:shadow-blue-500/25"
            >
              {submitting ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-gray-500 text-sm mt-6">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>

          <a
            href="https://www.mediafire.com/file/1vac1njb7wlktl9/Carziqo.apk/file"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full mt-6 flex items-center justify-center gap-2 gradient-accent text-white font-semibold py-3.5 rounded-xl transition-all hover:opacity-90 hover:shadow-lg hover:shadow-emerald-500/25"
          >
            <Download className="w-5 h-5" /> Download Our App
          </a>

          <button
            onClick={onShowAbout}
            className="w-full mt-4 flex items-center justify-center gap-2 text-gray-400 text-sm hover:text-blue-400 transition-colors"
          >
            <Info className="w-4 h-4" /> About Carziqo.Ltd
          </button>
        </div>
      </div>

      <style>{`
        .input-field {
          width: 100%;
          background: #131825;
          border: 1px solid #232a3f;
          border-radius: 0.75rem;
          padding: 0.875rem 1rem;
          color: white;
          font-size: 0.95rem;
          outline: none;
          transition: border-color 0.2s;
        }
        .input-field:focus {
          border-color: #0066ff;
        }
        .input-field::placeholder {
          color: #4b5563;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-2">{label}</label>
      {children}
    </div>
  );
}

function FeatureRow({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-10 h-10 bg-white/15 rounded-lg flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold text-white">{title}</h3>
        <p className="text-blue-100 text-sm">{desc}</p>
      </div>
    </div>
  );
}
