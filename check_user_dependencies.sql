-- Check all tables referencing this user
WITH user_data AS (
    SELECT 'auth.users' as table_name,
        COUNT(*) as count
    FROM auth.users
    WHERE id = '0b2cb9af-37f1-4eb8-a12a-d102848eba84'
    UNION ALL
    SELECT 'profiles',
        COUNT(*)
    FROM profiles
    WHERE id = '0b2cb9af-37f1-4eb8-a12a-d102848eba84'
    UNION ALL
    SELECT 'staff',
        COUNT(*)
    FROM staff
    WHERE user_id = '0b2cb9af-37f1-4eb8-a12a-d102848eba84'
    UNION ALL
    SELECT 'bookings',
        COUNT(*)
    FROM bookings
    WHERE client_id = '0b2cb9af-37f1-4eb8-a12a-d102848eba84'
    UNION ALL
    SELECT 'notifications',
        COUNT(*)
    FROM notifications
    WHERE recipient_id = '0b2cb9af-37f1-4eb8-a12a-d102848eba84'
    UNION ALL
    SELECT 'staff_schedules',
        COUNT(*)
    FROM staff_schedules
    WHERE staff_id IN (
            SELECT id
            FROM staff
            WHERE user_id = '0b2cb9af-37f1-4eb8-a12a-d102848eba84'
        )
    UNION ALL
    SELECT 'reviews',
        COUNT(*)
    FROM reviews
    WHERE client_id = '0b2cb9af-37f1-4eb8-a12a-d102848eba84'
)
SELECT *
FROM user_data
WHERE count > 0;
-- Check all foreign key constraints in the database
SELECT tc.table_schema,
    tc.table_name,
    kcu.column_name,
    ccu.table_schema AS foreign_table_schema,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
    JOIN information_schema.referential_constraints AS rc ON tc.constraint_name = rc.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND (
        ccu.table_schema = 'auth'
        OR ccu.table_schema = 'public'
    )
ORDER BY tc.table_schema,
    tc.table_name;