export const formatDate = (dateString: string): string => {
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit' };
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, options);
};

export const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

export const calculateTotal = (items: Array<{ price: number, quantity: number }>): number => {
    return items.reduce((total, item) => total + (item.price * item.quantity), 0);
};

/**
 * Parse a week string (e.g., "2024-W12") and return start/end dates
 * Uses ISO week date system
 * @param weekStr - Week string in format "YYYY-W##"
 * @returns Object with start and end dayjs dates, or { start: null, end: null } if invalid
 */
export const getWeekRange = (weekStr: string): { start: any; end: any } => {
    const dayjs = require('dayjs');
    require('dayjs/plugin/isoWeek');
    dayjs.extend(require('dayjs/plugin/isoWeek'));
    
    const match = /^([0-9]{4,})-W([0-9]{2})$/.exec(String(weekStr || '').trim());
    if (!match) {
        return { start: null, end: null };
    }

    const year = Number(match[1]);
    const week = Number(match[2]);
    if (!Number.isFinite(year) || !Number.isFinite(week) || week < 1 || week > 53) {
        return { start: null, end: null };
    }

    const januaryFourth = dayjs(`${year}-01-04`);
    const start = januaryFourth.startOf('isoWeek').add(week - 1, 'week');
    const end = start.endOf('isoWeek');
    return { start, end };
};

/**
 * Safely format a date string, handling various formats
 * @param dateString - Date string in any common format
 * @returns Formatted date as MM/DD/YYYY or the original string if parsing fails
 */
export const formatDateSafely = (dateString: string): string => {
    if (!dateString) return '';
    try {
        if (dateString.match(/^\d{4}-\d{2}-\d{2}/)) {
            return new Date(dateString + 'T00:00:00').toLocaleDateString('en-US');
        }
        const date = new Date(dateString + 'T00:00:00');
        return date.toLocaleDateString('en-US');
    } catch (error) {
        console.error('Error formatting date:', dateString, error);
        return dateString;
    }
};