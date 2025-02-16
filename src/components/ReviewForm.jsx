import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNotification } from '../contexts/NotificationContext';

function ReviewForm({ bookingId, onReviewSubmitted }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { showNotification } = useNotification();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('reviews')
        .insert([{
          booking_id: bookingId,
          client_id: user.id,
          rating,
          comment
        }]);

      if (error) throw error;

      showNotification('Review submitted successfully!', 'success');
      setRating(5);
      setComment('');
      if (onReviewSubmitted) onReviewSubmitted();
    } catch (error) {
      console.error('Error submitting review:', error);
      showNotification('Error submitting review', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-primary mb-2">Rating</label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              className="text-2xl focus:outline-none"
            >
              <span className={star <= rating ? 'text-gold' : 'text-secondary'}>
                ★
              </span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-primary mb-2">Comment</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="w-full px-3 py-2 bg-input border border-border rounded focus:outline-none focus:border-gold"
          rows="4"
          placeholder="Share your experience..."
          required
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full px-4 py-2 bg-gold text-background rounded hover:bg-gold/90 transition-colors disabled:opacity-50"
      >
        {submitting ? 'Submitting...' : 'Submit Review'}
      </button>
    </form>
  );
}

export default ReviewForm; 