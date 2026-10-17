export function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

export function string(value, label, min = 1, max = 200) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) {
    fail(`${label}: informe entre ${min} e ${max} caracteres.`);
  }
  return value.trim();
}

export function money(value) {
  const result = Number(value);
  if (!Number.isFinite(result) || result < 0.01 || result > 100000) {
    fail('Informe um preço válido entre R$ 0,01 e R$ 100.000 por kg.');
  }
  return Math.round(result * 100);
}

export function email(value) {
  const result = string(value, 'E-mail', 5, 180).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) {
    fail('Informe um e-mail válido.');
  }
  return result;
}

export function validatePassword(value) {
  if (typeof value !== 'string' || value.length < 8 || value.length > 128) {
    fail('A senha deve ter entre 8 e 128 caracteres.');
  }
  return value;
}

export function id(value) {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result <= 0) {
    fail('Identificador inválido.');
  }
  return result;
}
