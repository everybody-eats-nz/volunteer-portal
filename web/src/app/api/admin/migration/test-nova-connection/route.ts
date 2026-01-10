import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { createNovaScraper, NovaAuthConfig } from "@/lib/laravel-nova-scraper";
import { validateNovaBaseUrl } from "@/lib/nova-validation";

interface TestConnectionRequest {
  novaConfig: {
    baseUrl: string;
    email: string;
    password: string;
  };
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
