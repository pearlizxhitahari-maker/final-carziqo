export type UserRole = 'user' | 'admin';

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  wallet_balance: number;
  carbon_points: number;
  role: UserRole;
  referral_code: string | null;
  referred_by: string | null;
  free_investment_id: string | null;
  vip_level: number;
  theme_color: 'blue' | 'emerald' | 'amber' | 'rose' | 'violet' | 'cyan';
  language: 'en' | 'fil';
  notif_sound: boolean;
  avatar_frame: 'none' | 'gold' | 'neon' | 'cosmic' | null;
  currency: CurrencyCode;
  created_at: string;
}

export type CurrencyCode = 'PHP' | 'USD' | 'EUR';

export interface CurrencyInfo {
  code: CurrencyCode;
  symbol: string;
  label: string;
  rateFromPHP: number;
  locale: string;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyInfo> = {
  PHP: { code: 'PHP', symbol: '₱', label: 'Philippine Peso', rateFromPHP: 1, locale: 'en-PH' },
  USD: { code: 'USD', symbol: '$', label: 'US Dollar', rateFromPHP: 1 / 56.5, locale: 'en-US' },
  EUR: { code: 'EUR', symbol: '€', label: 'Euro', rateFromPHP: 1 / 61.2, locale: 'en-IE' },
};

let activeCurrency: CurrencyCode = 'PHP';

export function setActiveCurrency(code: CurrencyCode) {
  activeCurrency = code;
}

export function getActiveCurrency(): CurrencyCode {
  return activeCurrency;
}

export const THEME_COLORS: Record<Profile['theme_color'], { name: string; from: string; to: string; ring: string; text: string }> = {
  blue: { name: 'Ocean Blue', from: 'from-blue-500', to: 'to-cyan-400', ring: 'ring-blue-400', text: 'text-blue-400' },
  emerald: { name: 'Emerald', from: 'from-emerald-500', to: 'to-teal-400', ring: 'ring-emerald-400', text: 'text-emerald-400' },
  amber: { name: 'Sunset Gold', from: 'from-amber-500', to: 'to-orange-400', ring: 'ring-amber-400', text: 'text-amber-400' },
  rose: { name: 'Rose', from: 'from-rose-500', to: 'to-pink-400', ring: 'ring-rose-400', text: 'text-rose-400' },
  violet: { name: 'Violet', from: 'from-violet-500', to: 'to-purple-400', ring: 'ring-violet-400', text: 'text-violet-400' },
  cyan: { name: 'Cyan', from: 'from-cyan-500', to: 'to-sky-400', ring: 'ring-cyan-400', text: 'text-cyan-400' },
};

export const AVATAR_FRAMES: Record<NonNullable<Profile['avatar_frame']>, { name: string; classes: string }> = {
  none: { name: 'No Frame', classes: 'border-[#232a3f]' },
  gold: { name: 'Gold', classes: 'border-amber-400 shadow-[0_0_12px_2px_rgba(251,191,36,0.4)]' },
  neon: { name: 'Neon', classes: 'border-cyan-400 shadow-[0_0_12px_2px_rgba(34,211,238,0.4)]' },
  cosmic: { name: 'Cosmic', classes: 'border-violet-400 shadow-[0_0_14px_2px_rgba(167,139,250,0.5)]' },
};

export interface Car {
  id: string;
  car_name: string;
  image_url: string;
  price: number;
  daily_return_rate: number;
  status: 'active' | 'inactive';
  is_free: boolean;
  created_at: string;
}

export interface PaymentMethod {
  id: string;
  method_name: string;
  qr_image_url: string;
  instructions: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Investment {
  id: string;
  user_id: string;
  car_id: string;
  car_name: string;
  car_image_url: string;
  investment_amount: number;
  duration_days: number;
  daily_payout: number;
  days_completed: number;
  total_earned: number;
  status: 'active' | 'completed' | 'cancelled' | 'paused';
  pause_reason: string | null;
  start_date: string;
  last_payout_date: string | null;
  created_at: string;
}

export interface RechargeLog {
  id: string;
  user_id: string;
  amount: number;
  payment_method: string;
  proof_image_url: string | null;
  reference_number: string | null;
  status: 'pending' | 'approved' | 'rejected';
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface WithdrawalLog {
  id: string;
  user_id: string;
  amount: number;
  fee_amount: number;
  net_amount: number;
  account_name: string;
  account_number: string;
  bank_name: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export type WithdrawalMethod = 'gcash' | 'paymaya' | 'bank' | 'crypto';

export interface WithdrawalWallet {
  id: string;
  user_id: string;
  label: string;
  method: WithdrawalMethod;
  account_name: string;
  account_number: string;
  bank_name: string | null;
  is_default: boolean;
  created_at: string;
}

export const WITHDRAWAL_METHOD_LABELS: Record<WithdrawalMethod, string> = {
  gcash: 'GCash',
  paymaya: 'PayMaya',
  bank: 'Bank Transfer',
  crypto: 'Crypto Wallet',
};

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  details: string | null;
  created_at: string;
}

export interface AdminNotification {
  id: string;
  event_type: 'signup' | 'recharge' | 'withdrawal';
  title: string;
  message: string;
  entity_id: string | null;
  user_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface DailyCheckin {
  id: string;
  user_id: string;
  reward_amount: number;
  carbon_earned: number;
  checkin_date: string;
  created_at: string;
}

export interface GameSession {
  id: string;
  user_id: string;
  game_type: string;
  points_earned: number;
  bubbles_popped: number;
  duration_seconds: number;
  created_at: string;
}

export interface Coupon {
  id: string;
  code: string;
  title: string;
  description: string | null;
  discount_value: number;
  carbon_cost: number;
  is_active: boolean;
  max_claims: number;
  claims_count: number;
  expires_at: string | null;
  created_at: string;
}

export interface UserCoupon {
  id: string;
  user_id: string;
  coupon_id: string;
  code: string;
  title: string;
  discount_value: number;
  status: 'active' | 'used' | 'expired';
  claimed_at: string;
  used_at: string | null;
}

export interface GiftItem {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  carbon_cost: number;
  cash_value: number;
  is_active: boolean;
  stock: number;
  created_at: string;
}

export interface UserGift {
  id: string;
  user_id: string;
  gift_id: string;
  name: string;
  carbon_cost: number;
  cash_value: number;
  status: 'redeemed' | 'processed' | 'cancelled';
  redeemed_at: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  category: 'update' | 'promotion' | 'announcement' | 'maintenance';
  is_published: boolean;
  published_at: string;
  created_at: string;
}

export const VIP_LEVELS: Record<number, { name: string; color: string; description: string }> = {
  1: { name: 'Starter', color: 'text-slate-300', description: 'Reach this tier with 3 referrals' },
  2: { name: 'Silver', color: 'text-sky-300', description: 'Building momentum' },
  3: { name: 'Gold', color: 'text-amber-300', description: 'A trusted community builder' },
  4: { name: 'Platinum', color: 'text-cyan-300', description: 'Premium member benefits' },
  5: { name: 'Diamond', color: 'text-blue-200', description: 'Top-tier investor' },
  6: { name: 'Emerald', color: 'text-emerald-300', description: 'Growing a strong network' },
  7: { name: 'Sapphire', color: 'text-blue-300', description: 'Elite community leader' },
  8: { name: 'Ruby', color: 'text-red-300', description: 'High-impact referrer' },
  9: { name: 'Onyx', color: 'text-gray-200', description: 'Exceptional platform leader' },
  10: { name: 'Elite', color: 'text-amber-200', description: 'Maximum VIP referral tier' },
};

export const DURATION_OPTIONS = [30, 60] as const;
export type DurationDays = (typeof DURATION_OPTIONS)[number];
export const DURATION_DAILY_RATES: Record<number, number> = { 30: 0.02, 60: 0.03 };
export const FREE_CAR_DURATION_DAYS = 15;

export function formatCurrency(amountPHP: number): string {
  const currency = CURRENCIES[activeCurrency] ?? CURRENCIES.PHP;
  const converted = amountPHP * currency.rateFromPHP;
  const formattedAmount = new Intl.NumberFormat(currency.locale, {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(converted);
  return `${currency.symbol}${formattedAmount}`;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
