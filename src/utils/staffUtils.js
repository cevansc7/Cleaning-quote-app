import { supabase } from '../lib/supabaseClient';

export async function addStaffMember(email, name = null, phone = null, role = 'cleaner') {
  try {
    // Call the RPC function
    const { data, error } = await supabase.rpc('add_staff_member', {
      user_email: email,
      user_name: name,
      user_phone: phone,
      staff_role: role
    });

    if (error) throw error;

    // Update user metadata
    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        role: 'staff',
        name: name,
        phone: phone
      }
    });

    if (updateError) throw updateError;

    return { success: true, data };
  } catch (error) {
    console.error('Error adding staff member:', error);
    return { success: false, error };
  }
} 