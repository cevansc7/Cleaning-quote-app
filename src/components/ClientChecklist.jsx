import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNotification } from '../contexts/NotificationContext';

function ClientChecklist({ bookingId }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showNotification } = useNotification();

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const { data, error } = await supabase
          .from('checklists')
          .select('*')
          .eq('booking_id', bookingId);

        if (error) throw error;
        setTasks(data || []);
      } catch (error) {
        console.error('Error fetching checklist:', error);
        showNotification('Error loading checklist', 'error');
      } finally {
        setLoading(false);
      }
    };

    // Set up real-time subscription
    const subscription = supabase
      .channel(`checklist-${bookingId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'checklists',
        filter: `booking_id=eq.${bookingId}`
      }, (payload) => {
        console.log('Checklist change received:', payload);
        fetchTasks();
      })
      .subscribe();

    fetchTasks();

    return () => {
      subscription.unsubscribe();
    };
  }, [bookingId]);

  if (loading) {
    return <div className="text-secondary text-sm">Loading checklist...</div>;
  }

  if (!tasks.length) {
    return null;
  }

  return (
    <div className="mt-4 border-t border-border pt-4">
      <h3 className="text-gold font-semibold mb-2">Cleaning Progress</h3>
      <div className="space-y-2">
        {tasks.map(task => (
          <div 
            key={task.id}
            className="flex items-center gap-3 p-2 rounded bg-[#2a2a2a]"
          >
            <div className={`h-4 w-4 rounded border ${
              task.is_completed 
                ? 'bg-gold/20 border-gold' 
                : 'border-border'
            }`} />
            <span className={task.is_completed ? 'text-secondary line-through' : 'text-primary'}>
              {task.task_name}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 text-right text-sm text-secondary">
        {tasks.filter(t => t.is_completed).length} of {tasks.length} tasks completed
      </div>
    </div>
  );
}

export default ClientChecklist; 