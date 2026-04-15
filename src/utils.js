import crypto from "node:crypto";

export function createId(prefix = "job") {
  return `${prefix}_${crypto.randomBytes(6).toString("hex")}`;
}

export function parseDelay(input) {
  const value = String(input || "").trim();
  const match = value.match(/^(\d+)(ms|s|m|h|d)$/);

  if (!match) {
    throw new Error(`Invalid delay format: ${input}`);
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const table = {
    ms: 1,
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };

  return amount * table[unit];
}

export function resolveRunAt({ inDelay, at, now = new Date() }) {
  if (inDelay && at) {
    throw new Error("Use either 'in' or 'at', not both");
  }

  if (inDelay) {
    return new Date(now.getTime() + parseDelay(inDelay));
  }

  if (at) {
    const parsed = new Date(at);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error(`Invalid date: ${at}`);
    }
    return parsed;
  }

  throw new Error("Missing schedule: provide 'in' or 'at'");
}

export function toIso(input) {
  return input instanceof Date
    ? input.toISOString()
    : new Date(input).toISOString();
}

export function assert(value, message) {
  if (!value) throw new Error(message);
}
