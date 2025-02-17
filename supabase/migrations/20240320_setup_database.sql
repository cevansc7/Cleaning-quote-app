-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;
-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    email TEXT,
    name TEXT,
    phone TEXT,
    role TEXT DEFAULT 'client' CHECK (role IN ('client', 'staff', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);
-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
-- Create profiles policies
CREATE POLICY "Users can view their own profile" ON profiles FOR
SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON profiles FOR
UPDATE USING (auth.uid() = id);
CREATE POLICY "Enable insert for authenticated users only" ON profiles FOR
INSERT WITH CHECK (true);
CREATE POLICY "Admins have full access" ON profiles FOR ALL USING (auth.jwt()->>'role' = 'admin');
-- Create staff table
CREATE TABLE IF NOT EXISTS staff (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    email TEXT NOT NULL,
    name TEXT,
    phone TEXT,
    role TEXT DEFAULT 'cleaner' CHECK (role IN ('cleaner', 'supervisor')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(email)
);
-- Enable RLS on staff
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
-- Create staff policies
CREATE POLICY "Staff members can view their own record" ON staff FOR
SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all staff records" ON staff FOR
SELECT USING (auth.jwt()->>'role' = 'admin');
CREATE POLICY "Admins can insert staff records" ON staff FOR
INSERT WITH CHECK (auth.jwt()->>'role' = 'admin');
CREATE POLICY "Admins can update staff records" ON staff FOR
UPDATE USING (auth.jwt()->>'role' = 'admin');
CREATE POLICY "Allow add_staff_member function to insert" ON staff FOR
INSERT WITH CHECK (true);
-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION handle_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = TIMEZONE('utc'::text, NOW());
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- Create triggers for updated_at
CREATE TRIGGER handle_profiles_updated_at BEFORE
UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER handle_staff_updated_at BEFORE
UPDATE ON staff FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
-- Create function to sync staff information
CREATE OR REPLACE FUNCTION sync_staff_profile() RETURNS TRIGGER AS $$ BEGIN -- If the profile is for a staff member
    IF NEW.role = 'staff' THEN -- Try to update existing staff record
UPDATE staff
SET email = NEW.email,
    name = NEW.name,
    phone = NEW.phone,
    updated_at = NOW()
WHERE user_id = NEW.id;
-- If no record exists, create one
IF NOT FOUND THEN
INSERT INTO staff (user_id, email, name, phone, role)
VALUES (
        NEW.id,
        NEW.email,
        NEW.name,
        NEW.phone,
        'cleaner'
    );
END IF;
END IF;
RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Create trigger for staff profile sync
CREATE TRIGGER sync_staff_profile_trigger
AFTER
INSERT
    OR
UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION sync_staff_profile();
-- Create function to set up authorized users
CREATE OR REPLACE FUNCTION setup_authorized_user(
        user_id UUID,
        user_email TEXT,
        user_name TEXT,
        user_phone TEXT,
        user_role TEXT
    ) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN -- Update user's metadata
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
        COALESCE(raw_user_meta_data, '{}'::jsonb),
        '{role}',
        to_jsonb(user_role)
    )
WHERE id = user_id;
-- Insert or update profile
INSERT INTO profiles (id, email, name, phone, role)
VALUES (
        user_id,
        user_email,
        user_name,
        user_phone,
        user_role
    ) ON CONFLICT (id) DO
UPDATE
SET email = EXCLUDED.email,
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    role = EXCLUDED.role,
    updated_at = NOW();
-- Staff table sync is handled by the trigger
END;
$$;
-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION setup_authorized_user TO authenticated;
-- Create function to add staff member
CREATE OR REPLACE FUNCTION add_staff_member(
        user_email TEXT,
        user_name TEXT,
        user_phone TEXT,
        staff_role TEXT DEFAULT 'cleaner'
    ) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN -- Get the user ID from auth.users
DECLARE user_id UUID;
BEGIN
SELECT id INTO user_id
FROM auth.users
WHERE email = user_email;
IF user_id IS NULL THEN RAISE EXCEPTION 'User not found with email %',
user_email;
END IF;
-- Update user's metadata
UPDATE auth.users
SET raw_user_meta_data = jsonb_build_object(
        'role',
        'staff',
        'name',
        user_name,
        'phone',
        user_phone
    )
WHERE id = user_id;
-- Insert or update profile
INSERT INTO profiles (id, email, name, phone, role)
VALUES (
        user_id,
        user_email,
        user_name,
        user_phone,
        'staff'
    ) ON CONFLICT (id) DO
UPDATE
SET name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    role = 'staff',
    updated_at = NOW();
-- Insert or update staff record
INSERT INTO staff (user_id, email, name, phone, role)
VALUES (
        user_id,
        user_email,
        user_name,
        user_phone,
        staff_role
    ) ON CONFLICT (email) DO
UPDATE
SET name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    role = staff_role,
    updated_at = NOW();
END;
END;
$$;
-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION add_staff_member TO authenticated;