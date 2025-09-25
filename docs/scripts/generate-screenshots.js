import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Screenshot configuration
const SCREENSHOTS_DIR = path.join(__dirname, '../public/images/screenshots');
const BASE_URL = process.env.DOCS_SCREENSHOT_URL || 'http://localhost:3000';

// Admin pages to screenshot
const ADMIN_PAGES = [
  {
    name: 'admin-dashboard',
    path: '/admin',
    title: 'Admin Dashboard Overview',
    description: 'Main admin dashboard showing key metrics and quick actions'
  },
  {
    name: 'admin-users',
    path: '/admin/users',
    title: 'User Management',
    description: 'Volunteer user management interface'
  },
  {
    name: 'admin-shifts',
    path: '/admin/shifts',
    title: 'Shift Management',
    description: 'Admin shift creation and management'
  },
  {
    name: 'volunteer-dashboard',
    path: '/dashboard',
    title: 'Volunteer Dashboard',
    description: 'Main volunteer dashboard view'
  },
  {
    name: 'volunteer-shifts-browse',
    path: '/shifts',
    title: 'Browse Shifts',
    description: 'Volunteer shift browsing interface'
  },
  {
    name: 'volunteer-profile',
    path: '/profile',
    title: 'Volunteer Profile',
    description: 'Volunteer profile management page'
  }
];

async function generateScreenshots() {
  console.log('🎬 Starting screenshot generation...');
  
  // Ensure screenshots directory exists
  await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });
  
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-web-security', '--disable-dev-shm-usage']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1
  });
  
  const page = await context.newPage();
  
  // Basic authentication setup (if needed)
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@test.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'password123';
  
  try {
    console.log('🔐 Setting up authentication...');
    
    // Login as admin using quick login button
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');
    
    // Click the admin quick login button
    const adminLoginButton = page.getByTestId('quick-login-admin-button');
    await adminLoginButton.click();
    
    // Wait for redirect after login
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
    
    console.log('✅ Authentication successful');
    
    // Take screenshots of each page
    for (const pageConfig of ADMIN_PAGES) {
      console.log(`📸 Capturing ${pageConfig.name}...`);
      
      try {
        await page.goto(`${BASE_URL}${pageConfig.path}`, { timeout: 60000 });
        await page.waitForLoadState('domcontentloaded');
        
        // Wait for any dynamic content to load
        await page.waitForTimeout(3000);
        
        // Remove any animations for cleaner screenshots
        await page.addStyleTag({
          content: `
            *, *::before, *::after {
              animation-duration: 0s !important;
              animation-delay: 0s !important;
              transition-duration: 0s !important;
              transition-delay: 0s !important;
            }
          `
        });
        
        const screenshotPath = path.join(SCREENSHOTS_DIR, `${pageConfig.name}.png`);
        
        await page.screenshot({
          path: screenshotPath,
          fullPage: true,
          animations: 'disabled'
        });
        
        console.log(`✅ Saved: ${pageConfig.name}.png`);
        
      } catch (error) {
        console.error(`❌ Failed to capture ${pageConfig.name}:`, error.message);
      }
    }
    
    // Generate metadata file for documentation
    const metadata = {
      generated: new Date().toISOString(),
      pages: ADMIN_PAGES,
      totalScreenshots: ADMIN_PAGES.length
    };
    
    await fs.writeFile(
      path.join(SCREENSHOTS_DIR, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );
    
    console.log('📝 Generated metadata file');
    
  } catch (error) {
    console.error('❌ Screenshot generation failed:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
  
  console.log('🎉 Screenshot generation completed!');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateScreenshots().catch(console.error);
}

export { generateScreenshots, ADMIN_PAGES };