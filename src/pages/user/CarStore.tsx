import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Car as CarType, DURATION_OPTIONS, DURATION_DAILY_RATES, FREE_CAR_DURATION_DAYS, formatCurrency } from '@/lib/types';
import { useAuth } from '@/context/AuthContext';
import { TrendingUp, X, Check, Calendar, DollarSign, Car as CarIcon, Gift } from 'lucide-react';

export default function CarStore() {
  const { profile } = useAuth();
  const [cars, setCars] = useState<CarType[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCar, setSelectedCar] = useState<CarType | null>(null);

  useEffect(() => {
    loadCars();
  }, []);

  async function loadCars() {
    const { data } = await supabase.from('cars').select('*').eq('status', 'active').order('price', { ascending: true });
    setCars((data as unknown as CarType[]) || []);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <h2 className="text-xl font-bold text-white mb-1">Car Store</h2>
      <p className="text-gray-400 text-sm mb-5">Choose a car and start earning daily returns</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {cars.map((car) => (
          <CarCard
              key={car.id}
              car={car}
              disabled={car.is_free && Boolean(profile?.free_investment_id)}
              onClick={() => setSelectedCar(car)}
            />
        ))}
      </div>

      {selectedCar && (
        <InvestmentModal
          car={selectedCar}
          onClose={() => setSelectedCar(null)}
        />
      )}
    </div>
  );
}

function CarCard({ car, disabled, onClick }: { car: CarType; disabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="group text-left rounded-2xl overflow-hidden bg-[#131825] border border-[#232a3f] hover:border-blue-500/40 transition-all hover:shadow-lg hover:shadow-blue-500/10 disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <div className="relative h-40 overflow-hidden">
        <img
          src={car.image_url}
          alt={car.car_name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        <div className="absolute top-3 right-3 gradient-accent text-white text-xs font-bold px-2.5 py-1 rounded-full">
          {car.is_free ? '₱1/day' : '2-3%/day'}
        </div>
        {car.is_free && (
          <div className="absolute top-3 left-3 gradient-gold text-black text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
            <Gift className="w-3 h-3" /> FREE
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="text-white font-semibold text-base mb-1">{car.car_name}</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-xs">Rental price</p>
            <p className="text-white font-bold text-lg">{car.is_free ? 'FREE' : formatCurrency(Number(car.price))}</p>
          </div>
          <div className="text-right">
            <p className="text-gray-400 text-xs">Daily return</p>
            <p className="text-emerald-400 font-bold text-lg">{car.is_free ? '₱1.00' : formatCurrency(Number(car.price) * DURATION_DAILY_RATES[30])}</p>
          </div>
        </div>
      </div>
    </button>
  );
}

function InvestmentModal({ car, onClose }: { car: CarType; onClose: () => void }) {
  const { profile, session, refreshProfile } = useAuth();
  const [duration, setDuration] = useState<number>(car.is_free ? FREE_CAR_DURATION_DAYS : DURATION_OPTIONS[0]);
  const [amount, setAmount] = useState<string>(car.is_free ? '0' : String(car.price));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const invAmount = parseFloat(amount) || 0;
  const isFreeCar = car.is_free;
  const dailyRate = isFreeCar ? 0 : (DURATION_DAILY_RATES[duration] ?? 0);
  const dailyPayout = isFreeCar ? 1 : invAmount * dailyRate;
  const totalReturn = dailyPayout * duration;
  const balance = profile?.wallet_balance || 0;
  const canAfford = isFreeCar || invAmount <= balance;
  const MIN_INVESTMENT = 500;
  const MAX_INVESTMENT = 100000;
  const withinLimits = invAmount >= MIN_INVESTMENT && invAmount <= MAX_INVESTMENT;

  async function handleInvest() {
    if (!session) return;
    setError(null);
    if (!isFreeCar && invAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    if (isFreeCar && invAmount !== 0) {
      setError('The free starter car does not require payment');
      return;
    }
    if (!isFreeCar && invAmount < MIN_INVESTMENT) {
      setError(`Minimum investment amount is ${formatCurrency(MIN_INVESTMENT)}`);
      return;
    }
    if (invAmount > MAX_INVESTMENT) {
      setError(`Maximum investment amount is ${formatCurrency(MAX_INVESTMENT)}`);
      return;
    }
    if (invAmount > balance) {
      setError('Insufficient balance. Please recharge your wallet first.');
      return;
    }
    setSubmitting(true);

    const { error: invError } = await supabase.rpc('create_investment', {
      p_car_id: car.id,
      p_amount: invAmount,
      p_duration_days: duration,
    });

    if (invError) {
      setError(invError.message);
      setSubmitting(false);
      return;
    }

    await refreshProfile();
    setSuccess(true);
    setSubmitting(false);
    setTimeout(onClose, 2000);
  }

  if (success) {
    return (
      <ModalOverlay onClose={onClose}>
        <div className="text-center py-8 animate-scale-in">
          <div className="w-16 h-16 gradient-accent rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Investment Confirmed!</h3>
          <p className="text-gray-400 text-sm">Your car rental is now active. You'll earn {formatCurrency(dailyPayout)} daily.</p>
        </div>
      </ModalOverlay>
    );
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="animate-slide-up">
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <img src={car.image_url} alt={car.car_name} className="w-16 h-16 rounded-lg object-cover" />
            <div>
              <h3 className="text-lg font-bold text-white">{car.car_name}</h3>
              <p className="text-emerald-400 text-sm font-semibold">{isFreeCar ? 'Free starter car' : '2% (30 days) or 3% (60 days) daily return'}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Investment amount */}
        <div className="mb-5">
          <label className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
            <DollarSign className="w-4 h-4" /> {isFreeCar ? 'Starter Car Access' : 'Investment Amount'}
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={isFreeCar}
            className={`w-full bg-[#0a0e1a] border rounded-xl px-4 py-3 text-white text-lg font-bold outline-none transition-colors ${
              !withinLimits && !isFreeCar ? 'border-red-500/50' : 'border-[#232a3f] focus:border-blue-500'
            }`}
            min={isFreeCar ? 0 : MIN_INVESTMENT}
            max={MAX_INVESTMENT}
            step="0.01"
          />
          <p className="text-gray-500 text-xs mt-1.5">
            {isFreeCar ? 'This starter car is free for one user only.' : <>Available balance: {formatCurrency(balance)}<span className="ml-2">| Min: {formatCurrency(MIN_INVESTMENT)} · Max: {formatCurrency(MAX_INVESTMENT)}</span></>}
          </p>
          {!canAfford && invAmount > 0 && (
            <p className="text-red-400 text-xs mt-1">Insufficient balance — please recharge first.</p>
          )}
          {!isFreeCar && invAmount > 0 && invAmount < MIN_INVESTMENT && (
            <p className="text-red-400 text-xs mt-1">Minimum investment is {formatCurrency(MIN_INVESTMENT)}.</p>
          )}
          {invAmount > MAX_INVESTMENT && (
            <p className="text-red-400 text-xs mt-1">Maximum investment is {formatCurrency(MAX_INVESTMENT)}.</p>
          )}
        </div>

        {/* Duration selector */}
        <div className="mb-5">
          <label className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
            <Calendar className="w-4 h-4" /> Rental Period
          </label>
          {isFreeCar ? (
            <p className="text-gray-400 text-sm">{FREE_CAR_DURATION_DAYS} days, fixed for the starter car</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {DURATION_OPTIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={`py-3 rounded-lg text-sm font-semibold transition-all flex flex-col items-center ${
                    duration === d
                      ? 'gradient-primary text-white'
                      : 'bg-[#0a0e1a] border border-[#232a3f] text-gray-400 hover:text-white'
                  }`}
                >
                  {d} days
                  <span className="text-[10px] font-medium opacity-80">{(DURATION_DAILY_RATES[d] * 100).toFixed(0)}% per day</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="bg-[#0a0e1a] rounded-xl p-4 space-y-2.5 mb-5">
          <SummaryRow label="Daily Rate" value={isFreeCar ? 'Fixed' : `${(dailyRate * 100).toFixed(0)}%`} valueClass="text-gray-400" />
          <SummaryRow label="Daily Earning" value={formatCurrency(dailyPayout)} valueClass="text-emerald-400" />
          <SummaryRow label="Total Return" value={formatCurrency(totalReturn)} valueClass="text-emerald-400 font-bold" />
          <SummaryRow label="ROI" value={isFreeCar ? 'Starter benefit' : `${((totalReturn / invAmount) * 100).toFixed(0)}%`} valueClass="text-blue-400 font-bold" />
          <div className="border-t border-[#232a3f] pt-2.5">
            <SummaryRow label="After Investment Balance" value={formatCurrency(balance - invAmount)} valueClass="text-white" />
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm mb-4 animate-fade-in">
            {error}
          </div>
        )}

        <button
          onClick={handleInvest}
          disabled={submitting || !canAfford || (!isFreeCar && (invAmount <= 0 || !withinLimits))}
          className="w-full gradient-primary text-white font-semibold py-3.5 rounded-xl transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Processing...' : isFreeCar ? 'Claim Free Starter Car' : `Invest ${formatCurrency(invAmount)}`}
        </button>
      </div>
    </ModalOverlay>
  );
}

function SummaryRow({ label, value, valueClass = '' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-400 text-sm">{label}</span>
      <span className={`text-sm font-semibold ${valueClass}`}>{value}</span>
    </div>
  );
}

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[#131825] rounded-t-2xl sm:rounded-2xl border border-[#232a3f] p-5 w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
