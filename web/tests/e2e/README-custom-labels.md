# Custom Labels E2E Tests

This directory contains comprehensive end-to-end tests for the Custom Labels system.

## Test Files Overview

### 1. `custom-labels.spec.ts`
**Comprehensive test suite covering all major functionality:**
- ✅ Admin custom labels management (create, edit, delete)
- ✅ User label assignment on volunteer profiles
- ✅ Labels display on shifts management page
- ✅ Volunteer access restrictions and security
- ✅ Auto-labeling system (Under 18, New Volunteer)
- ✅ Form validation and error handling

**Total: 39 tests (13 test cases × 3 browsers)**

### 2. `custom-labels-focused.spec.ts`
**Focused integration tests using helper functions:**
- ✅ End-to-end label management workflow
- ✅ Auto-labeling for underage and adult users
- ✅ Security and access control verification
- ✅ UI validation and error handling
- ✅ Clean test data management

**Total: 21 tests (7 test cases × 3 browsers)**

### 3. `custom-labels-visual.spec.ts`
**Visual and UI integration tests:**
- ✅ Label styling and visual consistency
- ✅ Color picker and emoji selection
- ✅ Responsive design on mobile
- ✅ Loading states and transitions
- ✅ Empty state handling
- ✅ Layout consistency

**Total: 27 tests (9 test cases × 3 browsers)**

### 4. `helpers/custom-labels.ts`
**Helper functions for test automation:**
- Label creation, editing, and deletion
- User label assignment and removal
- Test user registration with age-based labeling
- Cleanup utilities
- Verification functions

## Running the Tests

### Run All Custom Labels Tests
```bash
# Run all custom labels tests across all browsers
npx playwright test custom-labels

# Run only in Chromium (recommended for development)
npx playwright test custom-labels --project=chromium
```

### Run Specific Test Files
```bash
# Comprehensive functionality tests
npx playwright test custom-labels.spec.ts --project=chromium

# Focused integration tests
npx playwright test custom-labels-focused.spec.ts --project=chromium

# Visual and UI tests
npx playwright test custom-labels-visual.spec.ts --project=chromium
```

### Run Specific Test Groups
```bash
# Test only admin functionality
npx playwright test custom-labels.spec.ts -g "Admin" --project=chromium

# Test only security restrictions
npx playwright test custom-labels.spec.ts -g "Volunteer Access Restrictions" --project=chromium

# Test only auto-labeling
npx playwright test custom-labels.spec.ts -g "Auto-Labeling" --project=chromium
```

### Run with UI Mode (Interactive)
```bash
npx playwright test custom-labels-focused.spec.ts --ui
```

### Debug Tests
```bash
# Run with debug mode
npx playwright test custom-labels-focused.spec.ts --debug --project=chromium

# Run headed (visible browser)
npx playwright test custom-labels.spec.ts --headed --project=chromium
```

## Test Coverage

### Core Functionality ✅
- [x] Custom label creation with validation
- [x] Label editing and deletion
- [x] Color and icon selection
- [x] User label assignment/removal
- [x] Labels display on user profiles
- [x] Labels display on shifts page

### Security & Access Control ✅
- [x] Admin-only access to label management
- [x] Volunteer access restrictions
- [x] API endpoint protection
- [x] UI visibility controls

### Auto-Labeling System ✅
- [x] "Under 18" label for minors during registration
- [x] "New Volunteer" label for fresh registrations
- [x] Label updates when profile changes
- [x] Age-based label removal when users turn 18

### UI/UX Testing ✅
- [x] Form validation and error states
- [x] Visual consistency with volunteer grades
- [x] Responsive design on mobile
- [x] Loading states and transitions
- [x] Empty state handling
- [x] Color picker functionality
- [x] Emoji selection interface

### Integration Testing ✅
- [x] Database operations (create, read, update, delete)
- [x] API endpoint integration
- [x] Real-time UI updates
- [x] Cross-component data flow
- [x] Seed data compatibility

## Test Data Requirements

### Prerequisites
1. **Admin User**: Tests require admin login functionality
2. **Volunteer Users**: Some tests need existing volunteer profiles
3. **Seed Data**: Tests expect basic custom labels from seed script
4. **Database**: Clean database state recommended for consistent results

### Seed Labels Expected
- Under 18 (orange with 🔞)
- New Volunteer (blue with ✨)
- Team Leader (purple with 👑)
- High Priority (red with 🚨)
- Needs Support (amber with 🤝)
- VIP (indigo with 💎)
- Mentor (teal with 🎓)

## Troubleshooting

### Common Issues

1. **Tests failing due to missing seed data**
   ```bash
   npm run prisma:seed
   ```

2. **Database connection issues**
   - Ensure PostgreSQL is running
   - Check DATABASE_URL in .env

3. **Timeout issues on slow systems**
   - Increase timeout in playwright.config.ts
   - Use `--project=chromium` for faster execution

4. **Authentication failures**
   - Verify quick-login buttons have correct test IDs
   - Check admin/volunteer test accounts exist

### Best Practices

1. **Run tests in Chromium only during development**
   ```bash
   npx playwright test custom-labels --project=chromium
   ```

2. **Use focused tests for faster feedback**
   ```bash
   npx playwright test custom-labels-focused.spec.ts --project=chromium
   ```

3. **Clean test environment**
   - Run `npm run prisma:reset` before critical test runs
   - Use unique names for test data to avoid conflicts

4. **Parallel execution**
   - Tests are designed to be independent
   - Can run in parallel across different test files
   - Avoid running same test file in parallel (data conflicts)

## Test Maintenance

### Adding New Tests
1. Use existing helper functions in `helpers/custom-labels.ts`
2. Follow established patterns from existing test files
3. Include cleanup logic for test data
4. Add appropriate test IDs to new UI components

### Updating Tests
- Update helper functions when UI changes
- Maintain test data compatibility
- Keep test descriptions clear and specific
- Use meaningful assertions with good error messages

### Test Data Cleanup
- Focused tests include automatic cleanup
- Manual cleanup available via helper functions
- Test users remain in system (by design)
- Labels can be manually cleaned up if needed