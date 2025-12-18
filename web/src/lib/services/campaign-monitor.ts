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

  /**
   * Subscribe a user to a newsletter list
   */
  async subscribeToList(
    listId: string,
    email: string,
    name: string,
    customFields: Record<string, string>
  ): Promise<{ success: boolean; message: string }> {
    if (!this.apiKey) {
      console.log(`
=================================
NEWSLETTER SUBSCRIPTION (DEVELOPMENT)
=================================
List ID: ${listId}
Email: ${email}
Name: ${name}
Custom Fields: ${JSON.stringify(customFields)}
Action: SUBSCRIBE
=================================
      `);
      return {
        success: true,
        message: 'Development mode: Subscription logged to console'
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/subscribers/${listId}.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${Buffer.from(`${this.apiKey}:x`).toString('base64')}`,
        },
        body: JSON.stringify({
          EmailAddress: email,
          Name: name,
          CustomFields: Object.entries(customFields).map(([key, value]) => ({
            Key: key,
            Value: value
          })),
          Resubscribe: true,
          RestartSubscriptionBasedAutoresponders: false,
          ConsentToTrack: 'Yes'
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Campaign Monitor API error: ${response.status} - ${errorText}`);
      }

      const result = await response.text();
      return {
        success: true,
        message: `Successfully subscribed ${email} to list ${listId}`,
      };
    } catch (error) {
      console.error('Campaign Monitor subscription error:', error);
      return {
        success: false,
        message: `Failed to subscribe: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Unsubscribe a user from a newsletter list
   */
  async unsubscribeFromList(
    listId: string,
    email: string
  ): Promise<{ success: boolean; message: string }> {
    if (!this.apiKey) {
      console.log(`
=================================
NEWSLETTER UNSUBSCRIPTION (DEVELOPMENT)
=================================
List ID: ${listId}
Email: ${email}
Action: UNSUBSCRIBE
=================================
      `);
      return {
        success: true,
        message: 'Development mode: Unsubscription logged to console'
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/subscribers/${listId}.json?email=${encodeURIComponent(email)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.apiKey}:x`).toString('base64')}`,
        },
      });

      if (!response.ok) {
        // 404 means already unsubscribed or never subscribed - treat as success
        if (response.status === 404) {
          return {
            success: true,
            message: `Email ${email} was not subscribed to list ${listId}`,
          };
        }

        const errorText = await response.text();
        throw new Error(`Campaign Monitor API error: ${response.status} - ${errorText}`);
      }

      return {
        success: true,
        message: `Successfully unsubscribed ${email} from list ${listId}`,
      };
    } catch (error) {
      console.error('Campaign Monitor unsubscription error:', error);
      return {
        success: false,
        message: `Failed to unsubscribe: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get subscriber details from a list
   */
  async getSubscriberDetails(
    listId: string,
    email: string
  ): Promise<{
    success: boolean;
    subscribed: boolean;
    data?: any;
    message: string
  }> {
    if (!this.apiKey) {
      console.log(`
=================================
GET SUBSCRIBER DETAILS (DEVELOPMENT)
=================================
List ID: ${listId}
Email: ${email}
=================================
      `);
      return {
        success: true,
        subscribed: false,
        message: 'Development mode: Details logged to console'
      };
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/subscribers/${listId}.json?email=${encodeURIComponent(email)}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${Buffer.from(`${this.apiKey}:x`).toString('base64')}`,
          },
        }
      );

      if (response.status === 404) {
        return {
          success: true,
          subscribed: false,
          message: `Email ${email} is not subscribed to list ${listId}`,
        };
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Campaign Monitor API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return {
        success: true,
        subscribed: data.State === 'Active',
        data,
        message: `Retrieved subscriber details for ${email}`,
      };
    } catch (error) {
      console.error('Campaign Monitor get subscriber error:', error);
      return {
        success: false,
        subscribed: false,
        message: `Failed to get subscriber details: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}

// Export singleton instance
export const campaignMonitorService = new CampaignMonitorService();