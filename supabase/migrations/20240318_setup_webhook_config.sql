-- Enable the http extension if not already enabled
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;
-- Set the Zapier webhook URL at the database level
ALTER DATABASE postgres
SET "app.settings.zapier_webhook_url" = 'YOUR_ZAPIER_WEBHOOK_URL';
-- Verify the setting
DO $$ BEGIN ASSERT current_setting('app.settings.zapier_webhook_url', true) IS NOT NULL,
'Webhook URL setting is not configured';
RAISE NOTICE 'Webhook URL configured successfully';
END $$;