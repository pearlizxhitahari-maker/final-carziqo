import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, X, Clock, Trophy } from 'lucide-react';

interface Bubble {
  id: number;
  x: number;
  y: number;
  size: number;
  points: number;
  color: string;
  popped: boolean;
}

const BUBBLE_COLORS = [
  'from-blue-400 to-blue-600',
  'from-cyan-400 to-cyan-600',
  'from-teal-400 to-teal-600',
  'from-emerald-400 to-emerald-600',
  'from-sky-400 to-sky-600',
];

const GAME_DURATION = 15;
const MAX_BUBBLES = 12;
const MAX_COMBO = 5;
const COMBO_WINDOW_MS = 1200;

let bubbleIdCounter = 0;

function createBubble(): Bubble {
  const points = Math.floor(Math.random() * 5) + 1;
  const size = 40 + Math.floor(Math.random() * 30);
  return {
    id: bubbleIdCounter++,
    x: Math.random() * 80 + 5,
    y: Math.random() * 70 + 10,
    size,
    points,
    color: BUBBLE_COLORS[Math.floor(Math.random() * BUBBLE_COLORS.length)],
    popped: false,
  };
}

export default function BubbleGame({ onClose, onGameEnd }: { onClose: () => void; onGameEnd: (points: number, bubbles: number) => void }) {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [score, setScore] = useState(0);
  const [poppedCount, setPoppedCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const spawnRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const comboRef = useRef(0);
  const lastPopAtRef = useRef(0);

  const endGame = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (spawnRef.current) clearInterval(spawnRef.current);
    setPlaying(false);
    setFinished(true);
  }, []);

  const startGame = useCallback(() => {
    setScore(0);
    setPoppedCount(0);
    setTimeLeft(GAME_DURATION);
    setFinished(false);
    comboRef.current = 0;
    lastPopAtRef.current = 0;
    setPlaying(true);
    const initial = Array.from({ length: 6 }, () => createBubble());
    setBubbles(initial);

    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    spawnRef.current = setInterval(() => {
      setBubbles((prev) => {
        const active = prev.filter((b) => !b.popped);
        if (active.length >= MAX_BUBBLES) return prev;
        const newBubble = createBubble();
        return [...prev.filter((b) => !b.popped), newBubble];
      });
    }, 800);
  }, []);

  useEffect(() => {
    if (timeLeft === 0 && playing) {
      endGame();
    }
  }, [timeLeft, playing, endGame]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (spawnRef.current) clearInterval(spawnRef.current);
    };
  }, []);

  function popBubble(bubble: Bubble) {
    if (bubble.popped || !playing) return;

    setBubbles((prev) =>
      prev.map((b) => (b.id === bubble.id ? { ...b, popped: true } : b))
    );

    const now = Date.now();
    const nextCombo = now - lastPopAtRef.current <= COMBO_WINDOW_MS ? Math.min(comboRef.current + 1, MAX_COMBO) : 1;
    comboRef.current = nextCombo;
    lastPopAtRef.current = now;
    setScore((prev) => prev + bubble.points * nextCombo);
    setPoppedCount((prev) => prev + 1);
  }

  if (!playing && !finished) {
    return (
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
        <div className="bg-[#131825] rounded-2xl border border-[#232a3f] p-6 w-full max-w-sm text-center" onClick={(e) => e.stopPropagation()}>
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Play className="w-10 h-10 text-white" fill="white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Bubble Pop Game</h2>
          <p className="text-gray-400 text-sm mb-1">Tap as many bubbles as you can in 15 seconds!</p>
          <p className="text-gray-500 text-xs mb-6">Chain pops within 1.2 seconds to earn up to 5x points</p>
          <button
            onClick={startGame}
            className="w-full gradient-primary text-white font-bold py-4 rounded-xl text-lg transition-all hover:opacity-90 active:scale-95"
          >
            Start Game
          </button>
        </div>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
        <div className="bg-[#131825] rounded-2xl border border-[#232a3f] p-6 w-full max-w-sm text-center" onClick={(e) => e.stopPropagation()}>
          <div className="w-20 h-20 rounded-full gradient-accent flex items-center justify-center mx-auto mb-4 animate-scale-in">
            <Trophy className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Game Over!</h2>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-[#0a0e1a] rounded-xl p-4">
              <p className="text-gray-400 text-xs">Bubbles Popped</p>
              <p className="text-blue-400 text-2xl font-bold">{poppedCount}</p>
            </div>
            <div className="bg-[#0a0e1a] rounded-xl p-4">
              <p className="text-gray-400 text-xs">Carbon Points</p>
              <p className="text-emerald-400 text-2xl font-bold">{score}</p>
            </div>
          </div>
          <p className="text-gray-400 text-sm mb-4">
            Worth <span className="text-cyan-400 font-bold">₱{(score * 0.01).toFixed(2)}</span>
          </p>
          <button
            onClick={() => onGameEnd(score, poppedCount)}
            className="w-full gradient-accent text-white font-bold py-3.5 rounded-xl transition-all hover:opacity-90 active:scale-95"
          >
            Claim {score} Carbon Points
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col animate-fade-in">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#232a3f] bg-[#131825]">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-400" />
          <span className={`text-2xl font-bold ${timeLeft <= 5 ? 'text-red-400' : 'text-white'}`}>
            {timeLeft}s
          </span>
        </div>
        <span className="text-sm text-gray-400">Bubbles popped: <span className="font-bold text-blue-400">{poppedCount}</span></span>
        <button onClick={endGame} className="text-gray-400 hover:text-white">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="h-1 bg-[#131825]">
        <div
          className={`h-full transition-all duration-1000 linear ${timeLeft <= 5 ? 'bg-red-500' : 'gradient-primary'}`}
          style={{ width: `${(timeLeft / GAME_DURATION) * 100}%` }}
        />
      </div>

      <div className="flex-1 relative overflow-hidden bg-gradient-to-b from-[#0a0e1a] to-[#0d1525]">
        {bubbles.filter((b) => !b.popped).map((bubble) => (
          <button
            key={bubble.id}
            onClick={() => popBubble(bubble)}
            className="absolute rounded-full transition-all active:scale-50 cursor-pointer"
            style={{
              left: `${bubble.x}%`,
              top: `${bubble.y}%`,
              width: `${bubble.size}px`,
              height: `${bubble.size}px`,
            }}
          >
            <div className={`w-full h-full rounded-full bg-gradient-to-br ${bubble.color} shadow-lg relative`}>
              <div className="absolute top-1 left-1 w-1/3 h-1/3 bg-white/40 rounded-full" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
