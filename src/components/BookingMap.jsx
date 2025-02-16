import { useState, useCallback } from 'react';
import { GoogleMap, Marker, InfoWindow } from '@react-google-maps/api';

const containerStyle = {
  width: '100%',
  height: '400px'
};

const defaultCenter = {
  lat: 43.6112, // Meridian, Idaho coordinates
  lng: -116.3915
};

function BookingMap({ bookings }) {
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [map, setMap] = useState(null);

  const onLoad = useCallback(function callback(map) {
    if (bookings?.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      bookings.forEach(booking => {
        if (booking.details?.location?.lat && booking.details?.location?.lng) {
          bounds.extend({
            lat: booking.details.location.lat,
            lng: booking.details.location.lng
          });
        }
      });
      map.fitBounds(bounds);
    }
    setMap(map);
  }, [bookings]);

  const onUnmount = useCallback(function callback() {
    setMap(null);
  }, []);

  return (
    <div className="mt-4">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={defaultCenter}
        zoom={10}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={{
          styles: [
            {
              elementType: "geometry",
              stylers: [{ color: "#242f3e" }]
            },
            {
              elementType: "labels.text.stroke",
              stylers: [{ color: "#242f3e" }]
            },
            {
              elementType: "labels.text.fill",
              stylers: [{ color: "#746855" }]
            }
          ]
        }}
      >
        {bookings?.map(booking => (
          booking.details?.location?.lat && booking.details?.location?.lng && (
            <Marker
              key={booking.id}
              position={{
                lat: booking.details.location.lat,
                lng: booking.details.location.lng
              }}
              onClick={() => setSelectedBooking(booking)}
              icon={{
                url: `http://maps.google.com/mapfiles/ms/icons/${
                  booking.status === 'completed' ? 'green' :
                  booking.status === 'pending' ? 'yellow' :
                  'red'
                }-dot.png`
              }}
            />
          )
        ))}

        {selectedBooking && (
          <InfoWindow
            position={{
              lat: selectedBooking.details.location.lat,
              lng: selectedBooking.details.location.lng
            }}
            onCloseClick={() => setSelectedBooking(null)}
          >
            <div className="bg-white p-2 rounded shadow">
              <h3 className="font-semibold text-gray-900">
                {selectedBooking.details.package} Cleaning
              </h3>
              <p className="text-sm text-gray-600">
                {new Date(selectedBooking.cleaning_date).toLocaleString()}
              </p>
              <p className="text-sm text-gray-600">
                Status: {selectedBooking.status}
              </p>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
}

export default BookingMap; 