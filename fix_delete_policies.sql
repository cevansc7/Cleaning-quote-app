-- Add delete policies for profiles
DROP POLICY IF EXISTS "Users can delete their own profile" ON profiles;
CREATE POLICY "Users can delete their own profile" ON profiles FOR DELETE USING (auth.uid() = id);
-- Add delete policies for staff
DROP POLICY IF EXISTS "Users can delete their own staff record" ON staff;
CREATE POLICY "Users can delete their own staff record" ON staff FOR DELETE USING (auth.uid() = user_id);
-- Add admin delete policies
DROP POLICY IF EXISTS "Admins can delete any profile" ON profiles;
CREATE POLICY "Admins can delete any profile" ON profiles FOR DELETE USING (auth.jwt()->>'role' = 'admin');
DROP POLICY IF EXISTS "Admins can delete any staff record" ON staff;
CREATE POLICY "Admins can delete any staff record" ON staff FOR DELETE USING (auth.jwt()->>'role' = 'admin');
-- Verify policies
SELECT schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename IN ('profiles', 'staff')
ORDER BY tablename,
    policyname;