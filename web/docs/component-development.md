# CLAUDE.md - Component Development Guidelines

This file provides guidance to Claude Code for working with React components in this directory.

## Overview

This directory contains all reusable React components for the Volunteer Portal, built primarily with shadcn/ui components and Tailwind CSS.

## Directory Structure

```
components/
├── ui/                    # shadcn/ui base components
│   ├── button.tsx        # Button component & variants
│   ├── card.tsx          # Card layout components
│   ├── dialog.tsx        # Modal dialogs
│   ├── form.tsx          # Form components with react-hook-form
│   ├── input.tsx         # Input fields
│   ├── select.tsx        # Select dropdowns
│   ├── table.tsx         # Data tables
│   └── ...               # Other shadcn/ui components
├── forms/                 # Complex form components
│   ├── volunteer-form.tsx
│   ├── shift-form.tsx
│   └── profile-form.tsx
├── layout/                # Layout components
│   ├── header.tsx
│   ├── sidebar.tsx
│   └── footer.tsx
├── dashboard/             # Dashboard-specific components
│   ├── stats-card.tsx
│   ├── shift-calendar.tsx
│   └── achievement-grid.tsx
└── shared/                # Shared utility components
    ├── loading-spinner.tsx
    ├── error-boundary.tsx
    └── role-guard.tsx
```

## Component Development Rules

### 1. ALWAYS Check shadcn/ui First

Before creating any new component, check if shadcn/ui already provides it:

```tsx
// ✅ GOOD - Use existing shadcn/ui components
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

// ❌ BAD - Creating custom components when shadcn/ui has them
const CustomButton = styled.button`...` // Don't do this!
```

### 2. Component Structure Pattern

Follow this consistent structure for all components:

```tsx
// 1. Imports
import { useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

// 2. Types/Interfaces
export interface ComponentNameProps {
  className?: string
  children?: React.ReactNode
  onAction?: (value: string) => void
  variant?: "default" | "outline" | "ghost"
}

// 3. Component
export function ComponentName({ 
  className,
  children,
  onAction,
  variant = "default"
}: ComponentNameProps) {
  // Hooks
  const [state, setState] = useState("")
  
  // Handlers
  const handleClick = useCallback(() => {
    onAction?.(state)
  }, [state, onAction])
  
  // Render
  return (
    <div className={cn("base-styles", className)}>
      {children}
    </div>
  )
}

// 4. Display name (for debugging)
ComponentName.displayName = "ComponentName"
```

### 3. Styling with Tailwind & cn()

Always use the `cn()` utility for conditional classes:

```tsx
import { cn } from "@/lib/utils"

// ✅ GOOD
<div className={cn(
  "base-styles p-4 rounded-lg",
  isActive && "bg-primary text-white",
  isDisabled && "opacity-50 cursor-not-allowed",
  className
)}>

// ❌ BAD
<div className={`base-styles ${isActive ? "bg-primary" : ""} ${className}`}>
```

### 4. Client vs Server Components

Default to Server Components, use "use client" only when needed:

```tsx
// Server Component (default) - for data display
export function VolunteerList({ volunteers }: { volunteers: Volunteer[] }) {
  return (
    <div>
      {volunteers.map(v => <VolunteerCard key={v.id} volunteer={v} />)}
    </div>
  )
}

// Client Component - for interactivity
"use client"
export function VolunteerSearch() {
  const [search, setSearch] = useState("")
  return <Input value={search} onChange={(e) => setSearch(e.target.value)} />
}
```

### 5. Form Components with react-hook-form

Use react-hook-form with zod validation:

```tsx
"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
})

export function VolunteerForm({ onSubmit }: { onSubmit: (data: z.infer<typeof formSchema>) => void }) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
    },
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="John Doe" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  )
}
```

### 6. Component Composition

Build complex components by composing shadcn/ui primitives:

```tsx
export function VolunteerCard({ volunteer, showActions = false }: VolunteerCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{volunteer.name}</CardTitle>
          <Badge variant={volunteer.status === "ACTIVE" ? "default" : "secondary"}>
            {volunteer.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{volunteer.email}</p>
          <div className="flex gap-2">
            <Badge variant="outline">
              {volunteer.completedShifts} shifts
            </Badge>
            <Badge variant="outline">
              {volunteer.totalHours} hours
            </Badge>
          </div>
        </div>
      </CardContent>
      {showActions && (
        <CardFooter className="flex gap-2">
          <Button size="sm">Edit</Button>
          <Button size="sm" variant="outline">View Profile</Button>
        </CardFooter>
      )}
    </Card>
  )
}
```

## shadcn/ui Component Usage

### Common Components & Their Use Cases

- **Button**: All clickable actions (variants: default, destructive, outline, secondary, ghost, link)
- **Card**: Content containers with header, content, and footer sections
- **Dialog**: Modal windows for forms, confirmations, and detailed views
- **Form**: Complex forms with validation (use with react-hook-form)
- **Input/Textarea**: Text input fields
- **Select**: Dropdown selections
- **Badge**: Status indicators, tags, and labels
- **Avatar**: User profile images with fallbacks
- **Table**: Data display in tabular format
- **Tabs**: Content organization and navigation
- **Alert**: Important messages and notifications
- **Toast**: Temporary notifications (use with sonner)
- **DropdownMenu**: Context menus and action lists
- **Popover**: Floating content panels
- **Sheet**: Side panels for forms and details

## Accessibility

Always ensure components are accessible:

```tsx
// ✅ GOOD - Accessible
<Button aria-label="Delete volunteer" onClick={handleDelete}>
  <TrashIcon className="h-4 w-4" />
</Button>

<FormLabel htmlFor="email">Email Address</FormLabel>
<Input id="email" type="email" required aria-describedby="email-error" />

// ❌ BAD - Not accessible
<div onClick={handleClick}>Click me</div>  // Use Button instead
<input type="text" />  // Missing label
```

## Testing Components

Add data-testid attributes for e2e testing:

```tsx
export function VolunteerDashboard() {
  return (
    <div data-testid="volunteer-dashboard">
      <h1 data-testid="dashboard-title">Dashboard</h1>
      <Button data-testid="add-shift-button">Add Shift</Button>
    </div>
  )
}
```

## Performance Optimization

1. **Use React.memo for expensive components**:
```tsx
export const ExpensiveList = React.memo(({ items }: { items: Item[] }) => {
  // Complex rendering logic
})
```

2. **Use useCallback/useMemo for stable references**:
```tsx
const handleSubmit = useCallback((data: FormData) => {
  // Handle submission
}, [dependency])

const sortedItems = useMemo(() => {
  return items.sort((a, b) => a.date - b.date)
}, [items])
```

3. **Lazy load heavy components**:
```tsx
const HeavyChart = dynamic(() => import("./heavy-chart"), {
  loading: () => <Skeleton className="h-64" />,
  ssr: false
})
```

## Common Patterns

### Loading States
```tsx
if (isLoading) {
  return <Skeleton className="h-32 w-full" />
}
```

### Error States
```tsx
if (error) {
  return (
    <Alert variant="destructive">
      <AlertDescription>{error.message}</AlertDescription>
    </Alert>
  )
}
```

### Empty States
```tsx
if (!data?.length) {
  return (
    <Card className="text-center p-8">
      <CardContent>
        <p className="text-muted-foreground">No volunteers found</p>
        <Button className="mt-4">Add First Volunteer</Button>
      </CardContent>
    </Card>
  )
}
```

## Do's and Don'ts

### Do's ✅
- Use shadcn/ui components first
- Follow existing component patterns
- Add proper TypeScript types
- Include loading and error states
- Make components accessible
- Use semantic HTML elements
- Add data-testid for testing

### Don'ts ❌
- Create custom components when shadcn/ui has them
- Use inline styles instead of Tailwind classes
- Forget error boundaries for complex components
- Mix business logic with UI components
- Use any type in TypeScript
- Ignore accessibility requirements
- Create components without proper props typing