/*
# Add More Cars (500-100000 PHP) & Adjust Carbon Point Costs

## Overview
1. Adds 10 new cars spanning the full price range from 500 PHP to 100,000 PHP.
2. Updates gift list carbon costs to reflect the new 1 carbon = 0.01 PHP rate.
3. Updates coupon carbon costs to reflect the new rate.

## New Cars Added
- Toyota Vios (500 PHP, 1.20%/day)
- Hyundai Accent (1000 PHP, 1.50%/day)
- Mitsubishi Xpander (2500 PHP, 1.80%/day)
- Ford Ranger (5000 PHP, 2.20%/day)
- Toyota Fortuner (10000 PHP, 2.50%/day)
- BMW 3 Series (20000 PHP, 3.00%/day)
- Mercedes C-Class (35000 PHP, 3.50%/day)
- Audi Q7 (50000 PHP, 4.00%/day)
- Porsche Cayenne (75000 PHP, 5.00%/day)
- Lamborghini Huracan (100000 PHP, 6.50%/day)
*/

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
-- Update gift list carbon costs for new rate (1 carbon = 0.01 PHP)
-- ============================================================
UPDATE public.gift_list SET carbon_cost = 500 WHERE name = '5 PHP Cash Reward';
UPDATE public.gift_list SET carbon_cost = 1000 WHERE name = '10 PHP Cash Reward';
UPDATE public.gift_list SET carbon_cost = 2500 WHERE name = '25 PHP Cash Reward';
UPDATE public.gift_list SET carbon_cost = 5000 WHERE name = '50 PHP Cash Reward';

-- ============================================================
-- Update coupon carbon costs for new rate
-- ============================================================
UPDATE public.coupons SET carbon_cost = 1000 WHERE code = 'WELCOME10';
UPDATE public.coupons SET carbon_cost = 2500 WHERE code = 'CARBON25';
UPDATE public.coupons SET carbon_cost = 5000 WHERE code = 'ECO50';

-- ============================================================
-- Add new higher-value gifts for users who accumulate carbon
-- ============================================================
INSERT INTO public.gift_list (name, description, carbon_cost, cash_value, stock)
SELECT '100 PHP Cash Reward', 'Convert your carbon points to cash', 10000, 100.00, 100
WHERE NOT EXISTS (SELECT 1 FROM public.gift_list WHERE name = '100 PHP Cash Reward');

INSERT INTO public.gift_list (name, description, carbon_cost, cash_value, stock)
SELECT '500 PHP Cash Reward', 'Convert your carbon points to cash', 50000, 500.00, 50
WHERE NOT EXISTS (SELECT 1 FROM public.gift_list WHERE name = '500 PHP Cash Reward');
