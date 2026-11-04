const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const CA_BOUNDS = { minLat: 32, maxLat: 42.1, minLng: -124.5, maxLng: -114 };

type Point = { lat: number; lng: number };

function isCaliforniaPoint(value: unknown): value is Point {
  if (!value || typeof value !== "object") return false;
  const { lat, lng } = value as Record<string, unknown>;
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    lat >= CA_BOUNDS.minLat &&
    lat <= CA_BOUNDS.maxLat &&
    lng >= CA_BOUNDS.minLng &&
    lng <= CA_BOUNDS.maxLng
  );
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const from = body?.from;
    const to = body?.to;

    if (!isCaliforniaPoint(from) || !isCaliforniaPoint(to)) {
      return jsonResponse({ error: "Both points must be inside California" }, 400);
    }

    const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) {
      return jsonResponse({ error: "Routing service unavailable" }, 502);
    }

    const data = await res.json();
    const route = data?.routes?.[0];
    const line = route?.geometry?.coordinates;
    if (!Array.isArray(line) || line.length < 2) {
      return jsonResponse({ error: "No driving route found" }, 502);
    }

    const points = line.map((pair: [number, number]) => [pair[1], pair[0]]);
    return jsonResponse({ points, distance_m: Number(route.distance) || 0 }, 200);
  } catch (err) {
    console.error("route-geometry failed", err);
    return jsonResponse({ error: "Could not load route" }, 500);
  }
});
