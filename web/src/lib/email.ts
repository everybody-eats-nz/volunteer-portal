// Email service utility
// This is a placeholder implementation that can be extended with a real email service

import { getBaseUrl } from "./utils";

interface InvitationEmailData {
  email: string;
  firstName?: string;
  lastName?: string;
  role: "VOLUNTEER" | "ADMIN";
  tempPassword: string;
}

export async function sendInvitationEmail(
  data: InvitationEmailData
): Promise<void> {
  // TODO: Implement with a real email service like SendGrid, AWS SES, or Nodemailer

  const name =
    data.firstName && data.lastName
      ? `${data.firstName} ${data.lastName}`
      : data.firstName || data.lastName || data.email;

  const emailContent = `
    Subject: Welcome to Everybody Eats Volunteer Portal!
    
    Hi ${name},
    
    You've been invited to join the Everybody Eats volunteer portal as a ${data.role.toLowerCase()}.
    
    Your login credentials:
    Email: ${data.email}
    Temporary Password: ${data.tempPassword}
    
    Please log in at: ${getBaseUrl()}/login
    
    For security, please change your password after your first login.
    
    Welcome to the team!
    
    Best regards,
    The Everybody Eats Team
  `;

  // For development: log the email content
  console.log("📧 Email would be sent:");
  console.log(emailContent);

  // In production, replace this with actual email sending:
  // await emailProvider.send({
  //   to: data.email,
  //   subject: "Welcome to Everybody Eats Volunteer Portal!",
  //   html: emailTemplate,
  // });
}

// Email templates for different scenarios
export const emailTemplates = {
  invitation: (
    name: string,
    role: string,
    tempPassword: string,
    loginUrl: string
  ) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Welcome to Everybody Eats</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2563eb;">Welcome to Everybody Eats Volunteer Portal!</h2>
        
        <p>Hi ${name},</p>
        
        <p>You've been invited to join the Everybody Eats volunteer portal as a <strong>${role.toLowerCase()}</strong>.</p>
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Your Login Credentials</h3>
          <p><strong>Email:</strong> ${name}</p>
          <p><strong>Temporary Password:</strong> <code style="background-color: #e2e8f0; padding: 2px 4px; border-radius: 4px;">${tempPassword}</code></p>
        </div>
        
        <p>
          <a href="${loginUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Login to Your Account
          </a>
        </p>
        
        <p><small><strong>Important:</strong> For security, please change your password after your first login.</small></p>
        
        <p>Welcome to the team!</p>
        
        <p>Best regards,<br>The Everybody Eats Team</p>
      </div>
    </body>
    </html>
  `,
};
