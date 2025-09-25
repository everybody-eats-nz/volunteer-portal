"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserX, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

interface FriendsErrorFallbackProps {
  error?: Error;
  retry: () => void;
}

export function FriendsErrorFallback({ error, retry }: FriendsErrorFallbackProps) {
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-center">
          <UserX className="h-5 w-5 text-muted-foreground" />
          Friends Unavailable
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-center">
        <p className="text-muted-foreground">
          We&apos;re having trouble loading your friends list right now. This could be a temporary network issue.
        </p>
        
        <div className="flex flex-col gap-2">
          <Button onClick={retry} variant="default" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard" className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </div>
        
        {process.env.NODE_ENV === "development" && error && (
          <details className="text-xs bg-muted p-3 rounded-md text-left">
            <summary className="cursor-pointer font-medium mb-2">
              Technical Details
            </summary>
            <pre className="whitespace-pre-wrap text-destructive">
              {error.message}
            </pre>
          </details>
        )}
      </CardContent>
    </Card>
  );
}