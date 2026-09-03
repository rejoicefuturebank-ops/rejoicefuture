-- Run this in the Supabase SQL editor before deploying the public contact endpoint.
-- Allows support_tickets / support_messages to exist without a signed-in user.

ALTER TABLE support_tickets
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS is_guest BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS guest_name TEXT,
  ADD COLUMN IF NOT EXISTS guest_email TEXT;

ALTER TABLE support_messages
  ALTER COLUMN sender_id DROP NOT NULL;

-- Optional but recommended: index for looking up a guest's tickets by email later
CREATE INDEX IF NOT EXISTS idx_support_tickets_guest_email
  ON support_tickets (guest_email)
  WHERE is_guest = TRUE;