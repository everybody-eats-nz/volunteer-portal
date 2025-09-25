# CLAUDE.md - Database & Prisma Guidelines

This file provides guidance to Claude Code for working with the database schema, migrations, and Prisma ORM in this directory.

## Overview

This directory contains all database-related files including the Prisma schema, migrations, and seed data for the Volunteer Portal.

## Directory Structure

```
prisma/
├── schema.prisma        # Main database schema
├── migrations/          # Database migration files
│   └── 20241201_*/     # Timestamped migration folders
├── seed.ts             # Database seeding script
└── seed-data/          # Static seed data files
    ├── users.json
    ├── shifts.json
    └── achievements.json
```

## Schema Best Practices

### 1. Model Structure Pattern

Follow consistent patterns for all models:

```prisma
model Volunteer {
  // Primary key
  id        String   @id @default(cuid())
  
  // Required fields
  email     String   @unique
  name      String
  
  // Optional fields with defaults
  status    VolunteerStatus @default(ACTIVE)
  role      UserRole        @default(VOLUNTEER)
  
  // Timestamps (ALWAYS include)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  // JSON fields for flexible data
  emergencyContact Json?
  skills           String[]
  
  // Relations
  shifts    ShiftAssignment[]
  achievements UserAchievement[]
  
  // Indexes for performance
  @@index([email])
  @@index([status])
  @@map("volunteers")
}

// ALWAYS define enums for status fields
enum VolunteerStatus {
  ACTIVE
  INACTIVE
  PENDING
  SUSPENDED
}

enum UserRole {
  ADMIN
  VOLUNTEER
  MANAGER
}
```

### 2. Relationship Patterns

Use explicit join tables for many-to-many relationships:

```prisma
// Many-to-many: Volunteers <-> Shifts
model ShiftAssignment {
  id          String   @id @default(cuid())
  volunteerId String
  shiftId     String
  status      AssignmentStatus @default(CONFIRMED)
  notes       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  // Relations
  volunteer   User  @relation(fields: [volunteerId], references: [id], onDelete: Cascade)
  shift       Shift @relation(fields: [shiftId], references: [id], onDelete: Cascade)
  
  // Prevent duplicate assignments
  @@unique([volunteerId, shiftId])
  @@map("shift_assignments")
}

enum AssignmentStatus {
  PENDING
  CONFIRMED
  COMPLETED
  CANCELLED
  NO_SHOW
}
```

### 3. Achievement System Schema

Complex gamification system with flexible criteria:

```prisma
model Achievement {
  id          String            @id @default(cuid())
  title       String
  description String
  icon        String
  type        AchievementType
  criteria    Json              // Flexible criteria storage
  points      Int               @default(0)
  isActive    Boolean           @default(true)
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt
  
  // Relations
  userAchievements UserAchievement[]
  
  @@map("achievements")
}

model UserAchievement {
  id            String      @id @default(cuid())
  userId        String
  achievementId String
  unlockedAt    DateTime    @default(now())
  progress      Json?       // Track progress towards achievement
  
  // Relations
  user          User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  achievement   Achievement @relation(fields: [achievementId], references: [id], onDelete: Cascade)
  
  // Prevent duplicate achievements
  @@unique([userId, achievementId])
  @@map("user_achievements")
}

enum AchievementType {
  MILESTONE    // Based on shift count
  DEDICATION   // Based on consecutive months
  IMPACT       // Based on hours volunteered  
  SPECIALIZATION // Based on specific shift types
}
```

### 4. Audit Trail Pattern

Track changes for important entities:

```prisma
model AuditLog {
  id        String   @id @default(cuid())
  entityId  String   // ID of the changed entity
  entityType String  // Type of entity (User, Shift, etc.)
  action    String   // CREATE, UPDATE, DELETE
  oldValues Json?    // Previous values
  newValues Json?    // New values
  changedBy String   // User who made the change
  timestamp DateTime @default(now())
  
  @@index([entityId, entityType])
  @@index([changedBy])
  @@index([timestamp])
  @@map("audit_logs")
}
```

## Migration Best Practices

### 1. Safe Migration Patterns

```sql
-- Adding new optional columns (safe)
ALTER TABLE "volunteers" ADD COLUMN "phone" TEXT;

-- Adding NOT NULL columns with defaults (safe)
ALTER TABLE "volunteers" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';

-- Creating indexes (safe)
CREATE INDEX "volunteers_email_idx" ON "volunteers"("email");

-- Renaming columns (requires data migration)
ALTER TABLE "volunteers" RENAME COLUMN "old_name" TO "new_name";
```

### 2. Data Migration Scripts

For complex schema changes, include data migration:

```typescript
// migration-script.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function migrateVolunteerData() {
  // Example: Move data from old structure to new
  const volunteers = await prisma.volunteer.findMany({
    where: { emergencyContactName: { not: null } }
  })
  
  for (const volunteer of volunteers) {
    await prisma.volunteer.update({
      where: { id: volunteer.id },
      data: {
        emergencyContact: {
          name: volunteer.emergencyContactName,
          phone: volunteer.emergencyContactPhone,
          relationship: volunteer.emergencyContactRelationship || 'Unknown'
        }
      }
    })
  }
}

migrateVolunteerData()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

## Database Operations

### 1. Query Patterns

Include necessary relations to avoid N+1 problems:

```typescript
// ✅ GOOD - Include relations in one query
const volunteers = await prisma.user.findMany({
  where: { role: 'VOLUNTEER' },
  include: {
    shifts: {
      include: {
        shift: {
          select: {
            id: true,
            title: true,
            date: true,
          }
        }
      }
    },
    achievements: {
      include: {
        achievement: true
      }
    }
  }
})

// ❌ BAD - N+1 query problem
const volunteers = await prisma.user.findMany({ where: { role: 'VOLUNTEER' } })
for (const volunteer of volunteers) {
  volunteer.shifts = await prisma.shiftAssignment.findMany({
    where: { volunteerId: volunteer.id }
  })
}
```

### 2. Transaction Patterns

Use transactions for multi-step operations:

```typescript
// Complex shift assignment with capacity checking
async function assignVolunteerToShift(volunteerId: string, shiftId: string) {
  return await prisma.$transaction(async (tx) => {
    // Check shift capacity
    const shift = await tx.shift.findUnique({
      where: { id: shiftId },
      include: { _count: { select: { assignments: true } } }
    })
    
    if (!shift) {
      throw new Error("Shift not found")
    }
    
    if (shift._count.assignments >= shift.maxVolunteers) {
      throw new Error("Shift is at capacity")
    }
    
    // Check for conflicts
    const conflict = await tx.shiftAssignment.findFirst({
      where: {
        volunteerId,
        shift: {
          date: shift.date,
          OR: [
            { startTime: { lte: shift.endTime } },
            { endTime: { gte: shift.startTime } }
          ]
        }
      }
    })
    
    if (conflict) {
      throw new Error("Volunteer has a conflicting shift")
    }
    
    // Create assignment
    const assignment = await tx.shiftAssignment.create({
      data: {
        volunteerId,
        shiftId,
        status: 'CONFIRMED'
      }
    })
    
    // Update volunteer stats
    await tx.user.update({
      where: { id: volunteerId },
      data: { totalShifts: { increment: 1 } }
    })
    
    return assignment
  })
}
```

### 3. Error Handling Patterns

Handle database constraints gracefully:

```typescript
async function createVolunteer(data: VolunteerInput) {
  try {
    return await prisma.user.create({
      data: {
        ...data,
        role: 'VOLUNTEER',
        status: 'PENDING'
      }
    })
  } catch (error) {
    if (error.code === 'P2002') { // Unique constraint violation
      if (error.meta?.target?.includes('email')) {
        throw new Error("A volunteer with this email already exists")
      }
    }
    
    console.error('Database error:', error)
    throw new Error("Failed to create volunteer")
  }
}
```

## Seeding Data

### 1. Seed Script Structure

```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')
  
  // Clear existing data in development
  if (process.env.NODE_ENV !== 'production') {
    await prisma.shiftAssignment.deleteMany()
    await prisma.userAchievement.deleteMany()
    await prisma.shift.deleteMany()
    await prisma.achievement.deleteMany()
    await prisma.user.deleteMany()
  }
  
  // Create admin user
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@everybodyeats.org',
      name: 'Admin User',
      password: await bcrypt.hash('admin123', 12),
      role: 'ADMIN',
      status: 'ACTIVE',
      emergencyContact: {
        name: 'Emergency Contact',
        phone: '+1234567890',
        relationship: 'Spouse'
      }
    }
  })
  
  // Create shift types
  const shiftTypes = await Promise.all([
    prisma.shiftType.create({
      data: {
        name: 'Kitchen Prep',
        description: 'Food preparation and cooking',
        duration: 240, // 4 hours in minutes
        maxVolunteers: 6,
        requiredSkills: ['cooking', 'food-safety']
      }
    }),
    prisma.shiftType.create({
      data: {
        name: 'Service',
        description: 'Serving meals to guests',
        duration: 180, // 3 hours
        maxVolunteers: 8,
        requiredSkills: ['customer-service']
      }
    }),
    prisma.shiftType.create({
      data: {
        name: 'Cleanup',
        description: 'Cleaning and dishwashing',
        duration: 120, // 2 hours
        maxVolunteers: 4,
        requiredSkills: []
      }
    })
  ])
  
  // Create achievements
  const achievements = await Promise.all([
    prisma.achievement.create({
      data: {
        title: 'First Shift',
        description: 'Complete your first volunteer shift',
        icon: '🌟',
        type: 'MILESTONE',
        criteria: { shiftCount: 1 },
        points: 10
      }
    }),
    prisma.achievement.create({
      data: {
        title: 'Dedicated Volunteer',
        description: 'Volunteer for 3 consecutive months',
        icon: '🏆',
        type: 'DEDICATION',
        criteria: { consecutiveMonths: 3 },
        points: 50
      }
    }),
    prisma.achievement.create({
      data: {
        title: 'Time Hero',
        description: 'Volunteer for 100+ hours',
        icon: '⏰',
        type: 'IMPACT',
        criteria: { totalHours: 100 },
        points: 100
      }
    })
  ])
  
  console.log('✅ Database seeded successfully!')
  console.log(`Created admin user: ${adminUser.email}`)
  console.log(`Created ${shiftTypes.length} shift types`)
  console.log(`Created ${achievements.length} achievements`)
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

### 2. Running Seeds

```bash
# Run seed script
npm run prisma:seed

# Reset database and seed (development only)
npm run prisma:migrate reset

# Seed specific data only
npx tsx prisma/seed-achievements.ts
```

## Performance & Optimization

### 1. Indexing Strategy

```prisma
model User {
  // ... fields
  
  // Single column indexes
  @@index([email])
  @@index([status])
  @@index([role])
  
  // Composite indexes for common queries
  @@index([status, role])
  @@index([createdAt, status])
}

model Shift {
  // ... fields
  
  // Date range queries
  @@index([date, startTime])
  @@index([date, shiftTypeId])
  
  // Full-text search
  @@index([title, description])
}
```

### 2. Query Optimization

```typescript
// Pagination with cursor
async function getVolunteers(cursor?: string, limit = 20) {
  return await prisma.user.findMany({
    where: { role: 'VOLUNTEER' },
    take: limit,
    skip: cursor ? 1 : 0,
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      totalHours: true,
      _count: {
        select: { shifts: true }
      }
    }
  })
}

// Aggregations for dashboard
async function getVolunteerStats() {
  const [totalVolunteers, activeVolunteers, totalHours] = await Promise.all([
    prisma.user.count({ where: { role: 'VOLUNTEER' } }),
    prisma.user.count({ where: { role: 'VOLUNTEER', status: 'ACTIVE' } }),
    prisma.shiftAssignment.aggregate({
      _sum: { hoursWorked: true },
      where: { status: 'COMPLETED' }
    })
  ])
  
  return {
    totalVolunteers,
    activeVolunteers,
    totalHours: totalHours._sum.hoursWorked || 0
  }
}
```

## Common Migration Commands

```bash
# Generate migration from schema changes
npx prisma migrate dev --name add_volunteer_skills

# Deploy migrations to production
npx prisma migrate deploy

# Reset database (development only)
npx prisma migrate reset

# Generate Prisma client after schema changes
npx prisma generate

# View database in Prisma Studio
npx prisma studio

# Validate schema
npx prisma validate
```

## Testing with Database

```typescript
// test/db-helpers.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL,
    },
  },
})

export async function cleanDatabase() {
  // Clean in dependency order
  await prisma.shiftAssignment.deleteMany()
  await prisma.userAchievement.deleteMany()
  await prisma.shift.deleteMany()
  await prisma.achievement.deleteMany()
  await prisma.user.deleteMany()
}

export async function createTestUser(overrides = {}) {
  return await prisma.user.create({
    data: {
      email: 'test@example.com',
      name: 'Test User',
      role: 'VOLUNTEER',
      status: 'ACTIVE',
      ...overrides
    }
  })
}

export { prisma as testDb }
```

## Important Reminders

1. **Always include createdAt and updatedAt** in models
2. **Use enums for status fields** to prevent invalid values
3. **Implement proper cascading deletes** with onDelete
4. **Add indexes for frequently queried fields**
5. **Use transactions for multi-step operations**
6. **Handle unique constraint violations gracefully**
7. **Test migrations on staging before production**
8. **Backup database before major schema changes**
9. **Use soft deletes for important data**
10. **Monitor query performance** with Prisma metrics