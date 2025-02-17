-- Create staff table if it doesn't exist
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
-- Enable RLS
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
-- Create policies
CREATE POLICY "Staff members can view their own record" ON staff FOR
SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all staff records" ON staff FOR
SELECT USING (auth.jwt()->>'role' = 'admin');
CREATE POLICY "Admins can insert staff records" ON staff FOR
INSERT WITH CHECK (auth.jwt()->>'role' = 'admin');
CREATE POLICY "Admins can update staff records" ON staff FOR
UPDATE USING (auth.jwt()->>'role' = 'admin');
-- Allow the add_staff_member function to insert records
CREATE POLICY "Allow add_staff_member function to insert" ON staff FOR
INSERT WITH CHECK (true);
-- Create function to handle updated_at
CREATE OR REPLACE FUNCTION handle_staff_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = TIMEZONE('utc'::text, NOW());
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- Create trigger for updated_at
CREATE TRIGGER handle_staff_updated_at BEFORE
UPDATE ON staff FOR EACH ROW EXECUTE FUNCTION handle_staff_updated_at();
-- Drop existing function if it exists
DROP FUNCTION IF EXISTS add_staff_member(text, text, text);
-- Create function to add staff member
CREATE OR REPLACE FUNCTION add_staff_member(
        user_email TEXT,
        user_name TEXT,
        staff_role TEXT DEFAULT 'cleaner'
    ) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_user_id UUID;
v_staff_id UUID;
BEGIN -- Get the user ID from auth.users
SELECT id INTO v_user_id
FROM auth.users
WHERE email = user_email;
IF v_user_id IS NULL THEN RAISE EXCEPTION 'User with email % not found',
user_email;
END IF;
-- Insert into staff table
INSERT INTO staff (user_id, email, name, role)
VALUES (v_user_id, user_email, user_name, staff_role)
RETURNING id INTO v_staff_id;
RETURN v_staff_id;
END;
$$;