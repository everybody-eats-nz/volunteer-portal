# E2E Tests for Enhanced Shift Creation

This directory contains end-to-end tests for the enhanced admin shift creation system.

## Test Files

### `admin-shift-creation-form.spec.ts`
Tests the main shift creation form UI components:
- Form structure and layout
- Template management (CRUD operations)
- Date/time selection with calendar pickers
- Form field interactions
- Bulk creation workflow
- Accessibility features

### `shift-creation-validation.spec.ts`
Tests form validation functionality:
- Required field validation and browser validation behavior
- Input constraints (capacity min/max, number types)
- Time input validation and edge cases
- Template management validation (creation, editing)
- Shift type creation validation
- Error handling and form state preservation
- Cross-browser validation compatibility

### `api-shift-types.spec.ts`
Tests the shift types API endpoints:
- POST /api/admin/shift-types (create shift types)
- GET /api/admin/shift-types (list shift types)
- Authentication and authorization
- Input validation and error responses

## Prerequisites

**Important**: These tests require a fully functional development environment:

1. **Database**: PostgreSQL running on `localhost:5432` with the application schema
2. **Development Server**: Next.js dev server running on `localhost:3000`
3. **Admin User**: An admin user must be seeded in the database for authentication
4. **Prisma**: Database must be migrated and seeded

## Running the Tests

### Setup Environment
```bash
# Start database (example with Docker)
docker run --name postgres -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres

# Run migrations and seed data
cd web
npm run prisma:migrate
npm run prisma:seed

# Start development server
npm run dev
```

### Run Tests
```bash
# Run all shift creation tests
npx playwright test admin-shift-creation-form.spec.ts shift-creation-validation.spec.ts api-shift-types.spec.ts --project=chromium

# Run specific test file
npx playwright test admin-shift-creation-form.spec.ts --project=chromium

# Run with UI mode for debugging
npx playwright test admin-shift-creation-form.spec.ts --project=chromium --ui
```

## Test Focus Areas

### UI Component Testing
- ✅ Form structure and responsive layout
- ✅ Template management interface
- ✅ Calendar picker functionality
- ✅ Input field validation
- ✅ Tab navigation and accessibility
- ✅ Mobile responsiveness

### API Testing
- ✅ Shift type creation endpoint
- ✅ Authentication and authorization
- ✅ Input validation and error handling
- ✅ Response format verification

### Integration Testing
- ✅ Template application to form fields
- ✅ Bulk creation workflow
- ✅ Form submission and validation
- ✅ Error state handling

## Known Limitations

1. **Database Dependency**: Tests require a running database and cannot run in isolation
2. **Authentication Requirement**: Tests depend on seeded admin users for login
3. **Network Dependency**: Tests require the Next.js development server to be running
4. **Test Data**: Some tests may create test data that needs cleanup
5. **Browser Validation Variability**: Form validation behavior may vary between browsers
6. **Calendar Date Availability**: Calendar picker tests use first available dates which may vary

## Troubleshooting

### Common Issues

**"Can't reach database server"**
- Ensure PostgreSQL is running on localhost:5432
- Check DATABASE_URL in .env.local
- Run `npm run prisma:migrate` and `npm run prisma:seed`

**"Test timeout during login"**
- Verify admin user exists in database
- Check that development server is running
- Ensure authentication system is working

**"Element not visible" errors**
- Components may not be loading due to missing data
- Check browser console for JavaScript errors
- Verify shift types exist in database

### Debug Mode
```bash
# Run with debug output
DEBUG=pw:api npx playwright test admin-shift-creation-form.spec.ts --project=chromium

# Run in headed mode to see browser
npx playwright test admin-shift-creation-form.spec.ts --project=chromium --headed

# Generate test report
npx playwright test admin-shift-creation-form.spec.ts --project=chromium --reporter=html
```