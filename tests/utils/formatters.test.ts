import { formatTime } from '../../src/report-generator/app/src/utils/formatters';

describe('formatTime', () => {
    it('should return "0 ms" for 0 milliseconds', () => {
        expect(formatTime(0)).toBe('0 ms');
    });

    it('should format milliseconds correctly', () => {
        expect(formatTime(500)).toBe('500.00 ms');
        expect(formatTime(500, 0)).toBe('500 ms');
        expect(formatTime(500, 1)).toBe('500.0 ms');
    });

    it('should format seconds correctly', () => {
        expect(formatTime(1500)).toBe('1.50 s');
        expect(formatTime(1500, 1)).toBe('1.5 s');
        expect(formatTime(30000)).toBe('30.00 s');
    });

    it('should format minutes correctly', () => {
        expect(formatTime(90000)).toBe('1.50 min');
        expect(formatTime(180000)).toBe('3.00 min');
        expect(formatTime(180000, 0)).toBe('3 min');
    });

    it('should format hours correctly', () => {
        expect(formatTime(3600000)).toBe('1.00 h');
        expect(formatTime(7200000)).toBe('2.00 h');
        expect(formatTime(5400000)).toBe('1.50 h');
    });

    it('should handle negative decimals by using 0 decimals', () => {
        expect(formatTime(1500, -1)).toBe('2 s');
    });
});
