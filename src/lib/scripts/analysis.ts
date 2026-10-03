/**
 * Análise leve (sem parser completo) de scripts do Postman: declarações,
 * acessos a variáveis via `pm.*` / `{{var}}` e uso de identificadores.
 * Trabalha por regex sobre o código com strings e comentários mascarados.
 */

export type Position = { line: number; column: number }; // 1-based

export type PmScope = 'variables' | 'collectionVariables' | 'environment' | 'globals' | 'iterationData';
export type PmOp = 'get' | 'set' | 'unset' | 'has' | 'ref';

/** Acesso a uma variável do Postman. `ref` = {{nome}} dentro de uma string. */
export type PmAccess = Position & { scope: PmScope; op: PmOp; name: string; endColumn: number };

/**
 * Declaração de identificador no topo do script.
 * - local: function/const/let/var — no Postman só existe dentro do próprio script;
 * - shared: atribuição sem declaração (`utils = …`) ou `globalThis.x = …` — fica
 *   disponível para os scripts que rodam depois na mesma execução.
 */
export type Declaration = Position & { name: string; kind: 'local' | 'shared'; keyword: string };

export type IdentifierUse = Position & { name: string; endColumn: number };

export type ScriptAnalysis = {
  declarations: Declaration[];
  /** Nomes declarados no script, incluindo parâmetros e variáveis internas. */
  declaredNames: Set<string>;
  pmAccesses: PmAccess[];
  /** Código com strings e comentários trocados por espaços (mesmas posições). */
  masked: string;
};

/** Troca o conteúdo de strings e comentários por espaços, preservando posições e quebras de linha. */
export function maskCode(code: string, { strings = true }: { strings?: boolean } = {}): string {
  let out = '';
  let i = 0;
  const blank = (s: string) => s.replace(/[^\n]/g, ' ');
  while (i < code.length) {
    const ch = code[i];
    const next = code[i + 1];
    if (ch === '/' && next === '/') {
      const end = code.indexOf('\n', i);
      const stop = end < 0 ? code.length : end;
      out += blank(code.slice(i, stop));
      i = stop;
    } else if (ch === '/' && next === '*') {
      const end = code.indexOf('*/', i + 2);
      const stop = end < 0 ? code.length : end + 2;
      out += blank(code.slice(i, stop));
      i = stop;
    } else if (ch === '"' || ch === "'" || ch === '`') {
      let j = i + 1;
      while (j < code.length && code[j] !== ch) {
        if (code[j] === '\\') j++;
        else if (ch !== '`' && code[j] === '\n') break;
        j++;
      }
      out += ch + (strings ? blank(code.slice(i + 1, j)) : code.slice(i + 1, j)) + (j < code.length ? ch : '');
      i = j + 1;
    } else {
      out += ch;
      i++;
    }
  }
  return out;
}

/** Converte índice absoluto em linha/coluna (1-based). */
export function positionAt(code: string, index: number): Position {
  let line = 1;
  let last = -1;
  for (let i = 0; i < index; i++) if (code.charCodeAt(i) === 10) (line++, (last = i));
  return { line, column: index - last };
}

const PM_CALL_RE = /pm\.(variables|collectionVariables|environment|globals|iterationData)\.(get|set|unset|has)\(\s*(['"`])([^'"`\n]+)\3/g;
const TEMPLATE_REF_RE = /\{\{\s*([^{}\s]+)\s*\}\}/g;
const IDENT = '[A-Za-z_$][\\w$]*';

const KEYWORDS = new Set(
  'break case catch class const continue debugger default delete do else export extends finally for function if import in instanceof let new return super switch this throw try typeof var void while with yield await async of true false null undefined NaN Infinity'.split(' '),
);

export function analyzeScript(code: string): ScriptAnalysis {
  const masked = maskCode(code);
  const declarations: Declaration[] = [];
  const declaredNames = new Set<string>();

  // Declarações locais (qualquer profundidade conta como "declarado no script").
  const localRe = new RegExp(`\\b(function\\s*\\*?|const|let|var|class)\\s+(${IDENT})`, 'g');
  for (const m of masked.matchAll(localRe)) {
    declaredNames.add(m[2]);
    const pos = positionAt(code, m.index! + m[0].length - m[2].length);
    // Só entra na lista de declarações do script se estiver no topo (sem indentação).
    const lineStart = masked.lastIndexOf('\n', m.index! - 1) + 1;
    if (masked.slice(lineStart, m.index) === '') declarations.push({ ...pos, name: m[2], kind: 'local', keyword: m[1].replace(/\s+/g, '') });
  }
  // Desestruturação: const { a, b } = … / const [a, b] = …
  for (const m of masked.matchAll(/\b(?:const|let|var)\s*[{[]([^}\]]*)[}\]]/g))
    for (const n of m[1].split(',')) {
      const name = n.split(':').pop()!.split('=')[0].trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) declaredNames.add(name);
    }
  // Parâmetros de funções e arrow functions.
  for (const m of masked.matchAll(/(?:function\s*\*?\s*[\w$]*\s*\(([^)]*)\)|\(([^()]*)\)\s*=>|\b([A-Za-z_$][\w$]*)\s*=>)/g)) {
    const params = m[1] ?? m[2] ?? m[3] ?? '';
    for (const p of params.split(',')) {
      const name = p.replace(/[{}[\]]/g, '').split('=')[0].replace('...', '').trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) declaredNames.add(name);
    }
  }
  // catch (e)
  for (const m of masked.matchAll(/catch\s*\(\s*([A-Za-z_$][\w$]*)/g)) declaredNames.add(m[1]);

  // Compartilhadas: atribuição no topo sem declaração, ou globalThis.x = …
  const sharedRe = new RegExp(`^[ \\t]*(?:globalThis\\.|window\\.)?(${IDENT})\\s*=(?!=)`, 'gm');
  for (const m of masked.matchAll(sharedRe)) {
    const name = m[1];
    if (KEYWORDS.has(name) || name === 'pm') continue;
    const explicitGlobal = /globalThis\.|window\./.test(m[0]);
    if (!explicitGlobal && declaredNames.has(name)) continue; // reatribuição de variável local
    declaredNames.add(name);
    declarations.push({ ...positionAt(code, m.index! + m[0].indexOf(name)), name, kind: 'shared', keyword: explicitGlobal ? 'globalThis' : '=' });
  }

  const pmAccesses: PmAccess[] = [];
  for (const m of code.matchAll(PM_CALL_RE)) {
    const nameIndex = m.index! + m[0].length - m[4].length - 1;
    const pos = positionAt(code, nameIndex);
    pmAccesses.push({ ...pos, endColumn: pos.column + m[4].length, scope: m[1] as PmScope, op: m[2] as PmOp, name: m[4] });
  }
  const withoutComments = maskCode(code, { strings: false });
  for (const m of code.matchAll(TEMPLATE_REF_RE)) {
    if (m[1].startsWith('$')) continue;
    // Só conta {{var}} dentro de strings: mascarado no código completo, mas não nos comentários.
    if (masked[m.index!] !== ' ' || withoutComments[m.index!] === ' ') continue;
    const pos = positionAt(code, m.index! + m[0].indexOf(m[1]));
    pmAccesses.push({ ...pos, endColumn: pos.column + m[1].length, scope: 'variables', op: 'ref', name: m[1] });
  }

  return { declarations, declaredNames, pmAccesses, masked };
}

/** Usos (no código mascarado) de identificadores de uma lista, ignorando propriedades (`x.nome`) e chaves (`nome:`). */
export function findIdentifierUses(analysis: ScriptAnalysis, code: string, names: Iterable<string>): IdentifierUse[] {
  const uses: IdentifierUse[] = [];
  for (const name of names) {
    const re = new RegExp(`(^|[^\\w$.])(${name.replace(/\$/g, '\\$')})(?![\\w$])(?!\\s*:(?!:))`, 'g');
    for (const m of analysis.masked.matchAll(re)) {
      const index = m.index! + m[1].length;
      const pos = positionAt(code, index);
      uses.push({ ...pos, endColumn: pos.column + name.length, name });
    }
  }
  return uses;
}
