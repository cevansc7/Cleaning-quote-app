-- Update user metadata with name and phone
UPDATE auth.users
SET raw_user_meta_data = jsonb_build_object(
        'role',
        'staff',
        'name',
        'David Banner',
        'phone',
        '2089998981'
    )
WHERE email = 'brickev@hotmail.com';
-- Update profile
UPDATE profiles
SET name = 'David Banner',
    phone = '2089998981',
    role = 'staff'
WHERE email = 'brickev@hotmail.com';
-- Update staff record
INSERT INTO staff (user_id, email, name, phone, role, status)
SELECT id,
    email,
    'David Banner',
    '2089998981',
    'cleaner',
    'active'
FROM auth.users
WHERE email = 'brickev@hotmail.com' ON CONFLICT (email) DO
UPDATE
SET name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    role = EXCLUDED.role,
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
WHERE email = 'brickev@hotmail.com'
UNION ALL
SELECT 'profiles' as source,
    id,
    email,
    role,
    name,
    phone
FROM profiles
WHERE email = 'brickev@hotmail.com'
UNION ALL
SELECT 'staff' as source,
    user_id as id,
    email,
    role,
    name,
    phone
FROM staff
WHERE email = 'brickev@hotmail.com';