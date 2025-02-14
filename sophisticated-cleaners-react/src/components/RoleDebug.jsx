import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { useState, useEffect } from 'react';

function RoleDebug() {
  const { user } = useAuth();
  const [session, setSession] = useState(null);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
    };
    getSession();
  }, []);

  if (process.env.NODE_ENV !== 'development') return null;

  return (
    <div className="fixed bottom-4 left-4 bg-black/80 text-white p-4 rounded text-xs">
      <h3 className="font-bold mb-2">Auth Debug</h3>
      <pre>
        {JSON.stringify({
          user: {
            id: user?.id,
            email: user?.email,
            role: user?.user_metadata?.role
          },
          session: {
            role: session?.user?.user_metadata?.role,
            jwt: session?.access_token?.slice(0, 50) + '...'
          }
        }, null, 2)}
      </pre>
    </div>
  );
}

export default RoleDebug; 