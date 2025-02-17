-- Update user's role metadata
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
        raw_user_meta_data,
        '{role}',
        '"staff"'
    )
WHERE email = 'brickev@hotmail.com';
-- Create profile if it doesn't exist
INSERT INTO profiles (id, email, name, phone, role)
VALUES (
        'c3dce157-e80f-44cf-aa3a-9a1da5a4b5e2',
        'brickev@hotmail.com',
        'David Banner',
        '2089998981',
        'staff'
    ) ON CONFLICT (id) DO
UPDATE
SET role = 'staff';
-- Add to staff table
INSERT INTO staff (user_id, email, name, phone, role)
VALUES (
        'c3dce157-e80f-44cf-aa3a-9a1da5a4b5e2',
        'brickev@hotmail.com',
        'David Banner',
        '2089998981',
        'cleaner'
    ) ON CONFLICT (email) DO NOTHING;