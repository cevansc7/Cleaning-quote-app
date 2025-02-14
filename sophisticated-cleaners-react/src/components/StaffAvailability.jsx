import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNotification } from '../contexts/NotificationContext';

function StaffAvailability() {
  const [availability, setAvailability] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showNotification } = useNotification();

  const daysOfWeek = [
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
  ];

  useEffect(() => {
    fetchAvailability();
  }, []);

  const fetchAvailability = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('staff_availability')
        .select('*')
        .eq('staff_id', user.id)
        .order('day_of_week');

      if (error) throw error;

      // Create default availability for missing days
      const availabilityMap = new Map(data.map(a => [a.day_of_week, a]));
      const fullAvailability = daysOfWeek.map(day => {
        return availabilityMap.get(day) || {
          day_of_week: day,
          start_time: '09:00',
          end_time: '17:00',
          is_available: false
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

  const updateAvailability = async (day, updates) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const existingDay = availability.find(a => a.day_of_week === day);

      if (existingDay?.id) {
        // Update existing availability
        const { error } = await supabase
          .from('staff_availability')
          .update({
            ...updates,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingDay.id);

        if (error) throw error;
      } else {
        // Create new availability
        const { error } = await supabase
          .from('staff_availability')
          .insert([{
            staff_id: user.id,
            day_of_week: day,
            ...updates
          }]);

        if (error) throw error;
      }

      await fetchAvailability();
      showNotification('Availability updated successfully', 'success');
    } catch (error) {
      console.error('Error updating availability:', error);
      showNotification('Error updating availability', 'error');
    }
  };

  if (loading) {
    return <div className="text-secondary">Loading availability...</div>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gold">Availability Settings</h3>
      <div className="grid gap-4">
        {availability.map(day => (
          <div 
            key={day.day_of_week}
            className="p-4 bg-container border border-border rounded-lg"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <input
                  type="checkbox"
                  id={`available-${day.day_of_week}`}
                  checked={day.is_available}
                  onChange={(e) => updateAvailability(day.day_of_week, {
                    is_available: e.target.checked
                  })}
                  className="h-4 w-4 rounded border-border text-gold focus:ring-gold"
                />
                <label 
                  htmlFor={`available-${day.day_of_week}`}
                  className="capitalize font-medium text-primary"
                >
                  {day.day_of_week}
                </label>
              </div>
              <div className="flex items-center gap-4">
                <input
                  type="time"
                  value={day.start_time}
                  onChange={(e) => updateAvailability(day.day_of_week, {
                    start_time: e.target.value,
                    is_available: true
                  })}
                  className="bg-input border border-border rounded px-2 py-1"
                />
                <span className="text-secondary">to</span>
                <input
                  type="time"
                  value={day.end_time}
                  onChange={(e) => updateAvailability(day.day_of_week, {
                    end_time: e.target.value,
                    is_available: true
                  })}
                  className="bg-input border border-border rounded px-2 py-1"
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