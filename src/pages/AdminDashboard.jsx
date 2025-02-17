import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import StaffManagement from '../components/StaffManagement';
import BookingMap from '../components/BookingMap';
import { useNotification } from '../contexts/NotificationContext';

function AdminDashboard() {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const [activeTab, setActiveTab] = useState('bookings');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showNotification } = useNotification();
  const [statusFilter, setStatusFilter] = useState('all');
  const [staffList, setStaffList] = useState([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/Boise'  // Set to your local timezone
    });
  };

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);

      // Get current session and JWT
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log('Current session:', {
        jwt: session?.access_token,
        user: session?.user,
        error: sessionError
      });

      // Check current user and role
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      console.log('Current admin user:', {
        id: currentUser?.id,
        email: currentUser?.email,
        role: currentUser?.user_metadata?.role,
        raw: currentUser
      });

      // Explicitly set auth header and include staff_schedules in the query
      const { data: allBookings, error: basicError } = await supabase
        .from('bookings')
        .select(`
          id,
          client_id,
          cleaning_date,
          status,
          payment_status,
          details,
          staff_schedules (
            id,
            staff_id,
            start_time,
            end_time,
            status,
            staff (
              name,
              phone
            )
          )
        `)
        .order('cleaning_date', { ascending: false });

      console.log('Raw bookings query:', {
        count: allBookings?.length,
        bookings: allBookings,
        error: basicError,
        userRole: currentUser?.user_metadata?.role
      });

      // If there's an error, let's see what it is
      if (basicError) {
        console.error('Bookings fetch error:', basicError);
        throw basicError;
      }

      // Then apply status filter if needed
      let filteredBookings = allBookings || [];
      if (statusFilter !== 'all') {
        filteredBookings = filteredBookings.filter(booking =>
          statusFilter === 'cancelled'
            ? booking.status === 'cancelled'
            : booking.status === statusFilter
        );
      }

      console.log('Filtered bookings:', {
        filter: statusFilter,
        count: filteredBookings?.length,
        bookings: filteredBookings
      });

      setBookings(filteredBookings);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      showNotification('Error loading bookings', 'error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, showNotification]);

  const fetchStaffMembers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('staff')
        .select(`
          id,
          email,
          name,
          role
        `);

      if (error) throw error;
      console.log('Fetched staff members:', data);
      setStaffList(data || []);
    } catch (error) {
      console.error('Error fetching staff:', error);
      showNotification('Error loading staff members', 'error');
    }
  }, [showNotification]);

  useEffect(() => {
    console.log('AdminDashboard state:', {
      activeTab,
      statusFilter,
      bookingsCount: bookings.length
    });

    fetchBookings();
    if (activeTab === 'bookings') {
      fetchStaffMembers();
    }
  }, [activeTab, statusFilter, fetchBookings, fetchStaffMembers]);

  useEffect(() => {
    // Check user role on mount
    const checkRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      console.log('Admin Dashboard - Current user:', {
        id: user?.id,
        email: user?.email,
        role: user?.user_metadata?.role,
        raw: user
      });

      if (!user?.user_metadata?.role || user.user_metadata.role !== 'admin') {
        console.error('User does not have admin role:', user?.user_metadata?.role);
        showNotification('Access denied - Admin role required', 'error');
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

  const assignStaff = async (bookingId, staffId, startTime, hours) => {
    try {
      const endTime = new Date(startTime);
      endTime.setHours(endTime.getHours() + parseInt(hours));

      // First update booking status
      const { error: bookingError } = await supabase
        .from('bookings')
        .update({
          status: 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId);

      if (bookingError) throw bookingError;

      // Then create staff schedule
      const { error: scheduleError } = await supabase
        .from('staff_schedules')
        .insert([{
          staff_id: staffId,
          booking_id: bookingId,
          start_time: new Date(startTime).toISOString(),
          end_time: endTime.toISOString()
        }]);

      if (scheduleError) throw scheduleError;

      showNotification('Staff assigned successfully', 'success');
      fetchBookings();
    } catch (error) {
      console.error('Error assigning staff:', error);
      showNotification('Error assigning staff member', 'error');
    }
  };

  const unassignStaff = async (bookingId, staffId) => {
    try {
      const { error } = await supabase
        .from('staff_schedules')
        .delete()
        .match({ booking_id: bookingId, staff_id: staffId });

      if (error) throw error;

      showNotification('Staff unassigned successfully', 'success');
      fetchBookings();
    } catch (error) {
      console.error('Error unassigning staff:', error);
      showNotification('Error unassigning staff member', 'error');
    }
  };

  // Helper function to format staff name
  const formatStaffName = (staff) => {
    if (!staff) return 'Unknown Staff';
    if (staff.name) return staff.name;
    return staff.email || 'Unknown Staff';
  };

  const handleBookingClick = (booking) => {
    setSelectedBooking(booking);
    setIsModalOpen(true);
  };

  const renderBookings = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold text-gold">All Bookings</h2>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-input border border-border rounded px-3 py-1 text-primary"
          >
            <option value="all">All Bookings</option>
            <option value="unassigned">Unassigned</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-secondary text-sm">
            {bookings.length} booking{bookings.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={fetchBookings}
            className="text-secondary hover:text-gold transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-secondary">Loading bookings...</div>
      ) : bookings.length === 0 ? (
        <div className="text-center text-secondary">No bookings found</div>
      ) : (
        <>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {bookings.map(booking => (
              <div
                key={booking.id}
                onClick={() => handleBookingClick(booking)}
                className="bg-container border border-border rounded-lg p-4 sm:p-6 hover:border-gold/50 transition-colors cursor-pointer hover:bg-container/50"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-gold font-semibold">
                      {formatDate(booking.cleaning_date)}
                    </p>
                    <p className="text-secondary text-sm">
                      {formatTime(booking.cleaning_date)}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm ${booking.status === 'completed' ? 'bg-success/20 text-success' :
                      booking.status === 'pending' ? 'bg-warning/20 text-warning' :
                        booking.status === 'unassigned' ? 'bg-error/20 text-error' :
                          'bg-gray-500/20 text-gray-500'
                    }`}>
                    {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="p-3 rounded bg-background">
                    <p className="text-primary font-medium">Service Details</p>
                    <div className="mt-2 space-y-1 text-secondary text-sm">
                      <p>Package: {booking.details.package}</p>
                      <p>Client: {booking.details.client_email || 'Not provided'}</p>
                      {booking.details.package === 'blockCleaning' && (
                        <>
                          <p>Cleaners: {booking.details.rooms.cleaners}</p>
                          <p>Hours: {booking.details.rooms.hours}</p>
                        </>
                      )}
                    </div>
                  </div>

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

                  {(booking.status === 'pending' || booking.status === 'unassigned') && (
                    <div className="p-3 rounded bg-background">
                      <p className="text-primary font-medium mb-2">Assign Staff</p>
                      <select
                        className="w-full bg-input border border-border rounded px-3 py-2 text-primary text-sm"
                        onChange={(e) => {
                          if (e.target.value) {
                            assignStaff(
                              booking.id,
                              e.target.value,
                              booking.cleaning_date,
                              booking.details.package === 'blockCleaning'
                                ? booking.details.rooms.hours
                                : 2
                            );
                          }
                        }}
                        defaultValue=""
                      >
                        <option value="" disabled>
                          {staffList.length === 0 ? 'Loading staff...' : 'Select staff member'}
                        </option>
                        {staffList.map(staff => (
                          <option
                            key={staff.id}
                            value={staff.id}
                            disabled={booking.staff_schedules?.some(
                              schedule => schedule.staff_id === staff.id
                            )}
                          >
                            {formatStaffName(staff)} {booking.staff_schedules?.some(
                              schedule => schedule.staff_id === staff.id
                            ) ? '(Already assigned)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {booking.staff_schedules?.length > 0 && (
                    <div className="p-3 rounded bg-background">
                      <p className="text-primary font-medium mb-2">Assigned Staff</p>
                      <div className="space-y-2">
                        {booking.staff_schedules.map((schedule, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-2 rounded bg-container"
                          >
                            <div className="text-sm text-secondary">
                              <p className="font-medium">{schedule.staff?.name || schedule.staff?.email || 'Unknown Staff'}</p>
                              <p className="text-xs mt-1">
                                {new Date(schedule.start_time).toLocaleTimeString([], {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                  hour12: true
                                })} -
                                {new Date(schedule.end_time).toLocaleTimeString([], {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                  hour12: true
                                })}
                              </p>
                            </div>
                            {booking.status === 'pending' && (
                              <button
                                onClick={() => unassignStaff(booking.id, schedule.staff_id)}
                                className="px-3 py-1 text-xs text-error hover:text-error/80 transition-colors"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <h3 className="text-xl font-semibold text-gold mb-4">Booking Locations</h3>
            <div className="h-[400px] sm:h-[500px] rounded-lg overflow-hidden">
              <BookingMap bookings={bookings} />
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-container border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <span className="text-gold font-semibold">Admin Dashboard</span>

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
              {user?.user_metadata?.role === 'staff' && (
                <button
                  onClick={() => navigate('/staff/dashboard')}
                  className="text-secondary hover:text-gold transition-colors"
                >
                  Staff View
                </button>
              )}
              <button
                onClick={() => setActiveTab('staff')}
                className={`px-4 py-2 rounded transition-colors ${activeTab === 'staff'
                    ? 'bg-gold text-background'
                    : 'text-secondary hover:text-gold'
                  }`}
              >
                Staff
              </button>
              <button
                onClick={() => setActiveTab('bookings')}
                className={`px-4 py-2 rounded transition-colors ${activeTab === 'bookings'
                    ? 'bg-gold text-background'
                    : 'text-secondary hover:text-gold'
                  }`}
              >
                Bookings
              </button>
              <button
                onClick={() => navigate('/settings')}
                className="text-secondary hover:text-gold transition-colors"
              >
                Settings
              </button>
              <button
                onClick={() => signOut()}
                className="text-secondary hover:text-gold transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>

          {/* Mobile menu */}
          <div className={`md:hidden ${isMenuOpen ? 'block' : 'hidden'} pb-3`}>
            <div className="flex flex-col gap-2">
              {user?.user_metadata?.role === 'staff' && (
                <button
                  onClick={() => {
                    navigate('/staff/dashboard');
                    setIsMenuOpen(false);
                  }}
                  className="w-full px-4 py-3 rounded text-left text-secondary hover:bg-container"
                >
                  Switch to Staff View
                </button>
              )}
              <button
                onClick={() => {
                  setActiveTab('staff');
                  setIsMenuOpen(false);
                }}
                className={`w-full px-4 py-3 rounded text-left ${activeTab === 'staff'
                    ? 'bg-gold text-background'
                    : 'text-secondary hover:bg-container'
                  }`}
              >
                Staff Management
              </button>
              <button
                onClick={() => {
                  setActiveTab('bookings');
                  setIsMenuOpen(false);
                }}
                className={`w-full px-4 py-3 rounded text-left ${activeTab === 'bookings'
                    ? 'bg-gold text-background'
                    : 'text-secondary hover:bg-container'
                  }`}
              >
                All Bookings
              </button>
              <button
                onClick={() => {
                  navigate('/settings');
                  setIsMenuOpen(false);
                }}
                className="w-full px-4 py-3 rounded text-left text-secondary hover:bg-container"
              >
                Settings
              </button>
              <button
                onClick={signOut}
                className="w-full px-4 py-3 rounded text-left text-secondary hover:bg-container"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {activeTab === 'staff' ? (
          <StaffManagement />
        ) : (
          <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <h2 className="text-xl font-semibold text-gold">All Bookings</h2>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full sm:w-auto bg-input border border-border rounded px-3 py-2 text-primary"
                >
                  <option value="all">All Bookings</option>
                  <option value="unassigned">Unassigned</option>
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-4">
                <span className="text-secondary text-sm">
                  {bookings.length} booking{bookings.length !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={fetchBookings}
                  className="text-secondary hover:text-gold transition-colors"
                >
                  Refresh
                </button>
              </div>
            </div>

            {loading ? (
              <div className="text-center text-secondary">Loading bookings...</div>
            ) : bookings.length === 0 ? (
              <div className="text-center text-secondary">No bookings found</div>
            ) : (
              <>
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {bookings.map(booking => (
                    <div
                      key={booking.id}
                      onClick={() => handleBookingClick(booking)}
                      className="bg-container border border-border rounded-lg p-4 sm:p-6 hover:border-gold/50 transition-colors cursor-pointer hover:bg-container/50"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className="text-gold font-semibold">
                            {formatDate(booking.cleaning_date)}
                          </p>
                          <p className="text-secondary text-sm">
                            {formatTime(booking.cleaning_date)}
                          </p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm ${booking.status === 'completed' ? 'bg-success/20 text-success' :
                            booking.status === 'pending' ? 'bg-warning/20 text-warning' :
                              booking.status === 'unassigned' ? 'bg-error/20 text-error' :
                                'bg-gray-500/20 text-gray-500'
                          }`}>
                          {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                        </span>
                      </div>

                      <div className="space-y-3">
                        <div className="p-3 rounded bg-background">
                          <p className="text-primary font-medium">Service Details</p>
                          <div className="mt-2 space-y-1 text-secondary text-sm">
                            <p>Package: {booking.details.package}</p>
                            <p>Client: {booking.details.client_email || 'Not provided'}</p>
                            {booking.details.package === 'blockCleaning' && (
                              <>
                                <p>Cleaners: {booking.details.rooms.cleaners}</p>
                                <p>Hours: {booking.details.rooms.hours}</p>
                              </>
                            )}
                          </div>
                        </div>

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

                        {(booking.status === 'pending' || booking.status === 'unassigned') && (
                          <div className="p-3 rounded bg-background">
                            <p className="text-primary font-medium mb-2">Assign Staff</p>
                            <select
                              className="w-full bg-input border border-border rounded px-3 py-2 text-primary text-sm"
                              onChange={(e) => {
                                if (e.target.value) {
                                  assignStaff(
                                    booking.id,
                                    e.target.value,
                                    booking.cleaning_date,
                                    booking.details.package === 'blockCleaning'
                                      ? booking.details.rooms.hours
                                      : 2
                                  );
                                }
                              }}
                              defaultValue=""
                            >
                              <option value="" disabled>
                                {staffList.length === 0 ? 'Loading staff...' : 'Select staff member'}
                              </option>
                              {staffList.map(staff => (
                                <option
                                  key={staff.id}
                                  value={staff.id}
                                  disabled={booking.staff_schedules?.some(
                                    schedule => schedule.staff_id === staff.id
                                  )}
                                >
                                  {formatStaffName(staff)} {booking.staff_schedules?.some(
                                    schedule => schedule.staff_id === staff.id
                                  ) ? '(Already assigned)' : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {booking.staff_schedules?.length > 0 && (
                          <div className="p-3 rounded bg-background">
                            <p className="text-primary font-medium mb-2">Assigned Staff</p>
                            <div className="space-y-2">
                              {booking.staff_schedules.map((schedule, index) => (
                                <div
                                  key={index}
                                  className="flex items-center justify-between p-2 rounded bg-container"
                                >
                                  <div className="text-sm text-secondary">
                                    <p className="font-medium">{schedule.staff?.name || schedule.staff?.email || 'Unknown Staff'}</p>
                                    <p className="text-xs mt-1">
                                      {new Date(schedule.start_time).toLocaleTimeString([], {
                                        hour: 'numeric',
                                        minute: '2-digit',
                                        hour12: true
                                      })} -
                                      {new Date(schedule.end_time).toLocaleTimeString([], {
                                        hour: 'numeric',
                                        minute: '2-digit',
                                        hour12: true
                                      })}
                                    </p>
                                  </div>
                                  {booking.status === 'pending' && (
                                    <button
                                      onClick={() => unassignStaff(booking.id, schedule.staff_id)}
                                      className="px-3 py-1 text-xs text-error hover:text-error/80 transition-colors"
                                    >
                                      Remove
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {isModalOpen && selectedBooking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-background rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-start">
                <h2 className="text-xl font-semibold text-gold">Booking Details</h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-secondary hover:text-gold"
                >
                  Close
                </button>
              </div>

              <div className="space-y-4">
                {/* Booking Info */}
                <div className="p-4 bg-container rounded-lg">
                  <h3 className="font-medium text-primary mb-2">Booking Information</h3>
                  <div className="space-y-2 text-secondary">
                    <p>Date: {formatDate(selectedBooking.cleaning_date)}</p>
                    <p>Time: {formatTime(selectedBooking.cleaning_date)}</p>
                    <p>Status: {selectedBooking.status}</p>
                    <p>Payment Status: {selectedBooking.payment_status}</p>
                  </div>
                </div>

                {/* Client Info */}
                <div className="p-4 bg-container rounded-lg">
                  <h3 className="font-medium text-primary mb-2">Client Information</h3>
                  <div className="space-y-2 text-secondary">
                    <p>Email: {selectedBooking.details.client_email}</p>
                    <p>Address: {`${selectedBooking.details.address.street}, ${selectedBooking.details.address.city}, ${selectedBooking.details.address.state} ${selectedBooking.details.address.zipCode}`}</p>
                  </div>
                </div>

                {/* Service Details */}
                <div className="p-4 bg-container rounded-lg">
                  <h3 className="font-medium text-primary mb-2">Service Details</h3>
                  <div className="space-y-2 text-secondary">
                    <p>Package: {selectedBooking.details.package}</p>
                    {selectedBooking.details.package === 'blockCleaning' && (
                      <>
                        <p>Cleaners: {selectedBooking.details.rooms.cleaners}</p>
                        <p>Hours: {selectedBooking.details.rooms.hours}</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="p-4 bg-container rounded-lg">
                  <h3 className="font-medium text-primary mb-2">Actions</h3>
                  <div className="flex gap-2">
                    <button
                      className="px-4 py-2 bg-gold text-background rounded hover:bg-gold/90"
                      onClick={() => {/* Add status update logic */ }}
                    >
                      Update Status
                    </button>
                    <button
                      className="px-4 py-2 bg-error text-background rounded hover:bg-error/90"
                      onClick={() => {/* Add cancellation logic */ }}
                    >
                      Cancel Booking
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard; 