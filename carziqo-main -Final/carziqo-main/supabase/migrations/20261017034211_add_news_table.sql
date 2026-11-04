/*
# Add news/announcements table

## Overview
Creates a table for platform news and announcements that can be displayed
on the About page and in the app.

## New table: news
- id (uuid, primary key)
- title (text)
- content (text)
- image_url (text, optional)
- category (text: update, promotion, announcement, maintenance)
- is_published (boolean, default false)
- published_at (timestamptz)
- created_at (timestamptz)

## Security
- RLS enabled
- SELECT: anyone (anon + authenticated) can read published news
- INSERT/UPDATE/DELETE: admin only (via is_admin())

## Seed data
- Adds 3 sample news articles
*/

CREATE TABLE IF NOT EXISTS public.news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  image_url text,
  category text NOT NULL DEFAULT 'announcement' CHECK (category IN ('update', 'promotion', 'announcement', 'maintenance')),
  is_published boolean NOT NULL DEFAULT true,
  published_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_published_news" ON public.news;
CREATE POLICY "select_published_news" ON public.news
  FOR SELECT TO anon, authenticated
  USING (is_published = true OR public.is_admin());

DROP POLICY IF EXISTS "admin_insert_news" ON public.news;
CREATE POLICY "admin_insert_news" ON public.news
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_update_news" ON public.news;
CREATE POLICY "admin_update_news" ON public.news
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_news" ON public.news;
CREATE POLICY "admin_delete_news" ON public.news
  FOR DELETE TO authenticated USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_news_published ON public.news(is_published, published_at DESC);

-- Seed sample news
INSERT INTO public.news (title, content, category, is_published) VALUES
  ('Carziqo.Ltd Launches New Premium Car Fleet', 'We are excited to announce the addition of 5 new premium vehicles to our rental fleet. Users can now invest in luxury cars with up to 5% daily returns. Explore the Car Store to see the latest additions.', 'update', true),
  ('Special Promotion: 20% Bonus on First Investment', 'For a limited time, all new users who make their first investment of 500 PHP or more will receive a 20% bonus added directly to their wallet balance. This promotion is valid until the end of the month.', 'promotion', true),
  ('Daily Check-in Rewards Now Available', 'You can now earn daily rewards by checking in every day. Each check-in gives you 5 PHP added to your wallet and 1 carbon point. Collect carbon points to redeem exclusive gifts and coupons in the Rewards section.', 'announcement', true)
ON CONFLICT DO NOTHING;
