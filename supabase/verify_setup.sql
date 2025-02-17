-- Check core tables existence and structure
SELECT EXISTS (
        SELECT
        FROM information_schema.tables
        WHERE table_schema = 'public'
            AND table_name = 'profiles'
    ) as profiles_exists,
    EXISTS (
        SELECT
        FROM information_schema.tables
        WHERE table_schema = 'public'
            AND table_name = 'staff'
    ) as staff_exists,
    EXISTS (
        SELECT
        FROM information_schema.tables
        WHERE table_schema = 'public'
            AND table_name = 'bookings'
    ) as bookings_exists,
    EXISTS (
        SELECT
        FROM information_schema.tables
        WHERE table_schema = 'public'
            AND table_name = 'staff_schedules'
    ) as staff_schedules_exists,
    EXISTS (
        SELECT
        FROM information_schema.tables
        WHERE table_schema = 'public'
            AND table_name = 'app_settings'
    ) as app_settings_exists;
-- Check RLS is enabled
SELECT tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN (
        'profiles',
        'staff',
        'bookings',
        'staff_schedules',
        'app_settings'
    );
-- Check policies exist
SELECT schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename,
    policyname;
-- Check triggers exist
SELECT event_object_table as table_name,
    trigger_name,
    event_manipulation,
    action_statement as trigger_function
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table,
    trigger_name;
-- Check required functions exist
SELECT routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND routine_name IN (
        'handle_updated_at',
        'sync_staff_profile',
        'setup_authorized_user',
        'get_app_setting'
    );
-- Check foreign key constraints
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
    AND tc.table_schema = 'public';
-- Call add_staff_member function to ensure proper setup
SELECT add_staff_member(
        'brickev@hotmail.com',
        'David Banner',
        'cleaner'
    );
-- Verify all records
SELECT 'auth.users' as source,
    id,
    email,
    raw_user_meta_data->>'role' as role,
    raw_user_meta_data->>'name' as name,
    raw_user_meta_data->>'phone' as phone
FROM auth.users
WHERE email = 'brickev@hotmail.com'
UNION ALL
SELECT 'profiles' as source,
    id,
    email,
    role,
    name,
    phone
FROM profiles
WHERE email = 'brickev@hotmail.com'
UNION ALL
SELECT 'staff' as source,
    user_id as id,
    email,
    role,
    name,
    phone
FROM staff
WHERE email = 'brickev@hotmail.com';