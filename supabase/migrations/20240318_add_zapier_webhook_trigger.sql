-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;
-- Ensure net schema exists and has necessary permissions
CREATE SCHEMA IF NOT EXISTS net;
GRANT USAGE ON SCHEMA net TO postgres;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA net TO postgres;
-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS handle_booking_webhook_trigger ON bookings;
DROP FUNCTION IF EXISTS handle_booking_webhook_trigger_func();
-- Create the webhook trigger function
CREATE OR REPLACE FUNCTION handle_booking_webhook_trigger_func() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public,
    extensions AS $$
DECLARE webhook_url text;
payload jsonb;
response_status int;
response_content text;
BEGIN -- Log the start of the function
RAISE NOTICE 'Starting webhook trigger for booking ID: %',
NEW.id;
-- Get webhook URL from environment variable
webhook_url := COALESCE(
    current_setting('app.settings.zapier_webhook_url', true),
    'https://hooks.zapier.com/hooks/catch/15133381/2aa1g16/'
);
RAISE NOTICE 'Using webhook URL: %',
webhook_url;
-- Extract nested data from the details JSONB
payload = jsonb_build_object(
    'booking_id',
    NEW.id,
    'client_id',
    NEW.client_id,
    'cleaning_date',
    NEW.cleaning_date,
    'status',
    NEW.status,
    'payment_status',
    NEW.payment_status,
    'amount_paid',
    NEW.amount_paid,
    'package',
    NEW.details->>'package',
    'service_type',
    NEW.details->>'serviceType',
    'price',
    (NEW.details->>'price')::numeric,
    'client_email',
    NEW.details->>'client_email',
    'client_name',
    NEW.details->>'client_name',
    'client_phone',
    NEW.details->>'client_phone',
    'street',
    NEW.details->'address'->>'street',
    'city',
    NEW.details->'address'->>'city',
    'state',
    NEW.details->'address'->>'state',
    'zip_code',
    NEW.details->'address'->>'zipCode',
    'latitude',
    (NEW.details->'address'->'coordinates'->>'lat')::numeric,
    'longitude',
    (NEW.details->'address'->'coordinates'->>'lng')::numeric
);
-- Add room details if they exist
IF NEW.details->'rooms' IS NOT NULL THEN IF NEW.details->>'package' = 'blockCleaning' THEN payload = payload || jsonb_build_object(
    'cleaners',
    (NEW.details->'rooms'->>'cleaners')::integer,
    'hours',
    (NEW.details->'rooms'->>'hours')::integer
);
ELSE payload = payload || jsonb_build_object(
    'bedrooms',
    (NEW.details->'rooms'->>'bedrooms')::integer,
    'bathrooms',
    (NEW.details->'rooms'->>'bathrooms')::integer,
    'half_bathrooms',
    (NEW.details->'rooms'->>'halfBathrooms')::integer,
    'kitchens',
    (NEW.details->'rooms'->>'kitchens')::integer,
    'living_rooms',
    (NEW.details->'rooms'->>'livingRooms')::integer,
    'bonus_rooms',
    (NEW.details->'rooms'->>'bonusRooms')::integer,
    'laundry_rooms',
    (NEW.details->'rooms'->>'laundryRooms')::integer,
    'offices',
    (NEW.details->'rooms'->>'offices')::integer,
    'sqft',
    (NEW.details->'rooms'->>'sqft')::integer,
    'dirty_scale',
    (NEW.details->'rooms'->>'dirtyScale')::integer
);
END IF;
END IF;
RAISE NOTICE 'Sending payload: %',
payload::text;
-- Send webhook using extensions.http
SELECT status_code,
    content::text INTO response_status,
    response_content
FROM extensions.http(
        (
            'POST',
            webhook_url,
            ARRAY [http_header('Content-Type', 'application/json')],
            'timeout',
            '10',
            'body',
            payload::text
        )::extensions.http_request
    );
-- Log the response
RAISE NOTICE 'Webhook response status: %, content: %',
response_status,
response_content;
-- Check response status
IF response_status >= 200
AND response_status < 300 THEN RAISE NOTICE 'Webhook sent successfully to % with payload: %',
webhook_url,
payload::text;
ELSE RAISE WARNING 'Webhook failed with status %: %',
response_status,
payload::text;
END IF;
RETURN NEW;
EXCEPTION
WHEN OTHERS THEN -- Log error but don't prevent the insert/update
RAISE WARNING 'Error sending webhook: % - %',
SQLERRM,
payload::text;
RETURN NEW;
END;
$$;
-- Set the owner of the function to postgres
ALTER FUNCTION handle_booking_webhook_trigger_func OWNER TO postgres;
-- Create the trigger
CREATE TRIGGER handle_booking_webhook_trigger
AFTER
INSERT ON bookings FOR EACH ROW EXECUTE FUNCTION handle_booking_webhook_trigger_func();
-- Add comment to describe the trigger
COMMENT ON FUNCTION handle_booking_webhook_trigger_func IS 'Formats booking data and sends it to Zapier webhook when a new booking is created.';