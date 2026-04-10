import { createRxDatabase, addRxPlugin } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';

addRxPlugin(RxDBDevModePlugin);

export const userSchema = {
  version: 0,
  description: 'The user schema',
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 100,
    },
    name: {
      type: 'string',
    },
    age: {
      type: 'integer',
    },
    searchIndex: {
      type: 'string',
      default: '',
    },
  },
};

export async function initDatabase(options?: any): Promise<any> {
  return createRxDatabase({
    name: 'testdb',
    storage: wrappedValidateAjvStorage({
      storage: getRxStorageMemory(),
    }),
    ...options,
  });
}
