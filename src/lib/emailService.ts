import { createClient } from '@/lib/supabaseClient';

// Email service using Supabase Edge Functions for sending emails
// This allows us to keep API keys server-side

export interface EmailOptions {
  to: string;
  subject: string;
  templateId?: string;
  dynamicTemplateData?: Record<string, any>;
  text?: string;
  html?: string;
}

export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();
    
    // Call the Supabase Edge Function for sending emails
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        to: options.to,
        subject: options.subject,
        templateId: options.templateId,
        dynamicTemplateData: options.dynamicTemplateData,
        text: options.text,
        html: options.html
      }
    });
    
    if (error) {
      console.error('Error sending email:', error);
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (error: any) {
    console.error('Error in email service:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

// Email templates
export const EMAIL_TEMPLATES = {
  COLLABORATION_INVITE: 'd-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', // Replace with actual SendGrid template ID
  COMMENT_NOTIFICATION: 'd-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', // Replace with actual SendGrid template ID
  COLLECTION_SHARED: 'd-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'    // Replace with actual SendGrid template ID
};

// Helper function to send collaboration invite
export async function sendCollaborationInvite(
  to: string,
  inviterName: string,
  collectionName: string,
  acceptUrl: string
): Promise<{ success: boolean; error?: string }> {
  return sendEmail({
    to,
    subject: `${inviterName} invited you to collaborate on a Pokémon collection`,
    templateId: EMAIL_TEMPLATES.COLLABORATION_INVITE,
    dynamicTemplateData: {
      inviter_name: inviterName,
      collection_name: collectionName,
      accept_url: acceptUrl
    }
  });
}

// Helper function to send comment notification
export async function sendCommentNotification(
  to: string,
  commenterName: string,
  collectionName: string,
  commentText: string,
  viewUrl: string
): Promise<{ success: boolean; error?: string }> {
  return sendEmail({
    to,
    subject: `${commenterName} commented on your Pokémon collection`,
    templateId: EMAIL_TEMPLATES.COMMENT_NOTIFICATION,
    dynamicTemplateData: {
      commenter_name: commenterName,
      collection_name: collectionName,
      comment_text: commentText,
      view_url: viewUrl
    }
  });
}

// Helper function to send collection shared notification
export async function sendCollectionSharedNotification(
  to: string,
  sharerName: string,
  collectionName: string,
  viewUrl: string
): Promise<{ success: boolean; error?: string }> {
  return sendEmail({
    to,
    subject: `${sharerName} shared a Pokémon collection with you`,
    templateId: EMAIL_TEMPLATES.COLLECTION_SHARED,
    dynamicTemplateData: {
      sharer_name: sharerName,
      collection_name: collectionName,
      view_url: viewUrl
    }
  });
}
