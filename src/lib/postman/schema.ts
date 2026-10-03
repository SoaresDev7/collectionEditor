/** Subconjunto do formato Postman Collection v2.1 usado na importação/exportação. */

export const POSTMAN_SCHEMA_V21 = 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json';

export type PostmanScript = { type?: string; exec?: string | string[] };
export type PostmanEvent = { listen: 'prerequest' | 'test'; script: PostmanScript };
export type PostmanVariable = { key: string; value?: unknown; type?: string; description?: string; disabled?: boolean };
export type PostmanHeader = { key: string; value: string; disabled?: boolean; description?: string };
export type PostmanUrl = string | { raw?: string; [k: string]: unknown };
export type PostmanBody = { mode?: string; raw?: string; options?: { raw?: { language?: string } } };

export type PostmanRequest = {
  method?: string;
  header?: PostmanHeader[];
  url?: PostmanUrl;
  body?: PostmanBody;
  description?: string;
};

export type PostmanItem = {
  name: string;
  description?: string;
  item?: PostmanItem[];
  request?: PostmanRequest | string;
  event?: PostmanEvent[];
  variable?: PostmanVariable[];
};

export type PostmanCollection = {
  info: { _postman_id?: string; name: string; description?: string; schema: string };
  item: PostmanItem[];
  event?: PostmanEvent[];
  variable?: PostmanVariable[];
};
