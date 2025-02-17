-- Check profiles table
SELECT *
FROM profiles
WHERE email = 'brickev@hotmail.com';
-- Check staff table
SELECT *
FROM staff
WHERE email = 'brickev@hotmail.com';
-- Check auth.users to see role metadata
SELECT id,
    email,
    raw_user_meta_data
FROM auth.users
WHERE email = 'brickev@hotmail.com';