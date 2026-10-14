/**
 * Adsterra Monetization & Smartlink Configuration
 * Central configuration for Adsterra ad network integration
 */

// Official Adsterra Smartlink Monetization URL
export const ADSTERRA_SMARTLINK_URL = "https://araplhn.org/4/1318a0beea33cd491f0b903cf1be47fd";

// Official Adsterra Social Bar Script URL for Generating Lessons view
export const ADSTERRA_SOCIAL_BAR_URL = "https://bauval.org/14/4c54359ed7ca9dd720c3c72e2c90b90a";

// Reward trigger: 1 Click = 50 Credits
export const SMARTLINK_CREDIT_REWARD = 50;

// Anti-fraud and spam prevention cooldown (in seconds)
export const SMARTLINK_COOLDOWN_SECONDS = 30;

// Local storage key for persisting cooldown across modal views and page reloads
export const SMARTLINK_COOLDOWN_STORAGE_KEY = "classroomlm_smartlink_cooldown_until";
