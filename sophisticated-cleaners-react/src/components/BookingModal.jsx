import React from 'react';

function BookingModal({ booking, isOpen, onClose, role, onStatusUpdate, onCancel }) {
  if (!isOpen || !booking) return null;

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
      timeZone: 'America/Boise'
    });
  };

  const renderAdminContent = () => (
    <>
      {/* Admin sees everything */}
      <div className="p-4 bg-container rounded-lg">
        <h3 className="font-medium text-primary mb-2">Booking Information</h3>
        <div className="space-y-2 text-secondary">
          <p>Date: {formatDate(booking.cleaning_date)}</p>
          <p>Time: {formatTime(booking.cleaning_date)}</p>
          <p>Status: {booking.status}</p>
          <p>Payment Status: {booking.payment_status}</p>
        </div>
      </div>

      <div className="p-4 bg-container rounded-lg">
        <h3 className="font-medium text-primary mb-2">Client Information</h3>
        <div className="space-y-2 text-secondary">
          <p>Email: {booking.details.client_email}</p>
          <p>Address: {`${booking.details.address.street}, ${booking.details.address.city}, ${booking.details.address.state} ${booking.details.address.zipCode}`}</p>
        </div>
      </div>

      <div className="p-4 bg-container rounded-lg">
        <h3 className="font-medium text-primary mb-2">Actions</h3>
        <div className="flex gap-2">
          <button 
            className="px-4 py-2 bg-gold text-background rounded hover:bg-gold/90"
            onClick={() => onStatusUpdate(booking.id)}
          >
            Update Status
          </button>
          <button 
            className="px-4 py-2 bg-error text-background rounded hover:bg-error/90"
            onClick={() => onCancel(booking.id)}
          >
            Cancel Booking
          </button>
        </div>
      </div>
    </>
  );

  const renderStaffContent = () => (
    <>
      {/* Staff sees cleaning details and location */}
      <div className="p-4 bg-container rounded-lg">
        <h3 className="font-medium text-primary mb-2">Cleaning Details</h3>
        <div className="space-y-2 text-secondary">
          <p>Date: {formatDate(booking.cleaning_date)}</p>
          <p>Time: {formatTime(booking.cleaning_date)}</p>
          <p>Package: {booking.details.package}</p>
          {booking.details.package === 'blockCleaning' && (
            <>
              <p>Cleaners Required: {booking.details.rooms.cleaners}</p>
              <p>Hours Allocated: {booking.details.rooms.hours}</p>
            </>
          )}
        </div>
      </div>

      <div className="p-4 bg-container rounded-lg">
        <h3 className="font-medium text-primary mb-2">Location</h3>
        <div className="space-y-2 text-secondary">
          <p>{booking.details.address.street}</p>
          <p>{booking.details.address.city}, {booking.details.address.state} {booking.details.address.zipCode}</p>
        </div>
      </div>

      <div className="p-4 bg-container rounded-lg">
        <h3 className="font-medium text-primary mb-2">Actions</h3>
        <div className="flex gap-2">
          <button 
            className="px-4 py-2 bg-gold text-background rounded hover:bg-gold/90"
            onClick={() => onStatusUpdate(booking.id)}
          >
            Mark as Complete
          </button>
        </div>
      </div>
    </>
  );

  const renderClientContent = () => (
    <>
      {/* Client sees service details and status */}
      <div className="p-4 bg-container rounded-lg">
        <h3 className="font-medium text-primary mb-2">Service Details</h3>
        <div className="space-y-2 text-secondary">
          <p>Date: {formatDate(booking.cleaning_date)}</p>
          <p>Time: {formatTime(booking.cleaning_date)}</p>
          <p>Package: {booking.details.package}</p>
          {booking.details.package === 'blockCleaning' && (
            <>
              <p>Cleaners: {booking.details.rooms.cleaners}</p>
              <p>Hours: {booking.details.rooms.hours}</p>
            </>
          )}
        </div>
      </div>

      <div className="p-4 bg-container rounded-lg">
        <h3 className="font-medium text-primary mb-2">Status</h3>
        <div className="space-y-2 text-secondary">
          <p>Booking Status: {booking.status}</p>
          <p>Payment Status: {booking.payment_status}</p>
        </div>
      </div>

      {booking.status !== 'completed' && booking.status !== 'cancelled' && (
        <div className="p-4 bg-container rounded-lg">
          <h3 className="font-medium text-primary mb-2">Actions</h3>
          <div className="flex gap-2">
            <button 
              className="px-4 py-2 bg-error text-background rounded hover:bg-error/90"
              onClick={() => onCancel(booking.id)}
            >
              Cancel Booking
            </button>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-background rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 space-y-4">
          <div className="flex justify-between items-start">
            <h2 className="text-xl font-semibold text-gold">Booking Details</h2>
            <button 
              onClick={onClose}
              className="text-secondary hover:text-gold"
            >
              Close
            </button>
          </div>

          <div className="space-y-4">
            {role === 'admin' && renderAdminContent()}
            {role === 'staff' && renderStaffContent()}
            {role === 'client' && renderClientContent()}

            {/* Service Details - shown to all */}
            <div className="p-4 bg-container rounded-lg">
              <h3 className="font-medium text-primary mb-2">Service Details</h3>
              <div className="space-y-2 text-secondary">
                <p>Package: {booking.details.package}</p>
                {booking.details.package === 'blockCleaning' && (
                  <>
                    <p>Cleaners: {booking.details.rooms.cleaners}</p>
                    <p>Hours: {booking.details.rooms.hours}</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BookingModal; 