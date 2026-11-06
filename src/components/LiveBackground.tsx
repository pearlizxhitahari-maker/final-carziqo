import { useEffect, useState } from 'react';

const THEME_PRESETS = [
  { name: 'ocean', primary: '#0066ff', accent: '#00c896', glow: 'rgba(0,102,255,0.35)' },
  { name: 'aurora', primary: '#00c896', accent: '#3385ff', glow: 'rgba(0,200,150,0.30)' },
  { name: 'sunset', primary: '#f0b90b', accent: '#ff7a45', glow: 'rgba(240,185,11,0.30)' },
  { name: 'crimson', primary: '#ff4d6d', accent: '#ff8fa3', glow: 'rgba(255,77,109,0.30)' },
  { name: 'violet', primary: '#7c5cff', accent: '#3385ff', glow: 'rgba(124,92,255,0.30)' },
  { name: 'mint', primary: '#00d4a8', accent: '#0066ff', glow: 'rgba(0,212,168,0.30)' },
] as const;

const ROTATE_MS = 60_000;

export default function LiveBackground() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % THEME_PRESETS.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, []);

  const preset = THEME_PRESETS[index];

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--color-primary', preset.primary);
    root.style.setProperty('--color-primary-light', preset.accent);
    root.style.setProperty('--live-glow', preset.glow);
  }, [preset]);

  return (
    <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <div
        className="live-bg-aurora"
        style={{
          background: `radial-gradient(60vw 60vh at 15% 20%, ${preset.primary}26 0%, transparent 60%), radial-gradient(55vw 55vh at 85% 75%, ${preset.accent}26 0%, transparent 60%), radial-gradient(40vw 40vh at 50% 50%, ${preset.primary}1a 0%, transparent 70%)`,
        }}
      />
      <div className="live-bg-grid" />
      <div className="live-bg-orbs">
        <span style={{ background: `${preset.primary}40` }} />
        <span style={{ background: `${preset.accent}40` }} />
        <span style={{ background: `${preset.primary}30` }} />
      </div>
      <div className="live-bg-noise" />
    </div>
  );
}
