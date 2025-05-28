// src/utils/formatters.js
export const NOT_APPLICABLE = "N/A";
export const UNLIMITED = "Unlimited";
export const COMPLEX_STRATEGY = "Complex";
export const API_REQUIRED = "API Req.";

export const formatDisplayValue = (value, type = "number", options = {}) => {
  const {
    digits = 2,
    prefix = "₹",
    suffix = "",
    showSign = false,
    useAbsolute = false,
    noPrefixForZero = false,
  } = options;
  if (
    value === UNLIMITED ||
    value === COMPLEX_STRATEGY ||
    value === API_REQUIRED
  )
    return value;
  if (
    value === null ||
    value === undefined ||
    (typeof value === "number" && isNaN(value))
  )
    return NOT_APPLICABLE;
  let numValue =
    typeof value === "string"
      ? parseFloat(value.replace(/[^0-9.-]+/g, ""))
      : value;
  if (typeof numValue !== "number" || isNaN(numValue)) return NOT_APPLICABLE;
  let sign = "";
  if (showSign && numValue > 0 && type !== "breakeven_val_only") sign = "+";
  else if (numValue < 0) sign = "-";
  if (prefix && numValue >= 0 && sign === "+") sign = ""; // Avoid "++₹" if prefix itself is a sign
  const valToFormat = useAbsolute
    ? Math.abs(numValue)
    : sign === "-"
    ? Math.abs(numValue)
    : numValue;
  const displayPrefix =
    noPrefixForZero && numValue === 0 && (prefix === "₹" || prefix === "$")
      ? ""
      : prefix;
  switch (type) {
    case "currency_pnl":
      return `${sign}${displayPrefix}${valToFormat.toLocaleString(undefined, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      })}${suffix}`;
    case "currency":
      return `${numValue < 0 ? "-" : ""}${displayPrefix}${Math.abs(
        valToFormat
      ).toLocaleString(undefined, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      })}${suffix}`;
    case "breakeven_val_only":
      return numValue.toFixed(0);
    case "percentage_with_sign":
      return ` (${sign}${valToFormat.toFixed(digits)}${suffix || "%"})`;
    default:
      return `${sign}${displayPrefix}${valToFormat.toLocaleString(undefined, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      })}${suffix}`;
  }
};
