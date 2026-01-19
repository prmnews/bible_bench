export function isAdminAvailable() {
  return process.env.NODE_ENV === "development" || process.env.ADMIN_LOCAL_ONLY === "true";
}
