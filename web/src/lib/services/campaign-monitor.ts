interface CampaignMonitorEmailData {
  to: string;
  firstName?: string;
  resetUrl: string;
  expiryHours?: number;
}

interface CampaignMonitorResponse {
  success: boolean;
  message: string;
  messageId?: string;
}

export class CampaignMonitorService {
  private readonly apiKey: string;
  private readonly smartEmailId: string;
  private readonly baseUrl = 'https://api.createsend.com/api/v3.3';

  constructor() {
    this.apiKey = process.env.CAMPAIGN_MONITOR_API_KEY || '';
    this.smartEmailId = process.env.CAMPAIGN_MONITOR_PASSWORD_RESET_TEMPLATE_ID || '';
    
    if (!this.apiKey || !this.smartEmailId) {
      console.warn('Campaign Monitor credentials not configured. Password reset emails will be logged instead.');
    }
  }

  /**
   * Send password reset email using Campaign Monitor Smart Email Template
   */
  async sendPasswordResetEmail(data: CampaignMonitorEmailData): Promise<CampaignMonitorResponse> {
    if (!this.apiKey || !this.smartEmailId) {
      // Fallback to console logging if Campaign Monitor not configured
      console.log(`
=================================
PASSWORD RESET EMAIL (DEVELOPMENT)
=================================
To: ${data.to}
Name: ${data.firstName || 'User'}
Reset URL: ${data.resetUrl}
Expires: ${data.expiryHours || 24} hours
=================================
      `);
      
      return {
        success: true,
        message: 'Development mode: Email logged to console',
        messageId: 'dev-' + Date.now()
      };
    }

    try {
      const emailData = {
        To: data.to,
        Data: {
          firstName: data.firstName || 'there',
          resetUrl: data.resetUrl,
          expiryHours: data.expiryHours || 24,
        },
        // Optional: Add tracking and personalization
        ConsentToTrack: 'Yes',
        AddRecipientsToList: false, // Don't add to mailing list
      };

      const response = await fetch(`${this.baseUrl}/transactional/smartemail/${this.smartEmailId}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${Buffer.from(`${this.apiKey}:x`).toString('base64')}`,
        },
        body: JSON.stringify(emailData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Campaign Monitor API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      
      return {
        success: true,
        message: 'Password reset email sent successfully',
        messageId: result.MessageID,
      };
    } catch (error) {
      console.error('Campaign Monitor password reset email error:', error);
      
      // Fallback to console logging if API fails
      console.log(`
=================================
PASSWORD RESET EMAIL (FALLBACK)
=================================
To: ${data.to}
Name: ${data.firstName || 'User'}
Reset URL: ${data.resetUrl}
Expires: ${data.expiryHours || 24} hours
Error: ${error instanceof Error ? error.message : 'Unknown error'}
=================================
      `);
      
      return {
        success: false,
        message: `Failed to send email via Campaign Monitor: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Validate Campaign Monitor configuration
   */
  isConfigured(): boolean {
    return !!(this.apiKey && this.smartEmailId);
  }

  /**
   * Test Campaign Monitor connection
   */
  async testConnection(): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/transactional/smartemail/${this.smartEmailId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.apiKey}:x`).toString('base64')}`,
        },
      });

      return response.ok;
    } catch (error) {
      console.error('Campaign Monitor connection test failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const campaignMonitorService = new CampaignMonitorService();