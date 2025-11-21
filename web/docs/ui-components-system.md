# UI Components System Guide

This guide covers the complete UI component ecosystem for the Volunteer Portal, including our core libraries, animation system, and recommended resources for inspiration and components.

## Tech Stack Overview

Our UI is built on a modern, flexible foundation:

- **Tailwind CSS v4** - Utility-first CSS framework for styling
- **shadcn/ui** - High-quality, accessible React components
- **motion.dev** - Animation library (successor to Framer Motion)
- **TypeScript** - Type-safe component development
- **Next.js 15** - React framework with App Router

### Philosophy

We follow a **copy-paste component model** where components are directly added to your codebase rather than installed as dependencies. This gives you:

- Full control and ownership of component code
- Easy customization without fighting package abstractions
- No version lock-in or dependency hell
- Type-safe, inspectable implementations

## Core Libraries

### 1. Tailwind CSS v4

Tailwind is our primary styling solution. We use it for all visual design through utility classes.

**Key Principles:**
- Use utility classes directly in JSX/TSX
- Leverage the `cn()` helper for conditional classes
- Follow mobile-first responsive design
- Use CSS variables for theming (defined in `src/app/globals.css`)

**Examples:**
```tsx
// Basic styling
<div className="flex items-center gap-4 p-6 rounded-lg bg-card">

// Responsive design
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

// Conditional classes with cn()
<div className={cn(
  "px-4 py-2 rounded-md",
  isActive && "bg-primary text-primary-foreground",
  isDisabled && "opacity-50 cursor-not-allowed"
)}>
```

**Color System:**
Tailwind v4 uses CSS variables for theming. Our colors are semantic:
- `background` / `foreground` - Base page colors
- `card` / `card-foreground` - Card backgrounds
- `primary` / `primary-foreground` - Primary actions
- `muted` / `muted-foreground` - Subdued content
- `destructive` - Error/delete actions
- `border` / `input` / `ring` - UI element colors

### 2. shadcn/ui

shadcn/ui is our component foundation. It provides accessible, customizable components that serve as building blocks.

**Installation Pattern:**
```bash
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add dialog
```

**Available Components:** (see `src/components/ui/`)
- Layout: `card`, `separator`, `sheet`, `sidebar`, `tabs`
- Forms: `form`, `input`, `select`, `checkbox`, `radio-group`, `textarea`, `combobox`
- Feedback: `alert`, `alert-dialog`, `dialog`, `drawer`, `tooltip`
- Data: `table`, `badge`, `avatar`, `progress`, `skeleton`
- Navigation: `dropdown-menu`, `command`, `scroll-area`
- Interactive: `button`, `calendar`, `chart`, `switch`, `collapsible`

**Best Practices:**
- Always check if shadcn/ui has a component before building custom
- Extend shadcn components rather than replacing them
- Use component composition for complex UI patterns

**Example:**
```tsx
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export function VolunteerCard({ volunteer }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{volunteer.name}</CardTitle>
          <Badge>{volunteer.status}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{volunteer.email}</p>
        <Button className="mt-4" size="sm">View Profile</Button>
      </CardContent>
    </Card>
  )
}
```

### 3. motion.dev

motion.dev (evolution of Framer Motion) powers all animations in the project.

**IMPORTANT:** We migrated from CSS animations to motion.dev. Never use CSS animation classes.

**Animation Utilities:** (see `src/lib/motion.ts`)
```tsx
import { motion } from "motion/react"
import {
  fadeVariants,
  slideUpVariants,
  staggerContainer,
  staggerItem
} from "@/lib/motion"

// Fade in animation
<motion.div
  variants={fadeVariants}
  initial="hidden"
  animate="visible"
>

// Stagger children
<motion.div variants={staggerContainer} initial="hidden" animate="visible">
  {items.map(item => (
    <motion.div key={item.id} variants={staggerItem}>
      {item.name}
    </motion.div>
  ))}
</motion.div>
```

**Pre-built Motion Components:**
- `MotionButton` - Button with hover/tap animations
- `MotionCard` - Card with hover lift effect
- `MotionDialog` - Dialog with entrance/exit animations
- Dashboard wrappers: `StatsGrid`, `ContentSection`, `ContentGrid`
- Auth wrappers: `AuthPageContainer`, `AuthCard`, `FormStepTransition`

**Testing Note:** Animations are automatically disabled during e2e tests via `.e2e-testing` class.

## Component Inspiration Resources

When building new features, these resources provide excellent patterns and inspiration. They all use similar tech stacks and follow the copy-paste philosophy.

### 1. Magic UI (https://magicui.design/)

**Best for:** Animated landing page components, marketing sections, eye-catching effects

**What it offers:**
- 150+ animated components built with React, TypeScript, Tailwind, and Motion
- Designed as a direct companion to shadcn/ui
- Emphasis on motion and visual polish
- Free open-source + Pro templates

**Categories:**
- Text animations (typing effects, gradient text, reveal animations)
- Hero sections and landing page blocks
- Animated backgrounds (particles, grids, beams)
- Card effects and interactions
- Charts and data visualizations
- Marketing-focused components

**When to use:**
- Building marketing pages or public-facing sections
- Adding visual flair to dashboards
- Creating engaging onboarding flows
- Enhancing user engagement with motion

**Integration:**
```tsx
// Example: Add an animated background from Magic UI
import { AnimatedGridPattern } from "@/components/ui/animated-grid-pattern"

export function HeroSection() {
  return (
    <div className="relative">
      <AnimatedGridPattern className="absolute inset-0 opacity-20" />
      <div className="relative z-10">
        <h1>Welcome to Everybody Eats</h1>
      </div>
    </div>
  )
}
```

### 2. Animata (https://animata.design/)

**Best for:** Hand-crafted interaction animations, micro-interactions, UI polish

**What it offers:**
- 80+ animated components built with Tailwind CSS
- Focus on interaction animations and effects
- Curated from around the internet
- Free and open-source (1000+ GitHub stars)

**Categories:**
- **Text Effects:** Wave reveal, mirror text, typing, gradient text, gibberish
- **Cards:** Shiny cards, skewed cards, GitHub-styled cards
- **Containers:** Animated borders, border trails
- **Backgrounds:** Animated beams, interactive grids
- **Widgets:** Complex trackers, delivery status, cycling animations
- **UI Elements:** Skeleton loaders, interactive components

**When to use:**
- Adding delight to user interactions
- Creating unique card designs for achievements or profiles
- Building engaging loading states
- Implementing creative text effects for headings

**Integration:**
```tsx
// Example: Add a shiny card effect from Animata
import { Card } from "@/components/ui/card"
import { motion } from "motion/react"

export function AchievementCard({ achievement }) {
  return (
    <motion.div
      className="relative overflow-hidden rounded-lg"
      whileHover={{ scale: 1.05 }}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent
                      animate-shimmer" />
      <Card>
        <h3>{achievement.title}</h3>
        <p>{achievement.description}</p>
      </Card>
    </motion.div>
  )
}
```

### 3. React Bits (https://reactbits.dev/)

**Best for:** Complete interactive components, form patterns, complex UI behaviors

**What it offers:**
- High-quality, animated, interactive React components
- Fully customizable implementations
- Focus on memorable user interfaces
- Open-source collection

**When to use:**
- Building complex interactive forms
- Implementing sophisticated UI patterns
- Creating unique user experiences
- Finding inspiration for component behavior

**Integration:**
- Copy component patterns and adapt to our tech stack
- Use as reference for interaction design
- Adapt animations to motion.dev syntax

## Component Development Workflow

### Step 1: Check Existing Components

Before building anything new:

1. **Check shadcn/ui** - Does it have the component? Use it.
2. **Check `src/components/ui/`** - Is it already installed? Use it.
3. **Check project components** - Has someone built something similar?

### Step 2: Design & Inspiration

If building something custom:

1. **Search inspiration sites** for similar patterns:
   - Magic UI for animated, polished effects
   - Animata for interaction animations
   - React Bits for complex behaviors

2. **Sketch the component structure:**
   - What shadcn/ui primitives can you compose?
   - What animations would enhance the UX?
   - What states does it need (loading, error, empty)?

### Step 3: Implementation

Follow this pattern:

```tsx
"use client" // Only if using hooks/interactivity

import { useState } from "react"
import { motion } from "motion/react"
import { cn } from "@/lib/utils"
import { Card, CardHeader, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { fadeVariants } from "@/lib/motion"

interface MyComponentProps {
  className?: string
  data: DataType
  onAction?: () => void
}

export function MyComponent({ className, data, onAction }: MyComponentProps) {
  const [isLoading, setIsLoading] = useState(false)

  return (
    <motion.div
      variants={fadeVariants}
      initial="hidden"
      animate="visible"
      className={cn("space-y-4", className)}
      data-testid="my-component"
    >
      <Card>
        <CardHeader>
          <h2 data-testid="my-component-title">{data.title}</h2>
        </CardHeader>
        <CardContent>
          <Button onClick={onAction} disabled={isLoading}>
            {isLoading ? "Loading..." : "Take Action"}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  )
}
```

### Step 4: Testing

Add data-testid attributes and test:

```bash
cd web
npx playwright test my-component.spec.ts --project=chromium
```

## Common Patterns & Solutions

### Pattern 1: Animated List with Stagger

```tsx
import { motion } from "motion/react"
import { staggerContainer, staggerItem } from "@/lib/motion"

export function VolunteerList({ volunteers }) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
    >
      {volunteers.map(volunteer => (
        <motion.div key={volunteer.id} variants={staggerItem}>
          <VolunteerCard volunteer={volunteer} />
        </motion.div>
      ))}
    </motion.div>
  )
}
```

### Pattern 2: Responsive Dialog/Sheet

Use `ResponsiveDialog` component (desktop dialog, mobile sheet):

```tsx
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"

export function EditVolunteerDialog({ volunteer, open, onOpenChange }) {
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Edit Volunteer"
      description="Update volunteer information"
    >
      <VolunteerForm volunteer={volunteer} />
    </ResponsiveDialog>
  )
}
```

### Pattern 3: Loading States with Skeleton

```tsx
import { Skeleton } from "@/components/ui/skeleton"

export function DashboardStats({ isLoading, stats }) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {stats.map(stat => (
        <StatsCard key={stat.id} stat={stat} />
      ))}
    </div>
  )
}
```

### Pattern 4: Form with Validation

```tsx
"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
})

export function VolunteerForm({ onSubmit }) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", email: "" },
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
                <Input {...field} />
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

### Pattern 5: Card with Hover Effect

```tsx
import { MotionCard } from "@/components/ui/motion-card"
import { Badge } from "@/components/ui/badge"

export function ShiftCard({ shift }) {
  return (
    <MotionCard className="cursor-pointer">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{shift.title}</h3>
          <Badge variant={shift.status === "OPEN" ? "default" : "secondary"}>
            {shift.status}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{shift.description}</p>
        <div className="flex gap-2 text-xs text-muted-foreground">
          <span>{shift.date}</span>
          <span>•</span>
          <span>{shift.duration} hours</span>
        </div>
      </div>
    </MotionCard>
  )
}
```

## Customization Guidelines

### Extending shadcn/ui Components

When you need custom variants or behavior, extend the base component:

```tsx
// src/components/ui/gradient-button.tsx
import { Button, ButtonProps } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function GradientButton({ className, ...props }: ButtonProps) {
  return (
    <Button
      className={cn(
        "bg-gradient-to-r from-primary to-purple-600",
        "hover:from-primary/90 hover:to-purple-600/90",
        className
      )}
      {...props}
    />
  )
}
```

### Creating Custom Animations

Add new animation variants to `src/lib/motion.ts`:

```tsx
export const customVariants = {
  hidden: {
    opacity: 0,
    y: 20,
    scale: 0.95
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: [0.4, 0, 0.2, 1]
    }
  }
}
```

### Adapting Components from Inspiration Sites

When copying from Magic UI, Animata, or React Bits:

1. **Check dependencies** - Ensure they match our stack
2. **Adapt to motion.dev** - Convert Framer Motion to motion.dev syntax (usually identical)
3. **Match our theme** - Use our CSS variables and color tokens
4. **Add TypeScript** - Type all props and state
5. **Follow our patterns** - Use `cn()`, add data-testid, follow file structure
6. **Test thoroughly** - Ensure it works across screen sizes

Example adaptation:

```tsx
// From Magic UI (Framer Motion)
import { motion } from "framer-motion"

// Adapt to our project (motion.dev)
import { motion } from "motion/react"
import { fadeVariants } from "@/lib/motion" // Use our variants
import { cn } from "@/lib/utils" // Use our utilities

export function AdaptedComponent({ className, ...props }: AdaptedComponentProps) {
  return (
    <motion.div
      variants={fadeVariants}
      className={cn("base-styles", className)}
      data-testid="adapted-component"
      {...props}
    />
  )
}
```

## Accessibility Checklist

Every component must be accessible:

- [ ] Semantic HTML elements (`button`, `nav`, `main`, etc.)
- [ ] Keyboard navigation support
- [ ] ARIA labels for icon-only buttons
- [ ] Form labels with `htmlFor` matching input `id`
- [ ] Focus indicators (never `outline-none` without custom focus styles)
- [ ] Color contrast meets WCAG AA standards
- [ ] Screen reader announcements for dynamic content
- [ ] Motion respects `prefers-reduced-motion`

shadcn/ui components handle most accessibility concerns, but verify when customizing.

## Performance Best Practices

1. **Lazy load heavy components:**
   ```tsx
   const HeavyChart = dynamic(() => import("./heavy-chart"), {
     loading: () => <Skeleton className="h-64" />,
     ssr: false
   })
   ```

2. **Memoize expensive renders:**
   ```tsx
   const VolunteerGrid = React.memo(({ volunteers }) => {
     return <Grid>{volunteers.map(...)}</Grid>
   })
   ```

3. **Use Server Components by default:**
   ```tsx
   // No "use client" needed for static display
   export async function VolunteerList() {
     const volunteers = await getVolunteers()
     return <div>{volunteers.map(...)}</div>
   }
   ```

4. **Optimize animations:**
   - Animate `transform` and `opacity` (GPU-accelerated)
   - Avoid animating `width`, `height`, `top`, `left`
   - Use `will-change` sparingly

## Quick Reference

### When to use each resource:

| Need | Use | Resource |
|------|-----|----------|
| Basic UI component | shadcn/ui | `npx shadcn@latest add [component]` |
| Custom animation | motion.dev | `src/lib/motion.ts` variants |
| Landing page flair | Magic UI | https://magicui.design |
| Micro-interactions | Animata | https://animata.design |
| Complex patterns | React Bits | https://reactbits.dev |
| Form validation | Zod + react-hook-form | shadcn/ui form docs |

### File structure:

```
src/components/
├── ui/                    # shadcn/ui components (base)
├── dashboard/             # Dashboard-specific
├── forms/                 # Complex forms
├── layout/                # Layout components
└── shared/                # Shared utilities
```

### Key imports:

```tsx
// Styling
import { cn } from "@/lib/utils"

// Animation
import { motion } from "motion/react"
import { fadeVariants, slideUpVariants } from "@/lib/motion"

// Components
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardContent } from "@/components/ui/card"

// Forms
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
```

## Additional Resources

- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [shadcn/ui Documentation](https://ui.shadcn.com/)
- [motion.dev Documentation](https://motion.dev/)
- [Next.js App Router Guide](./app-router-guide.md)
- [Component Development Guide](./component-development.md)
- [Testing Guide](./testing-guide.md)

---

**Remember:** Start with shadcn/ui, enhance with Tailwind, animate with motion.dev, and find inspiration from Magic UI, Animata, and React Bits. Build components that are accessible, performant, and delightful to use.
