import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNotification } from '../contexts/NotificationContext';

function CleaningChecklist({ bookingId }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCompleted, setShowCompleted] = useState(true);
  const { showNotification } = useNotification();

  // Calculate progress
  const progress = tasks.length 
    ? Math.round((tasks.filter(t => t.is_completed).length / tasks.length) * 100)
    : 0;

  useEffect(() => {
    let subscription;

    const fetchTasks = async () => {
      try {
        console.log('Fetching tasks for booking:', bookingId);
        const { data, error } = await supabase
          .from('checklists')
          .select('*')
          .eq('booking_id', bookingId)
          .order('order', { ascending: true })
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Error fetching tasks:', error);
          throw error;
        }

        console.log('Fetched tasks:', data);
        setTasks(data || []);
      } catch (error) {
        console.error('Error in fetchTasks:', error);
        showNotification('Error loading checklist', 'error');
      } finally {
        setLoading(false);
      }
    };

    const setupSubscription = async () => {
      // Clean up any existing subscription
      if (subscription) {
        subscription.unsubscribe();
      }

      // Set up new subscription
      subscription = supabase
        .channel(`checklist-${bookingId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'checklists',
            filter: `booking_id=eq.${bookingId}`
          },
          (payload) => {
            console.log('Checklist change received:', payload);
            fetchTasks();
          }
        )
        .subscribe((status) => {
          console.log('Subscription status:', status);
        });
    };

    fetchTasks();
    setupSubscription();

    return () => {
      if (subscription) {
        console.log('Cleaning up subscription');
        subscription.unsubscribe();
      }
    };
  }, [bookingId]);

  const toggleTask = async (taskId, currentStatus) => {
    try {
      console.log('Toggling task:', taskId, 'from', currentStatus, 'to', !currentStatus);
      const { error } = await supabase
        .from('checklists')
        .update({ 
          is_completed: !currentStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (error) throw error;

      // Optimistically update the UI
      setTasks(tasks.map(task => 
        task.id === taskId 
          ? { ...task, is_completed: !currentStatus }
          : task
      ));

    } catch (error) {
      console.error('Error updating task:', error);
      showNotification('Error updating task', 'error');
    }
  };

  if (loading) {
    return <div className="text-secondary text-sm">Loading checklist...</div>;
  }

  if (!tasks.length) {
    return <div className="text-secondary text-sm">No tasks found for this booking.</div>;
  }

  // Filter and sort tasks
  const filteredTasks = tasks
    .filter(task => showCompleted || !task.is_completed)
    .sort((a, b) => {
      if (a.is_completed === b.is_completed) {
        return a.order - b.order;
      }
      return a.is_completed ? 1 : -1;
    });

  return (
    <div className="mt-4 space-y-3 sm:space-y-2">
      <div className="flex justify-between items-center px-2 sm:px-0">
        <h3 className="text-lg font-semibold text-gold">Cleaning Checklist</h3>
        <button
          onClick={() => setShowCompleted(!showCompleted)}
          className="text-sm text-secondary hover:text-gold transition-colors"
        >
          {showCompleted ? 'Hide Completed' : 'Show Completed'}
        </button>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-background rounded-full h-2.5 mb-4">
        <div 
          className="bg-gold h-2.5 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {filteredTasks.map(task => (
        <div 
          key={task.id}
          className={`flex items-center gap-3 p-3 sm:p-2 rounded bg-container border border-border hover:border-gold/50 transition-colors ${
            task.is_completed ? 'opacity-75' : ''
          }`}
        >
          <div 
            className="flex items-center flex-1 cursor-pointer"
            onClick={() => toggleTask(task.id, task.is_completed)}
          >
            <input
              type="checkbox"
              checked={task.is_completed}
              onChange={() => toggleTask(task.id, task.is_completed)}
              className="h-6 w-6 sm:h-5 sm:w-5 rounded border-border text-gold focus:ring-gold cursor-pointer"
            />
            <span className={`ml-3 flex-1 ${
              task.is_completed 
                ? 'text-secondary line-through' 
                : 'text-primary'
            }`}>
              {task.task_name}
            </span>
          </div>
        </div>
      ))}
      <div className="text-right text-sm text-secondary px-2 sm:px-0 pt-2">
        <span className="font-medium text-gold">{progress}%</span> complete
        ({tasks.filter(t => t.is_completed).length} of {tasks.length} tasks)
      </div>
    </div>
  );
}

export default CleaningChecklist; 