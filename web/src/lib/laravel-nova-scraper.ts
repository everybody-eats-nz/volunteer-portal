import fetch from "node-fetch";
import {
  NovaAuthConfig,
  NovaUser,
  NovaEventResource,
  NovaUserResource,
  NovaPaginatedResponse,
  ScrapedData,
  NovaShift,
  NovaShiftSignup,
  NovaEvent,
} from "../types/nova-migration";

export class LaravelNovaScraper {
  private config: NovaAuthConfig;
  private token: string | null = null;
  private csrfToken: string | null = null;
  private cookies: string[] = [];

  constructor(config: NovaAuthConfig) {
    this.config = config;
  }

  /**
   * Authenticate with Laravel Nova admin panel
   */
  async authenticate(): Promise<void> {
    try {
      console.log(`[AUTH] Starting authentication for ${this.config.baseUrl}`);
      console.log(`[AUTH] Using email: ${this.config.email}`);

      // Step 1: Get CSRF token and session cookies from login page
      console.log(`[AUTH] Step 1: Fetching login page...`);
      const loginPageResponse = await fetch(
        `${this.config.baseUrl}/nova/login`,
        {
          method: "GET",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
        }
      );

      console.log(
        `[AUTH] Login page response status: ${loginPageResponse.status}`
      );
      console.log(
        `[AUTH] Login page response headers:`,
        Object.fromEntries(loginPageResponse.headers.entries())
      );

      if (!loginPageResponse.ok) {
        throw new Error(
          `Failed to load login page: ${loginPageResponse.status} ${loginPageResponse.statusText}`
        );
      }

      // Extract cookies from response
      const setCookieHeaders = loginPageResponse.headers.raw()["set-cookie"];
      if (setCookieHeaders) {
        this.cookies = setCookieHeaders.map((cookie) => cookie.split(";")[0]);
        console.log(
          `[AUTH] Extracted ${this.cookies.length} cookies from login page`
        );
        console.log(`[AUTH] Cookies:`, this.cookies);
      } else {
        console.log(`[AUTH] No cookies found in login page response`);
      }

      const loginPageHtml = await loginPageResponse.text();
      console.log(
        `[AUTH] Login page HTML length: ${loginPageHtml.length} characters`
      );

      // Extract CSRF token from meta tag
      console.log(`[AUTH] Step 2: Looking for CSRF token in HTML...`);
      const csrfMatch = loginPageHtml.match(
        /<meta name="csrf-token" content="([^"]+)"/
      );
      if (csrfMatch) {
        this.csrfToken = csrfMatch[1];
        console.log(
          `[AUTH] Found CSRF token via meta tag: ${this.csrfToken.substring(
            0,
            10
          )}...`
        );
      } else {
        console.log(
          `[AUTH] No CSRF token found in meta tag, trying alternative pattern...`
        );
        // Try alternative pattern for Laravel
        const altCsrfMatch = loginPageHtml.match(
          /name="_token"[^>]*value="([^"]+)"/
        );
        if (altCsrfMatch) {
          this.csrfToken = altCsrfMatch[1];
          console.log(
            `[AUTH] Found CSRF token via input field: ${this.csrfToken.substring(
              0,
              10
            )}...`
          );
        } else {
          console.log(`[AUTH] No CSRF token found in input field either`);
          // Log a snippet of HTML to help debug
          const htmlSnippet = loginPageHtml.substring(0, 1000);
          console.log(`[AUTH] HTML snippet (first 1000 chars):`, htmlSnippet);
        }
      }

      if (!this.csrfToken) {
        throw new Error("Could not extract CSRF token from login page");
      }

      // Step 3: Submit login credentials
      console.log(`[AUTH] Step 3: Submitting login credentials...`);
      const loginData = new URLSearchParams({
        email: this.config.email,
        password: this.config.password,
        _token: this.csrfToken,
      });

      console.log(`[AUTH] Login data:`, {
        email: this.config.email,
        password: "[REDACTED]",
        _token: this.csrfToken.substring(0, 10) + "...",
      });

      console.log(
        `[AUTH] Making POST request to: ${this.config.baseUrl}/nova/login`
      );
      console.log(`[AUTH] Request headers:`, {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-CSRF-TOKEN": this.csrfToken.substring(0, 10) + "...",
        Cookie: this.cookies.join("; "),
        Referer: `${this.config.baseUrl}/nova/login`,
      });

      const loginResponse = await fetch(`${this.config.baseUrl}/nova/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-CSRF-TOKEN": this.csrfToken,
          Cookie: this.cookies.join("; "),
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          Referer: `${this.config.baseUrl}/nova/login`,
        },
        body: loginData.toString(),
        redirect: "manual", // Handle redirects manually to capture cookies
      });

      console.log(
        `[AUTH] Login response status: ${loginResponse.status} ${loginResponse.statusText}`
      );
      console.log(
        `[AUTH] Login response headers:`,
        Object.fromEntries(loginResponse.headers.entries())
      );

      // Update cookies from login response
      const loginSetCookieHeaders = loginResponse.headers.raw()["set-cookie"];
      if (loginSetCookieHeaders) {
        const newCookies = loginSetCookieHeaders.map(
          (cookie) => cookie.split(";")[0]
        );
        // Replace existing cookies with new ones (especially session cookies)
        const cookieNames = new Set();
        const updatedCookies = [];

        // Add new cookies first (they take precedence)
        for (const cookie of newCookies) {
          const cookieName = cookie.split("=")[0];
          cookieNames.add(cookieName);
          updatedCookies.push(cookie);
        }

        // Add existing cookies that don't conflict
        for (const cookie of this.cookies) {
          const cookieName = cookie.split("=")[0];
          if (!cookieNames.has(cookieName)) {
            updatedCookies.push(cookie);
          }
        }

        this.cookies = updatedCookies;
        console.log(
          `[AUTH] Updated cookies from login response. Total cookies: ${this.cookies.length}`
        );
        console.log(`[AUTH] Current cookies:`, this.cookies);
      } else {
        console.log(`[AUTH] No new cookies from login response`);
      }

      // Check if login was successful (usually redirects to dashboard)
      if (loginResponse.status === 302 || loginResponse.status === 200) {
        console.log("[AUTH] ✅ Successfully authenticated with Laravel Nova");
        const redirectLocation = loginResponse.headers.get("location");
        if (redirectLocation) {
          console.log(`[AUTH] Redirect location: ${redirectLocation}`);
        }
      } else {
        // Log response body for debugging
        const responseText = await loginResponse.text();
        console.log(
          `[AUTH] ❌ Login failed response body:`,
          responseText.substring(0, 500)
        );
        throw new Error(
          `Login failed with status: ${loginResponse.status} ${loginResponse.statusText}`
        );
      }
    } catch (error) {
      throw new Error(
        `Authentication failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Fetch data from Nova API endpoint with authentication
   */
  async novaApiRequest(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<NovaPaginatedResponse> {
    if (!this.csrfToken) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    const url = `${this.config.baseUrl}/nova-api${endpoint}`;

    const requestHeaders = {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-CSRF-TOKEN": this.csrfToken,
      Cookie: this.cookies.join("; "),
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "X-Requested-With": "XMLHttpRequest",
      ...options.headers,
    };

    const response = await fetch(url, {
      headers: requestHeaders,
    });

    // Update cookies from API response (Nova might rotate session cookies)
    const apiSetCookieHeaders = response.headers.raw()["set-cookie"];
    if (apiSetCookieHeaders) {
      const newCookies = apiSetCookieHeaders.map(
        (cookie) => cookie.split(";")[0]
      );
      // Replace existing cookies with new ones
      const cookieNames = new Set();
      const updatedCookies = [];

      // Add new cookies first
      for (const cookie of newCookies) {
        const cookieName = cookie.split("=")[0];
        cookieNames.add(cookieName);
        updatedCookies.push(cookie);
      }

      // Add existing cookies that don't conflict
      for (const cookie of this.cookies) {
        const cookieName = cookie.split("=")[0];
        if (!cookieNames.has(cookieName)) {
          updatedCookies.push(cookie);
        }
      }

      this.cookies = updatedCookies;
    }

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(
        `Nova API request failed: ${response.status} ${
          response.statusText
        } - ${responseText.substring(0, 100)}`
      );
    }

    const jsonResponse = await response.json();

    if (typeof jsonResponse === "object" && jsonResponse !== null) {
      return jsonResponse;
    }

    return {};
  }

  /**
   * Scrape users from Nova
   */
  async scrapeUsers(limit?: number, startPage?: number): Promise<NovaUser[]> {
    const startingPage = startPage && startPage > 0 ? startPage : 1;
    console.log(
      `Scraping users from Laravel Nova${limit ? ` (limit: ${limit})` : ""}${startPage ? ` starting from page ${startingPage}` : ""}...`
    );
    const users: NovaUser[] = [];
    let page = startingPage;
    let hasMorePages = true;

    while (hasMorePages && (!limit || users.length < limit)) {
      try {
        // Calculate how many to request for this page
        const remainingUsers = limit ? limit - users.length : 100;
        const perPage = Math.min(100, remainingUsers);

        const response = await this.novaApiRequest(
          `/users?page=${page}&perPage=${perPage}`
        );

        if (
          "resources" in response &&
          Array.isArray(response.resources) &&
          response.resources.length > 0
        ) {
          const usersToAdd = limit
            ? response.resources.slice(0, limit - users.length)
            : response.resources;
          users.push(...usersToAdd);
          console.log(`Scraped page ${page}, total users: ${users.length}`);
          page++;

          // Check if we've reached the limit or there are no more pages
          hasMorePages = Boolean(
            "next_page_url" in response &&
              response.next_page_url &&
              (!limit || users.length < limit)
          );
        } else {
          hasMorePages = false;
        }
      } catch (error) {
        console.error("Error scraping users page %s:", page, error);
        hasMorePages = false;
      }
    }

    console.log(`Completed scraping ${users.length} users`);
    return users;
  }

  /**
   * Scrape all shifts from Nova
   */
  async scrapeShifts(): Promise<NovaShift[]> {
    console.log("Scraping shifts from Laravel Nova...");
    const shifts: NovaShift[] = [];
    let page = 1;
    let hasMorePages = true;

    while (hasMorePages) {
      try {
        const response = await this.novaApiRequest(
          `/shifts?page=${page}&perPage=100`
        );

        if (
          "data" in response &&
          Array.isArray(response.data) &&
          response.data.length > 0
        ) {
          shifts.push(...response.data);
          console.log(`Scraped page ${page}, total shifts: ${shifts.length}`);
          page++;

          hasMorePages = Boolean(
            "links" in response &&
              response.links &&
              "next" in response.links &&
              response.links.next
          );
        } else {
          hasMorePages = false;
        }
      } catch (error) {
        console.error(`Error scraping shifts page ${page}:`, error);
        hasMorePages = false;
      }
    }

    console.log(`Completed scraping ${shifts.length} shifts`);
    return shifts;
  }

  /**
   * Scrape all shift signups (event-applications) from Nova
   */
  async scrapeShiftSignups(): Promise<NovaShiftSignup[]> {
    console.log(
      "Scraping shift signups (event-applications) from Laravel Nova..."
    );
    const signups: NovaShiftSignup[] = [];
    let page = 1;
    let hasMorePages = true;

    while (hasMorePages) {
      try {
        // Use the correct endpoint based on the URL example provided
        const response = await this.novaApiRequest(
          `/event-applications?page=${page}&perPage=100`
        );

        if (
          "data" in response &&
          Array.isArray(response.data) &&
          response.data.length > 0
        ) {
          signups.push(...response.data);
          console.log(`Scraped page ${page}, total signups: ${signups.length}`);
          page++;

          hasMorePages = Boolean(
            "links" in response &&
              response.links &&
              "next" in response.links &&
              response.links.next
          );
        } else {
          hasMorePages = false;
        }
      } catch (error) {
        console.error(`Error scraping signups page ${page}:`, error);
        hasMorePages = false;
      }
    }

    console.log(`Completed scraping ${signups.length} shift signups`);
    return signups;
  }

  /**
   * Scrape all events (shifts) from Nova
   */
  async scrapeEvents(): Promise<NovaEventResource[]> {
    console.log("Scraping events from Laravel Nova...");
    const events: NovaEventResource[] = [];
    let page = 1;
    let hasMorePages = true;

    while (hasMorePages) {
      try {
        const response = await this.novaApiRequest(
          `/events?page=${page}&perPage=100`
        );

        if (
          "data" in response &&
          Array.isArray(response.data) &&
          response.data.length > 0
        ) {
          events.push(...response.data);
          console.log(`Scraped page ${page}, total events: ${events.length}`);
          page++;

          hasMorePages = Boolean(
            "links" in response &&
              response.links &&
              "next" in response.links &&
              response.links.next
          );
        } else {
          hasMorePages = false;
        }
      } catch (error) {
        console.error(`Error scraping events page ${page}:`, error);
        hasMorePages = false;
      }
    }

    console.log(`Completed scraping ${events.length} events`);
    return events;
  }

  /**
   * Scrape all historical data from Laravel Nova
   */
  async scrapeAllData(): Promise<ScrapedData> {
    console.log("Starting comprehensive data scrape from Laravel Nova...");

    await this.authenticate();

    const [users, events, signups] = await Promise.all([
      this.scrapeUsers(),
      this.scrapeEvents(),
      this.scrapeShiftSignups(),
    ]);

    // Calculate date range from events - we'll need to parse the event names for dates
    // since the Nova API returns formatted event names like "Sunday 7th September WGTN"
    const scrapedData: ScrapedData = {
      users,
      events,
      signups,
      metadata: {
        scrapedAt: new Date().toISOString(),
        totalUsers: users.length,
        totalEvents: events.length,
        totalSignups: signups.length,
        dateRange: {
          earliest: new Date().toISOString(), // We'll need to parse event names to get actual dates
          latest: new Date().toISOString(),
        },
      },
    };

    console.log("Scraping completed:", scrapedData.metadata);
    return scrapedData;
  }

  /**
   * Test connection to Laravel Nova without full scrape
   */
  async testConnection(): Promise<boolean> {
    try {
      console.log(`[TEST] 🔌 Testing connection to: ${this.config.baseUrl}`);
      console.log(`[TEST] 👤 Using email: ${this.config.email}`);

      console.log(`[TEST] 🔐 Starting authentication process...`);
      await this.authenticate();
      console.log("[TEST] ✅ Authentication successful, testing API access...");

      // Try to fetch first page of users to test API access
      console.log(`[TEST] 📊 Testing API endpoint: /users?page=1&perPage=1`);
      const response = await this.novaApiRequest("/users?page=1&perPage=1");
      console.log("[TEST] ✅ API test successful:", !!response);
      console.log(`[TEST] 📋 Response structure:`, {
        hasResources: !!response.resources,
        resourcesLength: response.resources?.length || 0,
        hasNextPageUrl: !!response.next_page_url,
        hasPrevPageUrl: !!response.prev_page_url,
        perPage: response.per_page,
      });

      return response && typeof response === "object";
    } catch (error) {
      console.error("[TEST] ❌ Connection test failed:", error);
      if (error instanceof Error) {
        console.error("[TEST] 📋 Error details:", error.message);
        console.error("[TEST] 🔍 Stack trace:", error.stack);
      }
      return false;
    }
  }

  /**
   * Get current authentication cookies for external requests
   */
  getCookies(): string {
    return this.cookies.join("; ");
  }
}

/**
 * Utility function to create and test a Nova scraper instance
 */
export async function createNovaScraper(
  config: NovaAuthConfig
): Promise<LaravelNovaScraper> {
  const scraper = new LaravelNovaScraper(config);

  const isConnected = await scraper.testConnection();
  if (!isConnected) {
    throw new Error(
      "Failed to connect to Laravel Nova. Please check your configuration."
    );
  }

  console.log("Laravel Nova connection verified successfully");
  return scraper;
}

export type {
  NovaAuthConfig,
  NovaShift,
  NovaShiftSignup,
  NovaEvent,
  NovaUser,
  NovaUserResource,
  ScrapedData,
};
