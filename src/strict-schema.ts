import type { RxCollection, RxPlugin } from 'rxdb';

function getSchemaProperties(collection: RxCollection): Set<string> {
  const schema = collection.schema.jsonSchema as Record<string, any>;
  const properties = schema.properties ?? {};
  return new Set(Object.keys(properties));
}

function stripExtraProperties(
  data: Record<string, any>,
  allowedProperties: Set<string>,
): void {
  for (const key of Object.keys(data)) {
    if (!allowedProperties.has(key)) {
      delete data[key];
    }
  }
}

export function initializeStrictSchema(collection: RxCollection): void {
  const properties = getSchemaProperties(collection);

  collection.preInsert((data: Record<string, any>) => {
    stripExtraProperties(data, properties);
  }, false);

  collection.preSave((data: Record<string, any>) => {
    stripExtraProperties(data, properties);
  }, false);
}

export const RxDBStrictSchemaPlugin: RxPlugin = {
  name: 'strict-schema',
  rxdb: true,
  hooks: {
    createRxCollection: {
      after: ({ collection }: { collection: RxCollection }) => {
        initializeStrictSchema(collection);
      },
    },
  },
};
