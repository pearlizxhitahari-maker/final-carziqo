import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Coupon, UserCoupon, GiftItem, UserGift, DailyCheckin, formatCurrency, formatDateShort } from '@/lib/types';
import { Gift, Ticket, GamepadIcon, CheckCircle, Calendar, Sparkles, Leaf, ArrowRight, Clock, X, Check } from 'lucide-react';
import BubbleGame from '@/components/BubbleGame';

export default function Rewards() {
  const { profile, session, refreshProfile } = useAuth();
  const [tab, setTab] = useState<'checkin' | 'game' | 'coupons' | 'gifts'>('checkin');
  const [todayCheckin, setTodayCheckin] = useState<DailyCheckin | null>(null);
  const [checkinHistory, setCheckinHistory] = useState<DailyCheckin[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [userCoupons, setUserCoupons] = useState<UserCoupon[]>([]);
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [userGifts, setUserGifts] = useState<UserGift[]>([]);
  const [claiming, setClaiming] = useState(false);
  const [checkinMsg, setCheckinMsg] = useState<{ type: 'success' | 'info'; text: string } | null>(null);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showGame, setShowGame] = useState(false);
  const [playedToday, setPlayedToday] = useState(false);

  const loadData = useCallback(async () => {
    if (!session) return;
    const today = new Date().toISOString().split('T')[0];

    const [checkinRes, historyRes, couponRes, userCouponRes, giftRes, userGiftRes, playedRes] = await Promise.all([
      supabase.from('daily_checkins').select('*').eq('user_id', session.user.id).eq('checkin_date', today).maybeSingle(),
      supabase.from('daily_checkins').select('*').eq('user_id', session.user.id).order('checkin_date', { ascending: false }).limit(7),
      supabase.from('coupons').select('*').eq('is_active', true).order('carbon_cost', { ascending: true }),
      supabase.from('user_coupons').select('*').eq('user_id', session.user.id).order('claimed_at', { ascending: false }),
      supabase.from('gift_list').select('*').eq('is_active', true).order('carbon_cost', { ascending: true }),
      supabase.from('user_gifts').select('*').eq('user_id', session.user.id).order('redeemed_at', { ascending: false }),
      supabase.rpc('bubble_game_played_today'),
    ]);

    setTodayCheckin((checkinRes.data as unknown as DailyCheckin) || null);
    setCheckinHistory((historyRes.data as unknown as DailyCheckin[]) || []);
    setCoupons((couponRes.data as unknown as Coupon[]) || []);
    setUserCoupons((userCouponRes.data as unknown as UserCoupon[]) || []);
    setGifts((giftRes.data as unknown as GiftItem[]) || []);
    setUserGifts((userGiftRes.data as unknown as UserGift[]) || []);
    setPlayedToday(playedRes.data === true);
  }, [session]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleCheckin() {
    setClaiming(true);
    setCheckinMsg(null);
    const { data, error } = await supabase.rpc('claim_daily_checkin');
    if (error) {
      setCheckinMsg({ type: 'info', text: error.message });
    } else if (data) {
      const result = Array.isArray(data) ? data[0] : data;
      const r = result as { reward_amount: number; carbon_earned: number; already_claimed: boolean };
      if (r.already_claimed) {
        setCheckinMsg({ type: 'info', text: 'You already checked in today!' });
      } else {
        setCheckinMsg({ type: 'success', text: `Check-in successful! +₱${r.reward_amount} and +${r.carbon_earned} carbon point!` });
        await loadData();
        await refreshProfile();
      }
    }
    setClaiming(false);
  }

  async function handleClaimCoupon(couponId: string) {
    setActionMsg(null);
    const { error } = await supabase.rpc('claim_coupon', { p_coupon_id: couponId });
    if (error) {
      setActionMsg({ type: 'error', text: error.message });
    } else {
      setActionMsg({ type: 'success', text: 'Coupon claimed! Its value has been added to your wallet.' });
      await loadData();
      await refreshProfile();
    }
    setTimeout(() => setActionMsg(null), 3000);
  }

  async function handleRedeemGift(giftId: string) {
    setActionMsg(null);
    const { error } = await supabase.rpc('redeem_gift', { p_gift_id: giftId });
    if (error) {
      setActionMsg({ type: 'error', text: error.message });
    } else {
      setActionMsg({ type: 'success', text: 'Gift redeemed! Its cash value has been added to your wallet.' });
      await loadData();
      await refreshProfile();
    }
    setTimeout(() => setActionMsg(null), 3000);
  }

  async function handleGameEnd(points: number, bubbles: number) {
    const { error } = await supabase.rpc('save_game_session', {
      p_points_earned: points,
      p_bubbles_popped: bubbles,
      p_duration_seconds: 15,
    });
    if (error) {
      setActionMsg({ type: 'error', text: error.message });
    } else {
      setPlayedToday(true);
      await loadData();
      await refreshProfile();
    }
    setShowGame(false);
  }

  const carbonPoints = profile?.carbon_points || 0;
  const carbonValue = (carbonPoints * 0.01).toFixed(2);

  const tabs = [
    { id: 'checkin' as const, label: 'Check-in', icon: <Calendar className="w-4 h-4" /> },
    { id: 'game' as const, label: 'Bubble Game', icon: <GamepadIcon className="w-4 h-4" /> },
    { id: 'coupons' as const, label: 'Coupons', icon: <Ticket className="w-4 h-4" /> },
    { id: 'gifts' as const, label: 'Gifts', icon: <Gift className="w-4 h-4" /> },
  ];

  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">Rewards Center</h2>
        <p className="text-gray-400 text-sm">Earn carbon points and redeem rewards</p>
      </div>

      {/* Carbon Points Card */}
      <div className="relative overflow-hidden rounded-2xl p-5 text-white bg-gradient-to-br from-emerald-600 to-teal-700 shadow-xl shadow-emerald-500/20">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <Leaf className="w-5 h-5 text-emerald-200" />
            <p className="text-emerald-100 text-sm font-medium">Carbon Points Balance</p>
          </div>
          <h2 className="text-4xl font-bold tracking-tight mb-2">{carbonPoints}</h2>
          <div className="flex items-center gap-2 text-emerald-100 text-sm">
            <span>Worth: </span>
            <span className="font-bold text-white">{formatCurrency(Number(carbonValue))}</span>
            <span className="text-xs">(1 pt = ₱0.01)</span>
          </div>
        </div>
      </div>

      {/* Tab selector */}
      <div className="flex gap-1 p-1 bg-[#131825] rounded-xl overflow-x-auto no-scrollbar">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              tab === t.id ? 'gradient-primary text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Action message */}
      {actionMsg && (
        <div className={`rounded-lg px-4 py-3 text-sm flex items-center gap-2 animate-fade-in ${
          actionMsg.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'
        }`}>
          {actionMsg.type === 'success' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
          {actionMsg.text}
        </div>
      )}

      {/* Daily Check-in tab */}
      {tab === 'checkin' && (
        <div className="space-y-4 animate-fade-in">
          <div className="bg-[#131825] rounded-2xl p-6 border border-[#232a3f] text-center">
            <div className="w-20 h-20 rounded-full gradient-accent flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-white font-bold text-lg mb-2">Daily Check-In</h3>
            <p className="text-gray-400 text-sm mb-1">Check in every day to earn rewards!</p>
            <p className="text-emerald-400 text-sm font-semibold mb-4">+₱5 + 1 Carbon Point</p>

            {checkinMsg && (
              <div className={`rounded-lg px-4 py-3 text-sm mb-4 flex items-center gap-2 justify-center ${
                checkinMsg.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
              }`}>
                {checkinMsg.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                {checkinMsg.text}
              </div>
            )}

            <button
              onClick={handleCheckin}
              disabled={claiming || !!todayCheckin}
              className="w-full gradient-accent text-white font-bold py-4 rounded-xl transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {todayCheckin ? 'Already Checked In Today' : claiming ? 'Processing...' : 'Check In Now'}
            </button>
          </div>

          {/* Check-in history */}
          {checkinHistory.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-3">Recent Check-ins</h4>
              <div className="space-y-2">
                {checkinHistory.map((c) => (
                  <div key={c.id} className="flex items-center justify-between bg-[#131825] rounded-lg px-4 py-3 border border-[#232a3f]">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">{formatDateShort(c.checkin_date)}</p>
                        <p className="text-gray-500 text-xs">+₱{c.reward_amount} · +{c.carbon_earned} carbon</p>
                      </div>
                    </div>
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bubble Game tab */}
      {tab === 'game' && (
        <div className="space-y-4 animate-fade-in">
          <div className="bg-[#131825] rounded-2xl p-6 border border-[#232a3f] text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center mx-auto mb-4">
              <GamepadIcon className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-white font-bold text-lg mb-2">Bubble Pop Game</h3>
            <p className="text-gray-400 text-sm mb-1">Tap bubbles to earn carbon points!</p>
            <p className="text-gray-500 text-xs mb-4">15 seconds · Each bubble gives 1-5 points · One play per day</p>

            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-[#0a0e1a] rounded-lg p-3">
                <p className="text-gray-500 text-xs">Duration</p>
                <p className="text-white font-bold">15s</p>
              </div>
              <div className="bg-[#0a0e1a] rounded-lg p-3">
                <p className="text-gray-500 text-xs">Per Bubble</p>
                <p className="text-cyan-400 font-bold">1-5 pts</p>
              </div>
              <div className="bg-[#0a0e1a] rounded-lg p-3">
                <p className="text-gray-500 text-xs">Value</p>
                <p className="text-emerald-400 font-bold">₱0.01/pt</p>
              </div>
            </div>

            <button
              onClick={() => setShowGame(true)}
              disabled={playedToday}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold py-4 rounded-xl transition-all hover:opacity-90 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              <GamepadIcon className="w-5 h-5" />
              {playedToday ? 'Played Today - Come Back Tomorrow' : 'Play Now'}
            </button>
          </div>
        </div>
      )}

      {/* Coupons tab */}
      {tab === 'coupons' && (
        <div className="space-y-4 animate-fade-in">
          <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            <Ticket className="w-4 h-4" /> Available Coupons
          </h3>
          {coupons.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Ticket className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No coupons available</p>
            </div>
          ) : (
            <div className="space-y-3">
              {coupons.map((c) => {
                const alreadyClaimed = userCoupons.some((uc) => uc.coupon_id === c.id);
                const canAfford = carbonPoints >= c.carbon_cost;
                const soldOut = c.max_claims > 0 && c.claims_count >= c.max_claims;
                const expired = !!(c.expires_at && new Date(c.expires_at) < new Date());
                const disabled = alreadyClaimed || !canAfford || soldOut || expired;
                return (
                  <div key={c.id} className="bg-[#131825] rounded-xl border border-[#232a3f] p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                          <Ticket className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                          <p className="text-white font-semibold text-sm">{c.title}</p>
                          <p className="text-blue-400 text-xs font-bold">{c.code}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-emerald-400 font-bold text-sm">{formatCurrency(Number(c.discount_value))}</p>
                        <p className="text-gray-500 text-xs">{c.carbon_cost} carbon</p>
                      </div>
                    </div>
                    {c.description && <p className="text-gray-400 text-xs mb-3">{c.description}</p>}
                    <button
                      onClick={() => handleClaimCoupon(c.id)}
                      disabled={disabled}
                      className={`w-full text-sm font-semibold py-2.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        alreadyClaimed ? 'bg-emerald-500/10 text-emerald-400' : 'gradient-primary text-white hover:opacity-90'
                      }`}
                    >
                      {alreadyClaimed ? 'Claimed' : soldOut ? 'Sold Out' : expired ? 'Expired' : !canAfford ? `Need ${c.carbon_cost} carbon` : `Claim for ${c.carbon_cost} carbon`}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* User's claimed coupons */}
          {userCoupons.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-3">Your Coupons</h4>
              <div className="space-y-2">
                {userCoupons.map((uc) => (
                  <div key={uc.id} className="flex items-center justify-between bg-[#131825] rounded-lg px-4 py-3 border border-[#232a3f]">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-blue-500/10 rounded-lg flex items-center justify-center">
                        <Ticket className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">{uc.title}</p>
                        <p className="text-gray-500 text-xs">{uc.code} · {formatDateShort(uc.claimed_at)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-emerald-400 text-sm font-bold">{formatCurrency(Number(uc.discount_value))}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${uc.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-500/10 text-gray-400'}`}>
                        {uc.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Gifts tab */}
      {tab === 'gifts' && (
        <div className="space-y-4 animate-fade-in">
          <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            <Gift className="w-4 h-4" /> Gift List
          </h3>
          <p className="text-gray-500 text-xs">Redeem your carbon points for cash rewards</p>

          {gifts.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Gift className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No gifts available</p>
            </div>
          ) : (
            <div className="space-y-3">
              {gifts.map((g) => {
                const canAfford = carbonPoints >= g.carbon_cost;
                const outOfStock = g.stock <= 0;
                return (
                  <div key={g.id} className="bg-[#131825] rounded-xl border border-[#232a3f] p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
                          <Gift className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                          <p className="text-white font-semibold text-sm">{g.name}</p>
                          {g.description && <p className="text-gray-500 text-xs">{g.description}</p>}
                          <p className="text-gray-500 text-xs mt-0.5">Stock: {g.stock}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-emerald-400 font-bold text-sm">{formatCurrency(Number(g.cash_value))}</p>
                        <p className="text-amber-400 text-xs">{g.carbon_cost} carbon</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRedeemGift(g.id)}
                      disabled={!canAfford || outOfStock}
                      className="w-full text-sm font-semibold py-2.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed gradient-accent text-white hover:opacity-90"
                    >
                      {outOfStock ? 'Out of Stock' : !canAfford ? `Need ${g.carbon_cost} carbon` : `Redeem for ${g.carbon_cost} carbon`}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Redeemed gifts */}
          {userGifts.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-3">Redeemed Gifts</h4>
              <div className="space-y-2">
                {userGifts.map((ug) => (
                  <div key={ug.id} className="flex items-center justify-between bg-[#131825] rounded-lg px-4 py-3 border border-[#232a3f]">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-amber-500/10 rounded-lg flex items-center justify-center">
                        <Gift className="w-5 h-5 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">{ug.name}</p>
                        <p className="text-gray-500 text-xs">{ug.carbon_cost} carbon · {formatDateShort(ug.redeemed_at)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-emerald-400 text-sm font-bold">{formatCurrency(Number(ug.cash_value))}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${ug.status === 'redeemed' ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                        {ug.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bubble Game modal */}
      {showGame && (
        <BubbleGame onClose={() => setShowGame(false)} onGameEnd={handleGameEnd} />
      )}
    </div>
  );
}
