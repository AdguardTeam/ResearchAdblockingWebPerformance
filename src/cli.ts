/* eslint-disable no-console */
import { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import { format } from 'date-fns';

import { MetricsCollector } from './metrics-collector';
import { logger } from './utils/logger';
import { generateReport } from './report-generator/report-generator';
import { version } from '../package.json';
import { TestEnvironment, TestEnvironmentType } from './types';

// Constants
const DEFAULT_HAR_FILENAME = 'har-results.har';
const DEFAULT_REPORT_DIR = 'report';
const DEFAULT_EXIT_CODE = {
    SUCCESS: 0,
    ERROR: 1,
};
const TIMESTAMP_FORMAT = 'yyyy-MM-dd_HH-mm-ss';

/**
 * Interface for CLI options
 */
interface CliOptions {
    environment: TestEnvironmentType;
    file?: string;
    limit?: number;
    domain?: string;
    proxyServer?: string;
    har?: string | boolean;
    withExtension?: boolean;
    verbose?: boolean;
    outputFile?: string;
}

/**
 * Interface for Report Command options
 */
interface ReportCommandOptions {
    input: string;
    reportOutput: string;
    verbose?: boolean;
}

/**
 * Custom error class for CLI validation errors
 */
class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ValidationError';
    }
}

/**
 * Validates that a file exists and is readable
 */
function validateFile(filePath?: string): string | never {
    if (!filePath) {
        throw new ValidationError('File path is required');
    }

    const resolvedPath = path.resolve(process.cwd(), filePath);

    try {
        if (!fs.existsSync(resolvedPath)) {
            throw new ValidationError(`File does not exist: ${resolvedPath}`);
        }

        const stats = fs.statSync(resolvedPath);
        if (!stats.isFile()) {
            throw new ValidationError(`Path is not a file: ${resolvedPath}`);
        }

        // Try to read the file to ensure it's readable
        fs.accessSync(resolvedPath, fs.constants.R_OK);

        return resolvedPath;
    } catch (error) {
        if (error instanceof ValidationError) {
            throw error;
        }
        throw new ValidationError(`Cannot access file: ${resolvedPath} - ${(error as Error).message}`);
    }
}

/**
 * Ensures a directory exists, creates it if necessary
 */
function ensureDirectoryExists(dirPath: string): void {
    const resolvedPath = path.resolve(process.cwd(), dirPath);
    if (!fs.existsSync(resolvedPath)) {
        try {
            fs.mkdirSync(resolvedPath, { recursive: true });
            logger.info(`Created directory: ${resolvedPath}`);
        } catch (error) {
            throw new ValidationError(`Could not create directory: ${resolvedPath} - ${(error as Error).message}`);
        }
    }
}

// Initialize Commander
const program = new Command();

// Define the possible environments using the enum
const ENVIRONMENTS = Object.values(TestEnvironment);

/**
 * Runs the metrics collection process based on CLI options
 */
async function runMetricsCollection(options: CliOptions) {
    logger.setVerbose(!!options.verbose);

    // Validate environment
    if (!ENVIRONMENTS.includes(options.environment)) {
        throw new ValidationError(`Invalid test environment: ${options.environment}. Valid options are: ${ENVIRONMENTS.join(', ')}`);
    }

    // Validate file option when no domain is specified
    if (!options.domain && !options.file) {
        throw new ValidationError('Please specify either a domains file (-f, --file) or a single domain (-d, --domain)');
    }

    // Constants based on options
    let domainsListFile: string | undefined;
    if (options.file) {
        domainsListFile = validateFile(options.file);
    }

    let domain: string | undefined;
    if (options.domain) {
        domain = options.domain;
    }

    const TEST_ENVIRONMENT = options.environment;
    const DOMAINS_LIMIT = options.limit;

    // Validate numeric limit if provided
    if (DOMAINS_LIMIT !== undefined && (Number.isNaN(DOMAINS_LIMIT) || DOMAINS_LIMIT <= 0)) {
        throw new ValidationError(`Invalid limit value: ${options.limit}. Must be a positive number.`);
    }

    // Retrieve the withExtension flag
    const withExtension = !!options.withExtension;

    // Generate default output filename if not provided
    let outputFile: string = options.outputFile || '';
    if (!options.outputFile) {
        const timestamp = format(new Date(), TIMESTAMP_FORMAT);
        outputFile = `${TEST_ENVIRONMENT}_${timestamp}`;
    }

    const metricsCollector = new MetricsCollector(!!options.verbose);

    // Determine HAR collection settings
    let harPath: string | undefined;
    if (options.har !== undefined) {
        if (typeof options.har === 'string') {
            // User provided a path: enable HAR collection with the specified path
            harPath = options.har;

            // Ensure the directory exists
            const harDir = path.dirname(path.resolve(process.cwd(), harPath));
            ensureDirectoryExists(harDir);
        } else {
            // User enabled HAR collection without specifying a path: use default path
            harPath = DEFAULT_HAR_FILENAME;
        }
    }

    const collectionOptions = {
        proxyServer: options.proxyServer,
        testEnvironment: TEST_ENVIRONMENT,
        harPath,
        withExtension,
        outputFile,
    };

    if (domain) {
        // Process the single domain specified
        logger.info(`Processing single domain: ${domain}`);
        await metricsCollector.processSingleDomainPuppeteer(domain, collectionOptions);
    } else if (domainsListFile) {
        // Process domains from the file
        logger.info(`Processing domains from file: ${domainsListFile}`);
        if (DOMAINS_LIMIT) {
            logger.info(`Limited to ${DOMAINS_LIMIT} domains`);
        }

        await metricsCollector.processDomainsPuppeteer({
            domainsFile: domainsListFile,
            limit: DOMAINS_LIMIT,
            ...collectionOptions,
        });
    }
}

// Define global options (shared by multiple commands if needed)
program
    .name('adblock-research-cli')
    .description('CLI for running adblock metrics collection and generating reports')
    .version(version, '--version')
    .showHelpAfterError('(add --help for additional information)')
    .addHelpText('after', `
Examples:
  $ bun src/cli.ts -e none -f domains.txt          # Process domains with no adblocker
  $ bun src/cli.ts -e baseline -d example.com -h   # Single domain baseline with HAR
  $ bun src/cli.ts -e dns -f domains.txt -l 5      # Limited domains with DNS blocking
  $ bun src/cli.ts -e extension -f domains.txt -x  # Extension blocking with extension enabled
  $ bun src/cli.ts generate-report -i results.json # Generate a report

Note: This CLI tool runs with Bun, not Node.js. Make sure Bun is installed.
    `);

// Add options to the default command
program
    .option(
        '-e, --environment <type>',
        `Test environment: ${ENVIRONMENTS.join(', ')}`,
        TestEnvironment.None,
    )
    .option(
        '-f, --file <path>',
        'Path to the domains list file (one domain per line)',
    )
    .option('-l, --limit <number>', 'Limit the number of domains to process', parseInt)
    .option('-d, --domain <domain>', 'Process a single domain (alternative to -f)')
    .option('-p, --proxy-server <proxy_server:port>', 'Proxy server to use for requests')
    .option(
        '-h, --har [path]',
        `Enable HAR collection (default path: ${DEFAULT_HAR_FILENAME})`,
    )
    .option('-x, --with-extension', 'Run with the extension enabled')
    .option('-v, --verbose', 'Enable verbose logging')
    .option('-o, --output-file <filename>', 'Specify the output filename (without extension)');

// Add the 'generate-report' command
program
    .command('generate-report')
    .description('Generate an HTML report from metrics files')
    .requiredOption('-i, --input <files>', 'Comma-separated list of input JSON files')
    .option('-r, --report-output <path>', `Output dir path (default: ${DEFAULT_REPORT_DIR})`, DEFAULT_REPORT_DIR)
    .action(async (options: ReportCommandOptions) => {
        logger.setVerbose(!!options.verbose);

        try {
            const inputFiles = options.input.split(',').map((file) => {
                return validateFile(file.trim());
            });

            const reportOutputPath = path.resolve(process.cwd(), options.reportOutput);

            // Create output directory if it doesn't exist
            ensureDirectoryExists(reportOutputPath);

            await generateReport(inputFiles, reportOutputPath);
            logger.info(`Report generated at ${reportOutputPath}`);
        } catch (error) {
            if (error instanceof ValidationError) {
                logger.error(`Validation error: ${error.message}`);
            } else {
                logger.error(`Error generating report: ${(error as Error).message}`);
            }
            process.exit(DEFAULT_EXIT_CODE.ERROR);
        }
    });

// Define the default action (no command specified)
program.action(async (options: CliOptions) => {
    try {
        await runMetricsCollection(options);
    } catch (error) {
        if (error instanceof ValidationError) {
            logger.error(`Validation error: ${error.message}`);
        } else {
            logger.error(`Error during metrics collection: ${(error as Error).message}`);
            if (options.verbose) {
                console.error(error);
            }
        }
        process.exit(DEFAULT_EXIT_CODE.ERROR);
    }

    logger.info('Metrics collection completed successfully');
    process.exit(DEFAULT_EXIT_CODE.SUCCESS);
});

program.parse(process.argv);
