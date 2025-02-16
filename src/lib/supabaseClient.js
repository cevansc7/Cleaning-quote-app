import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

// Add logging to debug connection
console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Key exists:', !!supabaseAnonKey);

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Test connection and permissions
supabase
  .from('bookings')
  .select('count')
  .single()
  .then(({ data, error }) => {
    if (error) {
      console.error('Supabase connection/permission error:', error);
    } else {
      console.log('Supabase connection successful, found', data.count, 'bookings');
    }
  });

// Add this after creating the supabase client
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    console.log('Signed in user:', session?.user);
    console.log('User role:', session?.user?.user_metadata?.role);
    
    // Test the checklists access
    supabase
      .from('checklists')
      .select('*')
      .limit(1)
      .then(({ data, error }) => {
        console.log('Checklist test:', { data, error });
      });
  }
}); 