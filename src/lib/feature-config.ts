// src/lib/feature-config.ts
// Centralized feature flags for the ERP system.
// Adjust these values per project configuration. Do NOT hardcode flags in individual pages.

export const ENABLE_PARKING = false; // Set true to enable Parking module UI and calculations
export const ENABLE_GAS = true; // Set false to disable Gas module features
export const ENABLE_MAINTENANCE = true; // Set false to hide Maintenance calculations UI
export const ENABLE_LATE_FEE = false; // Enable late fee handling in billing
export const ENABLE_SECURITY_DEPOSIT = false; // Include security deposit accounting
export const ENABLE_SYNC = true; // Enable online synchronization service
