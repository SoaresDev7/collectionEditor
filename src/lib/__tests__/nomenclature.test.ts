import { describe, expect, it } from 'vitest';
import { formatTestIdName, nextTestIdName, parseTestIdNumber, sanitizeIdCode, suggestIdCode } from '../nomenclature';
import { createScenario, createTestId } from '../factories';

describe('nomenclatura TC-<código>-NNN', () => {
  it('formata e interpreta', () => {
    expect(formatTestIdName('LCV', 7)).toBe('TC-LCV-007');
    expect(parseTestIdNumber('LCV', 'TC-LCV-012')).toBe(12);
    expect(parseTestIdNumber('LCV', 'TC-ABC-012')).toBeNull();
  });

  it('numera por cenário', () => {
    const s = createScenario({ idCode: 'CAD', testIds: [createTestId({ name: 'TC-CAD-001' }), createTestId({ name: 'TC-CAD-004' })] });
    expect(nextTestIdName(s)).toBe('TC-CAD-005');
    expect(nextTestIdName(createScenario({ idCode: 'CAD' }))).toBe('TC-CAD-001');
  });

  it('normaliza e sugere códigos', () => {
    expect(sanitizeIdCode('ação1x')).toBe('ACA');
    expect(suggestIdCode('Login com credenciais válidas')).toBe('LCV');
    expect(suggestIdCode('Cadastro de usuário')).toBe('CAU');
    expect(suggestIdCode('Remoção')).toBe('REM');
  });
});
