-- Migration: Add category and type columns to payment_requests table, and created_by for tracking creator.
ALTER TABLE public.payment_requests
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'Rent',
  ADD COLUMN IF NOT EXISTS type text DEFAULT 'Collect',
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
