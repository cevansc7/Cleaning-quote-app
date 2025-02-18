import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { addStaffMember } from '../utils/staffUtils';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId) => {
    try {
      // Try up to 3 times with a small delay between attempts
      for (let attempt = 1; attempt <= 3; attempt++) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (error) {
          console.error(`Error fetching profile (attempt ${attempt}/3):`, error);
          if (attempt < 3) {
            // Wait for 500ms before retrying
            await new Promise(resolve => setTimeout(resolve, 500));
            continue;
          }
          throw error;
        }

        if (!data) {
          console.error(`No profile found for user ${userId} (attempt ${attempt}/3)`);
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 500));
            continue;
          }
          return null;
        }

        return data;
      }
    } catch (error) {
      console.error('Error fetching profile after all retries:', error);
      return null;
    }
  };

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        const profileData = await fetchProfile(currentUser.id);
        setProfile(profileData);
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    // Listen for changes on auth state (sign in, sign out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        const profileData = await fetchProfile(currentUser.id);
        setProfile(profileData);
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email, password) => {
    try {
      const { data: { user }, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Check for pending profile data
      const pendingProfile = localStorage.getItem('pendingProfile');
      if (pendingProfile) {
        const profileData = JSON.parse(pendingProfile);

        // Only create profile if it matches the current user
        if (profileData.id === user.id) {
          // First check if profile already exists
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

          if (!existingProfile) {
            const { error: profileError } = await supabase
              .from('profiles')
              .insert([{
                id: profileData.id,
                email: profileData.email,
                name: profileData.name,
                phone: profileData.phone,
                role: profileData.role
              }])
              .select();

            if (profileError) {
              console.error('Error creating profile:', profileError);
              throw new Error('Failed to create profile: ' + profileError.message);
            }

            // Profile trigger will handle staff table sync automatically
          }

          // Clear pending profile data after successful creation
          localStorage.removeItem('pendingProfile');
        }
      }

      // Fetch profile after sign in (and possible profile creation)
      const profileData = await fetchProfile(user.id);
      if (!profileData) {
        throw new Error('Profile not found after creation');
      }

      // Double-check staff record if user is staff
      if (profileData.role === 'staff') {
        const { error: staffError } = await supabase.rpc('add_staff_member', {
          user_email: profileData.email,
          user_name: profileData.name,
          staff_role: 'cleaner'
        });

        if (staffError) {
          console.error('Error syncing staff record:', staffError);
          // Don't throw, as this is just a backup sync
        }
      }

      setProfile(profileData);

      // Return the user role for navigation in the Login component
      return profileData.role;

    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      localStorage.removeItem('pendingProfile');
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  const value = {
    signUp: (data) => supabase.auth.signUp(data),
    signIn,
    signOut,
    user,
    profile,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 