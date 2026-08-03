import { MAX_TERM_LENGTH } from "./sensus";

export function normalizeNickname(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 24);
}

export function validateNickname(value: string): string | null {
  if (!value) {
    return "Escribe tu nickname.";
  }

  if (value.length < 3 || value.length > 24) {
    return "Debe tener entre 3 y 24 caracteres.";
  }

  if (!/^[a-z0-9_]+$/.test(value)) {
    return "Usa solo letras minúsculas, números y guion bajo.";
  }

  return null;
}

export function validateTerm(value: string): string | null {
  const term = value.trim();

  if (!term) {
    return "Escribe una palabra o expresión corta.";
  }

  if (term.length > MAX_TERM_LENGTH) {
    return `Usa máximo ${MAX_TERM_LENGTH} caracteres.`;
  }

  return null;
}

export function normalizeTerm(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, MAX_TERM_LENGTH);
}

export function normalizeRecoveryCode(value: string): string {
  return value.trim();
}
