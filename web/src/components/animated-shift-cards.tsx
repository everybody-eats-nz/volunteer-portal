"use client";

import { motion, AnimatePresence, Variants } from "motion/react";
import { useEffect, useRef, useState, createContext, useContext } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

// Enhanced stagger container with day-level transition handling
const enhancedStaggerContainer: Variants = {
  hidden: {
    transition: {
      staggerChildren: 0.02, // Faster exit stagger for group effect
      staggerDirection: -1,
    },
  },
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
  exit: {
    transition: {
      staggerChildren: 0.03, // Very quick group exit
      staggerDirection: 1, // Exit in forward order
    },
  },
};

// Enhanced stagger item with coordinated group exit animations
const createStaggerItemVariants = (index: number): Variants => ({
  hidden: {
    opacity: 0,
    y: 30,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: [0.4, 0, 0.2, 1],
    },
  },
  exit: {
    opacity: 0,
    x: index % 2 === 0 ? -80 : 80, // Shorter distance for coordinated group exit
    y: -10, // Slight upward movement for polish
    scale: 0.9,
    transition: {
      duration: 0.3, // Faster exit for group cohesion
      ease: [0.4, 0, 1, 1],
    },
  },
});
import { formatInNZT } from "@/lib/timezone";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Clock,
  Users,
  Mail,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Shield,
  Star,
  Award,
  Edit,
  Trash2,
  Info,
  UserX,
} from "lucide-react";
import { VolunteerActions } from "@/components/volunteer-actions";
import { getShiftTheme } from "@/lib/shift-themes";
import { isShiftCompleted } from "@/lib/shift-utils";
import { DeleteShiftDialog } from "@/components/delete-shift-dialog";
import { CustomLabelBadge } from "@/components/custom-label-badge";
import { AdminNotesDialog } from "@/components/admin-notes-dialog";

// Layout update context for triggering masonry recalculation
const LayoutUpdateContext = createContext<(() => void) | null>(null);

export const useLayoutUpdate = () => {
  const updateLayout = useContext(LayoutUpdateContext);
  return updateLayout || (() => {});
};

interface Shift {
  id: string;
  start: Date;
  end: Date;
  location: string | null;
  capacity: number;
  notes: string | null;
  shiftType: {
    id: string;
    name: string;
  };
  signups: Array<{
    id: string;
    status: string;
    user: {
      id: string;
      name: string | null;
      firstName: string | null;
      lastName: string | null;
      volunteerGrade: string | null;
      profilePhotoUrl: string | null;
      adminNotes: Array<{
        id: string;
        content: string;
        createdAt: Date;
        creator: {
          name: string | null;
          firstName: string | null;
          lastName: string | null;
        };
      }>;
      customLabels: Array<{
        label: {
          id: string;
          name: string;
          color: string;
          icon: string | null;
        };
      }>;
    };
  }>;
  groupBookings: Array<{
    signups: Array<{
      status: string;
    }>;
  }>;
}

interface AnimatedShiftCardsProps {
  shifts: Shift[];
}

function getStaffingStatus(confirmed: number, capacity: number) {
  const percentage = (confirmed / capacity) * 100;
  if (percentage >= 100)
    return { color: "bg-green-500", text: "Fully Staffed", icon: CheckCircle2 };
  if (percentage >= 75)
    return { color: "bg-green-400", text: "Well Staffed", icon: CheckCircle2 };
  if (percentage >= 50)
    return { color: "bg-yellow-500", text: "Needs More", icon: AlertCircle };
  if (percentage >= 25)
    return {
      color: "bg-orange-500",
      text: "Understaffed",
      icon: AlertTriangle,
    };
  return { color: "bg-red-500", text: "Critical", icon: AlertTriangle };
}

function getGradeInfo(grade: string | null | undefined) {
  switch (grade) {
    case "PINK":
      return {
        color: "bg-pink-100 text-pink-700",
        icon: Award,
        label: "Shift Leader",
      };
    case "YELLOW":
      return {
        color: "bg-yellow-100 text-yellow-700",
        icon: Star,
        label: "Experienced",
      };
    case "GREEN":
      return {
        color: "bg-green-100 text-green-700",
        icon: Shield,
        label: "Standard",
      };
    default:
      return { color: "bg-blue-100 text-blue-700", icon: null, label: "New" };
  }
}

// Masonry layout hook
function useMasonry(itemCount: number, columnCount: number, shifts: Shift[]) {
  const containerRef = useRef<HTMLDivElement>(null);
  const updateLayoutRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const updateLayout = () => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      const items = Array.from(container.children) as HTMLElement[];
      const gap = 24; // 6 * 4px (gap-6)

      // Reset heights for each column
      const columnHeights = new Array(columnCount).fill(0);

      items.forEach((item, index) => {
        if (index < columnCount) {
          // First row - just position at top
          item.style.position = "absolute";
          item.style.left = `${(index * 100) / columnCount}%`;
          item.style.top = "0px";
          item.style.width = `calc(${100 / columnCount}% - ${
            ((columnCount - 1) * gap) / columnCount
          }px)`;
          columnHeights[index] = item.offsetHeight + gap;
        } else {
          // Find shortest column
          const shortestColumn = columnHeights.indexOf(
            Math.min(...columnHeights)
          );

          item.style.position = "absolute";
          item.style.left = `${(shortestColumn * 100) / columnCount}%`;
          item.style.top = `${columnHeights[shortestColumn]}px`;
          item.style.width = `calc(${100 / columnCount}% - ${
            ((columnCount - 1) * gap) / columnCount
          }px)`;

          columnHeights[shortestColumn] += item.offsetHeight + gap;
        }
      });

      // Set container height to the tallest column
      const maxHeight = Math.max(...columnHeights);
      container.style.height = `${maxHeight}px`;
    };

    updateLayoutRef.current = updateLayout;

    // Update layout on mount and resize
    updateLayout();

    const observer = new ResizeObserver(updateLayout);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    window.addEventListener("resize", updateLayout);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateLayout);
    };
  }, [itemCount, columnCount]);

  // Update layout when shifts data changes (signups added/removed)
  useEffect(() => {
    // Use a timeout to allow DOM updates to complete first
    const timeoutId = setTimeout(() => {
      if (updateLayoutRef.current) {
        updateLayoutRef.current();
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [shifts]);

  // Expose updateLayout function for manual triggers
  const triggerLayoutUpdate = () => {
    if (updateLayoutRef.current) {
      setTimeout(updateLayoutRef.current, 50);
    }
  };

  return { containerRef, triggerLayoutUpdate };
}

export function AnimatedShiftCards({ shifts }: AnimatedShiftCardsProps) {
  // Determine column count based on screen size (we'll use a simple approach)
  const [columnCount, setColumnCount] = useState(1);

  useEffect(() => {
    const updateColumnCount = () => {
      if (window.innerWidth >= 1280) setColumnCount(3); // xl
      else if (window.innerWidth >= 768) setColumnCount(2); // md
      else setColumnCount(1);
    };

    updateColumnCount();
    window.addEventListener("resize", updateColumnCount);
    return () => window.removeEventListener("resize", updateColumnCount);
  }, []);

  const { containerRef, triggerLayoutUpdate } = useMasonry(
    shifts.length,
    columnCount,
    shifts
  );

  return (
    <LayoutUpdateContext.Provider value={triggerLayoutUpdate}>
      <motion.div
        ref={containerRef}
        className="relative"
        style={{ minHeight: "200px" }}
        initial="hidden"
        animate="visible"
        exit="exit"
        variants={enhancedStaggerContainer}
      >
        <AnimatePresence mode="popLayout">
          {shifts.map((shift, index) => {
            const confirmed = shift.signups.filter(
              (s) => s.status === "CONFIRMED"
            ).length;
            const pending = shift.signups.filter(
              (s) => s.status === "PENDING" || s.status === "REGULAR_PENDING"
            ).length;
            const waitlisted = shift.signups.filter(
              (s) => s.status === "WAITLISTED"
            ).length;
            const noShow = shift.signups.filter(
              (s) => s.status === "NO_SHOW"
            ).length;
            const isCompleted = isShiftCompleted(shift.end);
            const staffingStatus = isCompleted 
              ? { color: "bg-gray-500", text: "Completed", icon: CheckCircle2 }
              : getStaffingStatus(confirmed, shift.capacity);

            // Count volunteer grades
            const gradeCount = {
              pink: shift.signups.filter(
                (s) => s.user.volunteerGrade === "PINK"
              ).length,
              yellow: shift.signups.filter(
                (s) => s.user.volunteerGrade === "YELLOW"
              ).length,
              green: shift.signups.filter(
                (s) => s.user.volunteerGrade === "GREEN"
              ).length,
              new: shift.signups.filter((s) => !s.user.volunteerGrade).length,
            };

            const shiftTheme = getShiftTheme(shift.shiftType.name);

            return (
              <motion.div
                key={shift.id}
                layout
                initial="hidden"
                animate="visible"
                exit="exit"
                variants={createStaggerItemVariants(index)}
                className="w-full"
              >
                <Card
                  data-testid={`shift-card-${shift.id}`}
                  className={`border-2 ${shiftTheme.borderColor} w-full relative overflow-hidden shadow-md`}
                >
                  {/* Background gradient */}
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${shiftTheme.gradient} opacity-5`}
                  />

                  <CardContent className="relative z-10">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl">{shiftTheme.emoji}</span>
                          <h3
                            className={`font-bold text-lg ${shiftTheme.textColor} mb-0`}
                          >
                            {shift.shiftType.name}
                          </h3>
                        </div>
                        <p className="text-sm text-slate-700 dark:text-slate-300 font-medium flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {formatInNZT(shift.start, "h:mm a")} -{" "}
                          {formatInNZT(shift.end, "h:mm a")}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge
                          data-testid={`shift-capacity-${shift.id}`}
                          className={`${staffingStatus.color} text-white text-sm px-2 py-1.5 font-bold`}
                        >
                          {confirmed}/{shift.capacity}
                        </Badge>
                        {!isCompleted && (
                          <p className="text-xs text-slate-600 mt-1">
                            {staffingStatus.text}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Grade Summary Bar */}
                    {shift.signups.length > 0 && (
                      <div
                        data-testid={`grade-summary-${shift.id}`}
                        className="flex flex-wrap gap-1 mb-3"
                      >
                        {gradeCount.pink > 0 && (
                          <div
                            data-testid={`grade-pink-badge-${shift.id}`}
                            className="flex items-center gap-1 px-2 py-1 bg-pink-100 text-pink-700 rounded text-xs font-medium"
                          >
                            <Award className="h-3 w-3" />
                            {gradeCount.pink}
                          </div>
                        )}
                        {gradeCount.yellow > 0 && (
                          <div
                            data-testid={`grade-yellow-badge-${shift.id}`}
                            className="flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium"
                          >
                            <Star className="h-3 w-3" />
                            {gradeCount.yellow}
                          </div>
                        )}
                        {gradeCount.green > 0 && (
                          <div
                            data-testid={`grade-green-badge-${shift.id}`}
                            className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium"
                          >
                            <Shield className="h-3 w-3" />
                            {gradeCount.green}
                          </div>
                        )}
                        {gradeCount.new > 0 && (
                          <div
                            data-testid={`grade-new-badge-${shift.id}`}
                            className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium"
                          >
                            <Users className="h-3 w-3" />
                            {gradeCount.new} new
                          </div>
                        )}
                        {pending > 0 && (
                          <div
                            data-testid={`pending-badge-${shift.id}`}
                            className="flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-medium ml-auto"
                          >
                            <Clock className="h-3 w-3" />
                            {pending} pending
                          </div>
                        )}
                        {waitlisted > 0 && (
                          <div
                            data-testid={`waitlisted-badge-${shift.id}`}
                            className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium"
                          >
                            <Users className="h-3 w-3" />
                            {waitlisted} waitlisted
                          </div>
                        )}
                        {noShow > 0 && (
                          <div
                            data-testid={`no-show-badge-${shift.id}`}
                            className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium"
                          >
                            <UserX className="h-3 w-3" />
                            {noShow} no show
                          </div>
                        )}
                      </div>
                    )}

                    {/* Volunteer Avatars */}
                    <div
                      data-testid={`volunteer-list-${shift.id}`}
                      className="space-y-2"
                    >
                      {shift.signups.length === 0 ? (
                        <div
                          data-testid={`no-volunteers-${shift.id}`}
                          className="py-6 text-center"
                        >
                          <Users className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                          <p className="text-sm text-slate-500">
                            No volunteers yet
                          </p>
                        </div>
                      ) : (
                        <div
                          data-testid={`volunteers-${shift.id}`}
                          className="space-y-2"
                        >
                          {shift.signups.map((signup) => {
                            const gradeInfo = getGradeInfo(
                              signup.user.volunteerGrade
                            );
                            const GradeIcon = gradeInfo.icon;
                            return (
                              <div
                                key={signup.id}
                                className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg min-w-0"
                              >
                                <Link
                                  href={`/admin/volunteers/${signup.user.id}`}
                                  className="flex-shrink-0"
                                  data-testid={`volunteer-avatar-link-${signup.id}`}
                                >
                                  <Avatar
                                    className="h-9 w-9 border-2 border-white shadow-md hover:shadow-lg transition-shadow"
                                    data-testid={`volunteer-avatar-${signup.id}`}
                                  >
                                    <AvatarImage
                                      src={
                                        signup.user.profilePhotoUrl || undefined
                                      }
                                      alt={
                                        signup.user.name ||
                                        `${signup.user.firstName} ${signup.user.lastName}` ||
                                        "Volunteer"
                                      }
                                      data-testid={`volunteer-avatar-image-${signup.id}`}
                                    />
                                    <AvatarFallback
                                      className="bg-gradient-to-br from-blue-400 to-blue-600 text-white font-bold text-xs"
                                      data-testid={`volunteer-avatar-fallback-${signup.id}`}
                                    >
                                      {(signup.user.name ||
                                        signup.user
                                          .firstName)?.[0]?.toUpperCase() ||
                                        "V"}
                                    </AvatarFallback>
                                  </Avatar>
                                </Link>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1 mb-1">
                                    <Link
                                      href={`/admin/volunteers/${signup.user.id}`}
                                      className="text-sm font-medium text-slate-900 truncate hover:text-blue-600"
                                      data-testid={`volunteer-name-link-${signup.id}`}
                                    >
                                      {signup.user.name ||
                                        `${signup.user.firstName || ""} ${
                                          signup.user.lastName || ""
                                        }`.trim() ||
                                        "Volunteer"}
                                    </Link>
                                    {signup.user.adminNotes.length > 0 && (
                                      <AdminNotesDialog
                                        volunteerId={signup.user.id}
                                        volunteerName={
                                          signup.user.name ||
                                          `${signup.user.firstName || ""} ${
                                            signup.user.lastName || ""
                                          }`.trim() ||
                                          "Volunteer"
                                        }
                                        trigger={
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-5 px-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                            data-testid={`admin-notes-button-${signup.id}`}
                                          >
                                            <Info className="h-3.5 w-3.5 mr-0.5" />
                                            <span className="text-xs">
                                              {signup.user.adminNotes.length > 1
                                                ? `${signup.user.adminNotes.length} notes`
                                                : "Note"}
                                            </span>
                                          </Button>
                                        }
                                      />
                                    )}
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1 flex-wrap">
                                      <div
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${gradeInfo.color} flex-shrink-0`}
                                        data-testid={`volunteer-grade-${signup.id}`}
                                      >
                                        {GradeIcon && (
                                          <GradeIcon className="h-3 w-3" />
                                        )}
                                        {gradeInfo.label}
                                      </div>
                                      {signup.user.customLabels.map(
                                        (userLabel) => (
                                          <CustomLabelBadge
                                            key={userLabel.label.id}
                                            label={{
                                              ...userLabel.label,
                                              isActive: true,
                                              createdAt: new Date(),
                                              updatedAt: new Date(),
                                            }}
                                            size="sm"
                                            className="flex-shrink-0"
                                            data-testid={`volunteer-label-${signup.id}-${userLabel.label.id}`}
                                          />
                                        )
                                      )}
                                    </div>
                                    <div className="flex-shrink-0">
                                      <VolunteerActions
                                        signupId={signup.id}
                                        currentStatus={signup.status}
                                        onUpdate={triggerLayoutUpdate}
                                        testIdPrefix={`shift-${shift.id}-volunteer-${signup.id}`}
                                        currentShift={{
                                          id: shift.id,
                                          start: shift.start,
                                          end: shift.end,
                                          location: shift.location,
                                          shiftType: {
                                            name: shift.shiftType.name,
                                          },
                                        }}
                                        volunteerName={
                                          signup.user.name ||
                                          `${signup.user.firstName} ${signup.user.lastName}`
                                        }
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Shortage Action Button */}
                    {!isCompleted && (staffingStatus.text === "Critical" ||
                      staffingStatus.text === "Understaffed") && (
                      <div className="mt-4 pt-4 border-t border-slate-100">
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="w-full border-orange-200 text-orange-600 hover:bg-orange-50"
                          data-testid={`send-shortage-email-${shift.id}`}
                        >
                          <Link
                            href={`/admin/notifications?shiftId=${shift.id}&shiftType=${shift.shiftType.id}&location=${shift.location}`}
                            className="flex items-center gap-2 justify-center"
                          >
                            <Mail className="h-4 w-4" />
                            Send Shortage Email
                          </Link>
                        </Button>
                      </div>
                    )}

                    {/* Admin Action Buttons */}
                    {!isCompleted && (
                    <div className="mt-4 pt-4 border-t border-slate-100 flex gap-2">
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="flex-1 text-blue-600 hover:bg-blue-50 border-blue-200"
                        data-testid={`edit-shift-button-${shift.id}`}
                      >
                        <Link
                          href={`/admin/shifts/${shift.id}/edit`}
                          className="flex items-center gap-2 justify-center"
                        >
                          <Edit className="h-4 w-4" />
                          Edit
                        </Link>
                      </Button>

                      <DeleteShiftDialog
                        shiftId={shift.id}
                        shiftName={shift.shiftType.name}
                        shiftDate={formatInNZT(
                          shift.start,
                          "EEEE, MMMM d, yyyy"
                        )}
                        hasSignups={shift.signups.length > 0}
                        signupCount={
                          shift.signups.filter(
                            (signup) =>
                              signup.status !== "CANCELED" &&
                              signup.status !== "NO_SHOW"
                          ).length
                        }
                        onDelete={async () => {
                          const response = await fetch(
                            `/api/admin/shifts/${shift.id}`,
                            {
                              method: "DELETE",
                            }
                          );

                          if (!response.ok) {
                            throw new Error("Failed to delete shift");
                          }

                          // Refresh the page to show the updated list
                          window.location.href = "/admin/shifts?deleted=1";
                        }}
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-red-600 hover:bg-red-50 border-red-200"
                          data-testid={`delete-shift-button-${shift.id}`}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </DeleteShiftDialog>
                    </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>
    </LayoutUpdateContext.Provider>
  );
}
