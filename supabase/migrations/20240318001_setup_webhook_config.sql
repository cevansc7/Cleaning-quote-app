-- Create a configuration table for app settings
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);
-- Enable RLS on app_settings
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
-- Create policies for app_settings
CREATE POLICY "App settings are viewable by all authenticated users" ON app_settings FOR
SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Only admins can modify app settings" ON app_settings FOR ALL USING (auth.jwt()->>'role' = 'admin');
-- Insert the Zapier webhook URL
INSERT INTO app_settings (key, value, description)
VALUES (
        'zapier_webhook_url',
        'https://hooks.zapier.com/hooks/catch/15133381/2aa1g16/',
        'Webhook URL for Zapier integration'
    ) ON CONFLICT (key) DO
UPDATE
SET value = EXCLUDED.value,
    updated_at = NOW();
-- Create a function to get app settings
CREATE OR REPLACE FUNCTION get_app_setting(setting_key TEXT) RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$ BEGIN RETURN (
        SELECT value
        FROM app_settings
        WHERE key = setting_key
    );
END;
$$;
-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_app_setting TO authenticated;