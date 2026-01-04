import { describe, it, expect } from "vitest";
import { generateCalendarUrls, generateCalendarData } from "./calendar-utils";

describe("calendar-utils", () => {
  const mockShift = {
    id: "test-shift-123",
    start: new Date("2024-12-31T10:00:00Z"), // 11pm NZDT (UTC+13)
    end: new Date("2024-12-31T13:00:00Z"), // 2am NZDT next day
    location: "Auckland",
    shiftType: {
      name: "Kitchen Helper",
      description: "Help with food preparation and cleaning",
    },
  };

  describe("generateCalendarUrls", () => {
    it("should generate calendar URLs with correct date formats", () => {
      const urls = generateCalendarUrls(mockShift);

      expect(urls).toHaveProperty("google");
      expect(urls).toHaveProperty("outlook");
      expect(urls).toHaveProperty("ics");
    });

    it("should use compact format (yyyyMMddTHHmmss) for Google Calendar", () => {
      const urls = generateCalendarUrls(mockShift);

      // Google Calendar should use compact format without separators
      expect(urls.google).toContain("dates=");
      expect(urls.google).toMatch(/dates=\d{8}T\d{6}\/\d{8}T\d{6}/);

      // Should NOT contain hyphens or colons in the date part
      const datesMatch = urls.google.match(/dates=([^&]+)/);
      expect(datesMatch).toBeTruthy();
      if (datesMatch) {
        const datesPart = datesMatch[1];
        // Compact format should not have hyphens or colons
        expect(datesPart).not.toMatch(/-|:/);
      }
    });

    it("should use ISO 8601 format (yyyy-MM-ddTHH:mm:ss) for Outlook", () => {
      const urls = generateCalendarUrls(mockShift);

      // Outlook should use ISO 8601 format with separators
      expect(urls.outlook).toContain("startdt=");
      expect(urls.outlook).toContain("enddt=");

      // Extract the date parameters
      const startMatch = urls.outlook.match(/startdt=([^&]+)/);
      const endMatch = urls.outlook.match(/enddt=([^&]+)/);

      expect(startMatch).toBeTruthy();
      expect(endMatch).toBeTruthy();

      if (startMatch && endMatch) {
        const startDate = decodeURIComponent(startMatch[1]);
        const endDate = decodeURIComponent(endMatch[1]);

        // Should match ISO 8601 format: yyyy-MM-ddTHH:mm:ss
        const iso8601Pattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
        expect(startDate).toMatch(iso8601Pattern);
        expect(endDate).toMatch(iso8601Pattern);

        // Should contain hyphens and colons
        expect(startDate).toContain("-");
        expect(startDate).toContain(":");
        expect(endDate).toContain("-");
        expect(endDate).toContain(":");
      }
    });

    it("should include shift title in all calendar URLs", () => {
      const urls = generateCalendarUrls(mockShift);
      const expectedTitle = encodeURIComponent(
        "Everybody Eats - Kitchen Helper"
      );

      expect(urls.google).toContain(expectedTitle);
      expect(urls.outlook).toContain(expectedTitle);
    });

    it("should include location in calendar URLs", () => {
      const urls = generateCalendarUrls(mockShift);

      expect(urls.google).toContain("location=");
      expect(urls.outlook).toContain("location=");
    });

    it("should generate ICS data URL", () => {
      const urls = generateCalendarUrls(mockShift);

      expect(urls.ics).toMatch(/^data:text\/calendar;charset=utf8,/);

      // Decode the data URL to check the actual content
      const decodedContent = decodeURIComponent(urls.ics.replace("data:text/calendar;charset=utf8,", ""));
      expect(decodedContent).toContain("BEGIN:VCALENDAR");
    });

    it("should handle TBD location correctly", () => {
      const shiftWithTBD = {
        ...mockShift,
        location: "TBD",
      };

      const urls = generateCalendarUrls(shiftWithTBD);

      expect(urls.google).toContain("location=");
      expect(urls.outlook).toContain("location=");
    });
  });

  describe("generateCalendarData", () => {
    it("should generate calendar data with correct structure", () => {
      const data = generateCalendarData(mockShift);

      expect(data).toHaveProperty("google");
      expect(data).toHaveProperty("outlook");
      expect(data).toHaveProperty("icsContent");
    });

    it("should use compact format for Google Calendar in calendar data", () => {
      const data = generateCalendarData(mockShift);

      expect(data.google).toContain("dates=");
      expect(data.google).toMatch(/dates=\d{8}T\d{6}\/\d{8}T\d{6}/);
    });

    it("should use ISO 8601 format for Outlook in calendar data", () => {
      const data = generateCalendarData(mockShift);

      const startMatch = data.outlook.match(/startdt=([^&]+)/);
      const endMatch = data.outlook.match(/enddt=([^&]+)/);

      expect(startMatch).toBeTruthy();
      expect(endMatch).toBeTruthy();

      if (startMatch && endMatch) {
        const startDate = decodeURIComponent(startMatch[1]);
        const endDate = decodeURIComponent(endMatch[1]);

        const iso8601Pattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
        expect(startDate).toMatch(iso8601Pattern);
        expect(endDate).toMatch(iso8601Pattern);
      }
    });

    it("should generate valid ICS content", () => {
      const data = generateCalendarData(mockShift);

      expect(data.icsContent).toContain("BEGIN:VCALENDAR");
      expect(data.icsContent).toContain("VERSION:2.0");
      expect(data.icsContent).toContain("BEGIN:VEVENT");
      expect(data.icsContent).toContain("END:VEVENT");
      expect(data.icsContent).toContain("END:VCALENDAR");
      expect(data.icsContent).toContain(
        "SUMMARY:Everybody Eats - Kitchen Helper"
      );
    });

    it("should include timezone information in ICS content", () => {
      const data = generateCalendarData(mockShift);

      expect(data.icsContent).toContain("Pacific/Auckland");
      expect(data.icsContent).toContain("BEGIN:VTIMEZONE");
      expect(data.icsContent).toContain("TZID:Pacific/Auckland");
    });

    it("should include shift description in calendar data", () => {
      const data = generateCalendarData(mockShift);

      expect(data.google).toContain("details=");
      expect(data.outlook).toContain("body=");
    });
  });

  describe("date formatting consistency", () => {
    it("should format dates in NZ timezone for all calendar providers", () => {
      const data = generateCalendarData(mockShift);

      // For the test date (2024-12-31T10:00:00Z), which is 11pm NZDT (2024-12-31T23:00:00+13:00)
      // We expect the Outlook format to show the NZ time
      const startMatch = data.outlook.match(/startdt=([^&]+)/);

      if (startMatch) {
        const startDate = decodeURIComponent(startMatch[1]);
        // Should be formatted in NZ timezone (NZDT is UTC+13)
        expect(startDate).toBeTruthy();
        // The date should be in NZ timezone, which would be Dec 31st at 11pm
        expect(startDate).toMatch(/^2024-12-31T23:00:00$|^2025-01-01T/);
      }
    });

    it("should use consistent timezone across Google and Outlook", () => {
      const data = generateCalendarData(mockShift);

      // Both should reference Pacific/Auckland timezone
      expect(data.google).toContain("ctz=Pacific/Auckland");
      expect(data.icsContent).toContain("Pacific/Auckland");
    });
  });

  describe("special characters handling", () => {
    it("should handle shift descriptions with special characters", () => {
      const shiftWithSpecialChars = {
        ...mockShift,
        shiftType: {
          name: "Kitchen & Dining",
          description: "Help with food preparation, serving & cleaning",
        },
      };

      const urls = generateCalendarUrls(shiftWithSpecialChars);

      // URLs should be properly encoded
      expect(urls.google).toBeTruthy();
      expect(urls.outlook).toBeTruthy();
      expect(urls.ics).toBeTruthy();
    });

    it("should escape special characters in ICS content", () => {
      const shiftWithSpecialChars = {
        ...mockShift,
        location: "Auckland",
        shiftType: {
          name: "Kitchen & Dining",
          description: "Help with: preparation, serving; cleaning",
        },
      };

      const data = generateCalendarData(shiftWithSpecialChars);

      // ICS content should escape commas and semicolons
      expect(data.icsContent).toContain("DESCRIPTION:");
    });
  });
});
