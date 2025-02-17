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
WHERE id = '8636fd86-ca75-457b-ae6b-0d344f6fbfa4';
-- Update profile
UPDATE profiles
SET name = 'David Banner',
    phone = '2089998981'
WHERE id = '8636fd86-ca75-457b-ae6b-0d344f6fbfa4';
-- Update staff record
INSERT INTO staff (user_id, email, name, phone, role, status)
VALUES (
        '8636fd86-ca75-457b-ae6b-0d344f6fbfa4',
        'brickev@hotmail.com',
        'David Banner',
        '2089998981',
        'cleaner',
        'active'
    ) ON CONFLICT (email) DO
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