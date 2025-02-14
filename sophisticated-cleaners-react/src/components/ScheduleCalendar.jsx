import { useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useNotification } from '../contexts/NotificationContext';

function ScheduleCalendar({ schedules, onEventClick }) {
  const [events, setEvents] = useState([]);
  const { showNotification } = useNotification();

  useEffect(() => {
    // Convert schedules to calendar events
    const calendarEvents = schedules.map(schedule => ({
      id: schedule.id,
      title: schedule.bookings?.details?.package || 'Cleaning',
      start: schedule.start_time,
      end: schedule.end_time,
      backgroundColor: getStatusColor(schedule.status),
      extendedProps: {
        status: schedule.status,
        notes: schedule.notes,
        booking: schedule.bookings
      }
    }));
    setEvents(calendarEvents);
  }, [schedules]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return '#22c55e'; // success color
      case 'in_progress':
        return '#eab308'; // gold color
      default:
        return '#64748b'; // secondary color
    }
  };

  const handleEventClick = (clickInfo) => {
    onEventClick(clickInfo.event.extendedProps);
  };

  return (
    <div className="bg-container border border-border rounded-lg p-4" style={{ height: '800px' }}>
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay'
        }}
        events={events}
        eventClick={handleEventClick}
        height="auto"
        slotMinTime="06:00:00"
        slotMaxTime="22:00:00"
        allDaySlot={false}
        slotDuration="01:00:00"
        expandRows={true}
        stickyHeaderDates={true}
        nowIndicator={true}
        dayMaxEvents={true}
        themeSystem="standard"
        contentHeight={800}
        aspectRatio={1.8}
        handleWindowResize={true}
        dayHeaderFormat={{ weekday: 'long' }}
        dayHeaderClassNames="text-white font-bold"
        slotLabelFormat={{
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }}
      />
    </div>
  );
}

export default ScheduleCalendar; 