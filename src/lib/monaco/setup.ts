/**
 * Monaco empacotado localmente (sem CDN) com workers do Vite, tipagem básica
 * da API `pm` do Postman e autocomplete de {{variáveis}}.
 */
import * as monaco from './core';
import { getCompletionVariables } from './completionVariables';
import { loader } from '@monaco-editor/react';
import EditorWorker from 'monaco-esm/editor/editor.worker.js?worker';
import JsonWorker from 'monaco-esm/language/json/json.worker.js?worker';
import TsWorker from 'monaco-esm/language/typescript/ts.worker.js?worker';

self.MonacoEnvironment = {
  getWorker(_id: string, label: string) {
    if (label === 'json') return new JsonWorker();
    if (label === 'javascript' || label === 'typescript') return new TsWorker();
    return new EditorWorker();
  },
};

const PM_TYPES = `
interface PmVariableScope {
  get(key: string): any;
  set(key: string, value: any): void;
  unset(key: string): void;
  has(key: string): boolean;
  clear(): void;
  toObject(): Record<string, any>;
  replaceIn(template: string): string;
}
interface PmResponse {
  code: number;
  status: string;
  responseTime: number;
  headers: { get(name: string): string | undefined };
  json(): any;
  text(): string;
  to: { have: { status(code: number): void; header(name: string): void; jsonBody(path?: string): void }; be: { ok: void } };
}
interface PmRequest {
  url: { toString(): string };
  method: string;
  headers: { add(h: { key: string; value: string }): void; upsert(h: { key: string; value: string }): void; remove(key: string): void };
  body: any;
}
interface Pm {
  variables: PmVariableScope;
  collectionVariables: PmVariableScope;
  environment: PmVariableScope;
  globals: PmVariableScope;
  request: PmRequest;
  response: PmResponse;
  info: { requestName: string; iteration: number; eventName: 'prerequest' | 'test' };
  test(name: string, fn: () => void): void;
  expect(value: any): any;
  sendRequest(request: string | object, callback: (err: any, res: PmResponse) => void): void;
  execution: { skipRequest(): void; setNextRequest(name: string | null): void };
}
declare const pm: Pm;
`;

monaco.typescript.javascriptDefaults.setCompilerOptions({
  target: monaco.typescript.ScriptTarget.ES2020,
  allowNonTsExtensions: true,
  checkJs: false,
  lib: ['es2020'],
});
monaco.typescript.javascriptDefaults.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: false });
monaco.typescript.javascriptDefaults.addExtraLib(PM_TYPES, 'ts:postman/pm.d.ts');

const variableCompletion: monaco.languages.CompletionItemProvider = {
  triggerCharacters: ['{'],
  provideCompletionItems(model, position) {
    const before = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
    const match = /\{\{([\w.$-]*)$/.exec(before);
    if (!match) return { suggestions: [] };
    const range = new monaco.Range(position.lineNumber, position.column - match[1].length, position.lineNumber, position.column);
    const after = model.getLineContent(position.lineNumber).slice(position.column - 1);
    const close = after.startsWith('}}') ? '' : '}}';
    return {
      suggestions: [...getCompletionVariables(), '$guid', '$timestamp', '$randomInt', '$randomEmail'].map((name) => ({
        label: `{{${name}}}`,
        filterText: name,
        kind: monaco.languages.CompletionItemKind.Variable,
        insertText: `${name}${close}`,
        range,
      })),
    };
  },
};
monaco.languages.registerCompletionItemProvider('json', variableCompletion);
monaco.languages.registerCompletionItemProvider('javascript', variableCompletion);

loader.config({ monaco });
