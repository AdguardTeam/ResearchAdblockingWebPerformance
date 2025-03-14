import { isThirdParty, extractFinalUrl } from '../../src/utils/url';

describe('url', () => {
    describe('isThirdParty', () => {
        it('checks if a URL is third-party', () => {
            expect(isThirdParty('https://example.com', 'https://example.com')).toBe(false);
            expect(isThirdParty('https://example.org', 'https://example.com')).toBe(true);
        });
        it('considers subdomains as same origin', () => {
            expect(isThirdParty('https://test.example.com', 'https://example.com')).toBe(false);
        });
    });

    describe('extractFinalUrl', () => {
        it('returns response URL when no location header is present', () => {
            const mockResponse = {
                url: 'https://example.com',
                headers: {
                    get: jest.fn().mockReturnValue(null),
                },
            } as unknown as Response;

            expect(extractFinalUrl(mockResponse)).toBe('https://example.com');
        });

        it('returns resolved URL when location header is present', () => {
            const mockResponse = {
                url: 'https://example.com',
                headers: {
                    get: jest.fn().mockReturnValue('/new-page'),
                },
            } as unknown as Response;

            expect(extractFinalUrl(mockResponse)).toBe('https://example.com/new-page');
        });
    });
});
