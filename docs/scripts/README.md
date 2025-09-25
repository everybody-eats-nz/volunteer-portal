# Documentation Screenshot System

This directory contains scripts for automatically generating screenshots of the Everybody Eats Volunteer Portal admin interface.

## Overview

The screenshot system uses Playwright to capture screenshots of key admin pages and automatically embeds them in the documentation. This ensures the documentation stays visually up-to-date with the actual application interface.

## Files

- `generate-screenshots.js` - Main script that captures screenshots using Playwright
- `README.md` - This documentation file

## Usage

### Manual Screenshot Generation

To generate screenshots locally:

```bash
# From the docs directory
cd docs

# Install dependencies (if not already done)
npm install

# Make sure the web app is running on localhost:3000
# Then generate screenshots
npm run screenshots:dev
```

### Automated Screenshot Generation

Screenshots are automatically generated via GitHub Actions:

1. **Manual Trigger**: Go to Actions → "Generate Documentation Screenshots" → "Run workflow"
2. **Scheduled**: Runs automatically every Sunday at 2 AM UTC
3. **Custom URL**: Can specify a different app URL when running manually

## Configuration

The screenshot script captures the following pages:

- Admin Dashboard (`/admin`)
- User Management (`/admin/users`) 
- Shift Management (`/admin/shifts`)
- Volunteer Dashboard (`/dashboard`)
- Shift Browsing (`/shifts`)
- Volunteer Profile (`/profile`)

## Environment Variables

- `DOCS_SCREENSHOT_URL` - Base URL of the app (default: http://localhost:3000)
- `ADMIN_EMAIL` - Admin login email (default: admin@test.com)
- `ADMIN_PASSWORD` - Admin login password (default: password123)

## Screenshot Settings

- **Resolution**: 1920x1080
- **Format**: PNG
- **Mode**: Full page screenshots
- **Browser**: Chromium (headless)
- **Animations**: Disabled for consistent screenshots

## Output

Screenshots are saved to: `docs/src/assets/images/screenshots/`

The system also generates a `metadata.json` file with information about when screenshots were generated and what pages were captured.

## Integration with Documentation

Screenshots are referenced in markdown files using Astro's asset path syntax:

```markdown
![Admin Dashboard](~/assets/images/screenshots/admin-dashboard.png)
```

## Troubleshooting

### Common Issues

1. **Authentication Fails**: Make sure the admin credentials are correct in environment variables
2. **Pages Don't Load**: Verify the app URL is accessible and the app is running
3. **Missing Dependencies**: Run `npm install` in the docs directory
4. **Browser Installation**: Run `npx playwright install --with-deps chromium`

### Debug Mode

To run with more verbose output:

```bash
DEBUG=pw:* npm run screenshots:dev
```

## Updating Screenshot Pages

To add new pages to screenshot, edit the `ADMIN_PAGES` array in `generate-screenshots.js`:

```javascript
{
  name: 'page-name',
  path: '/path/to/page',
  title: 'Page Title',
  description: 'Description for documentation'
}
```

Then add the corresponding image reference to the relevant documentation page.