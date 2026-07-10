-- Notification templates (admin-editable)
CREATE TABLE public.notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  channel text NOT NULL CHECK (channel IN ('whatsapp','sms','both')),
  subject text,
  body text NOT NULL,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_templates TO authenticated;
GRANT ALL ON public.notification_templates TO service_role;

ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/staff read templates" ON public.notification_templates
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'staff'));

CREATE POLICY "Admin write templates" ON public.notification_templates
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'))
  WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_notification_templates_updated_at
BEFORE UPDATE ON public.notification_templates
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Notification delivery logs
CREATE TABLE public.notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL CHECK (channel IN ('whatsapp','sms')),
  template_key text,
  recipient_phone text NOT NULL,
  recipient_user_id uuid,
  subject text,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','delivered','read')),
  provider text,
  provider_message_id text,
  error_message text,
  triggered_by uuid,
  trigger_type text,
  reference_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE INDEX idx_notif_logs_recipient ON public.notification_logs(recipient_user_id, created_at DESC);
CREATE INDEX idx_notif_logs_status ON public.notification_logs(status, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.notification_logs TO authenticated;
GRANT ALL ON public.notification_logs TO service_role;

ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/staff view all logs" ON public.notification_logs
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'staff'));

CREATE POLICY "Residents view own logs" ON public.notification_logs
  FOR SELECT TO authenticated
  USING (recipient_user_id = auth.uid());

CREATE POLICY "Admin/staff insert logs" ON public.notification_logs
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'staff'));

CREATE POLICY "Admin/staff update logs" ON public.notification_logs
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'staff'));

-- Seed common templates
INSERT INTO public.notification_templates (key, name, channel, body, variables, description) VALUES
  ('rent_reminder', 'Rent Reminder', 'both', 'Dear {{name}}, your rent of PKR {{amount}} for apartment {{apartment}} is due on {{due_date}}. Please pay to avoid late fees. — Margalla Gateway', '["name","amount","apartment","due_date"]'::jsonb, 'Sent before rent due date'),
  ('payment_confirmation', 'Payment Confirmation', 'both', 'Dear {{name}}, we have received your payment of PKR {{amount}}. Receipt: {{reference}}. Thank you. — Margalla Gateway', '["name","amount","reference"]'::jsonb, 'Sent after payment received'),
  ('complaint_update', 'Complaint Status Update', 'whatsapp', 'Hi {{name}}, your complaint "{{title}}" is now {{status}}. {{resolution}}', '["name","title","status","resolution"]'::jsonb, 'Sent when complaint status changes'),
  ('visitor_approval', 'Visitor Approval Needed', 'both', 'Visitor {{visitor_name}} (CNIC {{cnic}}) is at the gate for apartment {{apartment}}. Reply YES to approve.', '["visitor_name","cnic","apartment"]'::jsonb, 'Sent when a visitor arrives'),
  ('announcement', 'General Announcement', 'whatsapp', '📢 {{title}}\n\n{{body}}\n\n— Margalla Gateway Management', '["title","body"]'::jsonb, 'Building-wide announcements'),
  ('emergency', 'Emergency Notice', 'both', '🚨 URGENT: {{title}}\n{{body}}\nPlease follow building safety procedures.', '["title","body"]'::jsonb, 'High-priority emergency alerts'),
  ('maintenance_update', 'Maintenance Update', 'whatsapp', 'Maintenance update for {{apartment}}: {{message}}. ETA: {{eta}}.', '["apartment","message","eta"]'::jsonb, 'Maintenance progress updates'),
  ('otp_verification', 'OTP Verification', 'sms', 'Your Margalla Gateway verification code is {{code}}. Valid for 5 minutes. Do not share.', '["code"]'::jsonb, 'One-time password for SMS verification');