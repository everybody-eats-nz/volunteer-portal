# 🌐 Everybody Eats Volunteer Portal - Web Frontend

A modern Next.js application for managing volunteers at Everybody Eats, an innovative charitable restaurant that transforms rescued food into quality 3-course meals on a pay-what-you-can basis.

## ✨ Features

- 🙋‍♀️ **Volunteer Management**: Registration, profile management, and volunteer tracking
- 📅 **Shift Scheduling**: Browse and sign up for volunteer shifts
- 🏆 **Achievement System**: Gamified volunteer experience with milestones and badges
- 👥 **Role-based Access**: Separate interfaces for volunteers and administrators
- 🎨 **Responsive Design**: Modern UI built with Tailwind CSS and Radix UI components
- 🔐 **Authentication**: Secure login with NextAuth.js
- 🗄️ **Database**: PostgreSQL with Prisma ORM for data management

## 🛠️ Tech Stack

- ⚛️ **Framework**: Next.js 16.0.3 (App Router)
- 📝 **Language**: TypeScript
- 🎨 **Styling**: Tailwind CSS v4
- 🧩 **UI Components**: Radix UI + Custom shadcn/ui components
- 🗄️ **Database**: PostgreSQL with Prisma ORM
- 🔐 **Authentication**: NextAuth.js
- ⚡ **State Management**: React hooks and server components
- 🚀 **Deployment Ready**: Optimized for Vercel and Supabase

## 🚀 Getting Started

### 📋 Prerequisites

- 📦 Node.js 20+
- 🐳 Docker

### 🔧 Installation

1. **📥 Install dependencies:**

```bash
npm install
```

2. **🗄️ Set up PostgreSQL database:**

   If you don't have PostgreSQL installed, you can run it with Docker:

```bash
docker run --name postgres -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres
```

3. **🗄️ Run database setup:**

```bash
# Run database migrations
npm run prisma:migrate

# Seed the database with initial data
npm run prisma:seed
```

4. **⚙️ Set up environment variables:**

```bash
# Copy the example environment file
cp .env.example .env
```

Then edit `.env` as needed. See the [Environment Variables](#-environment-variables) section below for detailed configuration.

5. **🔒 Generate auth secret:**

```bash
npx auth secret
```

6. **🏃‍♂️ Run the development server:**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the volunteer portal. 🌐

## 💻 Development

- 📱 **Main App**: Edit pages in `src/app/` - the app uses Next.js App Router
- 🧩 **Components**: Reusable UI components in `src/components/`
- 🗄️ **Database**: Schema defined in `prisma/schema.prisma`
- 🎨 **Styling**: Global styles in `src/app/globals.css`

### 📜 Available Scripts

- 🏃‍♂️ `npm run dev` - Start development server
- 🏗️ `npm run build` - Build for production
- ▶️ `npm run start` - Start production server
- 🔍 `npm run lint` - Run ESLint
- 🗄️ `npm run prisma:migrate` - Run database migrations
- 🌱 `npm run prisma:seed` - Seed database with sample data

## 📁 Project Structure

- 📱 `/src/app/` - Next.js app router pages and API routes
- 🧩 `/src/components/` - Reusable React components
- 🛠️ `/src/lib/` - Utility functions and configurations
- 📝 `/src/types/` - TypeScript type definitions
- 🗄️ `/prisma/` - Database schema and migrations
- 🖼️ `/public/` - Static assets

## ⚙️ Environment Variables

Create a `.env.local` file in the root directory with the following configuration:

### Required Variables

```bash
# Database Configuration
DATABASE_URL="postgresql://postgres:password@localhost:5432/volunteer-portal"
DIRECT_URL="postgresql://postgres:password@localhost:5432/volunteer-portal"

# Authentication
NEXTAUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:3000"

# Campaign Monitor (for transactional emails)
CAMPAIGN_MONITOR_API_KEY="your-campaign-monitor-api-key"
CAMPAIGN_MONITOR_MIGRATION_EMAIL_ID="your-migration-email-template-id"
CAMPAIGN_MONITOR_SHIFT_ADMIN_CANCELLATION_EMAIL_ID="your-shift-cancellation-template-id"
CAMPAIGN_MONITOR_SHIFT_SHORTAGE_EMAIL_ID="your-shift-shortage-template-id"
CAMPAIGN_MONITOR_SHIFT_CONFIRMATION_EMAIL_ID="your-shift-confirmation-template-id"
CAMPAIGN_MONITOR_VOLUNTEER_CANCELLATION_EMAIL_ID="your-volunteer-cancellation-template-id"
CAMPAIGN_MONITOR_PARENTAL_CONSENT_APPROVAL_EMAIL_ID="your-parental-consent-approval-template-id"
```

### Optional OAuth Providers

```bash
# Google OAuth
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# Facebook OAuth
FACEBOOK_CLIENT_ID=""
FACEBOOK_CLIENT_SECRET=""

# Apple OAuth
APPLE_CLIENT_ID=""
APPLE_CLIENT_SECRET=""
```

### Campaign Monitor Setup

The application uses Campaign Monitor for sending various transactional emails:

1. **Get API Key**: Sign in to your Campaign Monitor account and navigate to Account Settings > API Keys
2. **Create Smart Email Templates**: Create transactional email templates for each email type
3. **Get Template IDs**: Copy the Smart Email ID from each template's settings

#### Required Email Templates:

**Migration Invitation (`CAMPAIGN_MONITOR_MIGRATION_EMAIL_ID`)**

- Variables: `{firstName}`, `{link}`
- Used for user migration invitations

**Shift Confirmation (`CAMPAIGN_MONITOR_SHIFT_CONFIRMATION_EMAIL_ID`)**

- Variables: `{firstName}`, `{shiftType}`, `{shiftDate}`, `{shiftTime}`, `{location}`, `{linkToShift}`, `{addToCalendarLink}`, `{locationMapLink}`
- Used when shifts are confirmed (auto-approval or admin approval)

**Shift Cancellation - Manager (`CAMPAIGN_MONITOR_SHIFT_ADMIN_CANCELLATION_EMAIL_ID`)**

- Variables: `{managerName}`, `{volunteerName}`, `{volunteerEmail}`, `{shiftName}`, `{shiftDate}`, `{shiftTime}`, `{location}`, `{cancellationTime}`, `{remainingVolunteers}`, `{shiftCapacity}`
- Sent to restaurant managers when volunteers cancel

**Volunteer Cancellation (`CAMPAIGN_MONITOR_VOLUNTEER_CANCELLATION_EMAIL_ID`)**

- Variables: `{firstName}`, `{shiftType}`, `{shiftDate}`, `{shiftTime}`, `{location}`
- Sent to volunteers when admins cancel their shifts

**Shift Shortage (`CAMPAIGN_MONITOR_SHIFT_SHORTAGE_EMAIL_ID`)**

- Variables: `{firstName}`, `{shiftType}`, `{shiftDate}`, `{restarauntLocation}`, `{linkToEvent}`
- Sent to notify volunteers about shifts needing more volunteers

**Parental Consent Approval (`CAMPAIGN_MONITOR_PARENTAL_CONSENT_APPROVAL_EMAIL_ID`)**

- Variables: `{firstName}`, `{linkToDashboard}`
- Sent to volunteers under 16 when their parental consent is approved by an admin

**No-show Follow-up (`CAMPAIGN_MONITOR_NO_SHOW_EMAIL_ID`)**

- Variables: `{firstName}`, `{shiftType}`, `{shiftDate}`, `{shiftTime}`, `{location}`, `{browseShiftsLink}`
- Sent by the `/api/cron/no-show-emails` sweep once a shift has ended, to volunteers an admin marked as a no-show. Marking them present again before then means no email. Until the template ID is set, emails stay queued for up to 7 days.
- Agreed copy (Nov 2026):

  > Kia ora {firstName},
  >
  > We've recorded you as a no-show for a volunteer shift you were booked for: {shiftType} on {shiftDate}, {shiftTime} at {location}.
  >
  > When a volunteer doesn't turn up, it can leave the restaurant short on help and means a place that could have gone to another volunteer is unused.
  >
  > If you can't make a shift, please cancel it as soon as possible so we can offer the place to someone else.
  >
  > We understand things can come up, so if there was a reason you couldn't attend and weren't able to cancel in time, please get in touch with the team.
  >
  > Thanks for your help.
  >
  > Ngā mihi,
  > The Everybody Eats Team

**Label Alert (`CAMPAIGN_MONITOR_LABEL_ASSIGNED_EMAIL_ID`)**

- Variables: `{firstName}` (the admin being told), `{volunteerName}`, `{labelName}`, `{note}` (empty for labels that take no note), `{assignedBy}`, `{profileLink}`
- Sent to the admins watching a label (set on the label at `/admin/custom-labels`) whenever it is added to a volunteer. They also get an in-app notification and a push.

## 🤝 Contributing

This application helps coordinate volunteers for Everybody Eats' mission to reduce food waste, food insecurity, and social isolation in Aotearoa/New Zealand. 🌱

## 📚 Learn More

To learn more about the technologies used:

- 📖 [Next.js Documentation](https://nextjs.org/docs) - Learn about Next.js features and API
- 🗄️ [Prisma Documentation](https://www.prisma.io/docs) - Database toolkit and ORM
- 🎨 [Tailwind CSS](https://tailwindcss.com/docs) - Utility-first CSS framework
- 🧩 [Radix UI](https://www.radix-ui.com/) - Low-level UI primitives
