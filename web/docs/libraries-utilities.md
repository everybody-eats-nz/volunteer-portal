# CLAUDE.md - Library & Utilities Guidelines

This file provides guidance to Claude Code for working with utility functions, services, and shared libraries in this directory.

## Overview

The lib directory contains all shared utilities, services, and configuration code that is used across the application.

## Directory Structure

```
lib/
├── auth.ts           # NextAuth configuration & helpers
├── db.ts            # Prisma client singleton
├── utils.ts         # General utility functions (including cn())
├── email/           # Email service integration
│   ├── templates.ts # Email templates
│   └── service.ts   # Email sending logic
├── validations/     # Zod schemas for validation
│   ├── volunteer.ts
│   ├── shift.ts
│   └── profile.ts
├── hooks/           # Custom React hooks
│   ├── use-session.ts
│   ├── use-shifts.ts
│   └── use-achievements.ts
└── services/        # Business logic services
    ├── volunteer-service.ts
    ├── shift-service.ts
    └── achievement-service.ts
```

## Core Libraries

### 1. Database Client (db.ts)

Always use the Prisma singleton to prevent connection issues:

```typescript
// lib/db.ts
import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

// Usage in other files:
import { prisma } from "@/lib/db"

// Never do this:
// const prisma = new PrismaClient() // ❌ Creates multiple connections
```

### 2. Authentication (auth.ts)

NextAuth configuration with proper typing:

```typescript
// lib/auth.ts
import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/db"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        // Validate credentials
        if (!credentials?.email || !credentials?.password) {
          return null
        }
        
        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        })
        
        // Verify password (use bcrypt in production)
        if (!user || !await verifyPassword(credentials.password, user.password)) {
          return null
        }
        
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        }
      }
    })
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!
        session.user.role = token.role as "ADMIN" | "VOLUNTEER"
      }
      return session
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
      }
      return token
    }
  },
  pages: {
    signIn: "/login",
    signOut: "/",
    error: "/auth/error",
  },
  session: {
    strategy: "jwt",
  },
}

// Helper functions
export async function getCurrentUser() {
  const session = await getServerSession(authOptions)
  return session?.user
}

export async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/login")
  }
  return user
}

export async function requireAdmin() {
  const user = await requireAuth()
  if (user.role !== "ADMIN") {
    throw new Error("Unauthorized")
  }
  return user
}
```

### 3. Utility Functions (utils.ts)

Essential utilities including the cn() function:

```typescript
// lib/utils.ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

// cn() - Merge Tailwind classes safely
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format dates consistently
export function formatDate(date: Date | string, format: string = "PPP"): string {
  return format(parseISO(date.toString()), format)
}

// Generate initials for avatars
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map(word => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

// Safe JSON parsing
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T
  } catch {
    return fallback
  }
}

// Debounce function
export function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}
```

## Validation Schemas

Use Zod for all data validation:

```typescript
// lib/validations/volunteer.ts
import * as z from "zod"

export const volunteerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number"),
  emergencyContact: z.object({
    name: z.string().min(1, "Emergency contact name required"),
    phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number"),
    relationship: z.string().min(1, "Relationship required"),
  }),
  availability: z.array(z.enum(["MORNING", "AFTERNOON", "EVENING", "WEEKEND"])),
  skills: z.array(z.string()).optional(),
  dietaryRestrictions: z.string().optional(),
})

export type VolunteerInput = z.infer<typeof volunteerSchema>

// API validation helper
export function validateVolunteer(data: unknown): VolunteerInput {
  return volunteerSchema.parse(data)
}

// Safe validation with error handling
export function safeValidateVolunteer(data: unknown): 
  { success: true; data: VolunteerInput } | 
  { success: false; errors: z.ZodError } {
  const result = volunteerSchema.safeParse(data)
  
  if (result.success) {
    return { success: true, data: result.data }
  }
  
  return { success: false, errors: result.error }
}
```

## Custom Hooks

Create reusable hooks for common patterns:

```typescript
// lib/hooks/use-shifts.ts
"use client"

import { useState, useEffect } from "react"
import { Shift } from "@prisma/client"

export function useShifts(volunteerId?: string) {
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    async function fetchShifts() {
      try {
        setLoading(true)
        const url = volunteerId 
          ? `/api/shifts?volunteerId=${volunteerId}`
          : "/api/shifts"
        
        const response = await fetch(url)
        if (!response.ok) throw new Error("Failed to fetch shifts")
        
        const data = await response.json()
        setShifts(data.shifts)
      } catch (err) {
        setError(err as Error)
      } finally {
        setLoading(false)
      }
    }

    fetchShifts()
  }, [volunteerId])

  const refetch = () => {
    setError(null)
    fetchShifts()
  }

  return { shifts, loading, error, refetch }
}

// Optimistic update hook
export function useOptimisticUpdate<T>() {
  const [optimisticData, setOptimisticData] = useState<T | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)

  const update = async (
    optimisticValue: T,
    updateFn: () => Promise<T>
  ) => {
    setOptimisticData(optimisticValue)
    setIsUpdating(true)

    try {
      const result = await updateFn()
      setOptimisticData(result)
      return result
    } catch (error) {
      setOptimisticData(null)
      throw error
    } finally {
      setIsUpdating(false)
    }
  }

  return { optimisticData, isUpdating, update }
}
```

## Service Layer

Business logic separated from UI:

```typescript
// lib/services/volunteer-service.ts
import { prisma } from "@/lib/db"
import { volunteerSchema } from "@/lib/validations/volunteer"
import { sendEmail } from "@/lib/email/service"
import { welcomeEmailTemplate } from "@/lib/email/templates"

export class VolunteerService {
  static async create(data: unknown) {
    // Validate input
    const validated = volunteerSchema.parse(data)
    
    // Check for duplicates
    const existing = await prisma.user.findUnique({
      where: { email: validated.email }
    })
    
    if (existing) {
      throw new Error("A volunteer with this email already exists")
    }
    
    // Create volunteer
    const volunteer = await prisma.user.create({
      data: {
        ...validated,
        role: "VOLUNTEER",
        status: "PENDING",
      }
    })
    
    // Send welcome email
    await sendEmail({
      to: volunteer.email,
      subject: "Welcome to Everybody Eats!",
      html: welcomeEmailTemplate(volunteer)
    })
    
    return volunteer
  }
  
  static async updateHours(volunteerId: string, hours: number) {
    return await prisma.$transaction(async (tx) => {
      // Update volunteer hours
      const volunteer = await tx.user.update({
        where: { id: volunteerId },
        data: { 
          totalHours: { increment: hours }
        }
      })
      
      // Check for achievement unlocks
      await this.checkAchievements(tx, volunteer)
      
      return volunteer
    })
  }
  
  private static async checkAchievements(tx: any, volunteer: any) {
    // Achievement logic here
  }
}
```

## Error Handling

Consistent error handling patterns:

```typescript
// lib/errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message)
    this.name = "AppError"
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public details?: any) {
    super(message, "VALIDATION_ERROR", 400)
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = "Authentication required") {
    super(message, "AUTHENTICATION_ERROR", 401)
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = "Insufficient permissions") {
    super(message, "AUTHORIZATION_ERROR", 403)
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, "NOT_FOUND", 404)
  }
}

// Error handler wrapper for API routes
export function withErrorHandler(
  handler: (req: Request) => Promise<Response>
) {
  return async (req: Request) => {
    try {
      return await handler(req)
    } catch (error) {
      console.error("API Error:", error)
      
      if (error instanceof AppError) {
        return NextResponse.json(
          { 
            success: false,
            error: error.message,
            code: error.code 
          },
          { status: error.statusCode }
        )
      }
      
      return NextResponse.json(
        { 
          success: false,
          error: "Internal server error",
          code: "INTERNAL_ERROR"
        },
        { status: 500 }
      )
    }
  }
}
```

## Email Service

Email sending with templates:

```typescript
// lib/email/service.ts
import nodemailer from "nodemailer"

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
})

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string | string[]
  subject: string
  html: string
  text?: string
}) {
  const mailOptions = {
    from: process.env.EMAIL_FROM || "noreply@example.com",
    to: Array.isArray(to) ? to.join(", ") : to,
    subject,
    html,
    text: text || htmlToText(html),
  }
  
  try {
    const info = await transporter.sendMail(mailOptions)
    console.log("Email sent:", info.messageId)
    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error("Email error:", error)
    throw new Error("Failed to send email")
  }
}

// lib/email/templates.ts
export function welcomeEmailTemplate(user: { name: string; email: string }) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background: #10b981; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .button { 
            display: inline-block; 
            padding: 12px 24px; 
            background: #10b981; 
            color: white; 
            text-decoration: none; 
            border-radius: 6px; 
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Everybody Eats!</h1>
          </div>
          <div class="content">
            <p>Hi ${user.name},</p>
            <p>Thank you for joining our volunteer community!</p>
            <p>
              <a href="${process.env.NEXTAUTH_URL}/profile/complete" class="button">
                Complete Your Profile
              </a>
            </p>
          </div>
        </div>
      </body>
    </html>
  `
}
```

## Testing Utilities

Test helpers and factories:

```typescript
// lib/test-utils.ts
import { render } from "@testing-library/react"
import { SessionProvider } from "next-auth/react"

export function renderWithSession(
  component: React.ReactElement,
  session?: any
) {
  return render(
    <SessionProvider session={session}>
      {component}
    </SessionProvider>
  )
}

// Mock data factories
export function createMockVolunteer(overrides = {}) {
  return {
    id: "test-id",
    name: "Test Volunteer",
    email: "test@example.com",
    phone: "+1234567890",
    role: "VOLUNTEER",
    status: "ACTIVE",
    totalHours: 0,
    completedShifts: 0,
    ...overrides
  }
}
```

## Best Practices

1. **Always use the Prisma singleton** from lib/db.ts
2. **Validate all external input** with Zod schemas
3. **Handle errors consistently** using the error classes
4. **Keep business logic in services**, not in components or API routes
5. **Use TypeScript strictly** - no `any` types
6. **Export types alongside functions** for better DX
7. **Document complex functions** with JSDoc
8. **Test service functions** independently from UI

## Common Pitfalls to Avoid

- Don't create new Prisma clients - use the singleton
- Don't put business logic in components
- Don't skip validation on API inputs
- Don't expose sensitive data in error messages
- Don't forget to handle async errors
- Don't use synchronous operations that block the event loop