-- Check if any data remains for the deleted user
WITH checks AS (
    SELECT 'auth.users' as table_name,
        COUNT(*) as count
    FROM auth.users
    WHERE id = 'c3dce157-e80f-44cf-aa3a-9a1da5a4b5e2'
    UNION ALL
    SELECT 'profiles' as table_name,
        COUNT(*) as count
    FROM profiles
    WHERE id = 'c3dce157-e80f-44cf-aa3a-9a1da5a4b5e2'
    UNION ALL
    SELECT 'staff' as table_name,
        COUNT(*) as count
    FROM staff
    WHERE user_id = 'c3dce157-e80f-44cf-aa3a-9a1da5a4b5e2'
    UNION ALL
    SELECT 'bookings' as table_name,
        COUNT(*) as count
    FROM bookings
    WHERE client_id = 'c3dce157-e80f-44cf-aa3a-9a1da5a4b5e2'
    UNION ALL
    SELECT 'notifications' as table_name,
        COUNT(*) as count
    FROM notifications
    WHERE recipient_id = 'c3dce157-e80f-44cf-aa3a-9a1da5a4b5e2'
)
SELECT *
FROM checks
WHERE count > 0;