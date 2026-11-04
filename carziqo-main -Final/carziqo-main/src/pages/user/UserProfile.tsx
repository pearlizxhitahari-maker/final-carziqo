import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  RechargeLog,
  WithdrawalLog,
  WithdrawalWallet,
  WithdrawalMethod,
  WITHDRAWAL_METHOD_LABELS,
  formatCurrency,
  formatDate,
  VIP_LEVELS,
  THEME_COLORS,
  AVATAR_FRAMES,
  Profile,
  CURRENCIES,
  CurrencyCode,
  setActiveCurrency,
} from '@/lib/types';
import { StatusBadge } from '@/pages/user/UserDashboard';
import {
  User, Mail, Phone, Camera, Key, ArrowDownCircle, ArrowUpCircle,
  Check, X, Gift, Copy, Wallet, Plus, Trash2, Star, Smartphone,
  Building2, Bitcoin, AlertCircle, Loader2, Crown, Sparkles,
  Palette, Bell, Globe, Frame, Volume2, VolumeX, Coins,
} from 'lucide-react';

const METHOD_ICONS: Record<WithdrawalMethod, React.ReactNode> = {
  gcash: <Smartphone className="w-4 h-4" />,
  paymaya: <Smartphone className="w-4 h-4" />,
  bank: <Building2 className="w-4 h-4" />,
  crypto: <Bitcoin className="w-4 h-4" />,
};

const METHOD_COLORS: Record<WithdrawalMethod, string> = {
  gcash: 'bg-blue-500/15 text-blue-400',
  paymaya: 'bg-emerald-500/15 text-emerald-400',
  bank: 'bg-amber-500/15 text-amber-400',
  crypto: 'bg-violet-500/15 text-violet-400',
};

export default function UserProfile() {
  const { profile, session, refreshProfile, signOut } = useAuth();
  const [tab, setTab] = useState<'profile' | 'preferences' | 'wallets' | 'security' | 'referral' | 'history'>('profile');
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState(false);
  const [recharges, setRecharges] = useState<RechargeLog[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalLog[]>([]);
  const [wallets, setWallets] = useState<WithdrawalWallet[]>([]);
  const [showAddWallet, setShowAddWallet] = useState(false);
  const [copied, setCopied] = useState(false);
  const [themeColor, setThemeColor] = useState<Profile['theme_color']>(profile?.theme_color || 'blue');
  const [language, setLanguage] = useState<Profile['language']>(profile?.language || 'en');
  const [notifSound, setNotifSound] = useState<boolean>(profile?.notif_sound ?? true);
  const [avatarFrame, setAvatarFrame] = useState<NonNullable<Profile['avatar_frame']>>(profile?.avatar_frame || 'none');
  const [currency, setCurrency] = useState<CurrencyCode>(profile?.currency || 'PHP');
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsSaved, setPrefsSaved] = useState(false);

  useEffect(() => {
    setThemeColor(profile?.theme_color || 'blue');
    setLanguage(profile?.language || 'en');
    setNotifSound(profile?.notif_sound ?? true);
    setAvatarFrame(profile?.avatar_frame || 'none');
    setCurrency(profile?.currency || 'PHP');
  }, [profile?.theme_color, profile?.language, profile?.notif_sound, profile?.avatar_frame, profile?.currency]);

  const presetAvatars = [
    { label: 'Sky Hero', url: '/assets/avatars/download_(2) copy.jpg#sky', frame: 'from-cyan-400 to-blue-500', filter: '' },
    { label: 'Ocean Glow', url: '/assets/avatars/download_(2) copy.jpg#ocean', frame: 'from-blue-400 to-cyan-300', filter: 'hue-rotate-6 saturate-125' },
    { label: 'Golden Star', url: '/assets/avatars/download_(2) copy.jpg#gold', frame: 'from-amber-300 to-orange-500', filter: 'sepia-[.12] saturate-125' },
    { label: 'Forest Quest', url: '/assets/avatars/download_(2) copy.jpg#forest', frame: 'from-emerald-300 to-teal-500', filter: 'hue-rotate-[-18deg] saturate-110' },
    { label: 'Ember', url: '/assets/avatars/download_(2).jpg#ember', frame: 'from-rose-400 to-orange-500', filter: 'hue-rotate-[-6deg] saturate-140 brightness-105' },
    { label: 'Twilight', url: '/assets/avatars/download_(2).jpg#twilight', frame: 'from-violet-400 to-indigo-500', filter: 'hue-rotate-40 saturate-130' },
    { label: 'Mint', url: '/assets/avatars/download_(2).jpg#mint', frame: 'from-teal-300 to-emerald-400', filter: 'hue-rotate-[-30deg] saturate-120 brightness-105' },
    { label: 'Frost', url: '/assets/avatars/download_(2).jpg#frost', frame: 'from-sky-300 to-blue-400', filter: 'saturate-90 brightness-110' },
  ];

  const vip = VIP_LEVELS[profile?.vip_level || 1] || VIP_LEVELS[1];

  useEffect(() => {
    setAvatarUrl(profile?.avatar_url || '');
  }, [profile?.avatar_url]);

  useEffect(() => {
    if (session) {
      supabase.from('recharge_logs').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }).then(({ data }) => {
        setRecharges((data as unknown as RechargeLog[]) || []);
      });
      supabase.from('withdrawal_logs').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }).then(({ data }) => {
        setWithdrawals((data as unknown as WithdrawalLog[]) || []);
      });
      loadWallets();
    }
  }, [session]);

  async function loadWallets() {
    if (!session) return;
    const { data } = await supabase
      .from('withdrawal_wallets')
      .select('*')
      .eq('user_id', session.user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true });
    setWallets((data as unknown as WithdrawalWallet[]) || []);
  }

  async function handleSaveProfile() {
    if (!session) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName, phone, avatar_url: avatarUrl, avatar_frame: avatarFrame })
      .eq('id', session.user.id);
    if (error) {
      console.error(error);
    } else {
      await refreshProfile();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !session) return;
    setAvatarError(null);

    if (!file.type.startsWith('image/')) {
      setAvatarError('Please choose an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('Avatar images must be smaller than 5 MB.');
      return;
    }

    setAvatarUploading(true);

    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${session.user.id}/avatar-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage.from('user-avatars').upload(fileName, file, {
      contentType: file.type,
      cacheControl: '3600',
    });
    if (uploadError) {
      console.error(uploadError);
      setAvatarError('Could not upload the avatar. Please try again.');
      setAvatarUploading(false);
      return;
    }

    const { data } = supabase.storage.from('user-avatars').getPublicUrl(fileName);
    const nextAvatarUrl = `${data.publicUrl}?v=${Date.now()}`;
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ avatar_url: nextAvatarUrl })
      .eq('id', session.user.id);

    if (profileError) {
      console.error(profileError);
      setAvatarError('The image uploaded, but could not be saved to your profile.');
      setAvatarUploading(false);
      return;
    }

    setAvatarUrl(nextAvatarUrl);
    await refreshProfile();
    setAvatarUploading(false);
  }

  async function handleChangePassword() {
    setPwdError(null);
    setPwdSuccess(false);
    if (newPassword.length < 6) {
      setPwdError('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError('Passwords do not match');
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPwdError(error.message);
      return;
    }
    setPwdSuccess(true);
    setNewPassword('');
    setConfirmPassword('');
    setTimeout(() => setPwdSuccess(false), 3000);
  }

  async function setDefaultWallet(walletId: string) {
    if (!session) return;
    await supabase
      .from('withdrawal_wallets')
      .update({ is_default: false })
      .eq('user_id', session.user.id);
    await supabase
      .from('withdrawal_wallets')
      .update({ is_default: true })
      .eq('id', walletId)
      .eq('user_id', session.user.id);
    loadWallets();
  }

  async function deleteWallet(walletId: string) {
    if (!session) return;
    const { error } = await supabase
      .from('withdrawal_wallets')
      .delete()
      .eq('id', walletId)
      .eq('user_id', session.user.id);
    if (!error) loadWallets();
  }

  function copyReferralCode() {
    if (profile?.referral_code) {
      navigator.clipboard.writeText(profile.referral_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="animate-fade-in">
      {/* Animated avatar header */}
      <div className="flex flex-col items-center mb-6">
        <div className="relative mb-3 group">
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500 rounded-full opacity-75 blur-md animate-spin-slow" />
          <div className={`relative w-24 h-24 rounded-full bg-[#0a0e1a] overflow-hidden border-4 avatar-float ${AVATAR_FRAMES[avatarFrame].classes}`}>
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Avatar"
                className="w-full h-full rounded-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-full h-full rounded-full gradient-primary flex items-center justify-center">
                <User className="w-10 h-10 text-white" />
              </div>
            )}
            {avatarUploading && (
              <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              </div>
            )}
          </div>
          <label className="absolute bottom-0 right-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-blue-600 transition-colors border-2 border-[#131825] z-10">
            <Camera className="w-4 h-4 text-white" />
            <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
          </label>
        </div>
        <h2 className="text-white font-bold text-lg">{profile?.full_name || 'User'}</h2>
        <p className="text-gray-500 text-sm">{session?.user.email}</p>
        <div className="mt-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-medium">
          Member since {profile ? formatDate(profile.created_at).split(',')[0] : ''}
        </div>
        <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500/15 to-blue-500/15 border border-amber-400/20">
          <Crown className={`w-4 h-4 ${vip.color}`} />
          <span className={`text-sm font-bold ${vip.color}`}>VIP {profile?.vip_level || 1} · {vip.name}</span>
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
        </div>
        <p className="text-gray-500 text-[11px] mt-1">{vip.description}</p>
        <div className="mt-5 w-full">
          <p className="text-gray-300 text-sm font-semibold text-center mb-1">Choose a ready-made avatar</p>
          <p className="text-gray-500 text-[11px] text-center mb-3">Illustrated character styles with animated frames</p>
          <div className="grid grid-cols-4 gap-2">
            {presetAvatars.map((avatar) => {
              const selected = avatarUrl === avatar.url;
              return (
                <button
                  key={avatar.label}
                  type="button"
                  onClick={() => {
                    setAvatarUrl(avatar.url);
                    setAvatarError(null);
                  }}
                  className={`group rounded-2xl p-1 bg-gradient-to-br ${avatar.frame} transition-all hover:-translate-y-1 hover:scale-105 ${selected ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0a0e1a] scale-105' : 'opacity-85 hover:opacity-100'}`}
                  title={avatar.label}
                >
                  <span className="block rounded-[13px] bg-[#131825] p-1">
                    <img src={avatar.url} alt={`${avatar.label} illustrated avatar`} className={`w-full aspect-square rounded-[10px] object-cover avatar-pulse ${avatar.filter}`} />
                  </span>
                  <span className="block text-[9px] text-white font-medium truncate px-1 py-1">{avatar.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-4 w-full">
          <p className="text-gray-300 text-xs font-semibold text-center mb-2 flex items-center justify-center gap-1.5"><Frame className="w-3.5 h-3.5 text-blue-400" /> Avatar Frame</p>
          <div className="grid grid-cols-4 gap-2">
            {(Object.keys(AVATAR_FRAMES) as Array<NonNullable<Profile['avatar_frame']>>).map((frameKey) => {
              const frame = AVATAR_FRAMES[frameKey];
              const selected = avatarFrame === frameKey;
              return (
                <button
                  key={frameKey}
                  type="button"
                  onClick={() => setAvatarFrame(frameKey)}
                  className={`rounded-xl p-1 transition-all ${selected ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0a0e1a] scale-105' : 'opacity-70 hover:opacity-100'}`}
                  title={frame.name}
                >
                  <span className={`block w-full aspect-square rounded-full bg-gradient-to-br from-slate-600 to-slate-800 border-4 ${frame.classes}`} />
                  <span className="block text-[9px] text-gray-400 font-medium truncate px-1 py-1">{frame.name}</span>
                </button>
              );
            })}
          </div>
        </div>
        {avatarError && (
          <div className="flex items-center gap-1.5 text-red-400 text-xs mt-3">
            <AlertCircle className="w-3.5 h-3.5" /> {avatarError}
          </div>
        )}
      </div>

      {/* Tab selector */}
      <div className="flex gap-1 mb-5 p-1 bg-[#131825] rounded-xl overflow-x-auto no-scrollbar">
        {(['profile', 'preferences', 'wallets', 'security', 'referral', 'history'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all capitalize whitespace-nowrap ${
              tab === t ? 'gradient-primary text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Profile tab */}
      {tab === 'profile' && (
        <div className="space-y-4 animate-fade-in">
          <FormField label="Full Name" icon={<User className="w-4 h-4" />}>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="form-input"
            />
          </FormField>
          <FormField label="Email" icon={<Mail className="w-4 h-4" />}>
            <input
              type="email"
              value={session?.user.email || ''}
              disabled
              className="form-input opacity-50 cursor-not-allowed"
            />
          </FormField>
          <FormField label="Phone" icon={<Phone className="w-4 h-4" />}>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="form-input"
              placeholder="+1 234 567 890"
            />
          </FormField>
          <button
            onClick={handleSaveProfile}
            disabled={saving}
            className="w-full gradient-primary text-white font-semibold py-3.5 rounded-xl transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saved ? <><Check className="w-5 h-5" /> Saved!</> : saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}

      {/* Preferences tab */}
      {tab === 'preferences' && (
        <div className="space-y-5 animate-fade-in">
          <div className="bg-[#131825] rounded-xl border border-[#232a3f] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Palette className="w-4 h-4 text-blue-400" />
              <h3 className="text-white font-semibold text-sm">Theme Accent</h3>
            </div>
            <p className="text-gray-500 text-xs mb-3">Choose the accent color used across your app highlights.</p>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(THEME_COLORS) as Array<Profile['theme_color']>).map((colorKey) => {
                const color = THEME_COLORS[colorKey];
                const selected = themeColor === colorKey;
                return (
                  <button
                    key={colorKey}
                    type="button"
                    onClick={() => setThemeColor(colorKey)}
                    className={`rounded-xl p-3 bg-gradient-to-br ${color.from} ${color.to} transition-all ${selected ? `ring-2 ${color.ring} ring-offset-2 ring-offset-[#131825] scale-105` : 'opacity-70 hover:opacity-100'}`}
                  >
                    <span className="block text-white text-xs font-semibold">{color.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-[#131825] rounded-xl border border-[#232a3f] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Globe className="w-4 h-4 text-emerald-400" />
              <h3 className="text-white font-semibold text-sm">Language</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {([['en', 'English'], ['fil', 'Filipino']] as const).map(([code, label]) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLanguage(code)}
                  className={`rounded-xl py-3 text-sm font-medium transition-all ${language === code ? 'gradient-primary text-white' : 'bg-[#0a0e1a] text-gray-400 border border-[#232a3f] hover:text-white'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[#131825] rounded-xl border border-[#232a3f] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Coins className="w-4 h-4 text-amber-400" />
              <h3 className="text-white font-semibold text-sm">Display Currency</h3>
            </div>
            <p className="text-gray-500 text-xs mb-3">Amounts across the app will show in your chosen currency.</p>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(CURRENCIES) as CurrencyCode[]).map((code) => {
                const info = CURRENCIES[code];
                const selected = currency === code;
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => {
                      setCurrency(code);
                      setActiveCurrency(code);
                    }}
                    className={`rounded-xl py-3 text-center transition-all ${selected ? 'gradient-primary text-white' : 'bg-[#0a0e1a] text-gray-400 border border-[#232a3f] hover:text-white'}`}
                  >
                    <span className="block text-lg font-bold">{info.symbol}</span>
                    <span className="block text-[10px] font-medium mt-0.5">{code}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-[#131825] rounded-xl border border-[#232a3f] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-400" />
                <div>
                  <h3 className="text-white font-semibold text-sm">Notification Sound</h3>
                  <p className="text-gray-500 text-xs mt-0.5">Play a sound when in-app alerts appear</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNotifSound((prev) => !prev)}
                className={`relative w-12 h-6 rounded-full transition-colors ${notifSound ? 'bg-emerald-500' : 'bg-[#232a3f]'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${notifSound ? 'left-6' : 'left-0.5'}`} />
              </button>
            </div>
            <div className="flex items-center gap-1.5 mt-3 text-xs text-gray-500">
              {notifSound ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5 text-gray-500" />}
              {notifSound ? 'Sound enabled' : 'Sound muted'}
            </div>
          </div>

          <button
            onClick={async () => {
              if (!session) return;
              setPrefsSaving(true);
              const { error } = await supabase
                .from('profiles')
                .update({ theme_color: themeColor, language, notif_sound: notifSound, currency })
                .eq('id', session.user.id);
              if (!error) {
                await refreshProfile();
                setPrefsSaved(true);
                setTimeout(() => setPrefsSaved(false), 2000);
              }
              setPrefsSaving(false);
            }}
            disabled={prefsSaving}
            className="w-full gradient-primary text-white font-semibold py-3.5 rounded-xl transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {prefsSaved ? <><Check className="w-5 h-5" /> Saved!</> : prefsSaving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      )}

      {/* Wallets tab */}
      {tab === 'wallets' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-bold text-sm">Withdrawal Wallets</h3>
              <p className="text-gray-500 text-xs mt-0.5">Save your GCash, PayMaya, bank, or crypto addresses</p>
            </div>
            <button
              onClick={() => setShowAddWallet(true)}
              className="bg-blue-500 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>

          {wallets.length === 0 ? (
            <button
              onClick={() => setShowAddWallet(true)}
              className="w-full bg-[#0a0e1a] border border-dashed border-[#232a3f] rounded-xl py-8 text-center hover:border-blue-500 transition-colors"
            >
              <Wallet className="w-8 h-8 text-gray-500 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">No wallets saved yet</p>
              <p className="text-gray-600 text-xs mt-1">Tap to add your first withdrawal wallet</p>
            </button>
          ) : (
            <div className="space-y-2">
              {wallets.map((w) => (
                <div
                  key={w.id}
                  className="bg-[#131825] rounded-xl border border-[#232a3f] p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${METHOD_COLORS[w.method]}`}>
                      {METHOD_ICONS[w.method]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-white font-medium text-sm truncate">{w.label}</p>
                        {w.is_default && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-[10px] font-medium">
                            <Star className="w-2.5 h-2.5 fill-amber-400" /> Default
                          </span>
                        )}
                      </div>
                      <p className="text-gray-500 text-xs mt-0.5">
                        {WITHDRAWAL_METHOD_LABELS[w.method]}
                        {w.bank_name ? ` · ${w.bank_name}` : ''}
                      </p>
                      <p className="text-gray-400 text-xs mt-1 truncate">{w.account_name}</p>
                      <p className="text-gray-400 text-xs truncate font-mono">{w.account_number}</p>
                    </div>
                    <div className="flex flex-col gap-1">
                      {!w.is_default && (
                        <button
                          onClick={() => setDefaultWallet(w.id)}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                          title="Set as default"
                        >
                          <Star className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteWallet(w.id)}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Security tab */}
      {tab === 'security' && (
        <div className="space-y-4 animate-fade-in">
          <FormField label="New Password" icon={<Key className="w-4 h-4" />}>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="form-input"
              placeholder="••••••••"
            />
          </FormField>
          <FormField label="Confirm Password" icon={<Key className="w-4 h-4" />}>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="form-input"
              placeholder="••••••••"
            />
          </FormField>
          {pwdError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm flex items-center gap-2">
              <X className="w-4 h-4" /> {pwdError}
            </div>
          )}
          {pwdSuccess && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-3 text-emerald-400 text-sm flex items-center gap-2">
              <Check className="w-4 h-4" /> Password updated successfully!
            </div>
          )}
          <button
            onClick={handleChangePassword}
            className="w-full gradient-primary text-white font-semibold py-3.5 rounded-xl transition-all hover:opacity-90"
          >
            Update Password
          </button>
        </div>
      )}

      {/* Referral tab */}
      {tab === 'referral' && (
        <div className="space-y-5 animate-fade-in">
          <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Gift className="w-5 h-5 text-blue-400" />
              <h3 className="text-white font-bold">Your Referral Code</h3>
            </div>
            <p className="text-gray-400 text-sm mb-3">
              Share this code with friends. Every registered referral helps you unlock higher VIP levels.
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-[#0a0e1a] rounded-xl px-4 py-3 border border-[#232a3f]">
                <p className="text-2xl font-bold text-white tracking-widest text-center">{profile?.referral_code || '------'}</p>
              </div>
              <button
                onClick={copyReferralCode}
                className="bg-blue-500 text-white px-4 py-3 rounded-xl font-medium hover:bg-blue-600 transition-colors flex items-center gap-2"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="bg-gradient-to-br from-amber-500/10 to-blue-500/10 rounded-xl p-4 border border-amber-400/20">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-white font-semibold text-sm">VIP Referral Roadmap</p>
                <p className="text-gray-400 text-xs mt-1">3 referrals starts VIP 1 · 12 referrals reaches VIP 10</p>
              </div>
              <Crown className="w-5 h-5 text-amber-300" />
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {[1, 2, 3, 4, 5].map((level) => (
                <div key={level} className={`rounded-lg px-2 py-2 text-center ${profile?.vip_level === level ? 'bg-amber-400/20 border border-amber-300/40' : 'bg-[#0a0e1a]/60'}`}>
                  <p className="text-amber-200 text-xs font-bold">VIP {level}</p>
                  <p className="text-gray-500 text-[10px]">{level + 2} refs</p>
                </div>
              ))}
            </div>
            <p className="text-gray-500 text-[10px] mt-2 text-center">VIP 6–10 continue one level per additional referral.</p>
          </div>

          <div className="bg-[#131825] rounded-xl p-4 border border-[#232a3f]">
            <h4 className="text-white font-semibold text-sm mb-2">How it works</h4>
            <ul className="space-y-2 text-gray-400 text-xs">
              <li className="flex items-start gap-2">
                <span className="text-blue-400 font-bold">1.</span>
                Share your referral code with friends
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 font-bold">2.</span>
                They enter the code when registering
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 font-bold">3.</span>
                They invest in any car on the platform
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 font-bold">4.</span>
                You earn referral rewards as they grow
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* History tab */}
      {tab === 'history' && (
        <div className="space-y-4 animate-fade-in">
          {recharges.length === 0 && withdrawals.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <ArrowDownCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No transaction history yet</p>
            </div>
          ) : (
            <>
              {recharges.map((r) => (
                <HistoryRow key={`r-${r.id}`} type="recharge" amount={Number(r.amount)} status={r.status} date={r.created_at} detail={r.payment_method} />
              ))}
              {withdrawals.map((w) => (
                <HistoryRow key={`w-${w.id}`} type="withdrawal" amount={Number(w.amount)} status={w.status} date={w.created_at} detail={w.bank_name} />
              ))}
            </>
          )}
        </div>
      )}

      <button
        onClick={signOut}
        className="w-full mt-8 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-medium hover:bg-red-500/20 transition-all"
      >
        Sign Out
      </button>

      {showAddWallet && session && (
        <AddWalletModal
          userId={session.user.id}
          onClose={() => setShowAddWallet(false)}
          onSaved={() => {
            setShowAddWallet(false);
            loadWallets();
          }}
        />
      )}

      <style>{`
        .form-input {
          width: 100%;
          background: #0a0e1a;
          border: 1px solid #232a3f;
          border-radius: 0.75rem;
          padding: 0.75rem 1rem;
          color: white;
          font-size: 0.95rem;
          outline: none;
          transition: border-color 0.2s;
        }
        .form-input:focus {
          border-color: #0066ff;
        }
        .form-input::placeholder {
          color: #4b5563;
        }
      `}</style>
    </div>
  );
}

function AddWalletModal({ userId, onClose, onSaved }: { userId: string; onClose: () => void; onSaved: () => void }) {
  const [label, setLabel] = useState('');
  const [method, setMethod] = useState<WithdrawalMethod>('gcash');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const methodOptions: { value: WithdrawalMethod; label: string; icon: React.ReactNode }[] = [
    { value: 'gcash', label: 'GCash', icon: <Smartphone className="w-4 h-4" /> },
    { value: 'paymaya', label: 'PayMaya', icon: <Smartphone className="w-4 h-4" /> },
    { value: 'bank', label: 'Bank', icon: <Building2 className="w-4 h-4" /> },
    { value: 'crypto', label: 'Crypto', icon: <Bitcoin className="w-4 h-4" /> },
  ];

  async function handleSave() {
    setError(null);
    if (!accountName || !accountNumber) {
      setError('Please fill in all required fields');
      return;
    }
    if (method === 'bank' && !bankName) {
      setError('Bank name is required for bank transfers');
      return;
    }

    setSaving(true);

    if (isDefault) {
      await supabase
        .from('withdrawal_wallets')
        .update({ is_default: false })
        .eq('user_id', userId);
    }

    const { error: insErr } = await supabase.from('withdrawal_wallets').insert({
      user_id: userId,
      label: label || `${WITHDRAWAL_METHOD_LABELS[method]} Wallet`,
      method,
      account_name: accountName,
      account_number: accountNumber,
      bank_name: method === 'bank' ? bankName : null,
      is_default: isDefault,
    });

    if (insErr) {
      setError(insErr.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    onSaved();
  }

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[#131825] rounded-t-2xl sm:rounded-2xl border border-[#232a3f] p-5 w-full max-w-md max-h-[90vh] overflow-y-auto animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-400" /> Add Withdrawal Wallet
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 block">Method</label>
            <div className="grid grid-cols-4 gap-2">
              {methodOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setMethod(opt.value)}
                  className={`flex flex-col items-center gap-1 py-3 rounded-xl border transition-all ${
                    method === opt.value
                      ? 'bg-blue-500/10 border-blue-500/50 text-blue-400'
                      : 'bg-[#0a0e1a] border-[#232a3f] text-gray-400 hover:text-white'
                  }`}
                >
                  {opt.icon}
                  <span className="text-[10px] font-medium">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 block">Label (optional)</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full bg-[#0a0e1a] border border-[#232a3f] rounded-xl px-4 py-3 text-white text-sm focus:border-blue-500 outline-none"
              placeholder="e.g. My GCash"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 block">Account Name</label>
            <input
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              className="w-full bg-[#0a0e1a] border border-[#232a3f] rounded-xl px-4 py-3 text-white text-sm focus:border-blue-500 outline-none"
              placeholder="Full name on account"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 block">
              {method === 'crypto' ? 'Wallet Address' : method === 'bank' ? 'Account Number' : 'Mobile Number'}
            </label>
            <input
              type="text"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              className="w-full bg-[#0a0e1a] border border-[#232a3f] rounded-xl px-4 py-3 text-white text-sm focus:border-blue-500 outline-none"
              placeholder={
                method === 'crypto'
                  ? '0x... or wallet address'
                  : method === 'bank'
                  ? 'Bank account number'
                  : '09XX XXX XXXX'
              }
            />
          </div>

          {method === 'bank' && (
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">Bank Name</label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full bg-[#0a0e1a] border border-[#232a3f] rounded-xl px-4 py-3 text-white text-sm focus:border-blue-500 outline-none"
                placeholder="e.g. BPI, BDO, Metrobank"
              />
            </div>
          )}

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="w-4 h-4 rounded accent-blue-500"
            />
            <span className="text-gray-300 text-sm">Set as default payout destination</span>
          </label>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full gradient-primary text-white font-semibold py-3.5 rounded-xl transition-all hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Wallet'}
          </button>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">{icon} {label}</label>
      {children}
    </div>
  );
}

function HistoryRow({ type, amount, status, date, detail }: { type: string; amount: number; status: string; date: string; detail: string }) {
  const isRecharge = type === 'recharge';
  return (
    <div className="flex items-center justify-between bg-[#131825] rounded-lg px-4 py-3 border border-[#232a3f]">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
          isRecharge ? 'bg-emerald-500/10 text-emerald-400' : 'bg-orange-500/10 text-orange-400'
        }`}>
          {isRecharge ? <ArrowDownCircle className="w-5 h-5" /> : <ArrowUpCircle className="w-5 h-5" />}
        </div>
        <div>
          <p className="text-white text-sm font-medium">{isRecharge ? 'Recharge' : 'Withdrawal'}</p>
          <p className="text-gray-500 text-xs">{detail} · {formatDate(date)}</p>
        </div>
      </div>
      <div className="text-right">
        <p className={`text-sm font-bold ${isRecharge ? 'text-emerald-400' : 'text-orange-400'}`}>
          {isRecharge ? '+' : '-'}{formatCurrency(amount)}
        </p>
        <StatusBadge status={status} />
      </div>
    </div>
  );
}
