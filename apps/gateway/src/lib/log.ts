export const log = {
  info: (...a: unknown[]) => console.log("[i]", ...a),
  warn: (...a: unknown[]) => console.warn("[!]", ...a),
  error: (...a: unknown[]) => console.error("[x]", ...a),
  debug: (...a: unknown[]) => process.env.DEBUG && console.log("[d]", ...a),
}
