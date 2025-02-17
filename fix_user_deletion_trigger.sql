-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS handle_user_deletion_trigger ON auth.users;
DROP FUNCTION IF EXISTS handle_user_deletion_trigger_func();
-- Create the trigger function
CREATE OR REPLACE FUNCTION handle_user_deletion_trigger_func() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public,
    auth AS $$ BEGIN -- Delete from dependent tables first
DELETE FROM quotes
WHERE client_id = OLD.id;
DELETE FROM staff_availability
WHERE staff_id = OLD.id;
DELETE FROM cleaning_notes
WHERE staff_id = OLD.id;
DELETE FROM reviews
WHERE client_id = OLD.id;
DELETE FROM payments
WHERE booking_id IN (
        SELECT id
        FROM bookings
        WHERE client_id = OLD.id
    );
DELETE FROM notifications
WHERE recipient_id = OLD.id;
DELETE FROM bookings
WHERE client_id = OLD.id;
DELETE FROM staff
WHERE user_id = OLD.id;
DELETE FROM profiles
WHERE id = OLD.id;
RETURN OLD;
EXCEPTION
WHEN OTHERS THEN RAISE EXCEPTION 'Error deleting user data: %',
SQLERRM;
END;
$$;
-- Create the trigger
CREATE TRIGGER handle_user_deletion_trigger BEFORE DELETE ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_user_deletion_trigger_func();
-- Ensure RLS is enabled on all relevant tables
ALTER TABLE IF EXISTS quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS staff_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cleaning_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;
-- Add delete policies for all tables
DO $$ BEGIN -- Quotes delete policy
IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
        AND tablename = 'quotes'
        AND cmd = 'DELETE'
) THEN CREATE POLICY "Allow deletion of user's quotes" ON quotes FOR DELETE USING (
    auth.uid() = client_id
    OR EXISTS (
        SELECT 1
        FROM profiles
        WHERE id = auth.uid()
            AND role = 'admin'
    )
);
END IF;
-- Staff availability delete policy
IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
        AND tablename = 'staff_availability'
        AND cmd = 'DELETE'
) THEN CREATE POLICY "Allow deletion of user's availability" ON staff_availability FOR DELETE USING (
    auth.uid() = staff_id
    OR EXISTS (
        SELECT 1
        FROM profiles
        WHERE id = auth.uid()
            AND role = 'admin'
    )
);
END IF;
-- Cleaning notes delete policy
IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
        AND tablename = 'cleaning_notes'
        AND cmd = 'DELETE'
) THEN CREATE POLICY "Allow deletion of user's cleaning notes" ON cleaning_notes FOR DELETE USING (
    auth.uid() = staff_id
    OR EXISTS (
        SELECT 1
        FROM profiles
        WHERE id = auth.uid()
            AND role = 'admin'
    )
);
END IF;
-- Reviews delete policy
IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
        AND tablename = 'reviews'
        AND cmd = 'DELETE'
) THEN CREATE POLICY "Allow deletion of user's reviews" ON reviews FOR DELETE USING (
    auth.uid() = client_id
    OR EXISTS (
        SELECT 1
        FROM profiles
        WHERE id = auth.uid()
            AND role = 'admin'
    )
);
END IF;
-- Payments delete policy
IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
        AND tablename = 'payments'
        AND cmd = 'DELETE'
) THEN CREATE POLICY "Allow deletion of user's payments" ON payments FOR DELETE USING (
    EXISTS (
        SELECT 1
        FROM bookings
        WHERE bookings.id = payments.booking_id
            AND (
                bookings.client_id = auth.uid()
                OR EXISTS (
                    SELECT 1
                    FROM profiles
                    WHERE id = auth.uid()
                        AND role = 'admin'
                )
            )
    )
);
END IF;
-- Notifications delete policy
IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
        AND tablename = 'notifications'
        AND cmd = 'DELETE'
) THEN CREATE POLICY "Allow deletion of user's notifications" ON notifications FOR DELETE USING (
    auth.uid() = recipient_id
    OR EXISTS (
        SELECT 1
        FROM profiles
        WHERE id = auth.uid()
            AND role = 'admin'
    )
);
END IF;
-- Bookings delete policy
IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
        AND tablename = 'bookings'
        AND cmd = 'DELETE'
) THEN CREATE POLICY "Allow deletion of user's bookings" ON bookings FOR DELETE USING (
    auth.uid() = client_id
    OR EXISTS (
        SELECT 1
        FROM profiles
        WHERE id = auth.uid()
            AND role = 'admin'
    )
);
END IF;
END $$;