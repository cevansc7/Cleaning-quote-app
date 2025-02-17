-- Drop the existing function
DROP FUNCTION IF EXISTS delete_user(UUID);
-- Create a function to safely delete a user and all their data
CREATE OR REPLACE FUNCTION delete_user(target_user_id UUID) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$ BEGIN -- Delete quotes first (no cascade)
DELETE FROM quotes
WHERE client_id = target_user_id;
-- Delete staff availability (no cascade)
DELETE FROM staff_availability
WHERE staff_id = target_user_id;
-- Delete cleaning notes (no cascade)
DELETE FROM cleaning_notes
WHERE staff_id = target_user_id;
-- Delete reviews (no cascade)
DELETE FROM reviews
WHERE client_id = target_user_id;
-- Delete payments (no cascade)
DELETE FROM payments
WHERE booking_id IN (
        SELECT id
        FROM bookings
        WHERE client_id = target_user_id
    );
-- Delete notifications (no cascade)
DELETE FROM notifications
WHERE recipient_id = target_user_id;
-- Delete bookings (will cascade to staff_schedules, checklists, and related notifications)
DELETE FROM bookings
WHERE client_id = target_user_id;
-- Delete from staff (will cascade to staff_schedules)
DELETE FROM staff
WHERE user_id = target_user_id;
-- Delete from profiles (will cascade)
DELETE FROM profiles
WHERE id = target_user_id;
-- Finally delete the user (will cascade to auth tables)
DELETE FROM auth.users
WHERE id = target_user_id;
END;
$$;
-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_user TO authenticated;
-- Test the deletion
SELECT delete_user('0b2cb9af-37f1-4eb8-a12a-d102848eba84');