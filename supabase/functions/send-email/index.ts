// Follow this setup guide to integrate the Deno runtime into your Supabase project:
// https://github.com/supabase/supabase/tree/master/examples/edge-functions/supabase/functions

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY')
const SENDGRID_FROM_EMAIL = Deno.env.get('SENDGRID_FROM_EMAIL') || 'noreply@pokebinder.com'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

interface EmailRequest {
  to: string
  subject: string
  templateId?: string
  dynamicTemplateData?: Record<string, any>
  text?: string
  html?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create a Supabase client with the service role key
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Get the JWT token from the request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the JWT token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse the request body
    const { to, subject, templateId, dynamicTemplateData, text, html } = await req.json() as EmailRequest

    // Validate required fields
    if (!to || !subject || (!templateId && !text && !html)) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(to)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if SendGrid API key is configured
    if (!SENDGRID_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'SendGrid API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Prepare the email payload
    const emailPayload: any = {
      personalizations: [
        {
          to: [{ email: to }],
          subject: subject,
        },
      ],
      from: { email: SENDGRID_FROM_EMAIL },
    }

    // Add template or content
    if (templateId) {
      emailPayload.template_id = templateId
      if (dynamicTemplateData) {
        emailPayload.personalizations[0].dynamic_template_data = dynamicTemplateData
      }
    } else {
      emailPayload.content = []
      if (text) {
        emailPayload.content.push({
          type: 'text/plain',
          value: text,
        })
      }
      if (html) {
        emailPayload.content.push({
          type: 'text/html',
          value: html,
        })
      }
    }

    // Send the email using SendGrid API
    const sendgridResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    })

    // Log the email to the database for tracking
    await supabase
      .from('email_logs')
      .insert({
        user_id: user.id,
        recipient: to,
        subject: subject,
        template_id: templateId,
        status: sendgridResponse.ok ? 'sent' : 'failed',
        error: sendgridResponse.ok ? null : await sendgridResponse.text(),
      })

    // Return the response
    if (sendgridResponse.ok) {
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      const errorText = await sendgridResponse.text()
      return new Response(
        JSON.stringify({ error: `SendGrid API error: ${errorText}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
