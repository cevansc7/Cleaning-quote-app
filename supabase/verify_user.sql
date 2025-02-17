-- Check user verification status
SELECT id,
    email,
    email_confirmed_at,
    raw_user_meta_data
FROM auth.users
WHERE email = 'brickev@hotmail.com';
-- Update user verification if needed
UPDATE auth.users
SET email_confirmed_at = NOW(),
    raw_user_meta_data = jsonb_set(
        COALESCE(raw_user_meta_data, '{}'::jsonb),
        '{role}',
        '"staff"'
    )
WHERE email = 'brickev@hotmail.com'
    AND email_confirmed_at IS NULL;
-- Ensure profile exists
INSERT INTO profiles (id, email, name, phone, role)
SELECT id,
    email,
    raw_user_meta_data->>'name',
    raw_user_meta_data->>'phone',
    COALESCE(raw_user_meta_data->>'role', 'client')
FROM auth.users
WHERE email = 'brickev@hotmail.com' ON CONFLICT (id) DO
UPDATE
SET name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    role = EXCLUDED.role;
-- Verify changes
SELECT 'auth.users' as source,
    id,
    email,
    email_confirmed_at,
    raw_user_meta_data->>'role' as role
FROM auth.users
WHERE email = 'brickev@hotmail.com'
UNION ALL
SELECT 'profiles' as source,
    id,
    email,
    created_at as confirmed_at,
    role
FROM profiles
WHERE email = 'brickev@hotmail.com';