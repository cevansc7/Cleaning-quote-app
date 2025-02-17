-- Update adrievans0121@gmail.com
UPDATE auth.users
SET raw_user_meta_data = jsonb_build_object(
        'role',
        COALESCE(raw_user_meta_data->>'role', 'client'),
        'name',
        'Adrian Evans',
        'phone',
        '2081234567'
    )
WHERE email = 'adrievans0121@gmail.com';
-- Update brickev@hotmail.com (already has metadata, keeping existing role)
UPDATE auth.users
SET raw_user_meta_data = jsonb_build_object(
        'role',
        COALESCE(raw_user_meta_data->>'role', 'staff'),
        'name',
        'David Banner',
        'phone',
        '2089998981'
    )
WHERE email = 'brickev@hotmail.com';
-- Update t6.resilient.t8@gmail.com
UPDATE auth.users
SET raw_user_meta_data = jsonb_build_object(
        'role',
        COALESCE(raw_user_meta_data->>'role', 'client'),
        'name',
        'Resilient Cleaning',
        'phone',
        '2085555555'
    )
WHERE email = 't6.resilient.t8@gmail.com';
-- Update sophisticatedcleanersca@gmail.com
UPDATE auth.users
SET raw_user_meta_data = jsonb_build_object(
        'role',
        COALESCE(raw_user_meta_data->>'role', 'client'),
        'name',
        'Sophisticated Cleaners',
        'phone',
        '2084444444'
    )
WHERE email = 'sophisticatedcleanersca@gmail.com';
-- Update cevansc7@gmail.com (admin user)
UPDATE auth.users
SET raw_user_meta_data = jsonb_build_object(
        'role',
        'admin',
        'name',
        'Sophia Evans',
        'phone',
        '2083333333'
    )
WHERE email = 'cevansc7@gmail.com';
-- Sync profiles table with updated metadata
INSERT INTO profiles (id, email, name, phone, role)
SELECT id,
    email,
    raw_user_meta_data->>'name',
    raw_user_meta_data->>'phone',
    raw_user_meta_data->>'role'
FROM auth.users ON CONFLICT (id) DO
UPDATE
SET name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    role = EXCLUDED.role,
    updated_at = NOW();
-- Sync staff table for any staff members
INSERT INTO staff (user_id, email, name, phone, role, status)
SELECT id,
    email,
    raw_user_meta_data->>'name',
    raw_user_meta_data->>'phone',
    'cleaner',
    'active'
FROM auth.users
WHERE raw_user_meta_data->>'role' = 'staff' ON CONFLICT (email) DO
UPDATE
SET name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    status = 'active',
    updated_at = NOW();
-- Verify the updates
SELECT 'auth.users' as source,
    email,
    raw_user_meta_data->>'role' as role,
    raw_user_meta_data->>'name' as name,
    raw_user_meta_data->>'phone' as phone
FROM auth.users
UNION ALL
SELECT 'profiles' as source,
    email,
    role,
    name,
    phone
FROM profiles
UNION ALL
SELECT 'staff' as source,
    email,
    role,
    name,
    phone
FROM staff
ORDER BY email,
    source;