// Global variable to track the selected package
let selectedPackage = '';

// Add this helper function at the top level (outside of any other function)
function getValue(id, defaultValue = 0) {
  const element = document.getElementById(id);
  if (!element) {
    console.warn(`Element with id '${id}' not found`);
    return defaultValue;
  }
  return element.value || defaultValue;
}

// Run after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Event delegation for package selection
  const packageContainer = document.querySelector('.package-options');
  packageContainer.addEventListener('click', (event) => {
    const option = event.target.closest('.package-option');
    if (option) {
      selectPackage(option.dataset.package);
    }
  });

  // Attach real-time calculation listeners for Breathe Easy form inputs/selects
  const breatheEasyElements = document.querySelectorAll('#breatheEasyForm input, #breatheEasyForm select');
  breatheEasyElements.forEach((element) => {
    element.addEventListener('input', calculateQuote);
    element.addEventListener('change', calculateQuote);
  });

  // Attach click listeners for Get Estimate buttons
  document.querySelectorAll('.btn-get-estimate').forEach((button) => {
    button.addEventListener('click', () => {
      const pkg = button.getAttribute('data-package');
      if (pkg === 'breatheEasy') {
        calculateQuote();
      } else if (pkg === 'blockCleaning') {
        calculateBlockCleaningQuote();
      }
    });
  });

  // Attach click listeners for Back buttons
  document.querySelectorAll('.btn-back').forEach((button) => {
    button.addEventListener('click', goBack);
  });

  // Attach click listener for Submit button
  document.querySelector('.btn-submit').addEventListener('click', submitQuote);

  // Get form elements
  const getEstimateButtons = document.querySelectorAll('.get-estimate-btn');
  const totalTimeSpan = document.getElementById('total-time');
  const estimatedCostSpan = document.getElementById('estimated-cost');
  
  // Base rate per hour
  const HOURLY_RATE = 30;
  
  // Calculate estimate when clicking the estimate button
  getEstimateButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      e.preventDefault();
      
      if (button.textContent === 'Submit') {
        // Handle form submission
        alert('Thank you for your submission! We will contact you shortly.');
        return;
      }
      
      // Calculate total time based on rooms
      let totalTime = 0;
      
      // Add time for each room type (using default values if not found)
      const getValue = (id) => {
        const element = document.getElementById(id);
        return element ? parseInt(element.value) || 0 : 0;
      };
      
      // Calculate time for each room
      totalTime += getValue('bedrooms') * 0.5;        // 30 mins per bedroom
      totalTime += getValue('bathrooms') * 0.75;      // 45 mins per bathroom
      totalTime += getValue('halfBathrooms') * 0.4;   // 24 mins per half bath
      totalTime += getValue('kitchens') * 1.0;        // 60 mins per kitchen
      totalTime += getValue('livingRooms') * 0.5;     // 30 mins per living room
      totalTime += getValue('bonusRooms') * 0.5;      // 30 mins per bonus room
      totalTime += getValue('laundryRooms') * 0.3;    // 18 mins per laundry
      totalTime += getValue('offices') * 0.4;         // 24 mins per office
      
      // Get dirtiness scale (1-5)
      const dirtinessScale = getValue('dirtyScale');
      const dirtinessMultiplier = 0.2 * dirtinessScale + 0.8;
      
      // Apply dirtiness multiplier
      totalTime *= dirtinessMultiplier;
      
      // Round to nearest half hour
      totalTime = Math.ceil(totalTime * 2) / 2;
      
      // Calculate cost
      const estimatedCost = totalTime * HOURLY_RATE;
      
      // Update display
      totalTimeSpan.textContent = totalTime.toFixed(1);
      estimatedCostSpan.textContent = estimatedCost.toFixed(2);
      
      // Make sure the quote section is visible
      const quoteSection = document.querySelector('.estimated-quote');
      quoteSection.style.display = 'block';
      
      console.log('Calculation complete:', {
        totalTime: totalTime,
        estimatedCost: estimatedCost,
        dirtinessMultiplier: dirtinessMultiplier
      });
    });
  });
});

// Function to select a package and toggle forms
function selectPackage(packageType) {
  selectedPackage = packageType;
  // Highlight selected package
  const options = document.querySelectorAll('.package-option');
  options.forEach(option => {
    option.style.borderColor = 'var(--border-color)';
    option.style.boxShadow = 'none';
  });

  if (packageType === 'breatheEasy') {
    document.getElementById('breatheEasy').checked = true;
    document.querySelector('[for="breatheEasy"]').parentElement.style.borderColor = 'var(--gold-color)';
    document.querySelector('[for="breatheEasy"]').parentElement.style.boxShadow = '0 2px 10px var(--box-shadow)';
    // Show Breathe Easy Form and hide others
    document.getElementById('breatheEasyForm').classList.add('active');
    document.getElementById('blockCleaningForm').classList.remove('active');
  } else if (packageType === 'blockCleaning') {
    document.getElementById('blockCleaning').checked = true;
    document.querySelector('[for="blockCleaning"]').parentElement.style.borderColor = 'var(--gold-color)';
    document.querySelector('[for="blockCleaning"]').parentElement.style.boxShadow = '0 2px 10px var(--box-shadow)';
    // Show Block Cleaning Form and hide others
    document.getElementById('blockCleaningForm').classList.add('active');
    document.getElementById('breatheEasyForm').classList.remove('active');
  }
  // Hide quote result and contact info when selecting a new package
  document.getElementById('quoteResult').classList.remove('active');
  document.getElementById('contactInfo').classList.remove('active');
}

// Function to return to package selection (reset the forms)
function goBack() {
  // Hide all forms and results
  document.getElementById('breatheEasyForm').classList.remove('active');
  document.getElementById('blockCleaningForm').classList.remove('active');
  document.getElementById('quoteResult').classList.remove('active');
  document.getElementById('contactInfo').classList.remove('active');
  // Uncheck package options and remove active classes
  document.querySelectorAll('.package-option').forEach((option) => {
    option.classList.remove('active');
    option.querySelector('input').checked = false;
  });
}

// Function to calculate quote for the Breathe Easy Package
function calculateQuote() {
  // Define base rates
  const baseRates = {
    standardCleaning: 53.00,      // $53/hr
    deepCleaning: 63.00,          // $63/hr
    moveInOutCleaning: 60.00      // $60/hr
  };

  // Helper function to safely get values
  const getValue = (id, defaultValue = 0) => {
    const element = document.getElementById(id);
    if (!element) {
      console.warn(`Element with id '${id}' not found`);
      return defaultValue;
    }
    return parseInt(element.value, 10) || defaultValue;
  };

  // Get form values with fallbacks
  const serviceSelection = document.getElementById('serviceSelection')?.value || 'standardCleaning';
  const bedrooms = getValue('bedrooms');
  const bathrooms = getValue('bathrooms');
  const halfBathrooms = getValue('halfBathrooms');
  const kitchens = getValue('kitchens');
  const livingRooms = getValue('livingRooms');
  const bonusRooms = getValue('bonusRooms');
  const laundryRooms = getValue('laundryRooms');
  const offices = getValue('offices');
  const sqft = getValue('sqft', 1000);
  const dirtyScale = getValue('dirtyScale', 1);

  // Validate inputs
  if (isNaN(bedrooms) || isNaN(bathrooms) || isNaN(halfBathrooms) || 
      isNaN(kitchens) || isNaN(livingRooms) || isNaN(bonusRooms) || 
      isNaN(laundryRooms) || isNaN(offices) || isNaN(sqft) || isNaN(dirtyScale)) {
    alert('Please enter valid numbers for all fields.');
    return;
  }

  // Define base cleaning times in hours
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

  // Define Dirtiness Scale Multipliers
  const dirtinessScaleMultipliers = {
    1: 1.15,   // Light
    2: 1.25,
    3: 1.35,
    4: 1.75,
    5: 2.0     // Very Dirty
  };

  // Calculate total time
  let totalTime = 0;
  totalTime += bedrooms * baseCleaningTimes.bedroom;
  totalTime += bathrooms * baseCleaningTimes.bathroom;
  totalTime += halfBathrooms * baseCleaningTimes.halfBathroom;
  totalTime += kitchens * baseCleaningTimes.kitchen;
  totalTime += livingRooms * baseCleaningTimes.livingRoom;
  totalTime += bonusRooms * baseCleaningTimes.bonusRoom;
  totalTime += laundryRooms * baseCleaningTimes.laundryRoom;
  totalTime += offices * baseCleaningTimes.office;

  // Apply dirtiness multiplier
  const multiplier = dirtinessScaleMultipliers[dirtyScale] || 1.0;
  totalTime *= multiplier;

  // Add time for square footage
  totalTime += Math.ceil(sqft / 500) * 0.5;

  // Calculate cost
  const baseRate = baseRates[serviceSelection] || baseRates.standardCleaning;
  const totalCost = totalTime * baseRate;

  // Update display
  document.getElementById('totalTime').textContent = totalTime.toFixed(2);
  document.getElementById('totalCost').textContent = totalCost.toFixed(2);
  
  // Show results
  document.getElementById('quoteResult').classList.add('active');
  document.getElementById('contactInfo').classList.add('active');

  console.log('Quote calculated:', {
    service: serviceSelection,
    totalTime,
    totalCost,
    multiplier
  });
}

// Function to calculate quote for the Block Cleaning Package
function calculateBlockCleaningQuote() {
  const rate = 53.00; // $53/hr

  // Helper function to safely get values
  const getValue = (id, defaultValue = 1) => {
    const element = document.getElementById(id);
    if (!element) {
      console.warn(`Element with id '${id}' not found`);
      return defaultValue;
    }
    return parseInt(element.value, 10) || defaultValue;
  };

  const cleaners = getValue('cleaners', 1);
  const hours = getValue('hours', 1);

  const totalTime = cleaners * hours;
  const totalCost = totalTime * rate;

  document.getElementById('totalTime').textContent = totalTime.toFixed(2);
  document.getElementById('totalCost').textContent = totalCost.toFixed(2);
  
  document.getElementById('quoteResult').classList.add('active');
  document.getElementById('contactInfo').classList.add('active');

  console.log('Block Cleaning Quote calculated:', {
    cleaners,
    hours,
    totalTime,
    totalCost
  });
}

// Function to submit the quote and send data via a Zapier webhook
function submitQuote() {
  // Get contact information
  const customerName = document.getElementById('customerName').value.trim();
  const customerEmail = document.getElementById('customerEmail').value.trim();
  const customerPhone = document.getElementById('customerPhone').value.trim();
  const customerZip = document.getElementById('customerZip').value.trim();

  // Get quote details
  const totalTime = document.getElementById('totalTime').textContent;
  const totalCost = document.getElementById('totalCost').textContent;
  const selectedPackage = document.querySelector('input[name="package"]:checked')?.value || '';
  const serviceType = document.getElementById('serviceSelection')?.value || '';

  // Get cleaning details based on package type
  let cleaningDetails = {};
  
  if (selectedPackage === 'breatheEasy') {
    cleaningDetails = {
      bedrooms: getValue('bedrooms'),
      bathrooms: getValue('bathrooms'),
      halfBathrooms: getValue('halfBathrooms'),
      kitchens: getValue('kitchens'),
      livingRooms: getValue('livingRooms'),
      bonusRooms: getValue('bonusRooms'),
      laundryRooms: getValue('laundryRooms'),
      offices: getValue('offices'),
      squareFootage: getValue('sqft'),
      dirtinessScale: getValue('dirtyScale'),
      serviceType: getValue('serviceSelection')
    };
  } else if (selectedPackage === 'blockCleaning') {
    cleaningDetails = {
      numberOfCleaners: getValue('cleaners'),
      numberOfHours: getValue('hours')
    };
  }

  // Validate required fields
  if (!customerName || !customerEmail || !customerPhone || !customerZip) {
    alert('Please enter all contact information.');
    return;
  }

  // Validate ZIP code format
  if (!/^\d{5}$/.test(customerZip)) {
    alert('Please enter a valid 5-digit ZIP code.');
    return;
  }

  // Prepare data for Zapier
  const data = {
    customerName,
    customerEmail,
    customerPhone,
    customerZip,
    totalTime,
    totalCost,
    selectedPackage,
    ...cleaningDetails,  // Spread the cleaning details into the data object
    timestamp: new Date().toISOString(),
  };

  console.log('Preparing to send data to Zapier:', data);

  const ZAPIER_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/15133381/2aa1g16/';

  // Create form data
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    formData.append(key, value);
  });

  // Send data to Zapier using XMLHttpRequest
  const xhr = new XMLHttpRequest();
  xhr.open('POST', ZAPIER_WEBHOOK_URL, true);

  xhr.onload = function() {
    console.log('Response status:', xhr.status);
    console.log('Response:', xhr.responseText);
    
    if (xhr.status === 200) {
      console.log('Success - Data sent to Zapier with cleaning details:', data);
      alert('Thank you for your submission! We will contact you shortly.');
      resetForm();
    } else {
      console.error('Error - Server responded with:', xhr.status);
      alert('There was an error submitting your quote. Please try again or contact us directly.');
    }
  };

  xhr.onerror = function() {
    console.error('Error details:', {
      status: xhr.status,
      statusText: xhr.statusText
    });
    alert('There was an error submitting your quote. Please try again or contact us directly.');
  };

  // Send the request
  try {
    xhr.send(JSON.stringify(data));
    console.log('Request sent with data:', data);
  } catch (error) {
    console.error('Error sending request:', error);
    alert('There was an error submitting your quote. Please try again or contact us directly.');
  }
}

// Function to reset the form after submission
function resetForm() {
  document.getElementById('quoteResult').classList.remove('active');
  document.getElementById('contactInfo').classList.remove('active');
  document.getElementById('quoteForm').reset();
  goBack();
}
