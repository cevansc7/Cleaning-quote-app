import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNotification } from '../contexts/NotificationContext';
import ScheduleCalendar from './ScheduleCalendar';
import StaffAvailability from './StaffAvailability';

function StaffSchedule() {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showNotification } = useNotification();
  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('staff_schedules')
        .select(`
          *,
          bookings (
            id,
            cleaning_date,
            status,
            details
          )
        `)
        .eq('staff_id', user.id)
        .order('start_time', { ascending: true });

      if (error) throw error;

      console.log('Fetched schedules:', data);
      setSchedules(data || []);
    } catch (error) {
      console.error('Error fetching schedules:', error);
      showNotification('Error loading schedules', 'error');
    } finally {
      setLoading(false);
    }
  };

  const updateScheduleStatus = async (scheduleId, newStatus) => {
    try {
      const { error } = await supabase
        .from('staff_schedules')
        .update({ status: newStatus })
        .eq('id', scheduleId);

      if (error) throw error;

      setSchedules(schedules.map(schedule => 
        schedule.id === scheduleId 
          ? { ...schedule, status: newStatus }
          : schedule
      ));

      showNotification('Schedule updated successfully', 'success');
    } catch (error) {
      console.error('Error updating schedule:', error);
      showNotification('Error updating schedule', 'error');
    }
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const handleEventClick = (eventDetails) => {
    setSelectedEvent(eventDetails);
  };

  if (loading) {
    return <div className="text-secondary">Loading schedules...</div>;
  }

  if (!schedules.length) {
    return <div className="text-secondary">No scheduled cleanings found.</div>;
  }

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-semibold text-gold">My Schedule</h2>
      
      <StaffAvailability />
      
      <div className="min-h-[800px] w-full">
        <ScheduleCalendar 
          schedules={schedules} 
          onEventClick={handleEventClick}
        />
      </div>

      {selectedEvent && (
        <div className="mt-4 p-4 bg-container border border-border rounded-lg">
          <h3 className="font-semibold text-primary mb-2">
            Selected Cleaning Details
          </h3>
          <p className="text-secondary">Status: {selectedEvent.status}</p>
          <p className="text-secondary">Notes: {selectedEvent.notes}</p>
          {/* Add more details as needed */}
        </div>
      )}

      {schedules.map(schedule => (
        <div 
          key={schedule.id}
          className="p-4 bg-container border border-border rounded-lg"
        >
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold text-primary">
                {schedule.bookings?.details?.package === 'breatheEasy' 
                  ? 'Breathe Easy Cleaning'
                  : 'Block Cleaning'}
              </h3>
              <p className="text-secondary text-sm">
                {formatDateTime(schedule.start_time)}
              </p>
              <p className="text-secondary text-sm">
                Duration: 2 hours
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <span className={`
                px-2 py-1 rounded text-sm
                ${schedule.status === 'completed' ? 'bg-success/20 text-success' : 
                  schedule.status === 'in_progress' ? 'bg-gold/20 text-gold' : 
                  'bg-secondary/20 text-secondary'}
              `}>
                {schedule.status.replace('_', ' ')}
              </span>
              {schedule.status === 'scheduled' && (
                <button
                  onClick={() => updateScheduleStatus(schedule.id, 'in_progress')}
                  className="btn-secondary text-sm"
                >
                  Start Cleaning
                </button>
              )}
              {schedule.status === 'in_progress' && (
                <button
                  onClick={() => updateScheduleStatus(schedule.id, 'completed')}
                  className="btn-secondary text-sm"
                >
                  Mark Complete
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default StaffSchedule; 