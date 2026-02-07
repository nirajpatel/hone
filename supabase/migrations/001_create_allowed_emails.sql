-- Create allowed_emails table
CREATE TABLE IF NOT EXISTS allowed_emails (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by TEXT
);

-- Enable RLS
ALTER TABLE allowed_emails ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can access
CREATE POLICY "Service role only" ON allowed_emails
  FOR ALL
  USING (auth.role() = 'service_role');

-- Migrate all existing users from auth.users
INSERT INTO allowed_emails (email, created_at, created_by)
SELECT DISTINCT 
  email,
  NOW(),
  'migration'
FROM auth.users
WHERE email IS NOT NULL
ON CONFLICT (email) DO NOTHING;
