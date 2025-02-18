import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { useNotification } from '../contexts/NotificationContext';
import { useNotificationSystem } from '../contexts/NotificationSystemContext';
import PaymentForm from '../components/PaymentForm';

// Base prices for different cleaning types (hourly rates)
const standardCleaning = 45;  // $45/hr
const deepCleaning = 63;      // $63/hr
const moveInOutCleaning = 60; // $60/hr

// Base cleaning times in hours
const baseCleaningTimes = {
  bedroom: 7 / 60,          // 7 mins
  bathroom: 25 / 60,        // 25 mins
  halfBathroom: 15 / 60,    // 15 mins
  kitchen: 30 / 60,         // 30 mins
  livingRoom: 20 / 60,      // 20 mins
  bonusRoom: 15 / 60,       // 15 mins
  laundryRoom: 5 / 60,      // 5 mins
  office: 5 / 60            // 5 mins
};

// Dirtiness scale adjustment (multipliers)
const dirtinessMultipliers = {
  1: 1.15,   // Light
  2: 1.25,
  3: 1.35,
  4: 1.75,
  5: 2.0     // Very Dirty
};

function QuoteCalculator() {
  const navigate = useNavigate();
  const { user, signOut, profile } = useAuth();
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
    city: '',
    state: '',
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
    let totalTime = 0;

    if (selectedPackage === 'breatheEasy') {
      // Calculate total time based on rooms
      totalTime += parseInt(formData.bedrooms) * baseCleaningTimes.bedroom;
      totalTime += parseInt(formData.bathrooms) * baseCleaningTimes.bathroom;
      totalTime += parseInt(formData.halfBathrooms) * baseCleaningTimes.halfBathroom;
      totalTime += parseInt(formData.kitchens) * baseCleaningTimes.kitchen;
      totalTime += parseInt(formData.livingRooms) * baseCleaningTimes.livingRoom;
      totalTime += parseInt(formData.bonusRooms) * baseCleaningTimes.bonusRoom;
      totalTime += parseInt(formData.laundryRooms) * baseCleaningTimes.laundryRoom;
      totalTime += parseInt(formData.offices) * baseCleaningTimes.office;

      // Add time for square footage (30 mins per 500 sqft)
      totalTime += Math.ceil(parseInt(formData.sqft) / 500) * 0.5;

      // Apply dirtiness multiplier
      totalTime *= dirtinessMultipliers[parseInt(formData.dirtyScale)];

      // Calculate base price using hourly rate
      let basePrice = 0;
      switch (formData.serviceSelection) {
        case 'standardCleaning':
          basePrice = standardCleaning * totalTime;
          break;
        case 'deepCleaning':
          basePrice = deepCleaning * totalTime;
          break;
        case 'moveInOutCleaning':
          basePrice = moveInOutCleaning * totalTime;
          break;
        default:
          alert('Please select a service type');
          return;
      }

      // Round to whole number (floor)
      basePrice = Math.floor(basePrice);

      setQuoteResult({
        price: basePrice,
        details: {
          package: selectedPackage,
          serviceType: formData.serviceSelection,
          estimatedTime: totalTime,
          ...formData
        }
      });

    } else if (selectedPackage === 'blockCleaning') {
      const hourlyRate = standardCleaning; // Use standard cleaning rate for block cleaning
      const totalPrice = Math.floor(parseInt(formData.cleaners) * parseInt(formData.hours) * hourlyRate);

      setQuoteResult({
        price: totalPrice,
        details: {
          package: selectedPackage,
          ...formData
        }
      });
    }
  };

  const geocodeAddress = async () => {
    const addressString = `${address.street}, ${address.city}, ${address.state} ${address.zipCode}, USA`;
    try {
      console.log('Geocoding address:', addressString);
      console.log('Using API key:', process.env.REACT_APP_GOOGLE_MAPS_API_KEY);

      if (!process.env.REACT_APP_GOOGLE_MAPS_API_KEY) {
        console.error('Google Maps API key is missing');
        showNotification('System configuration error. Please contact support.', 'error');
        return null;
      }

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addressString)}&region=us&key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}`
      );

      if (!response.ok) {
        console.error('Geocoding API error:', response.status, response.statusText);
        throw new Error(`Geocoding API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('Raw API Response:', data);

      if (data.status === 'ZERO_RESULTS') {
        showNotification('Could not find this address. Please check the address and try again.', 'error');
        return null;
      }

      if (data.status !== 'OK') {
        showNotification(`Geocoding error: ${data.status}`, 'error');
        return null;
      }

      if (data.results && data.results[0]) {
        return data.results[0].geometry.location;
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

    // Validate ZIP code format (5 digits)
    const zipCodeRegex = /^\d{5}$/;
    if (!zipCodeRegex.test(address.zipCode)) {
      showNotification('Please enter a valid 5-digit ZIP code', 'error');
      return false;
    }

    return true;
  };

  const handleBooking = async () => {
    try {
      setLoading(true);
      console.log('Starting booking process...');

      const { data: { user: authUser }, error: userError } = await supabase.auth.getUser();
      console.log('Auth user:', authUser);

      if (userError || !authUser) {
        console.error('User error:', userError);
        showNotification('Please log in to book a cleaning', 'error');
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

      // Validate quote result exists
      if (!quoteResult || !quoteResult.price) {
        showNotification('Please get a quote before booking', 'error');
        return;
      }

      // Get coordinates for the address
      const coordinates = await geocodeAddress();
      if (!coordinates) {
        showNotification('Could not verify address location. Please check the address and try again.', 'error');
        return;
      }

      const bookingData = {
        client_id: authUser.id,
        cleaning_date: new Date(bookingDate + 'T' + bookingTime).toISOString(),
        status: 'unassigned',
        payment_status: 'pending',
        amount_paid: quoteResult.price,
        details: {
          package: selectedPackage,
          serviceType: selectedPackage === 'breatheEasy' ? formData.serviceSelection : null,
          price: quoteResult.price,
          rooms: selectedPackage === 'blockCleaning'
            ? {
              cleaners: parseInt(formData.cleaners),
              hours: parseInt(formData.hours)
            }
            : {
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
            },
          address: {
            street: address.street,
            city: address.city,
            state: address.state,
            zipCode: address.zipCode,
            coordinates: coordinates
          },
          client_email: authUser.email,
          client_name: profile?.name,
          client_phone: profile?.phone
        }
      };

      console.log('Attempting to create booking with data:', bookingData);

      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert(bookingData)
        .select('*')
        .single();

      if (bookingError) {
        console.error('Detailed booking error:', bookingError);
        throw bookingError;
      }

      console.log('Supabase response:', { booking, bookingError });

      if (!booking) {
        console.error('No booking returned from database');
        throw new Error('No booking ID returned from database');
      }

      const createdBooking = booking;
      console.log('Successfully created booking:', createdBooking);

      // Generate tasks for the booking
      await generateTasks(createdBooking.id, selectedPackage, formData);

      // Set the current booking ID for payment
      setCurrentBookingId(createdBooking.id);
      setShowPayment(true);

    } catch (error) {
      console.error('Error creating booking:', error);
      showNotification('Error creating booking: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Add these functions before the generateTasks function

  const generateBreatheEasyTasks = (bookingId, formData) => {
    const tasks = [];

    // Add room-specific tasks
    if (parseInt(formData.bedrooms) > 0) {
      tasks.push(
        { booking_id: bookingId, task_name: 'Make beds and change linens (if provided)', is_completed: false },
        { booking_id: bookingId, task_name: 'Dust all bedroom surfaces and furniture', is_completed: false },
        { booking_id: bookingId, task_name: 'Vacuum bedroom floors and under furniture', is_completed: false },
        { booking_id: bookingId, task_name: 'Clean bedroom mirrors and windows', is_completed: false }
      );
    }

    if (parseInt(formData.bathrooms) > 0) {
      tasks.push(
        { booking_id: bookingId, task_name: 'Clean and sanitize toilet', is_completed: false },
        { booking_id: bookingId, task_name: 'Clean and sanitize shower/tub', is_completed: false },
        { booking_id: bookingId, task_name: 'Clean bathroom sink and counters', is_completed: false },
        { booking_id: bookingId, task_name: 'Clean bathroom mirrors and fixtures', is_completed: false },
        { booking_id: bookingId, task_name: 'Mop bathroom floor', is_completed: false }
      );
    }

    if (parseInt(formData.halfBathrooms) > 0) {
      tasks.push(
        { booking_id: bookingId, task_name: 'Clean and sanitize half-bath toilet', is_completed: false },
        { booking_id: bookingId, task_name: 'Clean half-bath sink and counter', is_completed: false },
        { booking_id: bookingId, task_name: 'Clean half-bath mirror and fixtures', is_completed: false },
        { booking_id: bookingId, task_name: 'Mop half-bath floor', is_completed: false }
      );
    }

    if (parseInt(formData.kitchens) > 0) {
      tasks.push(
        { booking_id: bookingId, task_name: 'Clean and sanitize kitchen counters', is_completed: false },
        { booking_id: bookingId, task_name: 'Clean stovetop and exterior of oven', is_completed: false },
        { booking_id: bookingId, task_name: 'Clean exterior of refrigerator', is_completed: false },
        { booking_id: bookingId, task_name: 'Clean and sanitize sink', is_completed: false },
        { booking_id: bookingId, task_name: 'Clean small appliances exteriors', is_completed: false },
        { booking_id: bookingId, task_name: 'Sweep and mop kitchen floor', is_completed: false }
      );
    }

    if (parseInt(formData.livingRooms) > 0) {
      tasks.push(
        { booking_id: bookingId, task_name: 'Dust all living room surfaces and decor', is_completed: false },
        { booking_id: bookingId, task_name: 'Clean windows and mirrors', is_completed: false },
        { booking_id: bookingId, task_name: 'Vacuum upholstered furniture', is_completed: false },
        { booking_id: bookingId, task_name: 'Vacuum and edge living room floors', is_completed: false }
      );
    }

    if (parseInt(formData.bonusRooms) > 0) {
      tasks.push(
        { booking_id: bookingId, task_name: 'Dust all surfaces in bonus room', is_completed: false },
        { booking_id: bookingId, task_name: 'Clean windows and mirrors', is_completed: false },
        { booking_id: bookingId, task_name: 'Vacuum bonus room floors', is_completed: false }
      );
    }

    if (parseInt(formData.laundryRooms) > 0) {
      tasks.push(
        { booking_id: bookingId, task_name: 'Clean exterior of washer and dryer', is_completed: false },
        { booking_id: bookingId, task_name: 'Clean laundry sink if present', is_completed: false },
        { booking_id: bookingId, task_name: 'Sweep and mop laundry room floor', is_completed: false }
      );
    }

    if (parseInt(formData.offices) > 0) {
      tasks.push(
        { booking_id: bookingId, task_name: 'Dust office desk and furniture', is_completed: false },
        { booking_id: bookingId, task_name: 'Clean office windows and surfaces', is_completed: false },
        { booking_id: bookingId, task_name: 'Vacuum office floor', is_completed: false }
      );
    }

    return tasks;
  };

  const generateBlockCleaningTasks = (bookingId, formData) => {
    return [
      { booking_id: bookingId, task_name: 'General cleaning of specified areas', is_completed: false },
      { booking_id: bookingId, task_name: `${formData.cleaners} cleaner(s) for ${formData.hours} hour(s)`, is_completed: false },
      { booking_id: bookingId, task_name: 'Clean and organize as per client instructions', is_completed: false }
    ];
  };

  // Helper function to generate tasks
  const generateTasks = (bookingId, packageType, formData) => {
    const commonTasks = [
      { booking_id: bookingId, task_name: 'Initial walkthrough and inspection', is_completed: false },
      { booking_id: bookingId, task_name: 'Setup cleaning equipment and supplies', is_completed: false }
    ];

    const serviceTasks = packageType === 'breatheEasy'
      ? generateBreatheEasyTasks(bookingId, formData)
      : generateBlockCleaningTasks(bookingId, formData);

    const finalTasks = [
      { booking_id: bookingId, task_name: 'Final inspection', is_completed: false },
      { booking_id: bookingId, task_name: 'Client walkthrough and feedback', is_completed: false }
    ];

    return [...commonTasks, ...serviceTasks, ...finalTasks];
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

  // Add this useEffect to track currentBookingId changes
  useEffect(() => {
    console.log('currentBookingId changed:', currentBookingId);
  }, [currentBookingId]);

  // Add this useEffect to track showPayment changes
  useEffect(() => {
    console.log('showPayment changed:', showPayment);
  }, [showPayment]);

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-container border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="text-gold">
              {user && `Welcome, ${profile?.name || user.email}`}
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
                <div className="space-y-4 bg-[#2A3746] p-4 rounded-md">
                  <div className="form-group">
                    <label htmlFor="bookingDate" className="text-secondary">Preferred Date</label>
                    <input
                      type="date"
                      id="bookingDate"
                      value={bookingDate}
                      onChange={(e) => setBookingDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full bg-transparent border-none text-primary focus:outline-none focus:ring-2 focus:ring-gold"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="bookingTime" className="text-secondary">Preferred Time</label>
                    <input
                      type="time"
                      id="bookingTime"
                      value={bookingTime}
                      onChange={(e) => setBookingTime(e.target.value)}
                      className="w-full bg-transparent border-none text-primary focus:outline-none focus:ring-2 focus:ring-gold"
                      required
                    />
                  </div>
                </div>

                <div className="address-section mt-6 border-t border-border pt-6">
                  <h3 className="text-gold font-semibold mb-4">Service Location</h3>

                  <div className="space-y-4 bg-[#2A3746] p-4 rounded-md">
                    <div className="form-group">
                      <label htmlFor="street" className="text-secondary">Street Address</label>
                      <input
                        type="text"
                        id="street"
                        value={address.street}
                        onChange={(e) => setAddress({ ...address, street: e.target.value })}
                        placeholder="e.g. 3597 E Monarch Sky Lane"
                        className="w-full bg-transparent border-none text-primary focus:outline-none focus:ring-2 focus:ring-gold"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-12 gap-4">
                      <div className="form-group col-span-6">
                        <label htmlFor="city" className="text-secondary">City</label>
                        <input
                          type="text"
                          id="city"
                          value={address.city}
                          onChange={(e) => setAddress({ ...address, city: e.target.value })}
                          placeholder="Enter city"
                          className="w-full bg-transparent border-none text-primary focus:outline-none focus:ring-2 focus:ring-gold"
                          required
                        />
                      </div>

                      <div className="form-group col-span-3">
                        <label htmlFor="state" className="text-secondary">State</label>
                        <input
                          type="text"
                          id="state"
                          value={address.state}
                          onChange={(e) => setAddress({ ...address, state: e.target.value })}
                          className="w-full bg-transparent border-none text-primary focus:outline-none focus:ring-2 focus:ring-gold"
                          required
                        />
                      </div>

                      <div className="form-group col-span-3">
                        <label htmlFor="zipCode" className="text-secondary">ZIP Code</label>
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
                          className="w-full bg-transparent border-none text-primary focus:outline-none focus:ring-2 focus:ring-gold"
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

        {showPayment && currentBookingId && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50">
            <div className="fixed inset-x-0 top-1/2 -translate-y-1/2 max-w-md mx-auto p-6">
              <div className="bg-container border border-border rounded-lg p-6">
                <h2 className="text-xl font-semibold text-gold mb-4">Complete Payment</h2>
                <PaymentForm
                  bookingId={currentBookingId}
                  amount={quoteResult?.price * 100} // Convert to cents
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