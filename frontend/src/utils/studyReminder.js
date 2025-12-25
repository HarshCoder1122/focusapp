/**
 * Study Reminder Notifications Utility
 * Schedules automatic study reminders with motivational quotes
 */

import { MOTIVATIONAL_QUOTES } from './focusVerification';

// Storage key for reminder settings
const REMINDER_STORAGE_KEY = 'study-reminder-settings';
const LAST_REMINDER_KEY = 'last-study-reminder';

// Default reminder intervals (in hours)
const DEFAULT_REMINDER_INTERVALS = [9, 14, 18, 21]; // 9am, 2pm, 6pm, 9pm

/**
 * Check if notifications are supported and permitted
 */
export const canSendNotifications = () => {
    return 'Notification' in window &&
        Notification.permission === 'granted' &&
        'serviceWorker' in navigator;
};

/**
 * Get a random motivational quote
 */
export const getRandomMotivationalQuote = () => {
    return MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
};

/**
 * Send a study reminder notification
 */
export const sendStudyReminder = async () => {
    if (!canSendNotifications()) return false;

    try {
        const quote = getRandomMotivationalQuote();
        const registration = await navigator.serviceWorker.ready;

        await registration.showNotification('📚 Time to Study!', {
            body: `"${quote.quote}" — ${quote.author}`,
            icon: '/logo192.png',
            badge: '/logo192.png',
            tag: 'study-reminder',
            vibrate: [200, 100, 200],
            requireInteraction: false,
            actions: [
                { action: 'study', title: '📖 Start Studying' },
                { action: 'dismiss', title: '✕ Dismiss' }
            ],
            data: { url: '/focus' }
        });

        // Save last reminder time
        localStorage.setItem(LAST_REMINDER_KEY, Date.now().toString());
        return true;
    } catch (error) {
        console.warn('Failed to send study reminder:', error);
        return false;
    }
};

/**
 * Calculate next reminder time based on intervals
 */
const getNextReminderTime = () => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();

    // Find next reminder time
    for (const hour of DEFAULT_REMINDER_INTERVALS) {
        if (hour > currentHour || (hour === currentHour && currentMinutes < 30)) {
            const nextTime = new Date(now);
            nextTime.setHours(hour, 0, 0, 0);
            return nextTime.getTime() - now.getTime();
        }
    }

    // All times passed today, schedule first reminder tomorrow
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(DEFAULT_REMINDER_INTERVALS[0], 0, 0, 0);
    return tomorrow.getTime() - now.getTime();
};

/**
 * Check if reminder should be shown (not shown recently)
 */
const shouldShowReminder = () => {
    const lastReminder = localStorage.getItem(LAST_REMINDER_KEY);
    if (!lastReminder) return true;

    const timeSinceLastReminder = Date.now() - parseInt(lastReminder);
    const minIntervalMs = 2 * 60 * 60 * 1000; // 2 hours minimum between reminders

    return timeSinceLastReminder >= minIntervalMs;
};

// Timer reference for scheduling
let reminderTimer = null;

/**
 * Start automatic study reminder scheduling
 */
export const startStudyReminders = () => {
    if (!canSendNotifications()) return;

    // Clear any existing timer
    stopStudyReminders();

    // Schedule next reminder
    const scheduleNextReminder = () => {
        const nextReminderMs = getNextReminderTime();

        reminderTimer = setTimeout(() => {
            if (shouldShowReminder()) {
                sendStudyReminder();
            }
            // Schedule next one
            scheduleNextReminder();
        }, nextReminderMs);
    };

    scheduleNextReminder();
};

/**
 * Stop automatic reminders
 */
export const stopStudyReminders = () => {
    if (reminderTimer) {
        clearTimeout(reminderTimer);
        reminderTimer = null;
    }
};

/**
 * Send immediate reminder (for testing or manual trigger)
 */
export const sendImmediateReminder = async () => {
    if (!canSendNotifications()) {
        console.warn('Notifications not available');
        return false;
    }

    return await sendStudyReminder();
};

/**
 * Initialize reminders based on user preference
 * Call this when the app loads
 */
export const initializeStudyReminders = (notificationsEnabled) => {
    if (notificationsEnabled && canSendNotifications()) {
        startStudyReminders();
    } else {
        stopStudyReminders();
    }
};
