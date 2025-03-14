import tldts from 'tldts';

import { logger } from './logger';

/**
 * Determines if a request URL is third-party compared to the main URL.
 *
 * @param mainUrl - The main page's URL for comparison.
 * @param requestUrl - The URL of the external request.
 * @returns `true` if the request is third-party; otherwise, `false`.
 *
 * @example
 * ```typescript
 * isThirdParty('https://api.example.com/data', 'https://www.mysite.com/home'); // true
 * isThirdParty('https://images.mysite.com/banner.jpg', 'https://www.mysite.com/home'); // false
 * ```
 */
export const isThirdParty = (mainUrl: string, requestUrl: string): boolean => {
    try {
        const mainOrigin = tldts.getDomain(mainUrl);
        const requestOrigin = tldts.getDomain(requestUrl);
        return mainOrigin !== requestOrigin;
    } catch (error) {
        logger.error(`Error parsing URLs for third-party check: ${error}`);
        return false;
    }
};

/**
 * Fetches a resource with a timeout.
 * @param url - The resource URL.
 * @param options - Fetch options.
 * @param timeout - Timeout in milliseconds.
 * @returns The fetch response.
 */
export async function fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeout: number,
): Promise<Response> {
    return new Promise<Response>((resolve, reject) => {
        const timer = setTimeout(
            () => reject(new Error('Request timed out')),
            timeout,
        );

        fetch(url, options)
            .then((response) => {
                clearTimeout(timer);
                resolve(response);
            })
            .catch((error) => {
                clearTimeout(timer);
                reject(error);
            });
    });
}

/**
 * Extracts the final URL from the response, handling redirects.
 * @param response - The fetch response.
 * @returns The resolved URL.
 */
export function extractFinalUrl(response: Response): string {
    const locationHeader = response.headers.get('location');
    if (locationHeader) {
        // Resolve relative URLs against the response URL
        return new URL(locationHeader, response.url).href;
    }
    return response.url;
}

/**
 * Determines the URL for a given domain name.
 * @param domain - The domain to fetch the URL for.
 * @returns The final URL or null if an error occurs.
 */
export async function getUrlByDomain(domain: string): Promise<string | null> {
    const TIMEOUT_MS = 5000; // 5-second timeout
    const protocols = ['http://', 'https://'];

    for (const protocol of protocols) {
        const url = `${protocol}${domain}`;
        try {
            const response = await fetchWithTimeout(
                url,
                {
                    // redirect: 'manual',
                    headers: { 'Accept-Encoding': 'identity' },
                },
                TIMEOUT_MS,
            );

            return extractFinalUrl(response);
        } catch (error) {
            logger.error(`Error fetching URL for ${url}:`, error);
            // If the error is due to timeout or network, try the next protocol
            // eslint-disable-next-line no-continue
            continue;
        }
    }

    // If both HTTP and HTTPS requests fail, return null
    return null;
}
