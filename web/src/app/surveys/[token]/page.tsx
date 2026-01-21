import { validateSurveyToken } from "@/lib/survey-tokens";
import { SurveyForm } from "@/components/survey-form";
import type { SurveyQuestion } from "@/types/survey";
import { AlertCircle, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ token: string }>;
}

export const metadata: Metadata = {
  title: "Survey",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function SurveyPage({ params }: PageProps) {
  const { token } = await params;

  // Validate token server-side
  const result = await validateSurveyToken(token);

  if (!result.valid || !result.assignment) {
    // Show appropriate error message
    const isExpired = result.message.includes("expired");
    const isCompleted = result.message.includes("already been completed");

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              {isExpired ? (
                <>
                  <Clock className="h-16 w-16 text-orange-500 mx-auto mb-4" />
                  <h2 className="text-2xl font-semibold mb-2">Survey Expired</h2>
                  <p className="text-muted-foreground mb-6">
                    This survey link has expired. Please contact us if you still
                    wish to provide feedback.
                  </p>
                </>
              ) : isCompleted ? (
                <>
                  <AlertCircle className="h-16 w-16 text-blue-500 mx-auto mb-4" />
                  <h2 className="text-2xl font-semibold mb-2">
                    Already Completed
                  </h2>
                  <p className="text-muted-foreground mb-6">
                    You&apos;ve already completed this survey. Thank you for your
                    feedback!
                  </p>
                </>
              ) : (
                <>
                  <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                  <h2 className="text-2xl font-semibold mb-2">Invalid Link</h2>
                  <p className="text-muted-foreground mb-6">
                    This survey link is invalid or no longer available.
                  </p>
                </>
              )}
              <Button asChild>
                <Link href="/dashboard">Go to Dashboard</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { survey, user } = result.assignment;
  const questions = survey.questions as SurveyQuestion[];

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <SurveyForm
          token={token}
          title={survey.title}
          description={survey.description}
          questions={questions}
          userName={user.name}
        />
      </div>
    </div>
  );
}
