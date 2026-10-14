/**
 * Adsterra Monetization & Smartlink Configuration
 * Central configuration for Adsterra ad network integration
 */

// Official Adsterra Smartlink Monetization URL
export const ADSTERRA_SMARTLINK_URL = "https://asiafilm.org/4/2fa49655ff370a4066b732ffd0860242";

// Reward trigger: 1 Click = 50 Credits
export const SMARTLINK_CREDIT_REWARD = 50;

// Anti-fraud and spam prevention cooldown (in seconds)
export const SMARTLINK_COOLDOWN_SECONDS = 30;

// Local storage key for persisting cooldown across modal views and page reloads
export const SMARTLINK_COOLDOWN_STORAGE_KEY = "classroomlm_smartlink_cooldown_until";
