import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { booking_id, staff_id } = await req.json()
    
    // Create a Supabase client with the Auth context of the logged in user
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // First verify the booking is still available
    const { data: booking, error: checkError } = await supabaseClient
      .from('bookings')
      .select('*')
      .eq('id', booking_id)
      .eq('status', 'unassigned')
      .single()

    if (checkError || !booking) {
      return new Response(
        JSON.stringify({ error: 'This job is no longer available' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Start a transaction by updating the booking status first
    const { error: updateError } = await supabaseClient
      .from('bookings')
      .update({
        status: 'pending',
        updated_at: new Date().toISOString()
      })
      .eq('id', booking_id)
      .eq('status', 'unassigned') // Double check it's still unassigned

    if (updateError) {
      throw updateError
    }

    // Create staff schedule
    const { error: scheduleError } = await supabaseClient
      .from('staff_schedules')
      .insert({
        staff_id: staff_id,
        booking_id: booking_id,
        start_time: booking.cleaning_date,
        end_time: new Date(new Date(booking.cleaning_date).getTime() + 
          (booking.details.rooms?.hours || 2) * 60 * 60 * 1000).toISOString(),
        status: 'scheduled'
      })

    if (scheduleError) {
      // If schedule creation fails, try to revert the booking status
      await supabaseClient
        .from('bookings')
        .update({
          status: 'unassigned',
          updated_at: new Date().toISOString()
        })
        .eq('id', booking_id)
      
      throw scheduleError
    }

    return new Response(
      JSON.stringify({ success: true, data: booking }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
}) 