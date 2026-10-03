/**
 * Variáveis oferecidas no autocomplete de {{…}} do editor de código.
 * Fica fora do módulo do Monaco para que os editores possam atualizar a lista
 * sem carregar o Monaco no bundle principal.
 */
let names: string[] = [];

export const setCompletionVariables = (list: string[]) => {
  names = list;
};

export const getCompletionVariables = () => names;
