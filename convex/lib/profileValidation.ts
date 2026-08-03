export function normalizeHandle(value: string): string {
  const trimmed = value.trim();
  const nickname = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;

  if (!/^[a-zA-Z0-9_]{3,24}$/u.test(nickname)) {
    throw new Error("INVALID_HANDLE");
  }

  return `@${nickname.toLowerCase()}`;
}

export function assertAccessKey(value: string): string {
  if (
    value.length < 24 ||
    value.length > 128 ||
    value !== value.trim()
  ) {
    throw new Error("INVALID_ACCESS_KEY");
  }
  return value;
}

export function normalizeRecoveryCode(value: string): string {
  const code = value.trim().toUpperCase();
  if (code.length < 12 || code.length > 64) {
    throw new Error("INVALID_RECOVERY_CODE");
  }
  return code;
}
