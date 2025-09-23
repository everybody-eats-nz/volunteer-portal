import { prisma } from "@/lib/prisma";
import { type VolunteerGrade, type AutoAcceptRule, type Shift, type ShiftType } from "@prisma/client";
import { createShiftConfirmedNotification } from "@/lib/notifications";
import { getEmailService } from "@/lib/email-service";
import { format } from "date-fns";

interface UserWithStats {
  id: string;
  email: string;
  name: string | null;
  volunteerGrade: VolunteerGrade;
  createdAt: Date;
  completedShifts: number;
  canceledShifts: number;
  attendanceRate: number;
  hasShiftTypeExperience: boolean;
}

interface EvaluationResult {
  approved: boolean;
  ruleId?: string;
  ruleName?: string;
  reason?: string;
}

// Helper to get volunteer grade priority (for comparison)
const GRADE_PRIORITY: Record<VolunteerGrade, number> = {
  GREEN: 0,
  YELLOW: 1,
  PINK: 2,
};

// Get user statistics for rule evaluation
async function getUserWithStats(userId: string, shiftTypeId: string): Promise<UserWithStats> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      signups: {
        include: {
          shift: {
            include: {
              shiftType: true,
            },
          },
        },
      },
    },
  });

  // Calculate statistics
  const now = new Date();
  const completedShifts = user.signups.filter(
    s => s.status === "CONFIRMED" && s.shift.end < now
  ).length;
  
  const canceledShifts = user.signups.filter(
    s => s.status === "CANCELED" && s.canceledAt !== null && s.previousStatus === "CONFIRMED"
  ).length;
  
  const totalConfirmedShifts = completedShifts + canceledShifts;
  const attendanceRate = totalConfirmedShifts > 0 
    ? ((completedShifts / totalConfirmedShifts) * 100) 
    : 100; // Default to 100% if no history
  
  const hasShiftTypeExperience = user.signups.some(
    s => s.shift.shiftTypeId === shiftTypeId && 
        s.status === "CONFIRMED" && 
        s.shift.end < now
  );

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    volunteerGrade: user.volunteerGrade,
    createdAt: user.createdAt,
    completedShifts,
    canceledShifts,
    attendanceRate,
    hasShiftTypeExperience,
  };
}

// Evaluate a single rule against user stats
function evaluateRule(
  rule: AutoAcceptRule,
  user: UserWithStats,
  shift: Shift & { shiftType: ShiftType }
): boolean {
  const criteria: boolean[] = [];
  
  // Check volunteer grade
  if (rule.minVolunteerGrade) {
    const userGradePriority = GRADE_PRIORITY[user.volunteerGrade];
    const minGradePriority = GRADE_PRIORITY[rule.minVolunteerGrade];
    criteria.push(userGradePriority >= minGradePriority);
  }
  
  // Check completed shifts
  if (rule.minCompletedShifts !== null && rule.minCompletedShifts !== undefined) {
    criteria.push(user.completedShifts >= rule.minCompletedShifts);
  }
  
  // Check attendance rate
  if (rule.minAttendanceRate !== null && rule.minAttendanceRate !== undefined) {
    criteria.push(user.attendanceRate >= rule.minAttendanceRate);
  }
  
  // Check account age
  if (rule.minAccountAgeDays !== null && rule.minAccountAgeDays !== undefined) {
    const accountAgeDays = Math.floor(
      (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    criteria.push(accountAgeDays >= rule.minAccountAgeDays);
  }
  
  // Check days in advance
  if (rule.maxDaysInAdvance !== null && rule.maxDaysInAdvance !== undefined) {
    const daysInAdvance = Math.floor(
      (shift.start.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    criteria.push(daysInAdvance <= rule.maxDaysInAdvance);
  }
  
  // Check shift type experience
  if (rule.requireShiftTypeExperience) {
    criteria.push(user.hasShiftTypeExperience);
  }
  
  // If no criteria are set, the rule doesn't apply
  if (criteria.length === 0) {
    return false;
  }
  
  // Apply logic (AND/OR)
  if (rule.criteriaLogic === "AND") {
    return criteria.every(c => c);
  } else {
    return criteria.some(c => c);
  }
}

// Main function to evaluate auto-accept rules for a signup
export async function evaluateAutoAcceptRules(
  userId: string,
  shiftId: string
): Promise<EvaluationResult> {
  try {
    // Get shift details
    const shift = await prisma.shift.findUniqueOrThrow({
      where: { id: shiftId },
      include: { shiftType: true },
    });
    
    // Get user statistics
    const userStats = await getUserWithStats(userId, shift.shiftTypeId);
    
    // Get applicable rules (global + shift type specific + location specific)
    const rules = await prisma.autoAcceptRule.findMany({
      where: {
        enabled: true,
        OR: [
          { global: true, location: null }, // Global rules that apply to all locations
          { shiftTypeId: shift.shiftTypeId, location: null }, // Shift type specific, all locations
          { location: shift.location }, // Location specific (any shift type)
          { shiftTypeId: shift.shiftTypeId, location: shift.location }, // Both shift type and location specific
        ],
      },
      orderBy: { priority: "desc" }, // Higher priority first
    });
    
    // Evaluate each rule
    for (const rule of rules) {
      if (evaluateRule(rule, userStats, shift)) {
        return {
          approved: true,
          ruleId: rule.id,
          ruleName: rule.name,
          reason: `Auto-approved by rule: ${rule.name}`,
        };
      }
      
      // Stop if this rule has stopOnMatch set
      if (rule.stopOnMatch) {
        break;
      }
    }
    
    return {
      approved: false,
      reason: "No auto-accept rules matched",
    };
  } catch (error) {
    console.error("Error evaluating auto-accept rules:", error);
    // On error, default to not auto-approving
    return {
      approved: false,
      reason: "Error evaluating rules",
    };
  }
}

// Process auto-approval after signup creation
export async function processAutoApproval(
  signupId: string,
  userId: string,
  shiftId: string
): Promise<{ autoApproved: boolean; status: string }> {
  const evaluationResult = await evaluateAutoAcceptRules(userId, shiftId);
  
  if (evaluationResult.approved && evaluationResult.ruleId) {
    // Update signup to CONFIRMED
    await prisma.signup.update({
      where: { id: signupId },
      data: { status: "CONFIRMED" },
    });
    
    // Create auto-approval record
    await prisma.autoApproval.create({
      data: {
        signupId,
        ruleId: evaluationResult.ruleId,
      },
    });
    
    // Send confirmation notification and email
    try {
      const shift = await prisma.shift.findUniqueOrThrow({
        where: { id: shiftId },
        include: { shiftType: true },
      });
      
      // Get user details for email
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          email: true,
          name: true,
          firstName: true,
          lastName: true,
        },
      });
      
      const shiftDate = new Intl.DateTimeFormat('en-NZ', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(shift.start);
      
      // Send in-app notification
      await createShiftConfirmedNotification(
        userId,
        shift.shiftType.name,
        shiftDate,
        shiftId
      );
      
      // Send email confirmation
      try {
        const emailService = getEmailService();
        const formattedShiftDate = format(shift.start, "EEEE, MMMM d, yyyy");
        const shiftTime = `${format(shift.start, "h:mm a")} - ${format(shift.end, "h:mm a")}`;
        
        await emailService.sendShiftConfirmationNotification({
          to: user.email,
          volunteerName: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
          shiftName: shift.shiftType.name,
          shiftDate: formattedShiftDate,
          shiftTime: shiftTime,
          location: shift.location || 'TBD',
          shiftId: shiftId,
          shiftStart: shift.start,
          shiftEnd: shift.end,
        });
        
        console.log("Auto-approval confirmation email sent successfully to:", user.email);
      } catch (emailError) {
        console.error("Error sending auto-approval confirmation email:", emailError);
        // Don't fail the auto-approval if email fails
      }
    } catch (notificationError) {
      console.error("Error sending auto-approval notification:", notificationError);
    }
    
    return { autoApproved: true, status: "CONFIRMED" };
  }
  
  return { autoApproved: false, status: "PENDING" };
}

// Check if a user would be eligible for auto-approval (for UI indicators)
export async function checkAutoApprovalEligibility(
  userId: string,
  shiftId: string
): Promise<{ eligible: boolean; ruleName?: string }> {
  const result = await evaluateAutoAcceptRules(userId, shiftId);
  return {
    eligible: result.approved,
    ruleName: result.ruleName,
  };
}

// Get statistics about auto-approvals
export async function getAutoApprovalStats() {
  const [totalAutoApprovals, recentAutoApprovals, topRules, overrideRate] = await Promise.all([
    // Total auto-approvals
    prisma.autoApproval.count(),
    
    // Recent auto-approvals (last 7 days)
    prisma.autoApproval.count({
      where: {
        approvedAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    }),
    
    // Top performing rules
    prisma.autoApproval.groupBy({
      by: ['ruleId'],
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: 5,
    }),
    
    // Override rate
    prisma.autoApproval.aggregate({
      _count: {
        id: true,
        overridden: true,
      },
    }),
  ]);
  
  // Get rule details for top rules
  const topRuleIds = topRules.map(r => r.ruleId);
  const ruleDetails = await prisma.autoAcceptRule.findMany({
    where: { id: { in: topRuleIds } },
    select: { id: true, name: true },
  });
  
  const ruleMap = new Map(ruleDetails.map(r => [r.id, r.name]));
  const topRulesWithNames = topRules.map(r => ({
    ruleId: r.ruleId,
    ruleName: ruleMap.get(r.ruleId) || 'Unknown',
    count: r._count.id,
  }));
  
  return {
    totalAutoApprovals,
    recentAutoApprovals,
    topRules: topRulesWithNames,
    overrideRate: overrideRate._count.id > 0 
      ? (overrideRate._count.overridden / overrideRate._count.id) * 100 
      : 0,
  };
}