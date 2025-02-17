-- First, drop any existing function with this name
DROP FUNCTION IF EXISTS handle_user_deletion(target_user_id UUID);
-- Create the RPC function
CREATE OR REPLACE FUNCTION handle_user_deletion(target_user_id UUID) RETURNS json LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE result json;
BEGIN -- Check if the user exists
IF NOT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = target_user_id
) THEN RETURN json_build_object('success', false, 'error', 'User not found');
END IF;
-- Check if the user has permission to delete
IF NOT (
    -- User can delete their own account
    auth.uid() = target_user_id
    OR -- Admin can delete any account
    (
        SELECT role
        FROM profiles
        WHERE id = auth.uid()
    ) = 'admin'
) THEN RETURN json_build_object('success', false, 'error', 'Permission denied');
END IF;
BEGIN -- Delete quotes first (no cascade)
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
result := json_build_object('success', true);
EXCEPTION
WHEN OTHERS THEN result := json_build_object(
    'success',
    false,
    'error',
    SQLERRM,
    'detail',
    SQLSTATE
);
END;
RETURN result;
END;
$$;
-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION handle_user_deletion TO authenticated;
-- Add comment to describe the function
COMMENT ON FUNCTION handle_user_deletion IS 'Safely deletes a user and all their related data. Can only be executed by the user themselves or an admin.';