-- First, drop any existing function with this name
DROP FUNCTION IF EXISTS handle_user_deletion(target_user_id UUID);
-- Create the RPC function
CREATE OR REPLACE FUNCTION handle_user_deletion(target_user_id UUID) RETURNS json LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public,
    auth AS $$
DECLARE result json;
v_role text;
BEGIN -- Get the role of the user attempting the deletion
SELECT role INTO v_role
FROM profiles
WHERE id = auth.uid();
-- Check if the user exists
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
    v_role = 'admin'
) THEN RETURN json_build_object('success', false, 'error', 'Permission denied');
END IF;
BEGIN -- Start with tables that have no dependencies
-- Delete quotes
DELETE FROM quotes
WHERE client_id = target_user_id;
-- Delete staff availability
DELETE FROM staff_availability
WHERE staff_id = target_user_id;
-- Delete cleaning notes
DELETE FROM cleaning_notes
WHERE staff_id = target_user_id;
-- Delete reviews
DELETE FROM reviews
WHERE client_id = target_user_id;
-- Delete payments for user's bookings
DELETE FROM payments
WHERE booking_id IN (
        SELECT id
        FROM bookings
        WHERE client_id = target_user_id
    );
-- Delete notifications
DELETE FROM notifications
WHERE recipient_id = target_user_id;
-- Delete bookings (this will cascade to staff_schedules)
DELETE FROM bookings
WHERE client_id = target_user_id;
-- Delete staff record (this will cascade to staff_schedules)
DELETE FROM staff
WHERE user_id = target_user_id;
-- Delete profile (this will cascade)
DELETE FROM profiles
WHERE id = target_user_id;
-- Finally delete the user (this will cascade to auth tables)
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
-- Ensure all necessary delete policies exist
DO $$ BEGIN -- Profiles delete policy
IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
        AND tablename = 'profiles'
        AND cmd = 'DELETE'
) THEN CREATE POLICY "Users can delete their own profile" ON profiles FOR DELETE USING (
    auth.uid() = id
    OR EXISTS (
        SELECT 1
        FROM profiles
        WHERE id = auth.uid()
            AND role = 'admin'
    )
);
END IF;
-- Staff delete policy
IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
        AND tablename = 'staff'
        AND cmd = 'DELETE'
) THEN CREATE POLICY "Users can delete their own staff record" ON staff FOR DELETE USING (
    auth.uid() = user_id
    OR EXISTS (
        SELECT 1
        FROM profiles
        WHERE id = auth.uid()
            AND role = 'admin'
    )
);
END IF;
-- Ensure cascade deletes are set up properly
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_user_id_fkey,
    ADD CONSTRAINT staff_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey,
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
END $$;