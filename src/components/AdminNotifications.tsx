import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, Volume2, VolumeX, X, UserPlus, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { AdminNotification } from '@/lib/types';

const EVENT_STYLES = {
  signup: { icon: UserPlus, color: 'text-blue-400 bg-blue-500/10' },
  recharge: { icon: ArrowDownCircle, color: 'text-emerald-400 bg-emerald-500/10' },
  withdrawal: { icon: ArrowUpCircle, color: 'text-amber-400 bg-amber-500/10' },
} as const;

export default function AdminNotifications() {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [toast, setToast] = useState<AdminNotification | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [browserEnabled, setBrowserEnabled] = useState(false);
  const initializedRef = useRef(false);
  const seenIdsRef = useRef(new Set<string>());

  useEffect(() => {
    let active = true;

    async function loadNotifications() {
      const { data, error } = await supabase
        .from('admin_notifications')
        .select('*')
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error || !active) return;
      const next = (data as unknown as AdminNotification[]) || [];
      next.forEach((notification) => seenIdsRef.current.add(notification.id));
      setNotifications(next);
      initializedRef.current = true;
    }

    function announce(notification: AdminNotification) {
      if (!active || seenIdsRef.current.has(notification.id)) return;
      seenIdsRef.current.add(notification.id);
      setNotifications((current) => [notification, ...current].slice(0, 20));
      setToast(notification);
      if (soundEnabled) playNotificationSound();
      if (browserEnabled && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(notification.title, { body: notification.message });
      }
      window.setTimeout(() => setToast((current) => (current?.id === notification.id ? null : current)), 6000);
    }

    loadNotifications();

    const channel = supabase
      .channel('admin-notifications-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'admin_notifications' },
        (payload) => announce(payload.new as unknown as AdminNotification)
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'admin_notifications' },
        (payload) => {
          const updated = payload.new as unknown as AdminNotification;
          if (updated.is_read) {
            seenIdsRef.current.delete(updated.id);
            setNotifications((current) => current.filter((notification) => notification.id !== updated.id));
          }
        }
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [browserEnabled, soundEnabled]);

  async function markRead(id: string) {
    const { error } = await supabase.from('admin_notifications').update({ is_read: true }).eq('id', id);
    if (!error) {
      setNotifications((current) => current.filter((notification) => notification.id !== id));
      setToast((current) => current?.id === id ? null : current);
    }
  }

  async function markAllRead() {
    const ids = notifications.map((notification) => notification.id);
    if (ids.length === 0) return;
    const { error } = await supabase.from('admin_notifications').update({ is_read: true }).in('id', ids);
    if (!error) {
      setNotifications([]);
      setToast(null);
    }
  }

  async function enableAlerts() {
    const nextSoundEnabled = !soundEnabled;
    setSoundEnabled(nextSoundEnabled);
    if (nextSoundEnabled) playNotificationSound();

    if ('Notification' in window) {
      const permission = Notification.permission === 'default'
        ? await Notification.requestPermission()
        : Notification.permission;
      setBrowserEnabled(permission === 'granted');
    }
  }

  const unreadCount = notifications.length;

  return (
    <>
      <div className="relative">
        <button
          onClick={enableAlerts}
          className={`relative w-10 h-10 rounded-xl border transition-all ${soundEnabled ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' : 'border-[#232a3f] bg-[#131825] text-gray-400 hover:text-white'}`}
          title={soundEnabled ? 'Alerts and sound enabled' : 'Enable alert sound'}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4 mx-auto" /> : <VolumeX className="w-4 h-4 mx-auto" />}
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>

      {toast && (
        <div className="fixed top-4 right-4 z-[70] w-[min(360px,calc(100vw-32px))] bg-[#131825] border border-blue-500/30 rounded-2xl shadow-2xl shadow-black/40 p-4 animate-slide-up">
          <div className="flex items-start gap-3">
            <NotificationIcon type={toast.event_type} />
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold">{toast.title}</p>
              <p className="text-gray-400 text-xs mt-1 leading-relaxed">{toast.message}</p>
              <button onClick={() => markRead(toast.id)} className="text-blue-400 text-xs font-medium mt-2 hover:text-blue-300">Dismiss</button>
            </div>
            <button onClick={() => setToast(null)} className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {unreadCount > 0 && (
        <div className="fixed top-20 right-4 z-[60] w-[min(380px,calc(100vw-32px))] max-h-[min(520px,calc(100vh-112px))] overflow-y-auto bg-[#131825] border border-[#232a3f] rounded-2xl shadow-2xl shadow-black/40 p-3 animate-fade-in">
          <div className="flex items-center justify-between px-2 py-1.5 mb-1">
            <div className="flex items-center gap-2"><Bell className="w-4 h-4 text-blue-400" /><span className="text-white text-sm font-semibold">New activity</span></div>
            <button onClick={markAllRead} className="flex items-center gap-1 text-gray-500 hover:text-blue-400 text-xs"><CheckCheck className="w-3.5 h-3.5" /> Clear all</button>
          </div>
          <div className="space-y-1">
            {notifications.map((notification) => (
              <button key={notification.id} onClick={() => markRead(notification.id)} className="w-full text-left flex items-start gap-3 p-2.5 rounded-xl hover:bg-[#1a2033] transition-colors">
                <NotificationIcon type={notification.event_type} />
                <span className="min-w-0 flex-1"><span className="block text-white text-xs font-semibold">{notification.title}</span><span className="block text-gray-500 text-xs mt-0.5 truncate">{notification.message}</span><span className="block text-gray-600 text-[10px] mt-1">{new Date(notification.created_at).toLocaleTimeString()}</span></span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function NotificationIcon({ type }: { type: AdminNotification['event_type'] }) {
  const style = EVENT_STYLES[type];
  const Icon = style.icon;
  return <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${style.color}`}><Icon className="w-4 h-4" /></span>;
}

function playNotificationSound() {
  const AudioContextClass = window.AudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(740, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(980, context.currentTime + 0.12);
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.22);
  oscillator.addEventListener('ended', () => void context.close());
}
