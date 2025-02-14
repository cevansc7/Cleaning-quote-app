import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { useNotification } from '../contexts/NotificationContext';
import { useNotificationSystem } from '../contexts/NotificationSystemContext';
import PaymentForm from '../components/PaymentForm';

// Add this array at the top of the file, outside the component
const TREASURE_VALLEY_ZIP_CODES = [
  '83642', // Meridian
  '83646', // Meridian
  '83680', // Meridian
  '83669', // Meridian
  '83643', // Meridian
  '83687', // Meridian
];

function QuoteCalculator() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [selectedPackage, setSelectedPackage] = useState('');
  const [quoteResult, setQuoteResult] = useState(null);
  const [formData, setFormData] = useState({
    // Breathe Easy form fields
    serviceSelection: '',
    bedrooms: '1',
    bathrooms: '1',
    halfBathrooms: '1',
    kitchens: '1',
    livingRooms: '1',
    bonusRooms: '1',
    laundryRooms: '1',
    offices: '1',
    sqft: '1000',
    dirtyScale: '1',
    // Block Cleaning form fields
    cleaners: '1',
    hours: '1'
  });
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('');
  const [loading, setLoading] = useState(false);
  const { showNotification } = useNotification();
  const [address, setAddress] = useState({
    street: '',
    city: 'Meridian',
    state: 'ID',
    zipCode: ''
  });
  const { createNotification } = useNotificationSystem();
  const [showPayment, setShowPayment] = useState(false);
  const [currentBookingId, setCurrentBookingId] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const calculateQuote = () => {
    let basePrice = 0;
    
    if (selectedPackage === 'breatheEasy') {
      // Base price by service type
      switch (formData.serviceSelection) {
        case 'standardCleaning':
          basePrice = 100;
          break;
        case 'deepCleaning':
          basePrice = 150;
          break;
        case 'moveInOutCleaning':
          basePrice = 200;
          break;
        default:
          alert('Please select a service type');
          return;
      }

      // Add room costs
      basePrice += parseInt(formData.bedrooms) * 30;
      basePrice += parseInt(formData.bathrooms) * 40;
      basePrice += parseInt(formData.halfBathrooms) * 20;
      basePrice += parseInt(formData.kitchens) * 50;
      basePrice += parseInt(formData.livingRooms) * 35;
      basePrice += parseInt(formData.bonusRooms) * 35;
      basePrice += parseInt(formData.laundryRooms) * 25;
      basePrice += parseInt(formData.offices) * 30;

      // Adjust for dirtiness scale
      basePrice *= (1 + (parseInt(formData.dirtyScale) - 1) * 0.2);

    } else if (selectedPackage === 'blockCleaning') {
      const hourlyRate = 35;
      basePrice = parseInt(formData.cleaners) * parseInt(formData.hours) * hourlyRate;
    }

    // Round to 2 decimal places
    basePrice = Math.round(basePrice * 100) / 100;

    setQuoteResult({
      price: basePrice,
      details: {
        package: selectedPackage,
        ...formData
      }
    });
  };

  const geocodeAddress = async () => {
    const addressString = `${address.street}, ${address.city || 'Meridian'}, ${address.state || 'ID'} ${address.zipCode}, USA`;
    try {
      console.log('Geocoding address:', addressString);
      console.log('Using API key:', process.env.REACT_APP_GOOGLE_MAPS_API_KEY);
      
      // Add error handling for missing API key
      if (!process.env.REACT_APP_GOOGLE_MAPS_API_KEY) {
        console.error('Google Maps API key is missing');
        showNotification('System configuration error. Please contact support.', 'error');
        return null;
      }

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addressString)}&region=us&components=administrative_area:ID&key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}`
      );

      if (!response.ok) {
        console.error('Geocoding API error:', response.status, response.statusText);
        throw new Error(`Geocoding API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('Raw API Response:', data);
      
      if (data.status === 'ZERO_RESULTS') {
        showNotification('Could not find this address in the Meridian area. Please check the address and try again.', 'error');
        return null;
      }

      if (data.status !== 'OK') {
        showNotification(`Geocoding error: ${data.status}`, 'error');
        return null;
      }
      
      if (data.results && data.results[0]) {
        // Verify the address is in the Meridian area
        const location = data.results[0].geometry.location;
        const isInMeridianArea = data.results[0].formatted_address.toLowerCase().includes('meridian') ||
                                data.results[0].formatted_address.toLowerCase().includes('idaho');
        
        if (!isInMeridianArea) {
          showNotification('Sorry, we only service the Meridian, Idaho area at this time.', 'error');
          return null;
        }

        return location;
      }

      showNotification('Could not find this address. Please check the address and try again.', 'error');
      return null;
    } catch (error) {
      console.error('Geocoding error:', error);
      showNotification('Error finding address location. Please try again.', 'error');
      return null;
    }
  };

  const validateAddress = () => {
    if (!address.street.trim()) {
      showNotification('Please enter a street address', 'error');
      return false;
    }
    if (!address.city.trim()) {
      showNotification('Please enter a city', 'error');
      return false;
    }
    if (!address.state.trim()) {
      showNotification('Please enter a state', 'error');
      return false;
    }
    if (!address.zipCode.trim()) {
      showNotification('Please enter a ZIP code', 'error');
      return false;
    }

    // Validate zip code for Treasure Valley
    if (!TREASURE_VALLEY_ZIP_CODES.includes(address.zipCode)) {
      showNotification(
        'Sorry, we currently only service the Meridian area (ZIP codes: ' + 
        TREASURE_VALLEY_ZIP_CODES.join(', ') + 
        '). More locations coming soon!', 
        'error'
      );
      return false;
    }

    return true;
  };

  const handleBooking = async () => {
    if (!user) {
      if (window.confirm('Please login or register to book a cleaning. Would you like to login now?')) {
        navigate('/login');
      }
      return;
    }

    // Validate date and time
    if (!bookingDate || !bookingTime) {
      showNotification('Please select both date and time for your booking', 'error');
      return;
    }

    // Validate address
    if (!validateAddress()) {
      return;
    }

    try {
      setLoading(true);

      // Log the user state first
      console.log('Current user:', user);

      // Get coordinates from address
      const location = await geocodeAddress();
      if (!location) {
        console.error('Failed to get location');
        setLoading(false);
        return;
      }

      // Create the booking data object
      const bookingData = {
        client_id: user.id,
        cleaning_date: `${bookingDate}T${bookingTime}:00`,
        status: 'unassigned',
        payment_status: 'pending',
        amount_paid: quoteResult.price * 100,
        details: {
          package: selectedPackage,
          serviceType: selectedPackage === 'breatheEasy' ? formData.serviceSelection : 'blockCleaning',
          price: quoteResult.price,
          rooms: selectedPackage === 'breatheEasy' ? {
            bedrooms: parseInt(formData.bedrooms),
            bathrooms: parseInt(formData.bathrooms),
            halfBathrooms: parseInt(formData.halfBathrooms),
            kitchens: parseInt(formData.kitchens),
            livingRooms: parseInt(formData.livingRooms),
            bonusRooms: parseInt(formData.bonusRooms),
            laundryRooms: parseInt(formData.laundryRooms),
            offices: parseInt(formData.offices),
            sqft: parseInt(formData.sqft),
            dirtyScale: parseInt(formData.dirtyScale)
          } : {
            cleaners: parseInt(formData.cleaners),
            hours: parseInt(formData.hours)
          },
          location: location,
          address: {
            street: address.street,
            city: address.city,
            state: address.state,
            zipCode: address.zipCode
          },
          client_email: user.email
        }
      };

      console.log('Attempting to create booking with data:', JSON.stringify(bookingData, null, 2));

      try {
        const { data: booking, error: bookingError } = await supabase
          .from('bookings')
          .insert([bookingData])
          .select()
          .single();

        console.log('New booking created:', {
          booking,
          error: bookingError,
          status: booking?.status,
          cleaning_date: booking?.cleaning_date,
          details: booking?.details
        });

        // Verify it exists immediately after creation
        const { data: verifyBooking, error: verifyError } = await supabase
          .from('bookings')
          .select('*')
          .eq('id', booking.id)
          .single();

        console.log('Booking verification:', {
          exists: !!verifyBooking,
          booking: verifyBooking,
          error: verifyError
        });

        if (bookingError) {
          throw bookingError;
        }

        console.log('Booking created successfully:', booking);

        // Get admin users
        const { data: adminUsers, error: adminError } = await supabase
          .from('staff')
          .select('email')
          .eq('role', 'supervisor');

        console.log('Admin users query result:', { adminUsers, adminError });

        if (adminError) {
          console.error('Error fetching admin users:', adminError);
          throw adminError;
        }

        // First get the auth user IDs for these staff members
        for (const admin of (adminUsers || [])) {
          // Use RPC function or a view to get user ID
          const { data: userData, error: userError } = await supabase
            .rpc('get_user_id_by_email', { email_input: admin.email });
          
          if (userError) {
            console.error('Error finding user for email:', admin.email, userError);
            continue;
          }

          if (userData) {
            console.log('Creating notification for user:', userData);
            await createNotification(
              userData,  // The function should return just the UUID
              'New Booking',
              `New ${bookingData.details.package} booking for ${bookingData.cleaning_date}`,
              'system',
              `/admin/dashboard`
            );
          }
        }

        // Generate tasks based on service type and selected rooms
        const generateTasks = () => {
          const commonTasks = [
            { name: 'Initial walkthrough and inspection', order: 1 },
            { name: 'Setup cleaning equipment and supplies', order: 2 },
          ];
          
          const finalTasks = [
            { name: 'Final inspection', order: 98 },
            { name: 'Client walkthrough and feedback', order: 99 },
            { name: 'Pack up and ensure all areas are secure', order: 100 }
          ];
          
          let serviceTasks = [];
          
          if (selectedPackage === 'breatheEasy') {
            // Add room-specific tasks based on the rooms selected
            if (parseInt(formData.bedrooms) > 0) {
              serviceTasks.push(
                { name: `Clean and dust ${formData.bedrooms} bedroom(s)`, order: 10 },
                { name: 'Make beds and organize bedroom areas', order: 11 }
              );
            }
            
            if (parseInt(formData.bathrooms) > 0 || parseInt(formData.halfBathrooms) > 0) {
              serviceTasks.push(
                { name: `Clean ${formData.bathrooms} full bath(s) and ${formData.halfBathrooms} half bath(s)`, order: 20 },
                { name: 'Sanitize bathroom fixtures and surfaces', order: 21 },
                { name: 'Clean mirrors and glass surfaces', order: 22 }
              );
            }
            
            if (parseInt(formData.kitchens) > 0) {
              serviceTasks.push(
                { name: 'Clean and sanitize kitchen counters and surfaces', order: 30 },
                { name: 'Clean appliance exteriors', order: 31 },
                { name: 'Clean and shine sink area', order: 32 }
              );
            }
            
            if (parseInt(formData.livingRooms) > 0 || parseInt(formData.bonusRooms) > 0) {
              serviceTasks.push(
                { name: 'Dust and clean living spaces', order: 40 },
                { name: 'Vacuum upholstery and furniture', order: 41 }
              );
            }
            
            // Add service-specific tasks
            if (formData.serviceSelection === 'deepCleaning') {
              serviceTasks.push(
                { name: 'Deep clean baseboards and trim', order: 50 },
                { name: 'Clean window sills and tracks', order: 51 },
                { name: 'Clean light fixtures and ceiling fans', order: 52 }
              );
            }
            
            if (formData.serviceSelection === 'moveInOutCleaning') {
              serviceTasks.push(
                { name: 'Clean inside cabinets and drawers', order: 60 },
                { name: 'Clean inside appliances', order: 61 },
                { name: 'Clean window tracks and sills', order: 62 },
                { name: 'Clean all light fixtures', order: 63 }
              );
            }
          } else if (selectedPackage === 'blockCleaning') {
            serviceTasks = [
              { name: 'Review client requirements and priorities', order: 10 },
              { name: `Assign areas to ${formData.cleaners} cleaner(s)`, order: 11 },
              { name: 'Clean assigned areas', order: 20 },
              { name: 'Track time and progress', order: 21 },
              { name: `Complete ${formData.hours}-hour cleaning block`, order: 90 }
            ];
          }
          
          // Combine all tasks and sort by order
          return [...commonTasks, ...serviceTasks, ...finalTasks]
            .sort((a, b) => a.order - b.order)
            .map(task => ({
              booking_id: booking.id,
              task_name: task.name,
              is_completed: false,
              created_at: new Date().toISOString()
            }));
        };

        const tasksToInsert = generateTasks();

        console.log('Creating tasks:', tasksToInsert);

        const { data: tasksData, error: tasksError } = await supabase
          .from('checklists')
          .insert(tasksToInsert)
          .select();

        if (tasksError) {
          console.error('Error creating tasks:', tasksError);
          throw tasksError;
        }

        console.log('Tasks created:', tasksData);

        setCurrentBookingId(booking.id);
        setShowPayment(true);
        
      } catch (insertError) {
        console.error('Booking insertion error:', {
          error: insertError,
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint,
          code: insertError.code,
          data: bookingData
        });
        throw insertError;
      }
    } catch (error) {
      console.error('Top level error:', {
        error,
        message: error.message,
        stack: error.stack
      });
      showNotification('Failed to create booking: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = () => {
    showNotification('Booking confirmed! Redirecting to dashboard...', 'success');
    navigate('/dashboard');
  };

  const handleDashboardClick = () => {
    console.log('Navigating to dashboard...');
    console.log('User role:', user?.user_metadata?.role);
    
    const path = user?.user_metadata?.role === 'staff' ? '/staff/dashboard' : '/client/dashboard';
    console.log('Navigation path:', path);
    
    navigate(path);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-container border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="text-gold">
              {user && `Welcome, ${user.email}`}
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="text-secondary hover:text-gold transition-colors"
              >
                Dashboard
              </button>
              <button
                onClick={() => navigate('/')}
                className="text-secondary hover:text-gold transition-colors"
              >
                New Booking
              </button>
              {user && (
                <button
                  onClick={handleSignOut}
                  className="text-secondary hover:text-gold transition-colors"
                >
                  Sign Out
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="quote-container">
        <h2>Choose Your Cleaning Package</h2>
        <div className="package-options">
          <div 
            className={`package-option ${selectedPackage === 'breatheEasy' ? 'selected' : ''}`}
            onClick={() => setSelectedPackage('breatheEasy')}
          >
            <input 
              type="radio" 
              id="breatheEasy" 
              name="package" 
              value="breatheEasy"
              checked={selectedPackage === 'breatheEasy'}
              onChange={(e) => setSelectedPackage(e.target.value)}
            />
            <label htmlFor="breatheEasy">
              <strong>Breathe Easy Package</strong>
              <span>Comes with a 24-hour customer satisfaction guarantee.</span>
            </label>
          </div>

          <div 
            className={`package-option ${selectedPackage === 'blockCleaning' ? 'selected' : ''}`}
            onClick={() => setSelectedPackage('blockCleaning')}
          >
            <input 
              type="radio" 
              id="blockCleaning" 
              name="package" 
              value="blockCleaning"
              checked={selectedPackage === 'blockCleaning'}
              onChange={(e) => setSelectedPackage(e.target.value)}
            />
            <label htmlFor="blockCleaning">
              <strong>Block Cleaning</strong>
              <span>Choose the number of cleaners and hours.</span>
            </label>
          </div>
        </div>

        {selectedPackage === 'breatheEasy' && (
          <div className="quote-form">
            <div className="form-section">
              <div className="form-row">
                <div className="col-span-2">
                  <label htmlFor="serviceSelection">Service Type:</label>
                  <select 
                    id="serviceSelection" 
                    name="serviceSelection"
                    value={formData.serviceSelection}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Select a Service</option>
                    <option value="standardCleaning">Standard Cleaning - Regular maintenance cleaning</option>
                    <option value="deepCleaning">Deep Cleaning - Thorough cleaning of all surfaces</option>
                    <option value="moveInOutCleaning">Move In/Out Cleaning - Detailed cleaning for moving</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div>
                  <label htmlFor="bedrooms">Number of Bedrooms:</label>
                  <select id="bedrooms" name="bedrooms" value={formData.bedrooms} onChange={handleInputChange}>
                    <option value="0">0</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4+</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="bathrooms">Number of Full Bathrooms:</label>
                  <select id="bathrooms" name="bathrooms" value={formData.bathrooms} onChange={handleInputChange}>
                    <option value="0">0</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4+</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="halfBathrooms">Number of Half Bathrooms:</label>
                  <select id="halfBathrooms" name="halfBathrooms" value={formData.halfBathrooms} onChange={handleInputChange}>
                    <option value="0">0</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4+</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="kitchens">Number of Kitchens:</label>
                  <select id="kitchens" name="kitchens" value={formData.kitchens} onChange={handleInputChange}>
                    <option value="0">0</option>
                    <option value="1">1</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="livingRooms">Number of Living Rooms:</label>
                  <select id="livingRooms" name="livingRooms" value={formData.livingRooms} onChange={handleInputChange}>
                    <option value="0">0</option>
                    <option value="1">1</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="bonusRooms">Number of Bonus Rooms/Family Rooms:</label>
                  <select id="bonusRooms" name="bonusRooms" value={formData.bonusRooms} onChange={handleInputChange}>
                    <option value="0">0</option>
                    <option value="1">1</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="laundryRooms">Number of Laundry Rooms:</label>
                  <select id="laundryRooms" name="laundryRooms" value={formData.laundryRooms} onChange={handleInputChange}>
                    <option value="0">0</option>
                    <option value="1">1</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="offices">Number of Offices:</label>
                  <select id="offices" name="offices" value={formData.offices} onChange={handleInputChange}>
                    <option value="0">0</option>
                    <option value="1">1</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div>
                  <label htmlFor="sqft">Approx. Square Footage (Optional):</label>
                  <input 
                    type="number" 
                    id="sqft" 
                    name="sqft"
                    value={formData.sqft}
                    onChange={handleInputChange}
                    min="0"
                  />
                </div>

                <div>
                  <label htmlFor="dirtyScale">Dirtiness Scale:</label>
                  <select id="dirtyScale" name="dirtyScale" value={formData.dirtyScale} onChange={handleInputChange}>
                    <option value="1">1 (Light)</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                    <option value="5">5 (Very Dirty)</option>
                  </select>
                </div>
              </div>

              <button type="button" className="btn" onClick={() => calculateQuote()}>
                Get Estimate
              </button>
            </div>
          </div>
        )}

        {selectedPackage === 'blockCleaning' && (
          <div className="quote-form">
            <div className="form-section">
              <div className="form-row">
                <div>
                  <label htmlFor="cleaners">Number of Cleaners:</label>
                  <select
                    id="cleaners"
                    name="cleaners"
                    value={formData.cleaners}
                    onChange={handleInputChange}
                  >
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4+</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="hours">Number of Hours:</label>
                  <select
                    id="hours"
                    name="hours"
                    value={formData.hours}
                    onChange={handleInputChange}
                  >
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4+</option>
                  </select>
                </div>
              </div>

              <button type="button" className="btn" onClick={() => calculateQuote()}>
                Get Estimate
              </button>
            </div>
          </div>
        )}

        {quoteResult && (
          <div className="quote-result">
            <h3>Estimated Price</h3>
            <p className="price">${quoteResult.price}</p>
            
            {!showBookingForm ? (
              <button 
                type="button" 
                className="btn"
                onClick={() => setShowBookingForm(true)}
              >
                Book Now
              </button>
            ) : (
              <div className="booking-form">
                <div className="form-group">
                  <label htmlFor="bookingDate">Preferred Date</label>
                  <input
                    type="date"
                    id="bookingDate"
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="bookingTime">Preferred Time</label>
                  <input
                    type="time"
                    id="bookingTime"
                    value={bookingTime}
                    onChange={(e) => setBookingTime(e.target.value)}
                    required
                  />
                </div>

                <div className="address-section mt-6 border-t border-border pt-6">
                  <h3 className="text-gold font-semibold mb-4">Service Location</h3>
                  
                  <div className="space-y-4">
                    <div className="form-group">
                      <label htmlFor="street">Street Address</label>
                      <input
                        type="text"
                        id="street"
                        value={address.street}
                        onChange={(e) => setAddress({ ...address, street: e.target.value })}
                        placeholder="e.g. 3597 E Monarch Sky Lane"
                        className="w-full"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-12 gap-4">
                      <div className="form-group col-span-6">
                        <label htmlFor="city">City</label>
                        <input
                          type="text"
                          id="city"
                          value={address.city}
                          onChange={(e) => setAddress({ ...address, city: e.target.value })}
                          className="w-full"
                          required
                        />
                      </div>

                      <div className="form-group col-span-3">
                        <label htmlFor="state">State</label>
                        <input
                          type="text"
                          id="state"
                          value={address.state}
                          onChange={(e) => setAddress({ ...address, state: e.target.value })}
                          className="w-full"
                          required
                        />
                      </div>

                      <div className="form-group col-span-3">
                        <label htmlFor="zipCode">ZIP Code</label>
                        <input
                          type="text"
                          id="zipCode"
                          value={address.zipCode}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '').slice(0, 5);
                            setAddress({ ...address, zipCode: value });
                          }}
                          placeholder="83642"
                          maxLength="5"
                          className="w-full"
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <button 
                  type="button" 
                  className="btn w-full mt-6"
                  onClick={handleBooking}
                  disabled={loading}
                >
                  {loading ? 'Confirming...' : 'Confirm Booking'}
                </button>
              </div>
            )}

            <button 
              type="button" 
              className="btn-secondary mt-4"
              onClick={() => {
                setQuoteResult(null);
                setShowBookingForm(false);
                setSelectedPackage('');
                setFormData({
                  // Reset form data
                  serviceSelection: '',
                  bedrooms: '1',
                  bathrooms: '1',
                  halfBathrooms: '1',
                  kitchens: '1',
                  livingRooms: '1',
                  bonusRooms: '1',
                  laundryRooms: '1',
                  offices: '1',
                  sqft: '1000',
                  dirtyScale: '1',
                  cleaners: '1',
                  hours: '1'
                });
              }}
            >
              Start Over
            </button>
          </div>
        )}

        {showPayment && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50">
            <div className="fixed inset-x-0 top-1/2 -translate-y-1/2 max-w-md mx-auto p-6">
              <div className="bg-container border border-border rounded-lg p-6">
                <h2 className="text-xl font-semibold text-gold mb-4">Complete Payment</h2>
                <PaymentForm
                  bookingId={currentBookingId}
                  amount={quoteResult.price * 100} // Convert to cents
                  onPaymentSuccess={handlePaymentSuccess}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default QuoteCalculator; 