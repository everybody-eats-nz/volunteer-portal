"use client";

import { motion } from "motion/react";
import { slideUpVariants } from "@/lib/motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  MapPin,
  Clock,
  Sparkles,
  ClipboardCheck,
  Users,
  Trophy,
} from "lucide-react";

// Unified activity item — discriminated union on `type`
interface SignupActivity {
  type: "signup";
  id: string;
  timestamp: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  userPhoto: string | null;
  shiftId: string;
  shiftTypeName: string;
  shiftDate: string;
  shiftTime: string;
  shiftDateParam: string;
  shiftLocation: string | null;
  status: string;
  isFirstSignup: boolean;
}

interface SurveyActivity {
  type: "survey";
  id: string;
  timestamp: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  userPhoto: string | null;
  surveyTitle: string;
  surveyId: string;
}

interface FriendshipActivity {
  type: "friendship";
  id: string;
  timestamp: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  userPhoto: string | null;
  friendName: string | null;
  friendId: string;
}

interface AchievementActivity {
  type: "achievement";
  id: string;
  timestamp: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  userPhoto: string | null;
  achievementName: string;
  achievementIcon: string;
}

export type ActivityItem =
  | SignupActivity
  | SurveyActivity
  | FriendshipActivity
  | AchievementActivity;

function getInitials(name: string | null, email: string): string {
  if (name) {
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }
  return email[0]?.toUpperCase() ?? "?";
}

interface AdminDashboardRecentActivityProps {
  items: ActivityItem[];
}

const statusVariant: Record<
  string,
  "default" | "outline" | "secondary" | "destructive"
> = {
  CONFIRMED: "default",
  PENDING: "outline",
  WAITLISTED: "secondary",
  CANCELED: "destructive",
  NO_SHOW: "destructive",
};

function ActivityRow({ item }: { item: ActivityItem }) {
  const displayName = item.userName ?? item.userEmail;

  return (
    <div className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <Avatar className="h-8 w-8 mt-0.5">
        {item.userPhoto && (
          <AvatarImage src={item.userPhoto} alt={item.userName ?? ""} />
        )}
        <AvatarFallback className="text-xs">
          {getInitials(item.userName, item.userEmail)}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {item.type === "signup" && (
            <SignupContent item={item} displayName={displayName} />
          )}
          {item.type === "survey" && (
            <SurveyContent item={item} displayName={displayName} />
          )}
          {item.type === "friendship" && (
            <FriendshipContent item={item} displayName={displayName} />
          )}
          {item.type === "achievement" && (
            <AchievementContent item={item} displayName={displayName} />
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0 pt-0.5">
          {item.type === "signup" && (
            <Badge variant={statusVariant[item.status] || "outline"}>
              {item.status.toLowerCase()}
            </Badge>
          )}
          {item.type === "survey" && (
            <Badge variant="secondary">
              <ClipboardCheck className="h-3 w-3 mr-1" />
              survey
            </Badge>
          )}
          {item.type === "friendship" && (
            <Badge variant="secondary">
              <Users className="h-3 w-3 mr-1" />
              friends
            </Badge>
          )}
          {item.type === "achievement" && (
            <Badge variant="success">
              <Trophy className="h-3 w-3 mr-1" />
              unlocked
            </Badge>
          )}
          <span className="text-xs text-muted-foreground hidden sm:inline min-w-[70px] text-right">
            {formatDistanceToNow(new Date(item.timestamp), {
              addSuffix: true,
            })}
          </span>
        </div>
      </div>
    </div>
  );
}

function SignupContent({
  item,
  displayName,
}: {
  item: SignupActivity;
  displayName: string;
}) {
  return (
    <>
      <div className="flex items-center gap-2">
        <span className="font-medium text-sm truncate">
          <Link
            href={`/admin/volunteers/${item.userId}`}
            className="hover:underline"
          >
            {displayName}
          </Link>
        </span>
        {item.isFirstSignup && (
          <Badge
            variant="success"
            className="text-[10px] px-1.5 py-0 gap-0.5"
          >
            <Sparkles className="h-2.5 w-2.5" />
            new
          </Badge>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-1">
        <Link
          href={`/admin/shifts?date=${item.shiftDateParam}${item.shiftLocation ? `&location=${encodeURIComponent(item.shiftLocation)}` : ""}&shiftId=${item.shiftId}`}
          className="font-medium text-foreground/70 hover:underline"
        >
          {item.shiftTypeName}
        </Link>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {item.shiftDate}, {item.shiftTime}
        </span>
        {item.shiftLocation && (
          <span className="flex items-center gap-1 hidden md:flex">
            <MapPin className="h-3 w-3" />
            {item.shiftLocation}
          </span>
        )}
      </div>
    </>
  );
}

function SurveyContent({
  item,
  displayName,
}: {
  item: SurveyActivity;
  displayName: string;
}) {
  return (
    <>
      <div className="font-medium text-sm truncate">
        <Link
          href={`/admin/volunteers/${item.userId}`}
          className="hover:underline"
        >
          {displayName}
        </Link>
      </div>
      <div className="text-xs text-muted-foreground mt-1">
        Completed{" "}
        <Link
          href={`/admin/surveys/${item.surveyId}/responses`}
          className="font-medium text-foreground/70 hover:underline"
        >
          {item.surveyTitle}
        </Link>
      </div>
    </>
  );
}

function FriendshipContent({
  item,
  displayName,
}: {
  item: FriendshipActivity;
  displayName: string;
}) {
  return (
    <>
      <div className="font-medium text-sm truncate">
        <Link
          href={`/admin/volunteers/${item.userId}`}
          className="hover:underline"
        >
          {displayName}
        </Link>
      </div>
      <div className="text-xs text-muted-foreground mt-1">
        Became friends with{" "}
        <Link
          href={`/admin/volunteers/${item.friendId}`}
          className="font-medium text-foreground/70 hover:underline"
        >
          {item.friendName ?? "someone"}
        </Link>
      </div>
    </>
  );
}

function AchievementContent({
  item,
  displayName,
}: {
  item: AchievementActivity;
  displayName: string;
}) {
  return (
    <>
      <div className="font-medium text-sm truncate">
        <Link
          href={`/admin/volunteers/${item.userId}`}
          className="hover:underline"
        >
          {displayName}
        </Link>
      </div>
      <div className="text-xs text-muted-foreground mt-1">
        Unlocked{" "}
        <span className="font-medium text-foreground/70">
          {item.achievementIcon} {item.achievementName}
        </span>
      </div>
    </>
  );
}

export function AdminDashboardRecentActivity({
  items,
}: AdminDashboardRecentActivityProps) {
  return (
    <motion.div variants={slideUpVariants} initial="hidden" animate="visible">
      <Card>
        <CardHeader>
          <CardTitle data-testid="recent-signups-heading">
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {items.length > 0 ? (
            <div className="divide-y divide-border">
              {items.map((item) => (
                <ActivityRow key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <p
              className="text-muted-foreground text-sm"
              data-testid="no-recent-signups"
            >
              No recent activity
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
