#!/usr/bin/env tsx
/**
 * Historical Shift Data Scraper for Laravel Nova Backend
 * 
 * This script scrapes historical volunteer shift data from the legacy Laravel Nova
 * system and imports it into the new Next.js/Prisma system to preserve user history.
 * 
 * Usage:
 * npm run scrape-historical-shifts -- --config config.json
 * npm run scrape-historical-shifts -- --nova-url https://app.everybodyeats.nz --email admin@example.com --password password
 * 
 * Options:
 * --config: Path to JSON config file
 * --nova-url: Laravel Nova base URL
 * --email: Admin email for authentication
 * --password: Admin password
 * --dry-run: Test run without making database changes
 * --output: Save scraped data to file
 */

import fs from 'fs';
import path from 'path';
import { createNovaScraper, NovaAuthConfig } from '../src/lib/laravel-nova-scraper';
import { importHistoricalData, TransformationOptions } from '../src/lib/historical-data-transformer';
import { ScrapedData } from '../src/types/nova-migration';

interface Config {
  novaUrl: string;
  email: string;
  password: string;
  dryRun?: boolean;
  outputFile?: string;
  transformationOptions?: TransformationOptions;
}

interface ScriptOptions {
  config?: string;
  novaUrl?: string;
  email?: string;
  password?: string;
  dryRun?: boolean;
  output?: string;
  help?: boolean;
}

function parseArgs(): ScriptOptions {
  const args = process.argv.slice(2);
  const options: ScriptOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--config':
        options.config = args[++i];
        break;
      case '--nova-url':
        options.novaUrl = args[++i];
        break;
      case '--email':
        options.email = args[++i];
        break;
      case '--password':
        options.password = args[++i];
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--output':
        options.output = args[++i];
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        console.warn(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function showHelp() {
  console.log(`
Historical Shift Data Scraper

This script scrapes historical volunteer shift data from a Laravel Nova backend
and imports it into the current system to preserve user history during migration.

Usage:
  npm run scrape-historical-shifts -- [options]

Options:
  --config <file>        Path to JSON configuration file
  --nova-url <url>       Laravel Nova base URL (e.g., https://app.everybodyeats.nz)
  --email <email>        Admin email for authentication
  --password <password>  Admin password
  --dry-run             Perform test run without making database changes
  --output <file>       Save scraped data to JSON file
  --help, -h            Show this help message

Examples:
  # Using config file
  npm run scrape-historical-shifts -- --config nova-config.json

  # Using direct parameters
  npm run scrape-historical-shifts -- --nova-url https://app.everybodyeats.nz --email admin@example.com --password mypassword

  # Dry run to test without changes
  npm run scrape-historical-shifts -- --config config.json --dry-run

  # Save scraped data to file for later analysis
  npm run scrape-historical-shifts -- --config config.json --output scraped-data.json

Config file format (JSON):
{
  "novaUrl": "https://app.everybodyeats.nz",
  "email": "admin@example.com", 
  "password": "your-password",
  "dryRun": false,
  "outputFile": "historical-data.json",
  "transformationOptions": {
    "skipExistingUsers": true,
    "skipExistingShifts": true,
    "markAsMigrated": true
  }
}
`);
}

function loadConfig(configPath: string): Config {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  try {
    const configContent = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(configContent);
  } catch (error) {
    throw new Error(`Failed to parse config file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function validateConfig(config: Config): void {
  if (!config.novaUrl) {
    throw new Error('Nova URL is required');
  }
  if (!config.email) {
    throw new Error('Email is required');
  }
  if (!config.password) {
    throw new Error('Password is required');
  }

  // Validate URL format
  try {
    new URL(config.novaUrl);
  } catch {
    throw new Error('Invalid Nova URL format');
  }
}

async function saveScrapedData(data: ScrapedData, outputFile: string): Promise<void> {
  const outputPath = path.resolve(outputFile);
  const outputDir = path.dirname(outputPath);

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`✅ Scraped data saved to: ${outputPath}`);
}

async function main() {
  console.log('🚀 Starting Historical Shift Data Scraper\n');

  try {
    const options = parseArgs();

    if (options.help) {
      showHelp();
      process.exit(0);
    }

    // Load configuration
    let config: Config;
    if (options.config) {
      console.log(`📄 Loading config from: ${options.config}`);
      config = loadConfig(options.config);
    } else {
      // Build config from CLI arguments
      if (!options.novaUrl || !options.email || !options.password) {
        console.error('❌ Error: Missing required arguments. Use --help for usage information.');
        process.exit(1);
      }
      
      config = {
        novaUrl: options.novaUrl,
        email: options.email,
        password: options.password,
      };
    }

    // Override config with CLI options
    if (options.dryRun !== undefined) config.dryRun = options.dryRun;
    if (options.output) config.outputFile = options.output;

    validateConfig(config);

    console.log(`🔗 Connecting to Laravel Nova: ${config.novaUrl}`);
    console.log(`👤 Authenticating as: ${config.email}`);
    if (config.dryRun) {
      console.log('🧪 Running in DRY RUN mode - no database changes will be made');
    }
    console.log('');

    // Create Nova scraper
    const novaConfig: NovaAuthConfig = {
      baseUrl: config.novaUrl,
      email: config.email,
      password: config.password,
    };

    const scraper = await createNovaScraper(novaConfig);

    // Scrape all historical data
    console.log('📡 Starting data scrape...');
    const scrapedData = await scraper.scrapeAllData();

    console.log('\n📊 Scraping Results:');
    console.log(`   Users: ${scrapedData.metadata.totalUsers}`);
    console.log(`   Events: ${scrapedData.metadata.totalEvents}`);
    console.log(`   Signups: ${scrapedData.metadata.totalSignups}`);
    console.log(`   Date Range: ${scrapedData.metadata.dateRange.earliest} to ${scrapedData.metadata.dateRange.latest}`);

    // Save scraped data if requested
    if (config.outputFile) {
      await saveScrapedData(scrapedData, config.outputFile);
    }

    // Transform and import data
    console.log('\n🔄 Starting data transformation and import...');
    const transformationOptions: TransformationOptions = {
      dryRun: config.dryRun,
      skipExistingUsers: true,
      skipExistingShifts: true,
      markAsMigrated: true,
      ...config.transformationOptions,
    };

    const result = await importHistoricalData(scrapedData, transformationOptions);

    // Display results
    console.log('\n📈 Import Results:');
    console.log(`   Users processed: ${result.stats.usersProcessed}`);
    console.log(`   Users created: ${result.stats.usersCreated}`);
    console.log(`   Users skipped: ${result.stats.usersSkipped}`);
    console.log(`   Shift types created: ${result.stats.shiftTypesCreated}`);
    console.log(`   Shifts processed: ${result.stats.shiftsProcessed}`);
    console.log(`   Shifts created: ${result.stats.shiftsCreated}`);
    console.log(`   Shifts skipped: ${result.stats.shiftsSkipped}`);
    console.log(`   Signups processed: ${result.stats.signupsProcessed}`);
    console.log(`   Signups created: ${result.stats.signupsCreated}`);
    console.log(`   Signups skipped: ${result.stats.signupsSkipped}`);

    if (result.errors.length > 0) {
      console.log(`\n⚠️  Errors encountered: ${result.errors.length}`);
      result.errors.slice(0, 10).forEach((error, index) => {
        console.log(`   ${index + 1}. ${error.type} ${error.id}: ${error.error}`);
      });
      if (result.errors.length > 10) {
        console.log(`   ... and ${result.errors.length - 10} more errors`);
      }
    }

    if (result.success) {
      console.log('\n✅ Historical data import completed successfully!');
      if (config.dryRun) {
        console.log('🧪 This was a dry run - no actual changes were made to the database.');
        console.log('   Remove --dry-run flag to perform the actual import.');
      }
    } else {
      console.log('\n❌ Historical data import failed. Check the errors above.');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main };