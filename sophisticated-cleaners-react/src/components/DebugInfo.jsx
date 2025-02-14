import { useAuth } from '../contexts/AuthContext';

function DebugInfo() {
  const { user } = useAuth();

  if (process.env.NODE_ENV !== 'development') return null;

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white p-4 rounded text-xs">
      <pre>
        {JSON.stringify({
          id: user?.id,
          email: user?.email,
          role: user?.user_metadata?.role
        }, null, 2)}
      </pre>
    </div>
  );
}

export default DebugInfo; 