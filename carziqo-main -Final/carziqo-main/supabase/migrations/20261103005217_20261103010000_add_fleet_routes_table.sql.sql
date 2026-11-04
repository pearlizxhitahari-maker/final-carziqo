/*
# Add editable fleet routes for the California live map

## What this does
Stores the city-to-city routes that rented cars drive along on the Live Fleet map.
Admins can add, edit, pause and delete routes. Signed-in users can see the active routes.

## New table: fleet_routes
- id (uuid, primary key)
- name (text): label shown for the route
- origin_name, origin_lat, origin_lng: starting city
- destination_name, destination_lat, destination_lng: ending city
- is_active (boolean): paused routes are hidden from the map
- sort_order (integer): display and assignment order
- created_at (timestamp)

Coordinates are limited to the California area.

## Security
- Row level security is enabled.
- Signed-in users can read active routes. Admins can read all routes.
- Only admins (via is_admin()) can insert, update or delete routes.

## Seed data
The table is filled with the seven routes the map already used, but only when it is empty.

## Notes
- Idempotent: safe to re-run.
*/

CREATE TABLE IF NOT EXISTS public.fleet_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 80),
  origin_name text NOT NULL CHECK (char_length(trim(origin_name)) BETWEEN 1 AND 60),
  origin_lat double precision NOT NULL CHECK (origin_lat BETWEEN 32 AND 42.1),
  origin_lng double precision NOT NULL CHECK (origin_lng BETWEEN -124.5 AND -114),
  destination_name text NOT NULL CHECK (char_length(trim(destination_name)) BETWEEN 1 AND 60),
  destination_lat double precision NOT NULL CHECK (destination_lat BETWEEN 32 AND 42.1),
  destination_lng double precision NOT NULL CHECK (destination_lng BETWEEN -124.5 AND -114),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fleet_routes_active_sort_idx ON public.fleet_routes (is_active, sort_order);

ALTER TABLE public.fleet_routes ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fleet_routes TO authenticated;

DROP POLICY IF EXISTS "select_active_or_admin_fleet_routes" ON public.fleet_routes;
CREATE POLICY "select_active_or_admin_fleet_routes" ON public.fleet_routes FOR SELECT
  TO authenticated USING (is_active OR public.is_admin());

DROP POLICY IF EXISTS "insert_admin_fleet_routes" ON public.fleet_routes;
CREATE POLICY "insert_admin_fleet_routes" ON public.fleet_routes FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "update_admin_fleet_routes" ON public.fleet_routes;
CREATE POLICY "update_admin_fleet_routes" ON public.fleet_routes FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "delete_admin_fleet_routes" ON public.fleet_routes;
CREATE POLICY "delete_admin_fleet_routes" ON public.fleet_routes FOR DELETE
  TO authenticated USING (public.is_admin());

INSERT INTO public.fleet_routes (name, origin_name, origin_lat, origin_lng, destination_name, destination_lat, destination_lng, sort_order)
SELECT v.name, v.origin_name, v.origin_lat, v.origin_lng, v.destination_name, v.destination_lat, v.destination_lng, v.sort_order
FROM (VALUES
  ('Downtown LA to Santa Monica', 'Los Angeles', 34.0522, -118.2437, 'Santa Monica', 34.0195, -118.4912, 1),
  ('Hollywood to Pasadena', 'Hollywood', 34.0928, -118.3287, 'Pasadena', 34.1478, -118.1445, 2),
  ('Long Beach to Downtown LA', 'Long Beach', 33.7701, -118.1937, 'Los Angeles', 34.0522, -118.2437, 3),
  ('San Francisco to Oakland', 'San Francisco', 37.7946, -122.3999, 'Oakland', 37.8044, -122.2712, 4),
  ('Berkeley to Oakland', 'Berkeley', 37.8715, -122.273, 'Oakland', 37.8044, -122.2712, 5),
  ('San Jose to Palo Alto', 'San Jose', 37.3382, -121.8863, 'Palo Alto', 37.4419, -122.143, 6),
  ('San Diego to La Jolla', 'San Diego', 32.7157, -117.1611, 'La Jolla', 32.8328, -117.2713, 7)
) AS v(name, origin_name, origin_lat, origin_lng, destination_name, destination_lat, destination_lng, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.fleet_routes);
