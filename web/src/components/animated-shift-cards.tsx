"use client";

import { motion, AnimatePresence, Variants } from "motion/react";
import { useEffect, useRef, useState, createContext, useContext } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getDisplayGradeInfo } from "@/lib/volunteer-grades";
import type { VolunteerGrade } from "@/generated/client";

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
const createStaggerItemVariants = (): Variants => ({
  hidden: {
    opacity: 0,
    y: 30,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.4, 0, 0.2, 1],
    },
  },
  exit: {
    opacity: 0,
    y: -10, // Only y-axis movement
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
  X,
  UserPlus,
} from "lucide-react";
import { VolunteerActions } from "@/components/volunteer-actions";
import { getShiftTheme } from "@/lib/shift-themes";
import { isShiftCompleted } from "@/lib/shift-utils";
import { DeleteShiftDialog } from "@/components/delete-shift-dialog";
import { CustomLabelBadge } from "@/components/custom-label-badge";
import { AdminNotesDialog } from "@/components/admin-notes-dialog";
import { calculateAge } from "@/lib/utils";
import { AssignVolunteerDialog } from "@/components/assign-volunteer-dialog";
import { PlaceholderCountControl } from "@/components/placeholder-count-control";
import { getEffectiveConfirmedCount } from "@/lib/placeholder-utils";


// Layout update context for triggering masonry recalculation
const LayoutUpdateContext = createContext<(() => void) | null>(null);

export const useLayoutUpdate = () => {
  const updateLayout = useContext(LayoutUpdateContext);
  return updateLayout || (() => { });
};

interface Shift {
  id: string;
  start: Date;
  end: Date;
  location: string | null;
  capacity: number;
  notes: string | null;
  placeholderCount: number;
  shiftType: {
    id: string;
    name: string;
  };
  signups: Array<{
    id: string;
    status: string;
    note: string | null;
    backupForShiftIds: string[];
    user: {
      id: string;
      name: string | null;
      firstName: string | null;
      lastName: string | null;
      volunteerGrade: string | null;
      profilePhotoUrl: string | null;
      dateOfBirth: Date | null;
      signups?: Array<{
        shift: {
          end: Date;
        };
      }>;
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
  shiftIdToTypeName: Map<string, string>;
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

function getGradeInfo(grade: string | null | undefined, completedShifts: number) {
  // Use the shared display logic
  const displayInfo = getDisplayGradeInfo(
    (grade as VolunteerGrade) || "GREEN",
    completedShifts
  );

  // Map to the format expected by this component
  if (!displayInfo) {
    return {
      color: "bg-gray-100 dark:bg-gray-900/50 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700",
      icon: null,
      label: "No grade",
    };
  }

  // Map the shared grade info to component's icon and color format
  const iconMap: Record<string, typeof Award> = {
    "🩷": Award,    // PINK - Shift Leader
    "🟡": Star,     // YELLOW - Experienced
    "🟢": Shield,   // GREEN - Standard
    "✨": Star,     // NEW_VOLUNTEER - New volunteer
    "🌟": Star,     // FIRST_SHIFT - First shift
  };

  const colorMap: Record<string, string> = {
    "Shift Leader": "bg-pink-100 dark:bg-pink-900/50 text-pink-700 dark:text-pink-200 border border-pink-200 dark:border-pink-700",
    "Experienced": "bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-700",
    "Standard": "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-200 border border-green-200 dark:border-green-700",
    "New volunteer": "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-200 border border-blue-200 dark:border-blue-700",
    "First shift": "bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-200 border border-purple-200 dark:border-purple-700",
  };

  return {
    color: colorMap[displayInfo.label] || "bg-gray-100 dark:bg-gray-900/50 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700",
    icon: iconMap[displayInfo.icon] || Shield,
    label: displayInfo.label,
  };
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
          item.style.width = `calc(${100 / columnCount}% - ${((columnCount - 1) * gap) / columnCount
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
          item.style.width = `calc(${100 / columnCount}% - ${((columnCount - 1) * gap) / columnCount
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

// Volunteer Status Groups Component
function VolunteerStatusGroups({
  statusOrder,
  groupedSignups,
  shift,
  shiftIdToTypeName,
  triggerLayoutUpdate,
}: {
  statusOrder: Array<{ status: string; label: string; icon: typeof CheckCircle2; color: string }>;
  groupedSignups: Record<string, Shift["signups"]>;
  shift: Shift;
  shiftIdToTypeName: Map<string, string>;
  triggerLayoutUpdate: () => void;
}) {
  return (
    <div
      data-testid={`volunteers-${shift.id}`}
      className="space-y-4"
    >
      {statusOrder.map(({ status, label, icon: StatusIcon, color }) => {
        const signupsForStatus = groupedSignups[status] || [];
        if (signupsForStatus.length === 0) return null;

        return (
          <div key={status} className="space-y-2">
            {/* Status Header */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${color}`}>
              <StatusIcon className="h-4 w-4" />
              <span className="text-sm font-semibold">{label}</span>
              <span className="text-xs opacity-75">({signupsForStatus.length})</span>
            </div>

            {/* Volunteers in this status group */}
            <div className="space-y-2">
              {signupsForStatus.map((signup) => {
                const now = new Date();
                const completedShifts = signup.user.signups
                  ? signup.user.signups.filter(s => s.shift.end < now).length
                  : 0;
                const gradeInfo = getGradeInfo(
                  signup.user.volunteerGrade,
                  completedShifts
                );
                const GradeIcon = gradeInfo.icon;
                return (
                  <div
                    key={signup.id}
                    className="flex items-start gap-3 p-3 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl min-w-0 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-200"
                  >
                    <Link
                      href={`/admin/volunteers/${signup.user.id}`}
                      className="flex-shrink-0"
                      data-testid={`volunteer-avatar-link-${signup.id}`}
                    >
                      <Avatar
                        className="h-12 w-12 border-2 border-white dark:border-slate-700 shadow-md hover:scale-105 transition-transform ring-2 ring-slate-100 dark:ring-slate-800"
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
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-center flex-wrap gap-2 mb-1">
                        <Link
                          href={`/admin/volunteers/${signup.user.id}`}
                          className="text-sm font-semibold text-slate-900 dark:text-white truncate hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
                          data-testid={`volunteer-name-link-${signup.id}`}
                        >
                          {signup.user.name ||
                            `${signup.user.firstName || ""} ${signup.user.lastName || ""
                              }`.trim() ||
                            "Volunteer"}
                        </Link>
                        {signup.user.adminNotes.length > 0 && (
                          <AdminNotesDialog
                            volunteerId={signup.user.id}
                            volunteerName={
                              signup.user.name ||
                              `${signup.user.firstName || ""} ${signup.user.lastName || ""
                                }`.trim() ||
                              "Volunteer"
                            }
                            trigger={
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 px-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/20"
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
                        {(() => {
                          const age = signup.user.dateOfBirth ? calculateAge(signup.user.dateOfBirth) : null;
                          return age !== null && age < 16 ? (
                            <Badge
                              variant="outline"
                              className="text-xs bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800 dark:border-orange-800 px-1.5 py-0.5"
                              data-testid={`volunteer-age-${signup.id}`}
                            >
                              {age}yr
                            </Badge>
                          ) : null;
                        })()}
                      </div>
                      {signup.note && (
                        <div className="text-xs text-slate-700 dark:text-slate-300 mt-2 p-3 bg-blue-50/50 dark:bg-blue-900/20 border-l-2 border-blue-400 dark:border-blue-600 rounded">
                          <span className="font-semibold text-blue-700 dark:text-blue-300">Note: </span>
                          {signup.note}
                        </div>
                      )}
                      {signup.backupForShiftIds && signup.backupForShiftIds.length > 0 && (
                        <div className="text-xs text-slate-700 dark:text-slate-300 mt-2 p-3 bg-amber-50/50 dark:bg-amber-900/20 border-l-2 border-amber-400 dark:border-amber-600 rounded">
                          <span className="font-semibold text-amber-700 dark:text-amber-300">🤝 Backup options: </span>
                          <span className="text-amber-600 dark:text-amber-400">
                            {signup.backupForShiftIds
                              .map((shiftId) => shiftIdToTypeName.get(shiftId) || 'Unknown')
                              .join(', ')}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-3 mt-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
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
                            backupShiftIds={signup.backupForShiftIds.length > 0 ? signup.backupForShiftIds : undefined}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AnimatedShiftCards({ shifts, shiftIdToTypeName }: AnimatedShiftCardsProps) {
  // Determine column count based on screen size (we'll use a simple approach)
  const [columnCount, setColumnCount] = useState(1);

  useEffect(() => {
    const updateColumnCount = () => {
      if (window.innerWidth >= 1280) setColumnCount(3); // xl: 3 columns for large desktop
      else if (window.innerWidth >= 1024) setColumnCount(2); // lg: 2 columns for desktop with sidebar
      else setColumnCount(1); // md and below: 1 column for tablet/mobile with sidebar
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
          {shifts.map((shift) => {
            const confirmedSignups = shift.signups.filter(
              (s) => s.status === "CONFIRMED"
            ).length;
            const confirmed = getEffectiveConfirmedCount(confirmedSignups, shift.placeholderCount);
            const isCompleted = isShiftCompleted(shift.end);
            const staffingStatus = isCompleted
              ? { color: "bg-slate-400 dark:bg-slate-600", text: "Completed", icon: CheckCircle2 }
              : getStaffingStatus(confirmed, shift.capacity);

            const shiftTheme = getShiftTheme(shift.shiftType.name);

            return (
              <motion.div
                key={shift.id}
                layout
                initial="hidden"
                animate="visible"
                exit="exit"
                variants={createStaggerItemVariants()}
                className="w-full"
              >
                <Card
                  data-testid={`shift-card-${shift.id}`}
                  className="w-full relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200 hover:shadow-lg py-0"
                >
                  <CardContent className="p-0">
                    {/* Modern Header with colored accent */}
                    <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${shiftTheme.fullGradient} flex items-center justify-center text-2xl shadow-sm`}>
                            {shiftTheme.emoji}
                          </div>
                          <div className="flex-1">
                            <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-1">
                              {shift.shiftType.name}
                            </h3>
                            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                              <Clock className="h-4 w-4" />
                              <span className="font-medium">
                                {formatInNZT(shift.start, "h:mm a")} - {formatInNZT(shift.end, "h:mm a")}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Badge
                            data-testid={`shift-capacity-${shift.id}`}
                            className={`${staffingStatus.color} text-white text-base px-3 py-1.5 font-bold shadow-sm`}
                          >
                            {shift.placeholderCount > 0
                              ? `${confirmedSignups}+${shift.placeholderCount}/${shift.capacity}`
                              : `${confirmed}/${shift.capacity}`}
                          </Badge>
                          {!isCompleted && (
                            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                              {staffingStatus.text}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>


                    {/* Volunteers List - Grouped by Status */}
                    <div
                      data-testid={`volunteer-list-${shift.id}`}
                      className="px-4 py-3"
                    >
                      {shift.signups.length === 0 ? (
                        <div
                          data-testid={`no-volunteers-${shift.id}`}
                          className="py-8 text-center bg-slate-50 dark:bg-slate-800/70 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg"
                        >
                          <Users className="h-10 w-10 text-slate-400 dark:text-slate-400 mx-auto mb-3" />
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                            No volunteers yet
                          </p>
                        </div>
                      ) : (() => {
                        // Group signups by status
                        const groupedSignups = shift.signups.reduce((acc, signup) => {
                          const status = signup.status;
                          if (!acc[status]) {
                            acc[status] = [];
                          }
                          acc[status].push(signup);
                          return acc;
                        }, {} as Record<string, typeof shift.signups>);

                        // Define status order and display info
                        const statusOrder = [
                          { status: "PENDING", label: "Pending", icon: Clock, color: "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-900 dark:text-orange-100" },
                          { status: "REGULAR_PENDING", label: "Pending", icon: Clock, color: "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-900 dark:text-orange-100" },
                          { status: "CONFIRMED", label: isCompleted ? "Attended" : "Confirmed", icon: CheckCircle2, color: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-900 dark:text-green-100" },
                          { status: "WAITLISTED", label: "Waitlisted", icon: AlertCircle, color: "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-100" },
                          { status: "NO_SHOW", label: "No Show", icon: UserX, color: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-900 dark:text-red-100" },
                          { status: "CANCELED", label: "Canceled", icon: X, color: "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300" },
                        ];

                        return (
                          <VolunteerStatusGroups
                            key={shift.id}
                            statusOrder={statusOrder}
                            groupedSignups={groupedSignups}
                            shift={shift}
                            shiftIdToTypeName={shiftIdToTypeName}
                            triggerLayoutUpdate={triggerLayoutUpdate}
                          />
                        );
                      })()}
                    </div>

                    {/* Action Buttons Footer */}
                    <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-200 dark:border-slate-700">
                      <div className="flex flex-col gap-2">
                        {/* Placeholder (Walk-in) Count Control */}
                        <PlaceholderCountControl
                          shiftId={shift.id}
                          initialCount={shift.placeholderCount}
                        />
                        {/* Assign Volunteer Button - Always visible for past/present/future shifts */}
                        <AssignVolunteerDialog
                          shift={{
                            id: shift.id,
                            start: shift.start,
                            end: shift.end,
                            location: shift.location,
                            capacity: shift.capacity,
                            shiftType: shift.shiftType,
                          }}
                          confirmedCount={confirmed}
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full bg-green-50 dark:bg-green-900/60 text-green-700 dark:text-green-200 hover:bg-green-100 dark:hover:bg-green-800/60 border-green-300 dark:border-green-700"
                            data-testid={`assign-volunteer-button-${shift.id}`}
                          >
                            <UserPlus className="h-4 w-4 mr-2" />
                            {isCompleted ? "Assign to Past Shift" : "Assign Volunteer"}
                          </Button>
                        </AssignVolunteerDialog>

                        {/* Edit & Delete Buttons - Only for future shifts */}
                        {!isCompleted && (
                          <div className="flex gap-2">
                            <Button
                              asChild
                              variant="outline"
                              size="sm"
                              className="flex-1 bg-blue-50 dark:bg-blue-900/60 text-blue-700 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-800/60 border-blue-300 dark:border-blue-700"
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

                                // Preserve current date and location filters when redirecting
                                const currentParams = new URLSearchParams(window.location.search);
                                const date = currentParams.get('date') || '';
                                const location = currentParams.get('location') || '';
                                const params = new URLSearchParams({ deleted: '1' });
                                if (date) params.set('date', date);
                                if (location) params.set('location', location);
                                window.location.href = `/admin/shifts?${params.toString()}`;
                              }}
                            >
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 bg-red-50 dark:bg-red-900/60 text-red-700 dark:text-red-200 hover:bg-red-100 dark:hover:bg-red-800/60 border-red-300 dark:border-red-700"
                                data-testid={`delete-shift-button-${shift.id}`}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </Button>
                            </DeleteShiftDialog>
                          </div>
                        )}
                      </div>
                    </div>
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
