#!/bin/bash

# Script to run coverage tests with Babel config only during testing

# Copy babel config for coverage
cp .babelrc.coverage.js .babelrc.js

# Run coverage tests
COVERAGE=true NODE_ENV=test playwright test --config=playwright.coverage.config.ts
TEST_EXIT_CODE=$?

# Generate NYC report
npx nyc report

# Remove babel config to avoid build conflicts
rm .babelrc.js

# Exit with the test exit code
exit $TEST_EXIT_CODE