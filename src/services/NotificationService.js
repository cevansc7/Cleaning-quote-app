import { supabase } from '../lib/supabaseClient';

class NotificationService {
  static async getNotifications(userId) {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching notifications:', error);
      throw error;
    }
  }

  static async markAsRead(notificationId) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) throw error;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  static async createReminder(booking) {
    const reminderTime = new Date(booking.cleaning_date);
    reminderTime.setHours(reminderTime.getHours() - 24); // 24 hours before

    try {
      const { error } = await supabase
        .from('notifications')
        .insert([{
          recipient_id: booking.client_id,
          type: 'reminder',
          title: 'Upcoming Cleaning Reminder',
          message: `Your cleaning is scheduled for tomorrow at ${new Date(booking.cleaning_date).toLocaleTimeString()}`,
          booking_id: booking.id,
          metadata: {
            cleaning_date: booking.cleaning_date
          }
        }]);

      if (error) throw error;
    } catch (error) {
      console.error('Error creating reminder:', error);
      throw error;
    }
  }

  // Subscribe to real-time notifications
  static subscribeToNotifications(userId, onNotification) {
    return supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`
        },
        (payload) => {
          onNotification(payload.new);
        }
      )
      .subscribe();
  }
}

export default NotificationService; 