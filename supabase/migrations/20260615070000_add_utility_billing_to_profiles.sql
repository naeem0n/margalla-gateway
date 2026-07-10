-- Migration: Add utility units, fixed maintenance, outstanding balance, and last billing date to profiles table.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gas_units numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS water_units numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS electricity_units numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fixed_maintenance numeric DEFAULT 5000,
  ADD COLUMN IF NOT EXISTS outstanding_balance numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_billing_date timestamptz;
