import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

function ReviewsList({ bookingId = null }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        let query = supabase
          .from('reviews')
          .select(`
            *,
            bookings (
              cleaning_date,
              details
            )
          `)
          .order('created_at', { ascending: false });

        if (bookingId) {
          query = query.eq('booking_id', bookingId);
        }

        const { data, error } = await query;

        if (error) throw error;
        setReviews(data || []);
      } catch (error) {
        console.error('Error fetching reviews:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchReviews();
  }, [bookingId]);

  if (loading) {
    return <div className="text-secondary">Loading reviews...</div>;
  }

  if (!reviews.length) {
    return <div className="text-secondary">No reviews yet</div>;
  }

  return (
    <div className="space-y-4">
      {reviews.map(review => (
        <div 
          key={review.id}
          className="bg-container border border-border rounded-lg p-4"
        >
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center">
              {[...Array(5)].map((_, i) => (
                <span
                  key={i}
                  className={`text-lg ${
                    i < review.rating ? 'text-gold' : 'text-secondary'
                  }`}
                >
                  ★
                </span>
              ))}
            </div>
            <span className="text-sm text-secondary">
              {new Date(review.created_at).toLocaleDateString()}
            </span>
          </div>
          
          <p className="text-primary">{review.comment}</p>
          
          {review.bookings && (
            <div className="mt-2 text-sm text-secondary">
              Service Date: {new Date(review.bookings.cleaning_date).toLocaleDateString()}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default ReviewsList; 