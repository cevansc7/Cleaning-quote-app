-- Check current staff record
SELECT *
FROM staff
WHERE user_id = '8636fd86-ca75-457b-ae6b-0d344f6fbfa4'
    OR email = 'brickev@hotmail.com';
-- Get user metadata
SELECT id,
    email,
    raw_user_meta_data
FROM auth.users
WHERE id = '8636fd86-ca75-457b-ae6b-0d344f6fbfa4';
-- Get profile data
SELECT *
FROM profiles
WHERE id = '8636fd86-ca75-457b-ae6b-0d344f6fbfa4';
-- Insert or update staff record
INSERT INTO staff (
        user_id,
        email,
        name,
        phone,
        role,
        status
    )
SELECT p.id,
    p.email,
    p.name,
    p.phone,
    'cleaner',
    'active'
FROM profiles p
WHERE p.id = '8636fd86-ca75-457b-ae6b-0d344f6fbfa4'
    AND p.role = 'staff' ON CONFLICT (email) DO
UPDATE
SET name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    status = 'active',
    updated_at = NOW();
-- Verify all records
SELECT 'auth.users' as source,
    id,
    email,
    raw_user_meta_data->>'role' as role,
    raw_user_meta_data->>'name' as name,
    raw_user_meta_data->>'phone' as phone
FROM auth.users
WHERE id = '8636fd86-ca75-457b-ae6b-0d344f6fbfa4'
UNION ALL
SELECT 'profiles' as source,
    id,
    email,
    role,
    name,
    phone
FROM profiles
WHERE id = '8636fd86-ca75-457b-ae6b-0d344f6fbfa4'
UNION ALL
SELECT 'staff' as source,
    user_id as id,
    email,
    role,
    name,
    phone
FROM staff
WHERE user_id = '8636fd86-ca75-457b-ae6b-0d344f6fbfa4';