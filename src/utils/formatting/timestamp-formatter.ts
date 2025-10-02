/**
 * Timestamp formatting utilities for docker-sha calculator
 * Handles period-based timestamp masking for cache invalidation
 */

/**
 * Period configuration types for timestamp formatting
 */
export type PeriodConfig =
  | "hourly"
  | "weekly"
  | "monthly"
  | "yearly"
  | {
      unit: "months" | "weeks" | "days" | "hours" | "minutes" | "seconds";
      number: number;
    }
  | { unit: "none" };

/**
 * Formats a timestamp for the image tag according to period requirements.
 * The format YYYYMMDD_hhmmss retains mask characters for less significant values.
 */
export function formatTimestamp(date: Date, period?: PeriodConfig): string {
  const year = date.getUTCFullYear().toString();
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = date.getUTCDate().toString().padStart(2, "0");
  const hour = date.getUTCHours().toString().padStart(2, "0");
  const minute = date.getUTCMinutes().toString().padStart(2, "0");
  const second = date.getUTCSeconds().toString().padStart(2, "0");

  // Handle string period formats
  if (typeof period === "string") {
    return formatStringPeriod(period, year, month, day, hour, minute, second);
  }

  // Handle object period formats
  if (period && typeof period === "object" && "unit" in period) {
    return formatObjectPeriod(period, year, month, day, hour, minute, second);
  }

  // Default case (no period specified)
  return `${year}${month}${day}_${hour}${minute}${second}`;
}

/**
 * Formats timestamp for string-based period configurations
 * Returns only the significant date parts (no masking)
 */
function formatStringPeriod(
  period: string,
  year: string,
  month: string,
  day: string,
  hour: string,
  _minute: string,
  _second: string,
): string {
  switch (period) {
    case "hourly":
      return `${year}${month}${day}_${hour}`; // year, month, day, hour
    case "weekly":
      return `${year}${month}${day}`; // year, month, day (weekly granularity)
    case "monthly":
      return `${year}${month}`; // year, month
    case "yearly":
      return `${year}`; // year only
    default:
      throw new Error(`Unknown string period format: ${period}`);
  }
}

/**
 * Formats timestamp for object-based period configurations
 * Returns only the significant date parts (no masking)
 */
function formatObjectPeriod(
  period: { unit: string; number?: number },
  year: string,
  month: string,
  day: string,
  hour: string,
  minute: string,
  second: string,
): string {
  if (period.unit === "none") {
    return ""; // No significant parts - empty timestamp
  }

  switch (period.unit) {
    case "seconds":
      return `${year}${month}${day}_${hour}${minute}${second}`; // All values (most granular)
    case "minutes":
      return `${year}${month}${day}_${hour}${minute}`; // down to minutes
    case "hours":
      return `${year}${month}${day}_${hour}`; // down to hours
    case "days":
      return `${year}${month}${day}`; // down to days
    case "weeks":
      return `${year}${month}${day}`; // down to days (weekly granularity)
    case "months":
      return `${year}${month}`; // down to months
    default:
      throw new Error(`Unknown object period unit: ${period.unit}`);
  }
}

/**
 * Creates a current timestamp for immediate use
 */
export function getCurrentTimestamp(period?: PeriodConfig): string {
  return formatTimestamp(new Date(), period);
}

/**
 * Validates that a period configuration is valid
 */
export function isValidPeriodConfig(period: unknown): period is PeriodConfig {
  if (typeof period === "string") {
    return ["hourly", "weekly", "monthly", "yearly"].includes(period);
  }

  if (period && typeof period === "object" && "unit" in period) {
    const obj = period as { unit: string; number?: number };

    if (obj.unit === "none") {
      return true;
    }

    const validUnits = ["months", "weeks", "days", "hours", "minutes", "seconds"];
    return validUnits.includes(obj.unit) && (obj.number === undefined || typeof obj.number === "number");
  }

  return period === undefined;
}

/**
 * Gets the granularity level of a period configuration for comparison
 * Higher numbers indicate more granular periods
 */
export function getPeriodGranularity(period?: PeriodConfig): number {
  if (!period) return 6; // Default is most granular (seconds)

  if (typeof period === "string") {
    switch (period) {
      case "yearly":
        return 1;
      case "monthly":
        return 2;
      case "weekly":
        return 3;
      case "hourly":
        return 4;
      default:
        return 6;
    }
  }

  if (period && typeof period === "object" && "unit" in period) {
    if (period.unit === "none") return 0;

    switch (period.unit) {
      case "months":
        return 2;
      case "weeks":
        return 3;
      case "days":
        return 3;
      case "hours":
        return 4;
      case "minutes":
        return 5;
      case "seconds":
        return 6;
      default:
        return 6;
    }
  }

  return 6;
}
