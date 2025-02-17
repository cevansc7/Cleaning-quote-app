-- Clean up overlapping policies for staff table
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON staff;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON staff;
DROP POLICY IF EXISTS "Staff can insert staff" ON staff;
DROP POLICY IF EXISTS "Staff can update staff" ON staff;
DROP POLICY IF EXISTS "Staff members can be viewed by authenticated users" ON staff;
-- Update staff policies to be more specific
DROP POLICY IF EXISTS "Staff members can view their own record" ON staff;
CREATE POLICY "Staff members can view their own record" ON staff FOR
SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can view all staff records" ON staff;
CREATE POLICY "Admins can view all staff records" ON staff FOR
SELECT USING (auth.jwt()->>'role' = 'admin');
DROP POLICY IF EXISTS "Allow add_staff_member function to insert" ON staff;
CREATE POLICY "Allow add_staff_member function to insert" ON staff FOR
INSERT WITH CHECK (
        -- Allow inserts during registration
        EXISTS (
            SELECT 1
            FROM auth.users
            WHERE id = auth.uid()
                AND raw_user_meta_data->>'role' = 'staff'
        )
        OR -- Allow admin inserts
        (auth.jwt()->>'role' = 'admin')
    );
DROP POLICY IF EXISTS "Users can delete their own staff record" ON staff;
CREATE POLICY "Users can delete their own staff record" ON staff FOR DELETE USING (
    auth.uid() = user_id
    OR auth.jwt()->>'role' = 'admin'
);
-- Verify the changes
SELECT schemaname,
    tablename,
    policyname,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'staff'
ORDER BY tablename,
    policyname;