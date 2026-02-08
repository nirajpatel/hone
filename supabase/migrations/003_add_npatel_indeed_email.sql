-- Add your-email@example.com to allowed_emails table
INSERT INTO allowed_emails (email, created_by)
VALUES ('your-email@example.com', 'migration')
ON CONFLICT (email) DO NOTHING;
