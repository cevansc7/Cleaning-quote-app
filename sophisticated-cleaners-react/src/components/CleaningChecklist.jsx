import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNotification } from '../contexts/NotificationContext';

function CleaningChecklist({ booking, onComplete }) {
  const [checklist, setChecklist] = useState({
    walkthrough: false,
    setup: false,
    requirements: false,
    assignments: false,
    cleaning: false,
    finalCheck: false
  });
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(false);

  const handleCheck = (item) => {
    setChecklist(prev => ({
      ...prev,
      [item]: !prev[item]
    }));
  };

  const handleComplete = async () => {
    if (!Object.values(checklist).every(Boolean)) {
      showNotification('Please complete all tasks before marking as completed', 'error');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ 
          status: 'completed',
          completion_checklist: checklist 
        })
        .eq('id', booking.id);

      if (error) throw error;

      showNotification('Booking marked as completed', 'success');
      onComplete?.();
    } catch (error) {
      console.error('Error completing booking:', error);
      showNotification('Error marking booking as complete', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-gold font-medium">Cleaning Checklist</h3>
        <button 
          className="text-secondary text-sm hover:text-gold"
          onClick={() => setChecklist(prev => {
            const allChecked = Object.values(prev).every(Boolean);
            return Object.keys(prev).reduce((acc, key) => ({
              ...acc,
              [key]: !allChecked
            }), {});
          })}
        >
          {Object.values(checklist).every(Boolean) ? 'Uncheck All' : 'Check All'}
        </button>
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2 p-2 hover:bg-container/50 rounded cursor-pointer">
          <input
            type="checkbox"
            checked={checklist.walkthrough}
            onChange={() => handleCheck('walkthrough')}
            className="form-checkbox text-gold rounded border-border focus:ring-gold"
          />
          <span className="text-secondary">Initial walkthrough and inspection</span>
        </label>

        <label className="flex items-center gap-2 p-2 hover:bg-container/50 rounded cursor-pointer">
          <input
            type="checkbox"
            checked={checklist.setup}
            onChange={() => handleCheck('setup')}
            className="form-checkbox text-gold rounded border-border focus:ring-gold"
          />
          <span className="text-secondary">Setup cleaning equipment and supplies</span>
        </label>

        <label className="flex items-center gap-2 p-2 hover:bg-container/50 rounded cursor-pointer">
          <input
            type="checkbox"
            checked={checklist.requirements}
            onChange={() => handleCheck('requirements')}
            className="form-checkbox text-gold rounded border-border focus:ring-gold"
          />
          <span className="text-secondary">Review client requirements and priorities</span>
        </label>

        <label className="flex items-center gap-2 p-2 hover:bg-container/50 rounded cursor-pointer">
          <input
            type="checkbox"
            checked={checklist.assignments}
            onChange={() => handleCheck('assignments')}
            className="form-checkbox text-gold rounded border-border focus:ring-gold"
          />
          <span className="text-secondary">Assign areas to cleaners</span>
        </label>

        <label className="flex items-center gap-2 p-2 hover:bg-container/50 rounded cursor-pointer">
          <input
            type="checkbox"
            checked={checklist.cleaning}
            onChange={() => handleCheck('cleaning')}
            className="form-checkbox text-gold rounded border-border focus:ring-gold"
          />
          <span className="text-secondary">Clean assigned areas</span>
        </label>

        <label className="flex items-center gap-2 p-2 hover:bg-container/50 rounded cursor-pointer">
          <input
            type="checkbox"
            checked={checklist.finalCheck}
            onChange={() => handleCheck('finalCheck')}
            className="form-checkbox text-gold rounded border-border focus:ring-gold"
          />
          <span className="text-secondary">Final inspection and quality check</span>
        </label>
      </div>

      <button
        onClick={handleComplete}
        disabled={loading || !Object.values(checklist).every(Boolean)}
        className={`w-full py-2 px-4 rounded ${
          Object.values(checklist).every(Boolean)
            ? 'bg-success text-background hover:bg-success/90'
            : 'bg-gray-500/20 text-gray-500 cursor-not-allowed'
        }`}
      >
        {loading ? 'Marking as Complete...' : 'Mark as Completed'}
      </button>
    </div>
  );
}

export default CleaningChecklist; 