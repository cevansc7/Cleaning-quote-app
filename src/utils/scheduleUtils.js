export const checkScheduleConflict = (newSchedule, existingSchedules) => {
  const newStart = new Date(newSchedule.start_time);
  const newEnd = new Date(newSchedule.end_time);

  return existingSchedules.some(schedule => {
    const existingStart = new Date(schedule.start_time);
    const existingEnd = new Date(schedule.end_time);

    // Check if the new schedule overlaps with an existing one
    const hasConflict = newStart < existingEnd && newEnd > existingStart;
    
    if (hasConflict) {
      console.log('Conflict found:', {
        new: { start: newStart, end: newEnd },
        existing: { start: existingStart, end: existingEnd }
      });
    }

    return hasConflict;
  });
};

export const checkAvailabilityConflict = (schedule, availability) => {
  const scheduleDate = new Date(schedule.start_time);
  const dayOfWeek = scheduleDate.toLocaleLowerCase().split(',')[0];
  
  const dayAvailability = availability.find(a => a.day_of_week === dayOfWeek);
  
  if (!dayAvailability?.is_available) {
    return { hasConflict: true, reason: 'Staff is not available on this day' };
  }

  const scheduleTime = scheduleDate.toTimeString().slice(0, 5);
  if (scheduleTime < dayAvailability.start_time || scheduleTime > dayAvailability.end_time) {
    return { 
      hasConflict: true, 
      reason: `Schedule time ${scheduleTime} is outside available hours (${dayAvailability.start_time}-${dayAvailability.end_time})`
    };
  }

  return { hasConflict: false };
}; 