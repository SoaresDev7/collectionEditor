import { VARIABLE_NAME_RE } from './variables';

export type ValidationResult = { ok: true } | { ok: false; message: string };

const OK: ValidationResult = { ok: true };
const fail = (message: string): ValidationResult => ({ ok: false, message });

/**
 * Valida a URL depois de interpolar variáveis conhecidas. Variáveis não
 * resolvidas são trocadas por um placeholder para não gerar falso-positivo.
 */
export function validateUrl(interpolatedUrl: string): ValidationResult {
  const url = interpolatedUrl.trim();
  if (!url) return fail('URL obrigatória.');
  const probe = url.replace(/\{\{[^{}]+\}\}/g, 'placeholder');
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(probe) ? probe : `http://${probe}`;
  try {
    const parsed = new URL(withProtocol);
    if (!parsed.hostname) return fail('URL sem host.');
    if (/\s/.test(url)) return fail('URL não pode conter espaços.');
    return OK;
  } catch {
    return fail('URL mal formada.');
  }
}

/** JSON vazio é aceito (requisição sem body). `{{var}}` sem aspas é aceito, como no Postman. */
export function validateJson(text: string): ValidationResult {
  if (!text.trim()) return OK;
  try {
    JSON.parse(text.replace(/\{\{[^{}]+\}\}/g, '0'));
    return OK;
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'JSON inválido.');
  }
}

/** Apenas compila o script (não executa) para detectar erros de sintaxe. */
export function validateJavaScript(code: string): ValidationResult {
  if (!code.trim()) return OK;
  try {
    // eslint-disable-next-line no-new-func
    new Function('pm', code);
    return OK;
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Erro de sintaxe.');
  }
}

export function validateVariableName(name: string): ValidationResult {
  if (!name) return fail('Nome obrigatório.');
  if (!VARIABLE_NAME_RE.test(name)) return fail('Use letras, números, "_", "-" ou "." e comece com letra ou "_".');
  return OK;
}

/** Verifica se `name` já existe entre os irmãos (ignorando o próprio item). */
export function isDuplicateName(name: string, siblings: { id: string; name: string }[], selfId?: string): boolean {
  const n = name.trim().toLowerCase();
  return siblings.some((s) => s.id !== selfId && s.name.trim().toLowerCase() === n);
}

export function formatJson(text: string): string | null {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return null;
  }
}
