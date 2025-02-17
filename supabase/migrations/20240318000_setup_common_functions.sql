-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION handle_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = TIMEZONE('utc'::text, NOW());
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;