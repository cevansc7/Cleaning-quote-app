-- Create staff_schedules table
CREATE TABLE IF NOT EXISTS staff_schedules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    staff_id UUID REFERENCES auth.users(id),
    booking_id UUID,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT DEFAULT 'scheduled' CHECK (
        status IN ('scheduled', 'completed', 'cancelled')
    ),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);
-- Enable RLS on staff_schedules
ALTER TABLE staff_schedules ENABLE ROW LEVEL SECURITY;
-- Create policies for staff_schedules
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'staff_schedules'
        AND policyname = 'Staff can view their own schedules'
) THEN CREATE POLICY "Staff can view their own schedules" ON staff_schedules FOR
SELECT USING (auth.uid() = staff_id);
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'staff_schedules'
        AND policyname = 'Admins can view all schedules'
) THEN CREATE POLICY "Admins can view all schedules" ON staff_schedules FOR
SELECT USING (auth.jwt()->>'role' = 'admin');
END IF;
END $$;
-- Create trigger for updated_at on staff_schedules
DROP TRIGGER IF EXISTS handle_staff_schedules_updated_at ON staff_schedules;
CREATE TRIGGER handle_staff_schedules_updated_at BEFORE
UPDATE ON staff_schedules FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
-- Create bookings table
CREATE TABLE IF NOT EXISTS bookings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID REFERENCES auth.users(id),
    cleaning_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (
        status IN ('pending', 'confirmed', 'completed', 'cancelled')
    ),
    payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
    amount_paid DECIMAL(10, 2) DEFAULT 0,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);
-- Add foreign key from staff_schedules to bookings
ALTER TABLE staff_schedules DROP CONSTRAINT IF EXISTS staff_schedules_booking_id_fkey;
ALTER TABLE staff_schedules
ADD CONSTRAINT staff_schedules_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;
-- Enable RLS on bookings
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
-- Create policies for bookings
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'bookings'
        AND policyname = 'Clients can view their own bookings'
) THEN CREATE POLICY "Clients can view their own bookings" ON bookings FOR
SELECT USING (auth.uid() = client_id);
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'bookings'
        AND policyname = 'Staff can view assigned bookings'
) THEN CREATE POLICY "Staff can view assigned bookings" ON bookings FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM staff_schedules
            WHERE staff_schedules.booking_id = bookings.id
                AND staff_schedules.staff_id = auth.uid()
        )
    );
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'bookings'
        AND policyname = 'Admins can view all bookings'
) THEN CREATE POLICY "Admins can view all bookings" ON bookings FOR
SELECT USING (auth.jwt()->>'role' = 'admin');
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'bookings'
        AND policyname = 'Clients can create bookings'
) THEN CREATE POLICY "Clients can create bookings" ON bookings FOR
INSERT WITH CHECK (auth.uid() = client_id);
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'bookings'
        AND policyname = 'Clients can update their own bookings'
) THEN CREATE POLICY "Clients can update their own bookings" ON bookings FOR
UPDATE USING (auth.uid() = client_id);
END IF;
END $$;
-- Create trigger for updated_at
DROP TRIGGER IF EXISTS handle_bookings_updated_at ON bookings;
CREATE TRIGGER handle_bookings_updated_at BEFORE
UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION handle_updated_at();