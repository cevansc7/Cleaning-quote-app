-- Verify complete deletion of user data
WITH verification AS (
    SELECT 'auth.users' as table_name,
        COUNT(*) as remaining_records
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
    SELECT 'quotes',
        COUNT(*)
    FROM quotes
    WHERE client_id = '0b2cb9af-37f1-4eb8-a12a-d102848eba84'
    UNION ALL
    SELECT 'reviews',
        COUNT(*)
    FROM reviews
    WHERE client_id = '0b2cb9af-37f1-4eb8-a12a-d102848eba84'
    UNION ALL
    SELECT 'payments',
        COUNT(*)
    FROM payments
    WHERE booking_id IN (
            SELECT id
            FROM bookings
            WHERE client_id = '0b2cb9af-37f1-4eb8-a12a-d102848eba84'
        )
    UNION ALL
    SELECT 'cleaning_notes',
        COUNT(*)
    FROM cleaning_notes
    WHERE staff_id = '0b2cb9af-37f1-4eb8-a12a-d102848eba84'
    UNION ALL
    SELECT 'staff_availability',
        COUNT(*)
    FROM staff_availability
    WHERE staff_id = '0b2cb9af-37f1-4eb8-a12a-d102848eba84'
)
SELECT *
FROM verification
WHERE remaining_records > 0;