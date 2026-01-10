import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { createNovaScraper, NovaAuthConfig } from "@/lib/laravel-nova-scraper";

interface TestConnectionRequest {
  novaConfig: {
    baseUrl: string;
    email: string;
    password: string;
  };
}

// Basic validation to prevent SSRF via novaConfig.baseUrl
function validateNovaBaseUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "Nova baseUrl must use http or https protocol";
    }

    const hostname = url.hostname.toLowerCase();

    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1"
    ) {
      return "Nova baseUrl must not point to a localhost address";
    }

    if (
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("172.16.") ||
      hostname.startsWith("172.17.") ||
      hostname.startsWith("172.18.") ||
      hostname.startsWith("172.19.") ||
      hostname.startsWith("172.20.") ||
      hostname.startsWith("172.21.") ||
      hostname.startsWith("172.22.") ||
      hostname.startsWith("172.23.") ||
      hostname.startsWith("172.24.") ||
      hostname.startsWith("172.25.") ||
      hostname.startsWith("172.26.") ||
      hostname.startsWith("172.27.") ||
      hostname.startsWith("172.28.") ||
      hostname.startsWith("172.29.") ||
      hostname.startsWith("172.30.") ||
      hostname.startsWith("172.31.")
    ) {
      return "Nova baseUrl must not point to a private network address";
    }

    return null;
  } catch {
    return "Nova baseUrl is not a valid URL";
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication and admin role
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body: TestConnectionRequest = await request.json();
    const { novaConfig } = body;

    if (!novaConfig.baseUrl || !novaConfig.email || !novaConfig.password) {
      return NextResponse.json(
        { error: "Missing required Nova configuration fields" },
        { status: 400 }
      );
    }

    const baseUrlError = validateNovaBaseUrl(novaConfig.baseUrl);
    if (baseUrlError) {
      return NextResponse.json({ error: baseUrlError }, { status: 400 });
    }

    try {
      // Test Nova connection
      await createNovaScraper({
        baseUrl: novaConfig.baseUrl,
        email: novaConfig.email,
        password: novaConfig.password,
      } as NovaAuthConfig);

      return NextResponse.json({
        success: true,
        message: "Successfully connected to Laravel Nova",
      });
    } catch (error) {
      console.error("Nova connection test failed:", error);
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Connection failed",
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Request processing error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
