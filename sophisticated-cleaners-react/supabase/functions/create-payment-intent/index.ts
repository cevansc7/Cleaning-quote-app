import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@12.6.0'

// Initialize Stripe
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-08-16",
});

serve(async (req) => {
  // Add CORS headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    });
  }

  try {
    // Log the request body for debugging
    const body = await req.json();
    console.log('Request body:', body);

    const { amount, currency, bookingId, customerId } = body;

    // Validate required parameters
    if (!amount || !currency) {
      console.log('Missing required parameters:', { amount, currency });
      return new Response(
        JSON.stringify({
          error: 'Missing required parameters. Need amount and currency'
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        }
      );
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount),
      currency: currency,
      metadata: {
        bookingId: bookingId || '',
        customerId: customerId || ''
      }
    });

    // Return the client secret
    return new Response(
      JSON.stringify({
        client_secret: paymentIntent.client_secret
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      }
    );

  } catch (error) {
    // Log the error for debugging
    console.error('Payment intent error:', error);

    // Return a proper error response
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error'
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      }
    );
  }
});