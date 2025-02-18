import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { supabase } from '../lib/supabaseClient';

function Dashboard() {
  const navigate = useNavigate();
  const { user, signOut, profile } = useAuth();
  const { showNotification } = useNotification();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');

  const fetchBookings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('client_id', user.id)
        .eq('status', statusFilter)
        .order('cleaning_date', { ascending: true });

      if (error) throw error;
      setBookings(data || []);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      showNotification('Error loading bookings', 'error');
    } finally {
      setLoading(false);
    }
  }, [user.id, statusFilter]);

  const cancelBooking = async (bookingId) => {
    try {
      if (!window.confirm('Are you sure you want to cancel this booking?')) {
        return;
      }

      setLoading(true);
      console.log('Cancelling booking:', bookingId);

      const { error } = await supabase
        .from('bookings')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId)
        .eq('client_id', user.id);

      if (error) {
        console.error('Cancel error:', error);
        throw error;
      }

      // Refresh bookings
      await fetchBookings();
      showNotification('Booking cancelled successfully', 'success');

    } catch (error) {
      console.error('Error cancelling booking:', error);
      showNotification('Failed to cancel booking: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchBookings();

    // Set up real-time subscription
    const subscription = supabase
      .channel('bookings_channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings'
        },
        (payload) => {
          console.log('Booking changed:', payload);
          fetchBookings();
        }
      )
      .subscribe();

    // Cleanup subscription
    return () => {
      subscription.unsubscribe();
    };
  }, [fetchBookings]);

  const handleSignOut = async () => {
    try {
      setLoading(true);
      await signOut();
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Error signing out:', error);
      showNotification('Error signing out. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleNewBooking = () => {
    navigate('/');  // Navigate to quote calculator
  };

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-container border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <span className="text-gold">Welcome, {profile?.name || user.email}</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-input border border-border rounded px-3 py-1 text-primary"
              >
                <option value="pending">Current Bookings</option>
                <option value="cancelled">Cancelled Bookings</option>
              </select>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/settings')}
                className="text-secondary hover:text-gold transition-colors"
              >
                Settings
              </button>
              <button
                onClick={handleSignOut}
                className="text-secondary hover:text-gold transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-gold">
            {statusFilter === 'pending' ? 'Current Bookings' : 'Cancelled Bookings'}
          </h1>
          <button
            onClick={handleNewBooking}
            className="btn-secondary"
          >
            Book New Cleaning
          </button>
        </div>

        {loading ? (
          <div className="text-center text-secondary">Loading your bookings...</div>
        ) : bookings.length === 0 ? (
          <div className="text-center text-secondary">
            <p>No {statusFilter} bookings found.</p>
            {statusFilter === 'pending' && (
              <p className="mt-2">Book your first cleaning service today!</p>
            )}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {bookings.map(booking => (
              <div
                key={booking.id}
                className="bg-container border border-border rounded-lg p-6 hover:border-gold transition-colors"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-gold font-semibold">
                      {new Date(booking.cleaning_date).toLocaleDateString()}
                    </p>
                    <p className="text-secondary text-sm">
                      {new Date(booking.cleaning_date).toLocaleTimeString()}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm ${booking.status === 'completed' ? 'bg-success/20 text-success' :
                    booking.status === 'pending' ? 'bg-gold/20 text-gold' :
                      'bg-error/20 text-error'
                    }`}>
                    {booking.status}
                  </span>
                </div>
                <div className="text-secondary">
                  <p>Service: {booking.details.package}</p>
                  <p>Price: ${booking.details.price}</p>
                </div>

                {statusFilter === 'pending' && (
                  <button
                    onClick={() => cancelBooking(booking.id)}
                    className="mt-4 w-full btn-secondary"
                  >
                    Cancel Booking
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default Dashboard; 