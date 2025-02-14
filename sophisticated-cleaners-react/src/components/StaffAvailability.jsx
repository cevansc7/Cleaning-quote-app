import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNotification } from '../contexts/NotificationContext';

function StaffAvailability({ staffId }) {
  const [availability, setAvailability] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showNotification } = useNotification();
  const [isEditing, setIsEditing] = useState(false);

  const daysOfWeek = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday', 
    'Thursday', 'Friday', 'Saturday'
  ];

  const defaultTimes = {
    start: '09:00',
    end: '17:00'
  };

  useEffect(() => {
    fetchAvailability();
  }, [staffId]);

  const fetchAvailability = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('staff_availability')
        .select('*')
        .eq('staff_id', staffId)
        .order('day_of_week');

      if (error) throw error;

      // Initialize empty availability for all days if none exists
      const fullAvailability = daysOfWeek.map((day, index) => {
        const existing = data?.find(a => a.day_of_week === index);
        return existing || {
          day_of_week: index,
          start_time: defaultTimes.start,
          end_time: defaultTimes.end,
          staff_id: staffId
        };
      });

      setAvailability(fullAvailability);
    } catch (error) {
      console.error('Error fetching availability:', error);
      showNotification('Error loading availability', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);

      // Upsert all availability records
      const { error } = await supabase
        .from('staff_availability')
        .upsert(availability.map(a => ({
          staff_id: staffId,
          day_of_week: a.day_of_week,
          start_time: a.start_time,
          end_time: a.end_time
        })));

      if (error) throw error;

      showNotification('Availability updated successfully', 'success');
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating availability:', error);
      showNotification('Error updating availability', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleTimeChange = (dayIndex, field, value) => {
    setAvailability(prev => prev.map(a => 
      a.day_of_week === dayIndex 
        ? { ...a, [field]: value }
        : a
    ));
  };

  if (loading) return <div className="text-secondary">Loading availability...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-primary">Weekly Availability</h3>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 bg-gold text-background rounded hover:bg-gold/90"
          >
            Edit Availability
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-gold text-background rounded hover:bg-gold/90"
            >
              Save
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                fetchAvailability();
              }}
              className="px-4 py-2 bg-error text-background rounded hover:bg-error/90"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-4">
        {availability.map((day) => (
          <div 
            key={day.day_of_week}
            className="p-4 bg-container rounded-lg flex items-center justify-between"
          >
            <span className="text-primary font-medium w-32">
              {daysOfWeek[day.day_of_week]}
            </span>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-secondary">From</span>
                <input
                  type="time"
                  value={day.start_time}
                  onChange={(e) => handleTimeChange(day.day_of_week, 'start_time', e.target.value)}
                  className="bg-input border border-border rounded px-3 py-1 text-primary"
                  disabled={!isEditing}
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-secondary">To</span>
                <input
                  type="time"
                  value={day.end_time}
                  onChange={(e) => handleTimeChange(day.day_of_week, 'end_time', e.target.value)}
                  className="bg-input border border-border rounded px-3 py-1 text-primary"
                  disabled={!isEditing}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default StaffAvailability; 