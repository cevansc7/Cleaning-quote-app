-- Create a function to safely delete a user and all their data
CREATE OR REPLACE FUNCTION delete_user(user_id UUID) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$ BEGIN -- Delete from staff first (should cascade to related records)
DELETE FROM staff
WHERE user_id = $1;
-- Delete from profiles (should cascade to related records)
DELETE FROM profiles
WHERE id = $1;
-- Finally delete the user
DELETE FROM auth.users
WHERE id = $1;
END;
$$;
-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_user TO authenticated;
-- Test the deletion
SELECT delete_user('c3dce157-e80f-44cf-aa3a-9a1da5a4b5e2');