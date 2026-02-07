-- Create early_access_requests table
CREATE TABLE IF NOT EXISTS early_access_requests (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMP DEFAULT NOW(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'))
);

-- Enable RLS
ALTER TABLE early_access_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can access
CREATE POLICY "Service role only" ON early_access_requests
  FOR ALL
  USING (auth.role() = 'service_role');

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_early_access_requests_created_at ON early_access_requests(created_at DESC);
