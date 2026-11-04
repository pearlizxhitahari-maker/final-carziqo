/*
# Car Rental Platform — Seed Data

## Overview
Seeds cars, coupons, gifts, news articles, and fleet routes.
All inserts are idempotent (use WHERE NOT EXISTS or ON CONFLICT).
*/

-- ============================================================
-- CARS
-- ============================================================
INSERT INTO public.cars (car_name, image_url, price, daily_return_rate, status, is_free) VALUES
('Aston Martin DB11', 'https://images.pexels.com/photos/6239334/pexels-photo-6239334.jpeg?auto=compress&cs=tinysrgb&w=800', 1600.00, 3.50, 'active', false),
('Ferrari 488 GTB', 'https://images.pexels.com/photos/29126220/pexels-photo-29126220.jpeg?auto=compress&cs=tinysrgb&w=800', 1800.00, 3.80, 'active', false),
('McLaren 720S', 'https://images.pexels.com/photos/9452144/pexels-photo-9452144.jpeg?auto=compress&cs=tinysrgb&w=800', 2200.00, 4.00, 'active', false),
('Bentley Continental GT', 'https://images.pexels.com/photos/18776099/pexels-photo-18776099.jpeg?auto=compress&cs=tinysrgb&w=800', 2500.00, 4.20, 'active', false),
('Rolls Royce Ghost', 'https://images.pexels.com/photos/3764986/pexels-photo-3764986.jpeg?auto=compress&cs=tinysrgb&w=800', 3500.00, 4.80, 'active', false),
('Bugatti Chiron', 'https://images.pexels.com/photos/29964453/pexels-photo-29964453.jpeg?auto=compress&cs=tinysrgb&w=800', 5000.00, 6.00, 'active', false),
('Toyota Corolla — FREE Starter', 'https://images.pexels.com/photos/170811/pexels-photo-170811.jpeg?auto=compress&cs=tinysrgb&w=800', 0.00, 1.00, 'active', true)
ON CONFLICT DO NOTHING;

INSERT INTO public.cars (car_name, image_url, price, daily_return_rate, status, is_free)
SELECT * FROM (VALUES
  ('Toyota Vios', 'https://images.pexels.com/photos/16389348/pexels-photo-16389348.jpeg?auto=compress&cs=tinysrgb&w=800', 500.00::numeric, 1.20::numeric, 'active'::text, false),
  ('Hyundai Accent', 'https://images.pexels.com/photos/16389348/pexels-photo-16389348.jpeg?auto=compress&cs=tinysrgb&w=800', 1000.00::numeric, 1.50::numeric, 'active'::text, false),
  ('Mitsubishi Xpander', 'https://images.pexels.com/photos/170811/pexels-photo-170811.jpeg?auto=compress&cs=tinysrgb&w=800', 2500.00::numeric, 1.80::numeric, 'active'::text, false),
  ('Ford Ranger', 'https://images.pexels.com/photos/16389348/pexels-photo-16389348.jpeg?auto=compress&cs=tinysrgb&w=800', 5000.00::numeric, 2.20::numeric, 'active'::text, false),
  ('Toyota Fortuner', 'https://images.pexels.com/photos/170811/pexels-photo-170811.jpeg?auto=compress&cs=tinysrgb&w=800', 10000.00::numeric, 2.50::numeric, 'active'::text, false),
  ('BMW 3 Series', 'https://images.pexels.com/photos/3802510/pexels-photo-3802510.jpeg?auto=compress&cs=tinysrgb&w=800', 20000.00::numeric, 3.00::numeric, 'active'::text, false),
  ('Mercedes C-Class', 'https://images.pexels.com/photos/3729464/pexels-photo-3729464.jpeg?auto=compress&cs=tinysrgb&w=800', 35000.00::numeric, 3.50::numeric, 'active'::text, false),
  ('Audi Q7', 'https://images.pexels.com/photos/2676551/pexels-photo-2676551.jpeg?auto=compress&cs=tinysrgb&w=800', 50000.00::numeric, 4.00::numeric, 'active'::text, false),
  ('Porsche Cayenne', 'https://images.pexels.com/photos/3786091/pexels-photo-3786091.jpeg?auto=compress&cs=tinysrgb&w=800', 75000.00::numeric, 5.00::numeric, 'active'::text, false),
  ('Lamborghini Huracan', 'https://images.pexels.com/photos/3786091/pexels-photo-3786091.jpeg?auto=compress&cs=tinysrgb&w=800', 100000.00::numeric, 6.50::numeric, 'active'::text, false)
) AS v(name, img, price, rate, status, is_free)
WHERE NOT EXISTS (SELECT 1 FROM public.cars WHERE car_name = v.name);

-- ============================================================
-- COUPONS (with adjusted carbon costs)
-- ============================================================
INSERT INTO public.coupons (code, title, description, discount_value, carbon_cost, max_claims)
SELECT 'WELCOME10', 'Welcome Bonus', '10 PHP discount on your next investment', 10.00, 1000, 1000
WHERE NOT EXISTS (SELECT 1 FROM public.coupons WHERE code = 'WELCOME10');

INSERT INTO public.coupons (code, title, description, discount_value, carbon_cost, max_claims)
SELECT 'CARBON25', 'Carbon Saver', '25 PHP bonus to your wallet', 25.00, 2500, 500
WHERE NOT EXISTS (SELECT 1 FROM public.coupons WHERE code = 'CARBON25');

INSERT INTO public.coupons (code, title, description, discount_value, carbon_cost, max_claims)
SELECT 'ECO50', 'Eco Warrior', '50 PHP bonus to your wallet', 50.00, 5000, 200
WHERE NOT EXISTS (SELECT 1 FROM public.coupons WHERE code = 'ECO50');

-- ============================================================
-- GIFT LIST (with adjusted carbon costs)
-- ============================================================
INSERT INTO public.gift_list (name, description, carbon_cost, cash_value, stock)
SELECT '5 PHP Cash Reward', 'Convert your carbon points to cash', 500, 5.00, 1000
WHERE NOT EXISTS (SELECT 1 FROM public.gift_list WHERE name = '5 PHP Cash Reward');

INSERT INTO public.gift_list (name, description, carbon_cost, cash_value, stock)
SELECT '10 PHP Cash Reward', 'Convert your carbon points to cash', 1000, 10.00, 1000
WHERE NOT EXISTS (SELECT 1 FROM public.gift_list WHERE name = '10 PHP Cash Reward');

INSERT INTO public.gift_list (name, description, carbon_cost, cash_value, stock)
SELECT '25 PHP Cash Reward', 'Convert your carbon points to cash', 2500, 25.00, 500
WHERE NOT EXISTS (SELECT 1 FROM public.gift_list WHERE name = '25 PHP Cash Reward');

INSERT INTO public.gift_list (name, description, carbon_cost, cash_value, stock)
SELECT '50 PHP Cash Reward', 'Convert your carbon points to cash', 5000, 50.00, 200
WHERE NOT EXISTS (SELECT 1 FROM public.gift_list WHERE name = '50 PHP Cash Reward');

INSERT INTO public.gift_list (name, description, carbon_cost, cash_value, stock)
SELECT '100 PHP Cash Reward', 'Convert your carbon points to cash', 10000, 100.00, 100
WHERE NOT EXISTS (SELECT 1 FROM public.gift_list WHERE name = '100 PHP Cash Reward');

INSERT INTO public.gift_list (name, description, carbon_cost, cash_value, stock)
SELECT '500 PHP Cash Reward', 'Convert your carbon points to cash', 50000, 500.00, 50
WHERE NOT EXISTS (SELECT 1 FROM public.gift_list WHERE name = '500 PHP Cash Reward');

-- ============================================================
-- NEWS
-- ============================================================
INSERT INTO public.news (title, content, category, is_published) VALUES
  ('Carziqo.Ltd Launches New Premium Car Fleet', 'We are excited to announce the addition of 5 new premium vehicles to our rental fleet. Users can now invest in luxury cars with up to 5% daily returns. Explore the Car Store to see the latest additions.', 'update', true),
  ('Special Promotion: 20% Bonus on First Investment', 'For a limited time, all new users who make their first investment of 500 PHP or more will receive a 20% bonus added directly to their wallet balance. This promotion is valid until the end of the month.', 'promotion', true),
  ('Daily Check-in Rewards Now Available', 'You can now earn daily rewards by checking in every day. Each check-in gives you 5 PHP added to your wallet and 1 carbon point. Collect carbon points to redeem exclusive gifts and coupons in the Rewards section.', 'announcement', true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- FLEET ROUTES
-- ============================================================
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