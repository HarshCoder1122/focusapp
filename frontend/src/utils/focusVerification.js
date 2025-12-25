/**
 * Focus Verification Utility
 * Handles sound, vibration, quotes, and interval scheduling for focus checks
 */

// Motivational quotes for focus verification popups
export const MOTIVATIONAL_QUOTES = [
    { quote: "Success is the sum of small efforts repeated day in and day out.", author: "Robert Collier" },
    { quote: "The secret of getting ahead is getting started.", author: "Mark Twain" },
    { quote: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
    { quote: "Focus on being productive instead of busy.", author: "Tim Ferriss" },
    { quote: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
    { quote: "It always seems impossible until it's done.", author: "Nelson Mandela" },
    { quote: "Your limitation—it's only your imagination.", author: "Unknown" },
    { quote: "Push yourself, because no one else is going to do it for you.", author: "Unknown" },
    { quote: "Great things never come from comfort zones.", author: "Unknown" },
    { quote: "Dream it. Wish it. Do it.", author: "Unknown" },
    { quote: "Success doesn't just find you. You have to go out and get it.", author: "Unknown" },
    { quote: "The harder you work for something, the greater you'll feel when you achieve it.", author: "Unknown" },
    { quote: "Don't stop when you're tired. Stop when you're done.", author: "Unknown" },
    { quote: "Wake up with determination. Go to bed with satisfaction.", author: "Unknown" },
    { quote: "Little things make big days.", author: "Unknown" },
    { quote: "It's going to be hard, but hard does not mean impossible.", author: "Unknown" },
    { quote: "Believe in yourself and all that you are.", author: "Unknown" },
    { quote: "Your only limit is your mind.", author: "Unknown" },
    { quote: "Stay focused and never give up.", author: "Unknown" },
    { quote: "Every expert was once a beginner.", author: "Unknown" },
];

/**
 * Get a random motivational quote
 */
export const getRandomQuote = () => {
    return MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
};

/**
 * Calculate next verification time with randomization
 * @param {number} sessionDuration - Total session duration in minutes
 * @param {number} elapsedMinutes - Minutes elapsed since session start
 * @param {number} checkCount - Number of checks already done
 * @returns {number} - Seconds until next check, or -1 if no more checks needed
 */
export const getNextCheckInterval = (sessionDuration, elapsedMinutes, checkCount) => {
    // Special handling for 25-minute sessions: 1 check around 10-15 minutes
    if (sessionDuration === 25) {
        // Only 1 check for 25-minute sessions
        if (checkCount >= 1) return -1;

        // Schedule check around 10-15 minutes into the session
        // Random offset between 10-15 minutes from start
        const targetMinute = 10 + Math.floor(Math.random() * 6); // 10-15 minutes

        // If we haven't reached the target time yet, schedule it
        if (elapsedMinutes < targetMinute) {
            const waitMinutes = targetMinute - elapsedMinutes;
            // Don't schedule if less than 8 minutes remaining after check
            if (sessionDuration - targetMinute < 8) return -1;
            return waitMinutes * 60; // Return in seconds
        }
        return -1; // Already past the check time
    }

    // No checks for sessions under 25 minutes
    if (sessionDuration < 25) return -1;

    // Base interval: ~15 minutes
    const baseInterval = 15;

    // Randomization range: ±5 minutes
    const randomOffset = Math.floor(Math.random() * 11) - 5; // -5 to +5

    // Calculate interval in minutes
    let intervalMinutes = baseInterval + randomOffset;

    // Ensure minimum 8 minutes between checks
    intervalMinutes = Math.max(8, intervalMinutes);

    // Max checks based on session duration
    const maxChecks = sessionDuration < 50 ? 1 : sessionDuration < 90 ? 2 : 4;

    // No more checks if we've hit the limit
    if (checkCount >= maxChecks) return -1;

    // Don't schedule check if it would be in last 5 minutes
    const remainingMinutes = sessionDuration - elapsedMinutes;
    if (remainingMinutes < intervalMinutes + 5) return -1;

    // Return interval in seconds
    return intervalMinutes * 60;
};

/**
 * Play notification sound
 */
export const playNotificationSound = () => {
    try {
        // Use Web Audio API for better mobile support
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();

        // Create a gentle chime sound
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Pleasant chime frequencies
        oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5
        oscillator.type = 'sine';

        // Fade in and out
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.1);
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.5);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);

        // Play second chime for attention
        setTimeout(() => {
            const osc2 = audioContext.createOscillator();
            const gain2 = audioContext.createGain();
            osc2.connect(gain2);
            gain2.connect(audioContext.destination);
            osc2.frequency.setValueAtTime(1047, audioContext.currentTime); // C6
            osc2.type = 'sine';
            gain2.gain.setValueAtTime(0, audioContext.currentTime);
            gain2.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.1);
            gain2.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.5);
            osc2.start(audioContext.currentTime);
            osc2.stop(audioContext.currentTime + 0.5);
        }, 300);

        return true;
    } catch (error) {
        console.warn("Could not play notification sound:", error);
        return false;
    }
};

/**
 * Trigger device vibration (if supported)
 */
export const triggerVibration = () => {
    try {
        if ('vibrate' in navigator) {
            // Pattern: vibrate 200ms, pause 100ms, vibrate 200ms
            navigator.vibrate([200, 100, 200]);
            return true;
        }
        return false;
    } catch (error) {
        console.warn("Vibration not supported:", error);
        return false;
    }
};

/**
 * Calculate coin penalty multiplier based on missed checks
 * @param {number} missedChecks - Number of missed verification checks
 * @returns {number} - Multiplier (0.5 to 1.0)
 */
export const getCoinPenaltyMultiplier = (missedChecks) => {
    if (missedChecks === 0) return 1.0;    // 100%
    if (missedChecks === 1) return 0.85;   // 85%
    if (missedChecks === 2) return 0.70;   // 70%
    return 0.50;                            // 50% for 3+
};

/**
 * Response timeout in milliseconds (30 seconds)
 */
export const VERIFICATION_TIMEOUT_MS = 30000;
