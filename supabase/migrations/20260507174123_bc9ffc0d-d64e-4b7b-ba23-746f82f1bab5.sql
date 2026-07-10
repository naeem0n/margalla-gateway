-- Add is_approved column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_approved boolean NOT NULL DEFAULT false;

-- Backfill: existing residents stay disabled until admin approves; admins/staff auto-approved
UPDATE public.profiles p
SET is_approved = true
WHERE EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = p.id AND ur.role IN ('admin','staff')
);

-- Allow admins to view/update approval (policies already cover admin select/update on profiles)
-- Ensure handle_new_user keeps is_approved = false for new residents (default already false)
