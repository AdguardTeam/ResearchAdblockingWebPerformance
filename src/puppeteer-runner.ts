import puppeteer, { Browser } from 'puppeteer';
import path from 'path';
import HAR from 'puppeteer-har';
import tldts from 'tldts';
import { format } from 'date-fns';
import fsExtra from 'fs-extra';
// @ts-ignore
import { type Configuration } from '@adguard/tswebextension/mv3';
// @ts-ignore
import { type PreprocessedFilterList } from '@adguard/tswebextension';
import { sleep } from './utils/time';
import { logger } from './utils/logger';
import { isThirdParty } from './utils/url';
import { extractZipFile, ensureEmptyDir } from './utils/file';

// TODO: Add this option to CLI arguments
const ENABLE_SCREENSHOTS = false;

export type PuppeteerResults = {
    domContentLoadTimeMs: number;
    loadTimeMs: number;
    weight: {
        totalBytes: number;
        thirdPartyBytes: number;
    };
    requests: {
        totalRequests: number;
        blockedRequests: number;
        notBlockedRequests: number;
        thirdPartyRequests: number;
        thirdPartyBlockedRequests: number;
        thirdPartyNotBlockedRequests: number;
        hostnames: Record<string, number>,
        etldPlus1s: Record<string, number>,
    };
};

// Path to zipped extension
const extensionZipPath = path.resolve(process.cwd(), 'src/extension/chrome-mv3.zip');
// Path to unpacked extension
const unpackedExtensionPath = path.resolve(process.cwd(), 'tmp/chrome-mv3');

/**
 * Extracts a zip file to the specified directory and returns the path
 *
 * @param zipPath Path to the zip file
 * @returns Path to the extracted directory
 */
async function extractExtensionToDir(zipPath: string): Promise<string> {
    if (!fsExtra.existsSync(zipPath)) {
        throw new Error(`Extension zip file does not exist at path: ${zipPath}`);
    }

    // Clear the destination directory if it exists and create a new empty one
    await ensureEmptyDir(unpackedExtensionPath);
    logger.info(`Extracting extension to directory: ${unpackedExtensionPath}`);

    try {
        await extractZipFile(zipPath, unpackedExtensionPath);
        return unpackedExtensionPath;
    } catch (error) {
        logger.error(`Failed to extract extension: ${error}`);
        throw new Error(`Failed to extract extension: ${error}`);
    }
}

/**
 * Set configuration for TsWebExtension via deserialize it.
 *
 * @param configuration Configuration.
 */
export const setTsWebExtensionConfig = async (configuration: SerializedConfiguration): Promise<void> => {
    // @ts-ignore
    // eslint-disable-next-line no-restricted-globals
    if (!self.adguard.configure) {
        // @ts-ignore
        // eslint-disable-next-line no-restricted-globals, max-len
        throw new Error(`self.adguard.configure is not found in Window object, available keys in window ${Object.keys(self)}.`);
    }

    const deserializedConfiguration: Configuration = {
        ...configuration,
    };

    // @ts-ignore
    // eslint-disable-next-line no-restricted-globals
    await self.adguard.configure(deserializedConfiguration);
};

/**
 * Wait until extension initialized and we can start tests.
 *
 * @param eventName Event name.
 *
 * @returns Promise that resolves when extension initialized.
 */
export const waitUntilExtensionInitialized = async (eventName: string): Promise<void> => {
    return new Promise((resolve: () => void) => {
        // @ts-ignore
        // eslint-disable-next-line no-restricted-globals
        self.addEventListener(eventName, resolve, { once: true });
    });
};

export const EXTENSION_INITIALIZED_EVENT = 'initialized';

/**
 * This is just a syntax sugar for setting default value if we not have
 * preprocessed list for user rules or for custom filters.
 */
export const emptyPreprocessedFilterList: PreprocessedFilterList = {
    filterList: [],
    sourceMap: {},
    rawFilterList: '',
    conversionMap: {},
};

/**
 * Serialized configuration needed because when we pass object with not-primitive
 * fields to background page (service worker), playwright will use serialization
 * (possibly to JSON) and then our fields like UInt8Array became invalid.
 */
export type SerializedConfiguration = Omit<Configuration, 'userrules'> & {
    userrules: Omit<Configuration['userrules'], 'filterList'> & {
        filterList: number[][];
    };
};

export const DEFAULT_EXTENSION_CONFIG: Configuration = {
    staticFiltersIds: [],
    customFilters: [],
    allowlist: [],
    userrules: {
        ...emptyPreprocessedFilterList,
        trusted: true,
    },
    quickFixesRules: {
        ...emptyPreprocessedFilterList,
        trusted: true,
    },
    verbose: false,
    filtersPath: 'filters',
    ruleSetsPath: 'filters/declarative',
    declarativeLogEnabled: false,
    settings: {
        // Url can be empty because it is not using during tests.
        assistantUrl: '',
        gpcScriptUrl: '',
        hideDocumentReferrerScriptUrl: '',
        collectStats: true,
        allowlistEnabled: true,
        allowlistInverted: false,
        stealthModeEnabled: false,
        filteringEnabled: true,
        debugScriptlets: false,
        stealth: {
            blockChromeClientData: true,
            hideReferrer: true,
            hideSearchQueries: true,
            sendDoNotTrack: true,
            blockWebRTC: true,
            selfDestructThirdPartyCookies: true,
            selfDestructThirdPartyCookiesTime: 3600,
            selfDestructFirstPartyCookies: true,
            selfDestructFirstPartyCookiesTime: 3600,
        },
    },
};

interface CollectStatsOptions {
    environment: string;
    url: string;
    domain: string;
    harPath?: string;
}

export class PuppeteerRunner {
    private browser: Browser | null = null;

    private verbose: boolean;

    constructor(verbose = false) {
        this.verbose = verbose;
    }

    async launchBrowser(proxyServer?: string, withExtension = false) {
        const args = [
            '--remote-debugging-port=9222',
            '--ignore-certificate-errors',
            '--ignore-certificate-errors-spki-list',
            '--no-sandbox',
        ];

        if (proxyServer) {
            args.push(`--proxy-server=${proxyServer}`);
        }

        if (withExtension) {
            try {
                logger.info(`Extracting extension from zip: ${extensionZipPath}`);
                const pathToExtension = await extractExtensionToDir(extensionZipPath);
                args.push(`--disable-extensions-except=${pathToExtension}`);
                args.push(`--load-extension=${pathToExtension}`);
            } catch (error) {
                logger.error(`Failed to load extension: ${error}`);
                throw new Error(`Unable to load extension: ${error}`);
            }
        }

        const launchOptions = {
            args,
            headless: true,
            defaultViewport: {
                width: 1920,
                height: 1080,
            },
        };

        logger.debug(`Launching browser with options: ${JSON.stringify(launchOptions)}`);

        this.browser = await puppeteer.launch(launchOptions);

        if (withExtension) {
            await this.initializeExtension();
        }

        logger.info('Browser launched successfully');
    }

    private async initializeExtension() {
        if (!this.browser) {
            throw new Error('Browser is not launched');
        }

        logger.info('Looking for background page...');
        const backgroundTarget = await this.browser.waitForTarget((target) => {
            return target.type() === 'service_worker'
                && target.url().endsWith('background.js');
        });
        const background = await backgroundTarget.worker();
        if (!background) {
            throw new Error('Background page not found');
        }
        logger.info('Background page found');
        logger.info('Waiting for extension initialization...');
        await background.evaluate(waitUntilExtensionInitialized, EXTENSION_INITIALIZED_EVENT);
        logger.info('Extension initialized');
        // TODO fix in the extension
        // after installation extension configures twice, that is why we are waiting
        await sleep(5000);
        const configuration: SerializedConfiguration = {
            ...DEFAULT_EXTENSION_CONFIG,
            staticFiltersIds: [
                1, // AdGuard Russian filter
                2, // AdGuard Base filter
                3, // AdGuard Tracking Protection filter
                4, // AdGuard Social Media filter
                6, // AdGuard German filter
                9, // spanish/portuguese
                16, // AdGuard French filter
                17, // AdGuard URL Tracking filter
                18, // AdGuard Cookie Notices filter
                19, // AdGuard Popups filter
                20, // AdGuard Mobile App Banners filter
                21, // AdGuard Other Annoyances filter
                22, // AdGuard Widgets filter
                216, // polish
                227, // korean
                208, // Online Malicious URL Blocklist
            ],
        };
        logger.info(`Setting configuration: ${JSON.stringify(configuration)}}`);
        await background.evaluate(
            setTsWebExtensionConfig,
            configuration,
        );
        logger.info('Configuration set');
    }

    async closeBrowser() {
        if (this.browser) {
            await this.browser.close();
            logger.info('Puppeteer browser closed');
            this.browser = null;
        }
    }

    /**
     * Load page twice to get rid of the first-time loading effect
     * @param url URL to warm up
     */
    public async warmUp(url: string) {
        if (!this.browser) {
            throw new Error('Browser is not launched');
        }

        const page = await this.browser.newPage();

        logger.debug(`Navigating to ${url} to warm up cache`);

        try {
            await page.goto(url, { waitUntil: 'load', timeout: 60000 });
            logger.debug(`Page loaded successfully (warm-up): ${url}`);
        } catch (error) {
            logger.error(`Error during page.goto (warm-up): ${error}`);
            throw error;
        } finally {
            await page.close();
        }
    }

    async collectStats(options: CollectStatsOptions): Promise<PuppeteerResults> {
        const { url, harPath } = options;
        if (!this.browser) {
            throw new Error('Browser is not launched');
        }

        const page = await this.browser.newPage();

        let domContentLoadTimeMs = 0;
        let loadTimeMs = 0;

        const navigationStart = Date.now();

        // Set up CDP session and enable Network domain
        const client = await page.createCDPSession();

        logger.debug('CDP session created');

        // Clear cookies
        await client.send('Network.clearBrowserCookies');
        // Clear cache
        await client.send('Network.clearBrowserCache');
        // Disable cache
        await client.send('Network.setCacheDisabled', { cacheDisabled: true });
        await client.send('Network.enable');

        logger.debug('Network cache cleared and disabled');
        logger.debug('Network domain enabled');

        // Set up network conditions for Fast 4G
        await client.send('Network.emulateNetworkConditions', {
            offline: false,
            downloadThroughput: (4 * 1024 * 1024) / 8, // Fast 4G download in bytes per second
            uploadThroughput: (3 * 1024 * 1024) / 8, // Fast 4G upload in bytes per second
            latency: 20, // Fast 4G latency in ms
        });

        logger.debug('Network conditions emulated for Fast 4G');

        interface RequestInfo {
            requestId: string;
            requestUrl: string;
            responseUrl?: string;
            statusCode?: number;
            headers?: Record<string, string>;
            thirdParty: boolean;
            encodedDataLength?: number;
            errorText?: string;
            failed?: boolean;
            isAdGuardResource?: boolean;
            isBlocked?: boolean;
        }

        const requests = new Map<string, RequestInfo>();

        // Collect request data
        client.on('Network.requestWillBeSent', (params) => {
            const { requestId, request } = params;
            const requestUrl = request.url;

            // Ignore data URIs and internal URLs
            if (
                requestUrl.startsWith('data:')
                || requestUrl.startsWith('chrome-extension://')
            ) {
                return;
            }

            requests.set(requestId, {
                requestId,
                requestUrl,
                thirdParty: isThirdParty(url, requestUrl),
            });

            logger.debug(`Request will be sent: ${requestUrl}`);
        });

        // Collect response data
        client.on('Network.responseReceived', (params) => {
            const { requestId, response } = params;
            const entry = requests.get(requestId);
            if (!entry) {
                return;
            }

            entry.responseUrl = response.url;
            entry.statusCode = response.status;
            entry.headers = response.headers;

            logger.debug(`Response received for ${response.url} with status ${response.status}`);
        });

        // Collect loading finished data
        client.on('Network.loadingFinished', (params) => {
            const { requestId, encodedDataLength } = params;
            const entry = requests.get(requestId);
            if (!entry) {
                return;
            }

            entry.encodedDataLength = encodedDataLength;

            logger.debug(`Loading finished for ${entry.responseUrl} with size ${encodedDataLength} bytes`);
        });

        // Collect failed requests data
        client.on('Network.loadingFailed', (params) => {
            const { requestId, errorText } = params;
            const entry = requests.get(requestId);
            if (entry) {
                entry.errorText = errorText;
                entry.failed = true;

                logger.debug(`Loading failed for ${entry.requestUrl}: ${errorText}`);
            }
        });

        page.on('domcontentloaded', () => {
            domContentLoadTimeMs = Date.now() - navigationStart;
            logger.debug(`DOM content loaded in ${domContentLoadTimeMs} ms`);
        });

        page.on('load', () => {
            loadTimeMs = Date.now() - navigationStart;
            logger.debug(`Page fully loaded in ${loadTimeMs} ms`);
        });

        let har;
        if (harPath) {
            har = new HAR(page);
            await har.start({ path: harPath });
            logger.debug(`HAR recording started, saving to ${harPath}`);
        }

        logger.info(`Navigating to ${url}`);

        try {
            await page.goto(url, { waitUntil: 'load', timeout: 60000 });
            logger.info(`Page loaded successfully: ${url}`);
        } catch (error) {
            logger.error(`Error during page.goto: ${error}`);
        }

        // scroll page to the bottom, because some requests start firing only after scrolling
        await page.evaluate(() => {
            // @ts-ignore
            window.scrollTo(0, document.body.scrollHeight);
        });

        // Wait to ensure all network activity is captured
        await sleep(5000);

        if (ENABLE_SCREENSHOTS) {
            // Take screenshot before closing everything
            const date = new Date();
            const formattedDate = format(date, 'yyyy-MM-dd-HH-mm-ss-SSS');
            const screenshotsDir = path.resolve(process.cwd(), 'dist', 'screenshots');
            await fsExtra.ensureDir(screenshotsDir);

            const screenshotPath = path.resolve(
                screenshotsDir,
                `${options.environment}-${options.domain}-${formattedDate}.png`,
            );

            await page.screenshot({
                path: screenshotPath,
                fullPage: true,
            });

            logger.info(`Screenshot saved to ${screenshotPath}`);
        }

        await client.detach(); // Clean up the CDP session

        if (har) {
            await har.stop();
            logger.debug('HAR recording stopped');
        }

        await page.close();

        // Process collected data
        let totalRequests = 0;
        let blockedRequests = 0;
        let notBlockedRequests = 0;
        let thirdPartyRequests = 0;
        let thirdPartyBlockedRequests = 0;
        let thirdPartyNotBlockedRequests = 0;
        let totalBytes = 0;
        let thirdPartyBytes = 0;
        const hostnames = new Map<string, number>();
        const etldPlus1s = new Map<string, number>();

        for (const entry of requests.values()) {
            // Determine if the request is from AdGuard
            if (entry.responseUrl?.startsWith('https://local.adguard.org/')) {
                entry.isAdGuardResource = true;
                logger.debug(`Skipping AdGuard resource: ${entry.responseUrl}`);
                // eslint-disable-next-line no-continue
                continue;
            }

            // Determine if the response is blocked
            // Note: Chrome is inconsistent in how it reports blocked requests:
            // The same request blocked by content blockers may be reported either as
            // ERR_BLOCKED_BY_CLIENT or ERR_FAILED, so we treat both as blocked
            const isBlocked = entry.statusCode === 500
                || entry.errorText === 'net::ERR_NAME_NOT_RESOLVED'
                || entry.errorText === 'net::ERR_BLOCKED_BY_CLIENT'
                || entry.errorText === 'net::ERR_CONNECTION_REFUSED' // blocked by dns
                || entry.errorText === 'net::ERR_UNSAFE_REDIRECT' // blocked by extension
                || entry.errorText === 'net::ERR_FAILED';

            const isBlockedByExtension = (entry.statusCode === 204 && entry.errorText === 'net::ERR_ABORTED') || entry.responseUrl?.startsWith('chrome-extension://');

            entry.isBlocked = isBlocked || isBlockedByExtension;

            totalRequests += 1;
            if (entry.thirdParty) {
                thirdPartyRequests += 1;
            }

            const encodedDataLength = entry.encodedDataLength || 0;
            totalBytes += encodedDataLength;

            if (entry.thirdParty) {
                thirdPartyBytes += encodedDataLength;
            }

            if (entry.isBlocked) {
                blockedRequests += 1;
                if (entry.thirdParty) {
                    thirdPartyBlockedRequests += 1;
                }
            } else {
                notBlockedRequests += 1;
                if (entry.thirdParty) {
                    thirdPartyNotBlockedRequests += 1;
                }
                const res = tldts.parse(entry.requestUrl);
                if (res.hostname) {
                    hostnames.set(res.hostname, (hostnames.get(res.hostname) || 0) + 1);
                }
                if (res.domain) {
                    etldPlus1s.set(res.domain, (etldPlus1s.get(res.domain) || 0) + 1);
                }
            }
        }

        logger.info('Summary of collected data:');
        logger.info(`  Total requests: ${totalRequests}`);
        logger.info(`  Total requests (blocked): ${blockedRequests}`);
        logger.info(`  Total requests (not blocked): ${notBlockedRequests}`);
        logger.info(`  Total third-party requests: ${thirdPartyRequests}`);
        logger.info(`  Total third-party requests (blocked): ${thirdPartyBlockedRequests}`);
        logger.info(`  Total third-party requests (not blocked): ${thirdPartyNotBlockedRequests}`);
        logger.info(`  Total bytes: ${totalBytes}`);
        logger.info(`  Total third-party bytes: ${thirdPartyBytes}`);

        // Optionally, save data to a file only if verbose mode is enabled
        if (this.verbose) {
            const dataArray = Array.from(requests.values());
            const date = new Date();
            const formattedDate = format(date, 'yyyy-MM-dd-HH-mm-ss-SSS');
            const runsDir = path.resolve(process.cwd(), 'dist', 'runs');
            const dataFilePath = path.resolve(
                runsDir,
                `${options.environment}-${options.domain}-${formattedDate}.json`,
            );
            await fsExtra.ensureDir(runsDir);
            await fsExtra.writeJson(dataFilePath, dataArray, { spaces: 2 });

            logger.info(`Data from the last run has been saved to ${dataFilePath}`);
        }

        return {
            domContentLoadTimeMs,
            loadTimeMs,
            weight: {
                totalBytes,
                thirdPartyBytes, // Include thirdPartyBytes in the returned weight
            },
            requests: {
                totalRequests,
                blockedRequests,
                notBlockedRequests,
                thirdPartyRequests,
                thirdPartyBlockedRequests,
                thirdPartyNotBlockedRequests,
                hostnames: Object.fromEntries(hostnames),
                etldPlus1s: Object.fromEntries(etldPlus1s),
            },
        };
    }

    async run(options: CollectStatsOptions): Promise<PuppeteerResults> {
        if (!this.browser) {
            throw new Error('Browser is not launched');
        }
        try {
            const result = await this.collectStats(options);
            return result;
        } catch (e) {
            logger.error(`Error during Puppeteer run: ${e}`);
            throw e;
        }
    }
}
