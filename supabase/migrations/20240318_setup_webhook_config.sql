-- Enable the http extension if not already enabled
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;
-- Set the Zapier webhook URL at the database level
ALTER DATABASE postgres
SET "app.settings.zapier_webhook_url" = 'https://hooks.zapier.com/hooks/catch/15133381/2aa1g16/';
-- Verify the setting and test the webhook
DO $$
DECLARE webhook_url text;
test_response int;
test_content text;
BEGIN -- Get the configured webhook URL
webhook_url := current_setting('app.settings.zapier_webhook_url', true);
-- Verify the setting
IF webhook_url IS NULL THEN RAISE EXCEPTION 'Webhook URL setting is not configured';
END IF;
RAISE NOTICE 'Webhook URL configured: %',
webhook_url;
-- Send a test payload
SELECT status_code,
    content::text INTO test_response,
    test_content
FROM extensions.http(
        (
            'POST',
            webhook_url,
            ARRAY [http_header('Content-Type', 'application/json')],
            'timeout',
            '10',
            'body',
            '{"test": true, "message": "Testing webhook configuration"}'
        )::extensions.http_request
    );
-- Check the response
IF test_response >= 200
AND test_response < 300 THEN RAISE NOTICE 'Test webhook successful. Status: %, Response: %',
test_response,
test_content;
ELSE RAISE WARNING 'Test webhook failed. Status: %, Response: %',
test_response,
test_content;
END IF;
END $$;