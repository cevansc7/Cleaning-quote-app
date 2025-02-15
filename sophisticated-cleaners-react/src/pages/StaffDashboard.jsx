import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { useNotification } from '../contexts/NotificationContext';
import CleaningChecklist from '../components/CleaningChecklist';
import StaffCalendar from '../components/StaffCalendar';
import { checkScheduleConflict, checkAvailabilityConflict } from '../utils/scheduleUtils';
import CleaningNotes from '../components/CleaningNotes';
import BookingMap from '../components/BookingMap';
import NotificationBell from '../components/NotificationBell';
import ReviewsList from '../components/ReviewsList';
import StaffAvailability from '../components/StaffAvailability';
import BookingModal from '../components/BookingModal';

function StaffDashboard() {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showNotification } = useNotification();
  const [statusFilter, setStatusFilter] = useState('pending');
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [activeTab, setActiveTab] = useState('bookings');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [unassignedJobs, setUnassignedJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(true);

  useEffect(() => {
    // Check user role on mount
    const checkRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        console.log('Staff Dashboard - Current user:', {
          id: user?.id,
          email: user?.email,
          role: user?.user_metadata?.role,
          raw: user
        });

        // First check if user exists in staff table
        const { data: staffMember, error: staffError } = await supabase
          .from('staff')
          .select('*')
          .eq('email', user.email)
          .single();

        if (staffError) {
          console.error('Error checking staff:', staffError);
          showNotification('Error verifying staff status', 'error');
          navigate('/login');
          return;
        }

        // If they're in staff table but don't have role metadata, update it
        if (staffMember && (!user?.user_metadata?.role || user.user_metadata.role !== 'staff')) {
          const { error: updateError } = await supabase.auth.updateUser({
            data: { role: 'staff' }
          });

          if (updateError) {
            console.error('Error updating user role:', updateError);
            showNotification('Error updating user role', 'error');
            navigate('/login');
            return;
          }
        }
        
        // Now check the role
        if (!staffMember || !user?.user_metadata?.role || user.user_metadata.role !== 'staff') {
          console.error('User does not have staff role:', user?.user_metadata?.role);
          showNotification('Access denied - Staff role required', 'error');
          navigate('/login');
        }
      } catch (error) {
        console.error('Error in checkRole:', error);
        showNotification('Error checking user role', 'error');
        navigate('/login');
      }
    };
    
    checkRole();
  }, [navigate, showNotification]);

  useEffect(() => {
    const refreshSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.refreshSession();
        if (error) throw error;
        
        console.log('Refreshed session:', {
          user: session?.user,
          role: session?.user?.user_metadata?.role
        });
        
        // Force reload if role is missing
        if (!session?.user?.user_metadata?.role) {
          await supabase.auth.signOut();
          window.location.href = '/login';
        }
      } catch (error) {
        console.error('Session refresh error:', error);
        showNotification('Session error - please login again', 'error');
        navigate('/login');
      }
    };

    refreshSession();
  }, [navigate, showNotification]);

  useEffect(() => {
    if (activeTab === 'available') {
      fetchUnassignedJobs();
    }
  }, [activeTab]);

  // Add auto-refresh for available jobs
  useEffect(() => {
    let interval;
    if (activeTab === 'available') {
      // Initial fetch
      fetchUnassignedJobs();
      // Then refresh every 30 seconds
      interval = setInterval(fetchUnassignedJobs, 30000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeTab]);

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      
      // First, get the bookings
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('*')
        .neq('status', 'cancelled')  // Always exclude cancelled bookings except in cancelled view
        .eq('status', activeTab === 'unassigned' ? 'unassigned' : 
          statusFilter === 'cancelled' ? 'cancelled' : statusFilter)
        .order('cleaning_date', { ascending: true });

      if (bookingsError) {
        console.error('Error fetching bookings:', bookingsError);
        throw bookingsError;
      }

      // Then, get the staff schedules for these bookings
      const { data: schedulesData, error: schedulesError } = await supabase
        .from('staff_schedules')
        .select(`
          *,
          staff (
            id,
            email,
            name
          ),
          booking_id
        `)
        .in('booking_id', bookingsData.map(booking => booking.id));

      if (schedulesError) {
        console.error('Error fetching schedules:', schedulesError);
        throw schedulesError;
      }

      // Combine the data
      const combinedData = bookingsData.map(booking => ({
        ...booking,
        staff_schedules: schedulesData.filter(schedule => schedule.booking_id === booking.id)
      }));

      // If we're looking for unassigned jobs, filter them
      if (activeTab === 'unassigned') {
        const unassignedData = combinedData.filter(booking => 
          !booking.staff_schedules || booking.staff_schedules.length === 0
        );
        setBookings(unassignedData);
      } else {
        setBookings(combinedData || []);
      }

    } catch (error) {
      console.error('Error fetching bookings:', error);
      showNotification('Error loading bookings', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeTab, statusFilter, showNotification]);

  // Update useEffect to respond to activeTab changes
  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const updateBookingStatus = async (bookingId, newStatus) => {
    try {
      if (!window.confirm(`Are you sure you want to mark this booking as ${newStatus}?`)) {
        return;
      }

      // Get the current user
      const { data: { user } } = await supabase.auth.getUser();

      // If marking as pending, check for conflicts first
      if (newStatus === 'pending') {
        const booking = bookings.find(b => b.id === bookingId);
        if (booking) {
          // Get staff's existing schedules
          const { data: existingSchedules, error: schedulesError } = await supabase
            .from('staff_schedules')
            .select('*')
            .eq('staff_id', user.id);

          if (schedulesError) throw schedulesError;

          // Get staff's availability
          const { data: availability, error: availabilityError } = await supabase
            .from('staff_availability')
            .select('*')
            .eq('staff_id', user.id);

          if (availabilityError) throw availabilityError;

          // Create proposed schedule
          const newSchedule = {
            start_time: booking.cleaning_date,
            end_time: new Date(new Date(booking.cleaning_date).getTime() + 2 * 60 * 60 * 1000).toISOString()
          };

          // Check for schedule conflicts
          const hasScheduleConflict = checkScheduleConflict(newSchedule, existingSchedules || []);
          if (hasScheduleConflict) {
            showNotification('Cannot accept booking - Schedule conflict detected', 'error');
            return;
          }

          // Check for availability conflicts
          const availabilityCheck = checkAvailabilityConflict(newSchedule, availability || []);
          if (availabilityCheck.hasConflict) {
            showNotification(`Cannot accept booking - ${availabilityCheck.reason}`, 'error');
            return;
          }

          // If no conflicts, create the schedule
          const { error: createError } = await supabase
            .from('staff_schedules')
            .insert([{
              staff_id: user.id,
              booking_id: bookingId,
              start_time: newSchedule.start_time,
              end_time: newSchedule.end_time,
              status: 'scheduled',
              notes: `${booking.details.package} cleaning service`
            }]);

          if (createError) throw createError;
        }
      }

      // Update the booking status
      const { error: updateError } = await supabase
        .from('bookings')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId);

      if (updateError) throw updateError;

      // Refresh the bookings list
      await fetchBookings();
      
      showNotification(`Booking marked as ${newStatus}`, 'success');

    } catch (error) {
      console.error('Error updating booking:', error);
      showNotification('Failed to update booking: ' + error.message, 'error');
    }
  };

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
      showNotification('Error signing out', 'error');
    }
  };

  const clearDashboardData = () => {
    // Clear localStorage
    localStorage.removeItem('staffDashboardBookings');
    localStorage.removeItem('lastStatusFilter');
    
    // Reset states
    setBookings([]);
    setStatusFilter('pending');
    setLastUpdate(Date.now());
    
    // Force refresh
    fetchBookings();
    
    showNotification('Dashboard data cleared', 'success');
  };

  const calculateStaffPay = (booking, role) => {
    const hourlyRate = role === 'supervisor' ? 20 : 18;
    
    if (booking.details.package === 'blockCleaning') {
      return hourlyRate * booking.details.rooms.hours;
    } else {
      // For breatheEasy, calculate hours based on rooms
      let estimatedHours = 0;
      const rooms = booking.details.rooms;
      
      // Base time for each room type
      estimatedHours += rooms.bedrooms * 0.5;     // 30 mins per bedroom
      estimatedHours += rooms.bathrooms * 0.75;    // 45 mins per bathroom
      estimatedHours += rooms.halfBathrooms * 0.5; // 30 mins per half bath
      estimatedHours += rooms.kitchens * 1;        // 1 hour per kitchen
      estimatedHours += rooms.livingRooms * 0.5;   // 30 mins per living room
      estimatedHours += rooms.bonusRooms * 0.5;    // 30 mins per bonus room
      estimatedHours += rooms.laundryRooms * 0.25; // 15 mins per laundry
      estimatedHours += rooms.offices * 0.25;      // 15 mins per office

      // Adjust for dirtiness scale (1-5)
      estimatedHours *= (1 + (rooms.dirtyScale - 1) * 0.2);

      return Math.round(hourlyRate * estimatedHours * 100) / 100;
    }
  };

  const handleAcceptJob = async (bookingId) => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      // First verify the booking is still available with a lock
      const { data: booking, error: checkError } = await supabase
        .from('bookings')
        .select('*, staff_schedules(*)')
        .eq('id', bookingId)
        .eq('status', 'unassigned')
        .single();

      if (checkError || !booking) {
        showNotification('This job is no longer available', 'error');
        fetchUnassignedJobs(); // Refresh the list
        return;
      }

      // Double check that no staff is assigned
      if (booking.staff_schedules && booking.staff_schedules.length > 0) {
        showNotification('This job has already been assigned to another staff member', 'error');
        fetchUnassignedJobs(); // Refresh the list
        return;
      }

      // Start transaction by updating status first
      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          status: 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId)
        .eq('status', 'unassigned'); // Ensure it's still unassigned

      if (updateError) {
        console.error('Error updating booking:', updateError);
        showNotification('Unable to claim job - it may have been claimed by another staff member', 'error');
        fetchUnassignedJobs();
        return;
      }

      // Calculate end time based on booking details
      const startTime = new Date(booking.cleaning_date);
      const hours = booking.details.package === 'blockCleaning' 
        ? booking.details.rooms.hours 
        : 2; // Default to 2 hours for other packages
      const endTime = new Date(startTime.getTime() + hours * 60 * 60 * 1000);

      // Create staff schedule
      const { error: scheduleError } = await supabase
        .from('staff_schedules')
        .insert({
          staff_id: user.id,
          booking_id: bookingId,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          status: 'scheduled'
        });

      if (scheduleError) {
        // If schedule creation fails, try to revert the booking status
        console.error('Error creating schedule:', scheduleError);
        const { error: revertError } = await supabase
          .from('bookings')
          .update({
            status: 'unassigned',
            updated_at: new Date().toISOString()
          })
          .eq('id', bookingId)
          .eq('status', 'pending');
        
        if (revertError) {
          console.error('Error reverting booking status:', revertError);
        }
        
        showNotification('Error claiming job - please try again', 'error');
        fetchUnassignedJobs();
        return;
      }

      showNotification('Job accepted successfully!', 'success');
      fetchUnassignedJobs(); // Refresh available jobs
      fetchBookings(); // Refresh my bookings

    } catch (error) {
      console.error('Error accepting job:', error);
      showNotification('Error accepting job: ' + error.message, 'error');
      fetchUnassignedJobs(); // Refresh the list to show current state
    } finally {
      setLoading(false);
    }
  };

  const fetchUnassignedJobs = async () => {
    try {
      setLoadingJobs(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      // First, let's check all bookings to see what's available
      const { data: allBookings, error: allError } = await supabase
        .from('bookings')
        .select('*')
        .eq('status', 'unassigned');

      console.log('All unassigned bookings:', allBookings);

      // Then do our filtered query
      const { data: unassignedBookings, error } = await supabase
        .from('bookings')
        .select(`
          *,
          staff_schedules (
            staff_id,
            start_time,
            end_time
          )
        `)
        .eq('status', 'unassigned')
        .is('staff_schedules', null)
        .order('cleaning_date', { ascending: true });

      console.log('Filtered unassigned bookings:', {
        data: unassignedBookings,
        error: error,
        query: {
          status: 'unassigned',
          staff_schedules: null
        }
      });

      if (error) throw error;

      if (!unassignedBookings || unassignedBookings.length === 0) {
        console.log('No unassigned bookings found');
      }

      setUnassignedJobs(unassignedBookings || []);
    } catch (error) {
      console.error('Error fetching unassigned jobs:', error);
      showNotification('Error loading available jobs', 'error');
    } finally {
      setLoadingJobs(false);
    }
  };

  const renderUnassignedJobs = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gold">Available Jobs</h2>
        <button
          onClick={fetchUnassignedJobs}
          className="text-secondary hover:text-gold transition-colors"
        >
          Refresh
        </button>
      </div>

      {loadingJobs ? (
        <div className="text-center text-secondary">Loading available jobs...</div>
      ) : unassignedJobs.length === 0 ? (
        <div className="text-center text-secondary">No available jobs at this time</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {unassignedJobs.map(booking => (
            <div
              key={booking.id}
              className="bg-container border border-border rounded-lg p-4 sm:p-6 hover:border-gold/50 transition-colors"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-gold font-semibold">
                    {new Date(booking.cleaning_date).toLocaleDateString()}
                  </p>
                  <p className="text-secondary text-sm">
                    {new Date(booking.cleaning_date).toLocaleTimeString([], {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true
                    })}
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-sm bg-blue-400/20 text-blue-400">
                  Available
                </span>
              </div>

              <div className="space-y-3">
                <div className="p-3 rounded bg-background">
                  <p className="text-primary font-medium">Service Details</p>
                  <div className="mt-2 space-y-1 text-secondary text-sm">
                    <p>Package: {booking.details.package}</p>
                    <p>Number of Cleaners: {booking.details.rooms?.cleaners || 1}</p>
                    <p>Hours: {booking.details.rooms?.hours || 1}</p>
                    <p className="text-gold">Your Pay: ${calculateStaffPay(booking)}</p>
                  </div>
                </div>

                <div className="p-3 rounded bg-background">
                  <p className="text-primary font-medium">Location</p>
                  <p className="mt-1 text-secondary text-sm">
                    {booking.details.address.street},
                    <br />
                    {booking.details.address.city}, {booking.details.address.state} {booking.details.address.zipCode}
                  </p>
                </div>

                <button
                  onClick={() => handleAcceptJob(booking.id)}
                  className="w-full px-4 py-2 bg-gold text-background rounded hover:bg-gold/90 transition-colors"
                >
                  Accept Job
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile-friendly navigation */}
      <nav className="bg-container border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <span className="text-gold font-semibold">Staff Dashboard</span>
            
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
            <div className="hidden md:flex items-center space-x-8">
              <button
                onClick={() => setActiveTab('bookings')}
                className={`px-3 py-2 text-sm font-medium ${
                  activeTab === 'bookings'
                    ? 'text-gold border-b-2 border-gold'
                    : 'text-secondary hover:text-primary'
                }`}
              >
                My Bookings
              </button>
              <button
                onClick={() => setActiveTab('available')}
                className={`px-3 py-2 text-sm font-medium ${
                  activeTab === 'available'
                    ? 'text-gold border-b-2 border-gold'
                    : 'text-secondary hover:text-primary'
                }`}
              >
                Available Jobs
              </button>
              <button
                onClick={() => setActiveTab('schedule')}
                className={`px-3 py-2 text-sm font-medium ${
                  activeTab === 'schedule'
                    ? 'text-gold border-b-2 border-gold'
                    : 'text-secondary hover:text-primary'
                }`}
              >
                Schedule
              </button>
              <button
                onClick={() => setActiveTab('reviews')}
                className={`px-3 py-2 text-sm font-medium ${
                  activeTab === 'reviews'
                    ? 'text-gold border-b-2 border-gold'
                    : 'text-secondary hover:text-primary'
                }`}
              >
                Reviews
              </button>
              
              {/* Add sign out button */}
              <button
                onClick={handleSignOut}
                className="px-3 py-2 text-sm font-medium text-error hover:text-error/80"
              >
                Sign Out
              </button>
            </div>
          </div>

          {/* Mobile menu */}
          <div className={`md:hidden ${isMenuOpen ? 'block' : 'hidden'} pb-3`}>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  setActiveTab('bookings');
                  setIsMenuOpen(false);
                }}
                className={`px-3 py-2 text-sm font-medium ${
                  activeTab === 'bookings'
                    ? 'text-gold bg-container'
                    : 'text-secondary hover:text-primary'
                }`}
              >
                My Bookings
              </button>
              <button
                onClick={() => {
                  setActiveTab('available');
                  setIsMenuOpen(false);
                }}
                className={`px-3 py-2 text-sm font-medium ${
                  activeTab === 'available'
                    ? 'text-gold bg-container'
                    : 'text-secondary hover:text-primary'
                }`}
              >
                Available Jobs
              </button>
              <button
                onClick={() => {
                  setActiveTab('schedule');
                  setIsMenuOpen(false);
                }}
                className={`px-3 py-2 text-sm font-medium ${
                  activeTab === 'schedule'
                    ? 'text-gold bg-container'
                    : 'text-secondary hover:text-primary'
                }`}
              >
                Schedule
              </button>
              <button
                onClick={() => {
                  setActiveTab('reviews');
                  setIsMenuOpen(false);
                }}
                className={`px-3 py-2 text-sm font-medium ${
                  activeTab === 'reviews'
                    ? 'text-gold bg-container'
                    : 'text-secondary hover:text-primary'
                }`}
              >
                Reviews
              </button>

              {/* Add divider and sign out button */}
              <div className="my-2 border-t border-border"></div>
              <button
                onClick={handleSignOut}
                className="px-3 py-2 text-sm font-medium text-error hover:text-error/80"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'bookings' ? (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-8">
              <h1 className="text-2xl font-bold text-gold">Bookings</h1>
              <div className="flex gap-4 items-center">
                <button
                  onClick={clearDashboardData}
                  className="text-secondary hover:text-gold transition-colors"
                >
                  Refresh Data
                </button>
              </div>
            </div>

            {loading ? (
              <div className="text-center text-secondary">Loading bookings...</div>
            ) : bookings.length === 0 ? (
              <div className="text-center text-secondary">
                No {statusFilter} bookings
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {bookings.map(booking => (
                    <div
                      key={booking.id}
                      className="bg-container border border-border rounded-lg p-4 sm:p-6 hover:border-gold/50 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className="text-gold font-semibold">
                            {new Date(booking.cleaning_date).toLocaleDateString()}
                          </p>
                          <p className="text-secondary text-sm">
                            {new Date(booking.cleaning_date).toLocaleTimeString([], {
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true
                            })}
                          </p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm ${
                          booking.status === 'completed' ? 'bg-success/20 text-success' :
                          booking.status === 'pending' ? 'bg-gold/20 text-gold' :
                          'bg-error/20 text-error'
                        }`}>
                          {booking.status}
                        </span>
                      </div>
                      
                      <div className="text-secondary mb-4">
                        <p>Service: {booking.details.package}</p>
                        {booking.details.package === 'blockCleaning' && (
                          <div className="mt-2">
                            <p>Number of Cleaners: {booking.details.rooms.cleaners}</p>
                            <p>Number of Hours: {booking.details.rooms.hours}</p>
                          </div>
                        )}
                        <p className="mt-2 text-gold font-semibold">
                          Your Pay: ${calculateStaffPay(booking, user?.user_metadata?.role || 'cleaner')}
                        </p>
                      </div>

                      <div className="mt-4 text-secondary">
                        <div className="mt-4 pt-4 border-t border-border">
                          <h3 className="text-gold font-semibold mb-2">Assigned Staff</h3>
                          {booking.staff_schedules?.length > 0 ? (
                            <div className="space-y-2">
                              {booking.staff_schedules.map(staff => (
                                <div
                                  key={staff.id}
                                  className="flex items-center justify-between p-2 rounded bg-background"
                                >
                                  <div>
                                    <p className="text-primary">
                                      {staff.staff.name}
                                    </p>
                                  </div>
                                  {staff.staff.id === user.id && (
                                    <span className="text-gold text-sm">
                                      Assigned
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-secondary text-sm">No staff assigned yet</p>
                          )}
                        </div>

                        {booking.status === 'pending' && (
                          <button
                            onClick={() => updateBookingStatus(booking.id, 'completed')}
                            className="w-full mt-4 px-4 py-2 bg-success text-white rounded hover:bg-success/90 transition-colors"
                          >
                            Mark as Completed
                          </button>
                        )}

                        <div className="mt-4 pt-4 border-t border-border">
                          <h3 className="text-gold font-semibold mb-2">Client Information</h3>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="form-group">
                              <label className="text-secondary">Email</label>
                              <input
                                type="text"
                                value={booking.client_email}
                                readOnly
                                className="w-full bg-input border border-border rounded px-3 py-2 text-primary focus:outline-none focus:border-gold"
                              />
                            </div>
                            <div className="form-group">
                              <label className="text-secondary">Phone</label>
                              <input
                                type="text"
                                value={booking.client_phone || 'Not provided'}
                                readOnly
                                className="w-full bg-input border border-border rounded px-3 py-2 text-primary focus:outline-none focus:border-gold"
                              />
                            </div>
                          </div>
                          {booking.details?.address && (
                            <div className="mt-4">
                              <label className="text-secondary">Address</label>
                              <input
                                type="text"
                                value={`${booking.details.address.street}, ${booking.details.address.city}, ${booking.details.address.state} ${booking.details.address.zipCode}`}
                                readOnly
                                className="w-full bg-input border border-border rounded px-3 py-2 text-primary focus:outline-none focus:border-gold"
                              />
                            </div>
                          )}
                        </div>

                        {booking.status === 'completed' && (
                          <div className="mt-6 pt-6 border-t border-border">
                            <h3 className="text-lg font-semibold text-gold mb-4">Client Review</h3>
                            <ReviewsList bookingId={booking.id} />
                          </div>
                        )}
                      </div>

                      {/* Add the checklist component */}
                      {statusFilter === 'pending' && (
                        <div className="mt-4 border-t border-border pt-4">
                          <CleaningChecklist 
                            booking={booking} 
                            onComplete={() => {
                              fetchBookings();
                              showNotification('Booking marked as complete!', 'success');
                            }} 
                          />
                        </div>
                      )}

                      {/* Status update buttons */}
                      <div className="flex gap-2 mt-4">
                        {statusFilter === 'pending' && (
                          <button
                            onClick={() => updateBookingStatus(booking.id, 'completed')}
                            className="btn flex-1"
                          >
                            Mark Complete
                          </button>
                        )}
                        {statusFilter === 'pending' && (
                          <button
                            onClick={() => updateBookingStatus(booking.id, 'cancelled')}
                            className="btn-secondary flex-1"
                          >
                            Cancel
                          </button>
                        )}
                        {statusFilter === 'cancelled' && (
                          <button
                            onClick={() => updateBookingStatus(booking.id, 'pending')}
                            className="btn-secondary flex-1"
                          >
                            Reactivate
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {!loading && bookings.length > 0 && (
                  <div className="mb-8">
                    <h2 className="text-xl font-semibold text-gold mb-4">Booking Locations</h2>
                    <BookingMap bookings={bookings} />
                  </div>
                )}
              </>
            )}
          </div>
        ) : activeTab === 'available' ? (
          renderUnassignedJobs()
        ) : activeTab === 'schedule' ? (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-primary">Schedule Management</h2>
            </div>

            {/* Availability Management */}
            <div className="bg-container border border-border rounded-lg p-6">
              <StaffAvailability staffId={user.id} />
            </div>

            {/* Calendar/Schedule */}
            <div className="bg-container border border-border rounded-lg p-6">
              <h3 className="text-lg font-semibold text-primary mb-4">Upcoming Assignments</h3>
              <StaffCalendar />
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Reviews content */}
            <ReviewsList />
          </div>
        )}
      </main>

      <BookingModal
        booking={selectedBooking}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedBooking(null);
        }}
        role="staff"
        onStatusUpdate={(bookingId) => {
          // Add status update logic
          console.log('Update status for booking:', bookingId);
        }}
      />
    </div>
  );
}

export default StaffDashboard; 