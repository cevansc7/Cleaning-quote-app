-- First, drop existing foreign key constraint
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_user_id_fkey;
-- Add the constraint back with CASCADE
ALTER TABLE staff
ADD CONSTRAINT staff_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
-- Verify the profiles table cascade (should already be set up)
SELECT tc.table_schema,
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    rc.delete_rule
FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
WHERE tc.table_name IN ('profiles', 'staff')
    AND tc.constraint_type = 'FOREIGN KEY';