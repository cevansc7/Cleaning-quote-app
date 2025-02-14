import { useState } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { supabase } from '../lib/supabaseClient';
import { useNotification } from '../contexts/NotificationContext';

function PaymentForm({ bookingId, amount, onPaymentSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const { showNotification } = useNotification();

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // Create payment intent
      const { data, error } = await supabase.functions.invoke('create-payment-intent', {
        body: { 
          amount: amount,
          currency: 'usd',
          bookingId,
          customerId: user.id
        }
      });

      console.log('Payment intent response:', { data, error });

      if (error) throw error;

      // Confirm card payment
      const { error: stripeError } = await stripe.confirmCardPayment(
        data.client_secret,
        {
          payment_method: {
            card: elements.getElement(CardElement),
            billing_details: {
              email: user.email,
            },
          },
        }
      );

      if (stripeError) {
        showNotification(stripeError.message, 'error');
        return;
      }

      // Update booking payment status
      const { error: updateError } = await supabase
        .from('bookings')
        .update({ 
          payment_status: 'paid',
          payment_date: new Date().toISOString()
        })
        .eq('id', bookingId);

      console.log('Booking payment update result:', { bookingId, updateError });

      if (updateError) throw updateError;

      // Create notification about the successful payment
      await createNotification();

      showNotification('Payment successful!', 'success');
      if (onPaymentSuccess) onPaymentSuccess();

    } catch (error) {
      console.error('Payment error:', error);
      showNotification('Payment failed: ' + error.message, 'error');
    } finally {
      setProcessing(false);
    }
  };

  // When creating a notification, ensure the type is one of the allowed values
  // Common notification types are: 'info', 'success', 'warning', 'error'
  const createNotification = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error('No user found');
        return;
      }

      // Simplify the notification data to minimum required fields
      const notificationData = {
        recipient_id: user.id,
        title: 'Payment Successful',
        message: 'Your booking has been successfully created and paid',
        type: 'status_change',  // Using the raw string value
        read: false
      };

      // First, try to insert without the optional fields
      const { error: firstTry } = await supabase
        .from('notifications')
        .insert(notificationData);

      if (!firstTry) {
        console.log('Basic notification created successfully');
        return;
      }

      // If that fails, log the exact error and data
      console.error('First attempt failed:', {
        error: firstTry,
        sentData: notificationData,
        typeValue: notificationData.type,
        typeLength: notificationData.type.length,
        typeCharCodes: [...notificationData.type].map(char => char.charCodeAt(0))
      });

    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-4 border border-border rounded-lg bg-container">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#ffffff',
                '::placeholder': {
                  color: '#a0aec0',
                },
              },
              invalid: {
                color: '#ef4444',
              },
            },
          }}
        />
      </div>

      <button
        type="submit"
        disabled={!stripe || processing}
        className="w-full px-4 py-2 bg-gold text-background rounded hover:bg-gold/90 transition-colors disabled:opacity-50"
      >
        {processing ? 'Processing...' : `Pay $${(amount / 100).toFixed(2)}`}
      </button>
    </form>
  );
}

export default PaymentForm; 