// D4: pure, dependency-free. Bounds are re-asserted here because they are
// load-bearing at the network boundary -- never trust a client-declared
// shape. Shared by both audit's own tests and the ingestion API (one tested
// shape, two consumers).
const APP_PATTERN = /^[A-Za-z0-9._\-/]{1,100}$/;
const DS_VERSION_PATTERN = /^[A-Za-z0-9._\-^~+]{1,64}$/;
const COMPONENT_NAME_PATTERN = /^[A-Za-z_$][\w$]*$/;
const DS_VERSION_SOURCES = new Set(["installed", "declared"]);
const MAX_LIST_ENTRIES = 500;
const MAX_FUTURE_SKEW_MS = 24 * 60 * 60 * 1000;

const REQUIRED_KEYS = ["app", "dsVersion", "dsVersionSource", "components", "generatedAt"];
const ALLOWED_KEYS = new Set([...REQUIRED_KEYS, "deprecatedComponents"]);

/** @typedef {{ valid: true }} ValidReport */
/** @typedef {{ valid: false, field: string, message: string }} InvalidReport */
/** @typedef {ValidReport | InvalidReport} ValidationResult */

/** @param {string} field @param {string} message @returns {InvalidReport} */
function invalid(field, message) {
  return { valid: false, field, message };
}

/** @param {unknown} names @param {string} field @returns {InvalidReport | null} */
function validateComponentList(names, field) {
  if (!Array.isArray(names)) return invalid(field, `${field} must be an array`);
  if (names.length > MAX_LIST_ENTRIES)
    return invalid(field, `${field} exceeds ${MAX_LIST_ENTRIES} entries`);
  for (const name of names) {
    if (typeof name !== "string" || !COMPONENT_NAME_PATTERN.test(name)) {
      return invalid(field, `${field} contains an invalid component name`);
    }
  }
  return null;
}

/**
 * @param {unknown} value
 * @returns {ValidationResult}
 */
export function validateReport(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return invalid("report", "report must be a JSON object");
  }
  const report = /** @type {Record<string, unknown>} */ (value);

  for (const key of Object.keys(report)) {
    if (!ALLOWED_KEYS.has(key)) return invalid(key, `unknown field "${key}"`);
  }
  for (const key of REQUIRED_KEYS) {
    if (!(key in report)) return invalid(key, `missing required field "${key}"`);
  }

  if (typeof report.app !== "string" || !APP_PATTERN.test(report.app)) {
    return invalid("app", "app must be 1-100 chars matching the allowed charset");
  }
  if (typeof report.dsVersion !== "string" || !DS_VERSION_PATTERN.test(report.dsVersion)) {
    return invalid("dsVersion", "dsVersion must be 1-64 chars matching the allowed charset");
  }
  if (
    typeof report.dsVersionSource !== "string" ||
    !DS_VERSION_SOURCES.has(report.dsVersionSource)
  ) {
    return invalid("dsVersionSource", 'dsVersionSource must be "installed" or "declared"');
  }

  const componentsError = validateComponentList(report.components, "components");
  if (componentsError) return componentsError;

  if (typeof report.generatedAt !== "string") {
    return invalid("generatedAt", "generatedAt must be an ISO 8601 string");
  }
  const generatedAtMs = Date.parse(report.generatedAt);
  if (Number.isNaN(generatedAtMs)) {
    return invalid("generatedAt", "generatedAt must be a valid ISO 8601 date");
  }
  if (generatedAtMs - Date.now() > MAX_FUTURE_SKEW_MS) {
    return invalid("generatedAt", "generatedAt is more than 24h in the future");
  }

  if ("deprecatedComponents" in report) {
    const deprecatedError = validateComponentList(
      report.deprecatedComponents,
      "deprecatedComponents",
    );
    if (deprecatedError) return deprecatedError;
  }

  return { valid: true };
}
