-- Verify all changes
SELECT 'auth.users' as table_name,
    id,
    email,
    raw_user_meta_data->>'role' as role
FROM auth.users
WHERE email = 'brickev@hotmail.com'
UNION ALL
SELECT 'profiles' as table_name,
    id,
    email,
    role
FROM profiles
WHERE email = 'brickev@hotmail.com'
UNION ALL
SELECT 'staff' as table_name,
    user_id as id,
    email,
    role
FROM staff
WHERE email = 'brickev@hotmail.com';