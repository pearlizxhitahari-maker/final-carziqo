import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { NewsArticle, formatDateShort } from '@/lib/types';
import {
  TrendingUp, Shield, Wallet, Gift, Leaf, Car, Users, Award,
  ArrowRight, Clock, Tag, Megaphone, Wrench, Sparkles, ChevronLeft,
  Download, Smartphone, Apple,
} from 'lucide-react';

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  update: { label: 'Update', icon: <Sparkles className="w-4 h-4" />, color: 'bg-blue-500/15 text-blue-400' },
  promotion: { label: 'Promotion', icon: <Tag className="w-4 h-4" />, color: 'bg-amber-500/15 text-amber-400' },
  announcement: { label: 'Announcement', icon: <Megaphone className="w-4 h-4" />, color: 'bg-emerald-500/15 text-emerald-400' },
  maintenance: { label: 'Maintenance', icon: <Wrench className="w-4 h-4" />, color: 'bg-red-500/15 text-red-400' },
};

export default function AboutPage({ onBack }: { onBack: () => void }) {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('news')
      .select('*')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        setNews((data as unknown as NewsArticle[]) || []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0e1a]">
      {/* Header */}
      <header className="glass sticky top-0 z-40 border-b border-[#232a3f]">
        <div className="max-w-3xl mx-auto px-5 py-3 flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-lg bg-[#131825] flex items-center justify-center text-gray-400 hover:text-white transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <img src="/carziqo.webp" alt="Carziqo.Ltd" className="w-9 h-9 rounded-lg object-cover bg-white" />
          <div>
            <h1 className="font-bold text-white text-sm">About Carziqo.Ltd</h1>
            <p className="text-[10px] text-gray-400">News & Information</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-6 pb-32">
        {/* Hero section */}
        <div className="relative overflow-hidden rounded-2xl gradient-primary p-8 mb-6">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-48 h-48 bg-white rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-300 rounded-full blur-3xl" />
          </div>
          <div className="relative z-10">
            <h2 className="text-3xl font-bold text-white mb-3 leading-tight">
              Carziqo.Ltd
            </h2>
            <p className="text-blue-100 text-base leading-relaxed mb-4">
              A premier car rental earning platform where users invest in luxury vehicles
              and earn daily returns over 30 or 60 day holding periods.
              Built on transparency, security, and consistent payouts.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1.5 rounded-lg bg-white/15 text-white text-xs font-medium backdrop-blur-sm">
                Licensed Platform
              </span>
              <span className="px-3 py-1.5 rounded-lg bg-white/15 text-white text-xs font-medium backdrop-blur-sm">
                Daily Payouts
              </span>
              <span className="px-3 py-1.5 rounded-lg bg-white/15 text-white text-xs font-medium backdrop-blur-sm">
                Secure Transactions
              </span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <StatCard icon={<Users className="w-5 h-5" />} value="4,200+" label="Active Users" />
          <StatCard icon={<Car className="w-5 h-5" />} value="25+" label="Premium Cars" />
          <StatCard icon={<Award className="w-5 h-5" />} value="5%" label="Max Daily Return" />
        </div>

        {/* Features */}
        <h3 className="text-white font-bold text-lg mb-4">Why Choose Carziqo</h3>
        <div className="grid sm:grid-cols-2 gap-3 mb-8">
          <FeatureCard
            icon={<TrendingUp className="w-5 h-5" />}
            title="High Daily Returns"
            desc="Earn up to 5% daily returns on your car investments with transparent payout calculations."
            color="from-blue-500/10 to-cyan-500/10 border-blue-500/20"
          />
          <FeatureCard
            icon={<Shield className="w-5 h-5" />}
            title="Secure & Verified"
            desc="Admin-verified payments and withdrawals ensure your funds are always protected."
            color="from-emerald-500/10 to-green-500/10 border-emerald-500/20"
          />
          <FeatureCard
            icon={<Wallet className="w-5 h-5" />}
            title="Flexible Withdrawals"
            desc="Cash out your earnings to GCash, PayMaya, bank transfer, or crypto wallets."
            color="from-amber-500/10 to-orange-500/10 border-amber-500/20"
          />
          <FeatureCard
            icon={<Leaf className="w-5 h-5" />}
            title="Carbon Rewards"
            desc="Earn carbon points through daily check-ins and games, redeemable for gifts and coupons."
            color="from-violet-500/10 to-purple-500/10 border-violet-500/20"
          />
        </div>

        {/* How it works */}
        <div className="bg-[#131825] rounded-2xl border border-[#232a3f] p-6 mb-8">
          <h3 className="text-white font-bold text-lg mb-5">How It Works</h3>
          <div className="space-y-5">
            <StepCard
              num="1"
              title="Create Your Account"
              desc="Sign up for free and instantly receive a starter car with daily earnings."
            />
            <StepCard
              num="2"
              title="Browse the Car Store"
              desc="Choose from premium vehicles with different price points and return rates."
            />
            <StepCard
              num="3"
              title="Invest & Earn Daily"
              desc="Your earnings are automatically credited to your wallet balance every day."
            />
            <StepCard
              num="4"
              title="Withdraw Your Profits"
              desc="Request a withdrawal to your preferred wallet and receive funds after admin approval."
            />
          </div>
        </div>

        {/* Download App */}
        <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-2xl p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Download className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">Get the Mobile App</h3>
              <p className="text-gray-400 text-xs">Invest on the go — available now</p>
            </div>
          </div>
          <p className="text-gray-400 text-sm mb-5 leading-relaxed">
            Download the Carziqo.Ltd app for the best experience with push notifications,
            faster loading, and exclusive mobile-only promotions.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href="https://www.mediafire.com/file/1vac1njb7wlktl9/Carziqo.apk/file"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-3 bg-[#0a0e1a] hover:bg-[#131825] border border-[#232a3f] hover:border-blue-500/50 rounded-xl py-3.5 px-4 transition-all group"
            >
              <Smartphone className="w-6 h-6 text-gray-300 group-hover:text-blue-400 transition-colors" />
              <div className="text-left">
                <p className="text-gray-500 text-[10px]">Get it on</p>
                <p className="text-white text-sm font-semibold">Google Play</p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-blue-400 ml-auto transition-colors" />
            </a>
            <a
              href="https://www.mediafire.com/file/1vac1njb7wlktl9/Carziqo.apk/file"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-3 bg-[#0a0e1a] hover:bg-[#131825] border border-[#232a3f] hover:border-blue-500/50 rounded-xl py-3.5 px-4 transition-all group"
            >
              <Apple className="w-6 h-6 text-gray-300 group-hover:text-blue-400 transition-colors" />
              <div className="text-left">
                <p className="text-gray-500 text-[10px]">Download Chrome</p>
                <p className="text-white text-sm font-semibold">App Store</p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-blue-400 ml-auto transition-colors" />
            </a>
          </div>
        </div>

        {/* News section */}
        <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-blue-400" /> Latest News
        </h3>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-[#131825] rounded-xl border border-[#232a3f] p-5 animate-pulse">
                <div className="h-4 bg-[#232a3f] rounded w-20 mb-3" />
                <div className="h-5 bg-[#232a3f] rounded w-3/4 mb-2" />
                <div className="h-3 bg-[#232a3f] rounded w-full mb-1" />
                <div className="h-3 bg-[#232a3f] rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : news.length === 0 ? (
          <div className="bg-[#131825] rounded-xl border border-[#232a3f] p-8 text-center">
            <Megaphone className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">No news yet. Check back soon for updates.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {news.map((article) => {
              const cat = CATEGORY_CONFIG[article.category] || CATEGORY_CONFIG.announcement;
              return (
                <article
                  key={article.id}
                  className="bg-[#131825] rounded-xl border border-[#232a3f] p-5 hover:border-[#3a4258] transition-all"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cat.color}`}>
                      {cat.icon} {cat.label}
                    </span>
                    <span className="text-gray-500 text-xs flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {formatDateShort(article.published_at)}
                    </span>
                  </div>
                  <h4 className="text-white font-semibold text-base mb-2">{article.title}</h4>
                  <p className="text-gray-400 text-sm leading-relaxed">{article.content}</p>
                </article>
              );
            })}
          </div>
        )}

        {/* Contact / Support */}
        <div className="mt-8 bg-[#131825] rounded-2xl border border-[#232a3f] p-6 text-center">
          <h3 className="text-white font-bold text-sm mb-2">Need Help?</h3>
          <p className="text-gray-400 text-xs mb-4">
            Our support team is available 24/7 through live chat. Tap the chat icon in the bottom right corner to start a conversation.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/10 text-blue-400 text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5" /> Powered by Carziqo Live Chat
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="bg-[#131825] rounded-xl border border-[#232a3f] p-4 text-center">
      <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 mx-auto mb-2">
        {icon}
      </div>
      <p className="text-white font-bold text-lg">{value}</p>
      <p className="text-gray-500 text-[10px]">{label}</p>
    </div>
  );
}

function FeatureCard({ icon, title, desc, color }: { icon: React.ReactNode; title: string; desc: string; color: string }) {
  return (
    <div className={`bg-gradient-to-br ${color} rounded-xl border p-5`}>
      <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-white mb-3">
        {icon}
      </div>
      <h4 className="text-white font-semibold text-sm mb-1.5">{title}</h4>
      <p className="text-gray-400 text-xs leading-relaxed">{desc}</p>
    </div>
  );
}

function StepCard({ num, title, desc }: { num: string; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
        {num}
      </div>
      <div className="flex-1">
        <h4 className="text-white font-medium text-sm mb-1">{title}</h4>
        <p className="text-gray-400 text-xs leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}
