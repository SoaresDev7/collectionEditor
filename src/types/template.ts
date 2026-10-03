/**
 * Templates de documentação por nível. O conteúdo é Markdown com
 * placeholders [[campo]] (colchetes duplos para não conflitar com as
 * {{variáveis}} do Postman). O resultado vai para a descrição do item,
 * que o Postman exibe como documentação.
 */

export type TemplateLevel = 'folder' | 'scenario' | 'testId';

export type DocTemplate = {
  id: string;
  name: string;
  level: TemplateLevel;
  content: string;
  /** Template sugerido por padrão para o nível. */
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};
