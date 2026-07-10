-- Create parking_rules table
CREATE TABLE IF NOT EXISTS parking_rules (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE parking_rules ENABLE ROW LEVEL SECURITY;

-- Allow read access for everyone (anonymous & authenticated)
CREATE POLICY "Allow read access for everyone" ON parking_rules
  FOR SELECT USING (true);

-- Allow authenticated users (Admins/Staff) to write
CREATE POLICY "Allow write access for authenticated users only" ON parking_rules
  FOR ALL TO authenticated USING (true);

-- Seed default parking rules
INSERT INTO parking_rules (title, description) VALUES
('Standard Spot Allocation', 'Each apartment gets 1 free parking card.'),
('Extra Spot Charges', 'Additional cards: PKR 2,000/month each.'),
('Visitor Parking Limit', 'Visitor parking limited to 5 hours max in designated bays.')
ON CONFLICT DO NOTHING;
