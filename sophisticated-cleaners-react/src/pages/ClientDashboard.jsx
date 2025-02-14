import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { useNotification } from '../contexts/NotificationContext';
import { useNotificationSystem } from '../contexts/NotificationSystemContext';
import ClientChecklist from '../components/ClientChecklist';
import ReviewForm from '../components/ReviewForm';
import ReviewsList from '../components/ReviewsList';

function ClientDashboard() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showNotification } = useNotification();
  const { createNotification } = useNotificationSystem();
  const [statusFilter, setStatusFilter] = useState('all');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    fetchBookings();
  }, [statusFilter]);

  const fetchBookings = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      console.log('Fetching bookings for client:', user.id);

      // First try without status filter to see all bookings
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          staff_schedules (
            staff_id,
            start_time,
            end_time
          )
        `)
        .eq('client_id', user.id)
        // .eq('status', statusFilter) // Temporarily comment this out
        .order('cleaning_date', { ascending: true });

      if (error) {
        console.error('Error fetching bookings:', error);
        throw error;
      }

      console.log('Client Dashboard - Raw fetched bookings:', data);
      
      // Filter bookings based on status
      let filteredBookings;
      if (statusFilter === 'cancelled') {
        filteredBookings = data?.filter(booking => booking.status === 'cancelled');
      } else if (statusFilter === 'all') {
        filteredBookings = data?.filter(booking => booking.status !== 'cancelled');
      } else {
        filteredBookings = data?.filter(booking => booking.status === statusFilter);
      }
      
      console.log('Client Dashboard - Filtered bookings:', filteredBookings);
      setBookings(filteredBookings || []);
    } catch (error) {
      console.error('Error:', error);
      showNotification('Error loading bookings', 'error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, showNotification]);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleCancelBooking = async (bookingId) => {
    console.log('Attempting to cancel booking:', bookingId);
    
    if (!window.confirm('Are you sure you want to cancel this booking? This cannot be undone.')) {
      return;
    }

    try {
      // Get booking details first
      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .select(`
          *,
          staff_schedules (
            staff_id,
            staff (
              id,
              name
            )
          )
        `)
        .eq('id', bookingId)
        .single();

      if (bookingError) throw bookingError;

      // Update booking status
      const { error: updateError } = await supabase
        .from('bookings')
        .update({ 
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_reason: 'Cancelled by client'
        })
        .eq('id', bookingId);

      if (updateError) throw updateError;

      // Notify assigned staff members
      if (bookingData.staff_schedules) {
        for (const schedule of bookingData.staff_schedules) {
          if (schedule.staff_id) {
            await createNotification(
              schedule.staff_id,
              'Booking Cancelled',
              `Booking for ${new Date(bookingData.cleaning_date).toLocaleDateString()} at ${bookingData.details.address.street} has been cancelled by the client.`,
              'booking',
              `/staff/dashboard`
            );
          }
        }
      }

      // Notify admin/supervisor
      const { data: supervisors } = await supabase
        .from('staff')
        .select('id')
        .eq('role', 'supervisor');

      if (supervisors) {
        for (const supervisor of supervisors) {
          await createNotification(
            supervisor.id,
            'Booking Cancelled',
            `Booking #${bookingId.slice(0, 8)} for ${new Date(bookingData.cleaning_date).toLocaleDateString()} has been cancelled by the client.`,
            'booking',
            `/admin/dashboard`
          );
        }
      }

      showNotification('Booking cancelled successfully', 'success');
      fetchBookings(); // Refresh the list
    } catch (error) {
      console.error('Error cancelling booking:', error);
      showNotification('Error cancelling booking', 'error');
    }
  };

  const clearCancelledBookings = async () => {
    if (!window.confirm('Are you sure you want to clear all cancelled bookings? This cannot be undone.')) {
      return;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('status', 'cancelled')
        .eq('client_id', user.id)
        .is('staff_schedules', null);

      if (error) throw error;

      showNotification('Cancelled bookings cleared successfully', 'success');
      fetchBookings();
    } catch (error) {
      console.error('Error clearing cancelled bookings:', error);
      showNotification('Error clearing cancelled bookings', 'error');
    }
  };

  if (loading) {
    return <div className="text-secondary">Loading bookings...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-container border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <span className="text-gold font-semibold">My Bookings</span>

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 rounded-md text-secondary hover:text-gold focus:outline-none"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Desktop navigation */}
            <div className="hidden md:flex items-center gap-4">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-input border border-border rounded px-3 py-2 text-primary"
              >
                <option value="all">All Bookings</option>
                <option value="unassigned">Unassigned</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <button
                onClick={() => navigate('/')}
                className="px-4 py-2 bg-gold text-background rounded hover:bg-gold/90 transition-colors"
              >
                New Booking
              </button>
              <button
                onClick={handleSignOut}
                className="text-secondary hover:text-gold transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>

          {/* Mobile menu */}
          <div className={`md:hidden ${isMenuOpen ? 'block' : 'hidden'} pb-3`}>
            <div className="flex flex-col gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full bg-input border border-border rounded px-3 py-2 text-primary"
              >
                <option value="all">All Bookings</option>
                <option value="unassigned">Unassigned</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <button
                onClick={() => {
                  navigate('/');
                  setIsMenuOpen(false);
                }}
                className="w-full px-4 py-3 bg-gold text-background rounded text-center"
              >
                New Booking
              </button>
              <button
                onClick={handleSignOut}
                className="w-full px-4 py-3 rounded text-left text-secondary hover:bg-container"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="text-center text-secondary">Loading bookings...</div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-secondary mb-4">
              No {statusFilter === 'all' ? '' : statusFilter} bookings found.
            </p>
            <button 
              onClick={() => navigate('/')} 
              className="px-6 py-3 bg-gold text-background rounded-lg hover:bg-gold/90 transition-colors"
            >
              Book a Cleaning
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map(booking => (
              <div
                key={booking.id}
                className="bg-container border border-border rounded-lg p-4 sm:p-6 hover:border-gold/50 transition-colors"
              >
                {/* Booking header */}
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-gold font-semibold">
                      {new Date(booking.cleaning_date).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </p>
                    <p className="text-secondary text-sm">
                      {new Date(booking.cleaning_date).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: 'numeric',
                        hour12: true
                      })}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm ${
                    booking.status === 'completed' ? 'bg-success/20 text-success' :
                    booking.status === 'pending' ? 'bg-gold/20 text-gold' :
                    booking.status === 'unassigned' ? 'bg-blue-400/20 text-blue-400' :
                    'bg-error/20 text-error'
                  }`}>
                    {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                  </span>
                </div>

                {/* Service details */}
                <div className="space-y-3">
                  <div className="p-3 rounded bg-background">
                    <p className="text-primary font-medium">Service Details</p>
                    <div className="mt-2 space-y-1 text-secondary text-sm">
                      <p>Package: {booking.details.package === 'breatheEasy' ? 'Breathe Easy' : 'Block Cleaning'}</p>
                      <p>Price: ${booking.details.price}</p>
                    </div>
                  </div>

                  {/* Location with tap-to-copy */}
                  {booking.details?.address && (
                    <div className="p-3 rounded bg-background">
                      <p className="text-primary font-medium">Location</p>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(
                            `${booking.details.address.street}, ${booking.details.address.city}, ${booking.details.address.state} ${booking.details.address.zipCode}`
                          );
                          showNotification('Address copied to clipboard', 'success');
                        }}
                        className="text-secondary text-sm mt-1 hover:text-gold transition-colors text-left w-full"
                      >
                        {booking.details.address.street},
                        <br />
                        {booking.details.address.city}, {booking.details.address.state} {booking.details.address.zipCode}
                      </button>
                    </div>
                  )}

                  {/* Status messages and actions */}
                  {(booking.status === 'unassigned' || booking.status === 'pending') && (
                    <div className="p-3 rounded bg-blue-400/10">
                      <p className="text-blue-400 text-sm">
                        {booking.status === 'unassigned' 
                          ? 'Your booking has been received and is waiting for staff assignment.'
                          : 'Your booking has been assigned and is pending completion.'
                        }
                      </p>
                      <button
                        onClick={() => handleCancelBooking(booking.id)}
                        className="w-full mt-3 px-4 py-2 bg-error/10 text-error border border-error/20 rounded hover:bg-error/20 transition-colors"
                      >
                        Cancel Booking
                      </button>
                    </div>
                  )}

                  {/* Staff information */}
                  {booking.staff_schedules?.length > 0 && (
                    <div className="p-3 rounded bg-background">
                      <p className="text-primary font-medium mb-2">Cleaning Staff</p>
                      {booking.staff_schedules.map((schedule, index) => (
                        <div key={index} className="text-sm text-secondary">
                          Arriving at {new Date(schedule.start_time).toLocaleTimeString([], {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Checklist */}
                {(booking.status === 'pending' || booking.status === 'completed') && (
                  <div className="mt-4">
                    <ClientChecklist bookingId={booking.id} />
                  </div>
                )}

                {/* Add review section for completed bookings */}
                {booking.status === 'completed' && (
                  <div className="mt-6 pt-6 border-t border-border">
                    <h3 className="text-lg font-semibold text-gold mb-4">Your Review</h3>
                    <ReviewForm 
                      bookingId={booking.id}
                      onReviewSubmitted={fetchBookings}
                    />
                  </div>
                )}
              </div>
            ))}
            {statusFilter === 'cancelled' && bookings.length > 0 && (
              <button
                onClick={clearCancelledBookings}
                className="mt-4 px-4 py-2 bg-error/10 text-error border border-error/20 rounded hover:bg-error/20 transition-colors"
              >
                Clear All Cancelled Bookings
              </button>
            )}

            {/* Add reviews section */}
            {statusFilter === 'completed' && bookings.length > 0 && (
              <div className="mt-8">
                <h2 className="text-xl font-semibold text-gold mb-4">Your Reviews</h2>
                <ReviewsList />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default ClientDashboard; 