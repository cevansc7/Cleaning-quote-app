import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';

function StaffCalendar() {
  const [view, setView] = useState('week'); // 'day', 'week', 'month'
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { showNotification } = useNotification();

  // Time slots for the day view (30-minute intervals)
  const timeSlots = Array.from({ length: 32 }, (_, i) => {
    const hour = Math.floor(i / 2) + 8; // Start at 8 AM
    const minutes = (i % 2) * 30;
    return `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  });

  const fetchSchedule = useCallback(async () => {
    try {
      setLoading(true);
      
      // Calculate date range based on view
      let startDate, endDate;
      if (view === 'day') {
        startDate = new Date(currentDate.setHours(0, 0, 0, 0));
        endDate = new Date(currentDate.setHours(23, 59, 59, 999));
      } else if (view === 'week') {
        startDate = new Date(currentDate);
        startDate.setDate(startDate.getDate() - startDate.getDay());
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
      } else {
        startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      }

      const { data, error } = await supabase
        .from('staff_schedules')
        .select(`
          *,
          bookings (*)
        `)
        .eq('staff_id', user.id)
        .gte('start_time', startDate.toISOString())
        .lte('end_time', endDate.toISOString());

      if (error) throw error;

      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching schedule:', error);
      showNotification('Error loading schedule', 'error');
    } finally {
      setLoading(false);
    }
  }, [currentDate, view, user.id, showNotification]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const calculateEventPosition = (startTime) => {
    const date = new Date(startTime);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    // Convert time to pixels (each hour is 48px, starting from 8 AM)
    return (hours - 8) * 48 + (minutes / 60) * 48;
  };

  const calculateEventDuration = (startTime, endTime) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationHours = (end - start) / (1000 * 60 * 60);
    // Convert hours to pixels
    return durationHours * 48;
  };

  const navigateDate = (direction) => {
    const newDate = new Date(currentDate);
    if (view === 'day') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    } else if (view === 'week') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    } else {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    }
    setCurrentDate(newDate);
  };

  useEffect(() => {
    // Sample events for testing
    const sampleEvents = [
      {
        id: 1,
        start_time: '2024-02-12T09:00:00',
        end_time: '2024-02-12T11:00:00',
        bookings: {
          details: {
            package: 'Block Cleaning',
            rooms: {
              cleaners: 2,
              hours: 2
            }
          }
        }
      },
      {
        id: 2,
        start_time: '2024-02-12T13:00:00',
        end_time: '2024-02-12T15:30:00',
        bookings: {
          details: {
            package: 'Breathe Easy',
            serviceType: 'standardCleaning'
          }
        }
      }
    ];
    setEvents(sampleEvents);
    setLoading(false);
  }, []);

  const renderDayView = () => (
    <div className="day-view">
      <div className="grid grid-cols-[100px_1fr] gap-4">
        <div className="time-slots">
          {timeSlots.map(time => (
            <div key={time} className="h-12 border-b border-border text-secondary text-sm py-1">
              {time}
            </div>
          ))}
        </div>
        <div className="events-container relative border-l border-border">
          {/* Time grid lines */}
          {timeSlots.map(time => (
            <div 
              key={time} 
              className="absolute left-0 right-0 border-b border-border/30 h-12"
              style={{ top: `${timeSlots.indexOf(time) * 48}px` }}
            />
          ))}
          {/* Events */}
          {events.map(event => (
            <div
              key={event.id}
              className="absolute left-2 right-2 bg-gold/10 border border-gold/50 rounded p-2 hover:bg-gold/20 transition-colors cursor-pointer"
              style={{
                top: `${calculateEventPosition(event.start_time)}px`,
                height: `${calculateEventDuration(event.start_time, event.end_time)}px`,
                minHeight: '24px'
              }}
            >
              <p className="text-sm font-semibold text-gold truncate">
                {event.bookings?.details?.package}
              </p>
              <p className="text-xs text-secondary">
                {new Date(event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - 
                {new Date(event.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
              {event.bookings?.details?.rooms && (
                <p className="text-xs text-secondary mt-1">
                  {event.bookings.details.rooms.cleaners} cleaners • {event.bookings.details.rooms.hours} hours
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderWeekView = () => {
    // Get start of week (Sunday)
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

    // Create array of dates for the week
    const weekDates = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(startOfWeek);
      date.setDate(date.getDate() + i);
      return date;
    });

    return (
      <div className="week-view">
        <div className="grid grid-cols-7 gap-4">
          {weekDates.map(date => (
            <div key={date.toISOString()} className="text-center">
              <div className="text-secondary mb-2">
                {date.toLocaleDateString('en-US', { weekday: 'short' })}
              </div>
              <div className={`text-sm ${
                date.toDateString() === new Date().toDateString() 
                  ? 'text-gold font-semibold' 
                  : 'text-primary'
              }`}>
                {date.getDate()}
              </div>
              <div className="mt-2 min-h-[200px] border border-border/30 rounded p-2">
                {events
                  .filter(event => {
                    const eventDate = new Date(event.start_time);
                    return eventDate.toDateString() === date.toDateString();
                  })
                  .map(event => (
                    <div
                      key={event.id}
                      className="mb-2 p-2 bg-gold/10 border border-gold/50 rounded text-left hover:bg-gold/20 transition-colors cursor-pointer"
                    >
                      <p className="text-sm font-semibold text-gold truncate">
                        {event.bookings?.details?.package}
                      </p>
                      <p className="text-xs text-secondary">
                        {new Date(event.start_time).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderMonthView = () => {
    // Get first day of month
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    // Get last day of month
    const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    // Get start of first week (might be in previous month)
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    // Create array of week arrays
    const weeks = [];
    let currentWeek = [];
    const iterationDate = new Date(startDate);

    while (iterationDate <= lastDay || currentWeek.length > 0) {
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }

      currentWeek.push(new Date(iterationDate));
      iterationDate.setDate(iterationDate.getDate() + 1);

      if (iterationDate > lastDay && currentWeek.length < 7) {
        while (currentWeek.length < 7) {
          currentWeek.push(new Date(iterationDate));
          iterationDate.setDate(iterationDate.getDate() + 1);
        }
        weeks.push(currentWeek);
        break;
      }
    }

    return (
      <div className="month-view">
        <div className="grid grid-cols-7 gap-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-secondary p-2">
              {day}
            </div>
          ))}
          {weeks.map((week, weekIndex) => (
            week.map((date, dayIndex) => (
              <div
                key={`${weekIndex}-${dayIndex}`}
                className={`min-h-[100px] border border-border/30 p-2 ${
                  date.getMonth() !== currentDate.getMonth() ? 'bg-background/50' : ''
                }`}
              >
                <div className={`text-sm mb-1 ${
                  date.toDateString() === new Date().toDateString()
                    ? 'text-gold font-semibold'
                    : date.getMonth() === currentDate.getMonth()
                      ? 'text-primary'
                      : 'text-secondary'
                }`}>
                  {date.getDate()}
                </div>
                <div className="space-y-1">
                  {events
                    .filter(event => {
                      const eventDate = new Date(event.start_time);
                      return eventDate.toDateString() === date.toDateString();
                    })
                    .map(event => (
                      <div
                        key={event.id}
                        className="text-xs p-1 bg-gold/10 border border-gold/50 rounded truncate hover:bg-gold/20 transition-colors cursor-pointer"
                      >
                        {new Date(event.start_time).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })} - {event.bookings?.details?.package}
                      </div>
                    ))}
                </div>
              </div>
            ))
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="staff-calendar bg-container border border-border rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gold">Schedule</h2>
        <div className="flex items-center gap-4">
          <div className="flex rounded overflow-hidden">
            <button
              onClick={() => setView('day')}
              className={`px-4 py-2 ${
                view === 'day' 
                  ? 'bg-gold text-background' 
                  : 'bg-background text-secondary hover:text-gold'
              }`}
            >
              Day
            </button>
            <button
              onClick={() => setView('week')}
              className={`px-4 py-2 ${
                view === 'week' 
                  ? 'bg-gold text-background' 
                  : 'bg-background text-secondary hover:text-gold'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setView('month')}
              className={`px-4 py-2 ${
                view === 'month' 
                  ? 'bg-gold text-background' 
                  : 'bg-background text-secondary hover:text-gold'
              }`}
            >
              Month
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateDate('prev')}
              className="text-secondary hover:text-gold"
            >
              ←
            </button>
            <span className="text-primary">
              {currentDate.toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
                ...(view === 'day' && { day: 'numeric' })
              })}
            </span>
            <button
              onClick={() => navigateDate('next')}
              className="text-secondary hover:text-gold"
            >
              →
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-secondary py-8">Loading schedule...</div>
      ) : (
        <div className="calendar-content">
          {view === 'day' && renderDayView()}
          {view === 'week' && renderWeekView()}
          {view === 'month' && renderMonthView()}
        </div>
      )}
    </div>
  );
}

export default StaffCalendar; 