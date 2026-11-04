import { supabase } from '@/lib/supabase';
import { Investment } from '@/lib/types';

export type Coord = [number, number];

export interface RouteLeg {
  points: Coord[];
  approximate: boolean;
}

export interface FleetRoute {
  id: string;
  name: string;
  origin: { name: string; lat: number; lng: number };
  destination: { name: string; lat: number; lng: number };
}

export interface FleetCar {
  id: string;
  name: string;
  points: Coord[];
  cumulative: number[];
  loopLengthM: number;
  loopDurationMs: number;
  speedMph: number;
  startMs: number;
  dailyPayout: number;
  totalEarned: number;
  ceiling: number;
  accrualStartMs: number;
}

const EARTH_RADIUS_M = 6371000;
const METERS_PER_SECOND_PER_MPH = 0.44704;
const MIN_CRUISE_MPH = 10;
const CRUISE_MPH_RANGE = 6;
const MOTION_TIME_SCALE = 10; // on-screen drive speed relative to real time, so cars crawl instead of racing

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function distanceM(a: Coord, b: Coord): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

function isRoutePayload(value: unknown): value is { points: Coord[] } {
  if (!value || typeof value !== 'object') return false;
  const points = (value as { points?: unknown }).points;
  return (
    Array.isArray(points) &&
    points.length >= 2 &&
    points.every((p) => Array.isArray(p) && p.length === 2 && typeof p[0] === 'number' && typeof p[1] === 'number')
  );
}

export async function loadActiveRoutes(): Promise<FleetRoute[]> {
  const { data, error } = await supabase
    .from('fleet_routes')
    .select('id, name, origin_name, origin_lat, origin_lng, destination_name, destination_lat, destination_lng')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    origin: { name: row.origin_name, lat: row.origin_lat, lng: row.origin_lng },
    destination: { name: row.destination_name, lat: row.destination_lat, lng: row.destination_lng },
  }));
}

export function routeFor(investmentId: string, routes: FleetRoute[]): FleetRoute | undefined {
  if (routes.length === 0) return undefined;
  return routes[hashString(investmentId) % routes.length];
}

export async function loadRouteLeg(route: FleetRoute): Promise<RouteLeg> {
  const from: Coord = [route.origin.lat, route.origin.lng];
  const to: Coord = [route.destination.lat, route.destination.lng];
  const fallback: RouteLeg = { points: [from, to], approximate: true };

  try {
    const { data, error } = await supabase.functions.invoke('route-geometry', {
      body: { from: { lat: from[0], lng: from[1] }, to: { lat: to[0], lng: to[1] } },
    });
    if (error || !isRoutePayload(data)) return fallback;
    return { points: data.points, approximate: false };
  } catch {
    return fallback;
  }
}

export function buildFleetCar(investment: Investment, leg: RouteLeg): FleetCar {
  const forward = leg.points;
  const points: Coord[] = [...forward, ...forward.slice(0, -1).reverse()];

  const cumulative: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    cumulative.push(cumulative[i - 1] + distanceM(points[i - 1], points[i]));
  }
  const loopLengthM = cumulative[cumulative.length - 1];

  const speedMph = MIN_CRUISE_MPH + createRandom(hashString(investment.id))() * CRUISE_MPH_RANGE;
  const loopDurationMs = (loopLengthM / (speedMph * METERS_PER_SECOND_PER_MPH)) * 1000;

  const dailyPayout = Number(investment.daily_payout);
  const totalEarned = Number(investment.total_earned);
  const remainingDays = Math.max(0, investment.duration_days - investment.days_completed);

  return {
    id: investment.id,
    name: investment.car_name.trim(),
    points,
    cumulative,
    loopLengthM,
    loopDurationMs,
    speedMph,
    startMs: new Date(investment.start_date).getTime(),
    dailyPayout,
    totalEarned,
    ceiling: totalEarned + dailyPayout * remainingDays,
    accrualStartMs: new Date(investment.last_payout_date ?? investment.start_date).getTime(),
  };
}

export interface CarState {
  position: Coord;
  heading: number;
}

function bearingDeg(a: Coord, b: Coord): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function carStateAt(car: FleetCar, now: number): CarState {
  const elapsed = (Math.max(0, now - car.startMs) * MOTION_TIME_SCALE) % car.loopDurationMs;
  const target = (elapsed / car.loopDurationMs) * car.loopLengthM;

  let i = 1;
  while (i < car.cumulative.length - 1 && car.cumulative[i] < target) i++;

  const segmentLength = car.cumulative[i] - car.cumulative[i - 1];
  const ratio = segmentLength === 0 ? 0 : (target - car.cumulative[i - 1]) / segmentLength;
  const a = car.points[i - 1];
  const b = car.points[i];
  return {
    position: [a[0] + (b[0] - a[0]) * ratio, a[1] + (b[1] - a[1]) * ratio],
    heading: bearingDeg(a, b),
  };
}

export function liveEarnings(car: FleetCar, now: number): number {
  const elapsedDays = Math.max(0, now - car.accrualStartMs) / 86400000;
  const pending = Math.min(car.dailyPayout * elapsedDays, car.ceiling - car.totalEarned);
  return car.totalEarned + Math.max(0, pending);
}
