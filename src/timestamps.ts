import type { RxCollection, RxDatabase, RxPlugin } from 'rxdb';
import type { RxTimestampsCollectionOptions, RxTimestampOptions, RxModifier } from './types';

const DEFAULT_FIELDS: {
  createdAt: string;
  updatedAt: string;
} = {
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

function resolveTimestampFields(source: {
  database?: Pick<RxDatabase, 'options'>;
  options?: {
    timestamps?: boolean | RxTimestampOptions;
  };
}): {
  createdAt: string;
  updatedAt: string;
  modifier?: RxModifier;
} | null {
  const mergedOptions = {
    ...((source.database?.options ?? {}) as Record<string, unknown>),
    ...((source.options ?? {}) as Record<string, unknown>),
  };
  const { timestamps } = mergedOptions as {
    timestamps?: boolean | RxTimestampOptions;
  };

  if (!timestamps) {
    return null;
  }

  if (timestamps === true) {
    return { ...DEFAULT_FIELDS };
  }

  const fields = {
    ...DEFAULT_FIELDS,
    ...timestamps,
  };

  if (
    typeof fields.createdAt !== 'string' ||
    !fields.createdAt ||
    typeof fields.updatedAt !== 'string' ||
    !fields.updatedAt
  ) {
    throw new Error('timestamps must define valid createdAt and updatedAt field names.');
  }

  if (fields.createdAt === fields.updatedAt) {
    throw new Error('timestamps createdAt and updatedAt fields must be different.');
  }

  return fields;
}

function getPrimaryPath(primaryKey: unknown): string | undefined {
  if (typeof primaryKey === 'string') {
    return primaryKey;
  }

  if (primaryKey && typeof primaryKey === 'object' && 'key' in primaryKey) {
    return String((primaryKey as { key: string }).key);
  }

  return undefined;
}

export function validateTimestampSchema(
  database: Pick<RxDatabase, 'options'>,
  creator: RxTimestampsCollectionOptions,
  collectionName?: string,
): RxTimestampsCollectionOptions {
  const fields = resolveTimestampFields({
    database,
    options: creator.options,
  });

  if (!fields) {
    return creator;
  }

  const schema = creator.schema;
  const primaryPath = getPrimaryPath(schema.primaryKey);

  if (primaryPath === fields.createdAt || primaryPath === fields.updatedAt) {
    throw new Error('timestamps fields cannot reuse the collection primary key.');
  }

  const properties = schema.properties ?? {};
  const missingFields = [fields.createdAt, fields.updatedAt].filter((field) => !properties[field]);

  if (missingFields.length > 0) {
    const label = collectionName ? `Collection "${collectionName}"` : 'Collection';
    throw new Error(
      `${label} must declare timestamps fields in schema.properties: ${missingFields.join(', ')}.`,
    );
  }

  return creator;
}

function formatValue(
  value: unknown,
  field: string,
  data: Record<string, any>,
  modifier?: RxModifier,
): unknown {
  if (modifier) {
    return modifier(value, field, data);
  }

  return value instanceof Date ? value.toISOString() : value;
}

export function initializeTimestamps(collection: RxCollection): void {
  const fields = resolveTimestampFields({
    database: collection.database,
    options: (collection.options ?? {}) as {
      timestamps?: boolean | RxTimestampOptions;
    },
  });

  if (!fields) {
    return;
  }

  collection.preInsert((data: Record<string, any>) => {
    const now = new Date();

    if (!data[fields.createdAt]) {
      data[fields.createdAt] = formatValue(now, fields.createdAt, data, fields.modifier);
    }

    if (!data[fields.updatedAt]) {
      data[fields.updatedAt] = formatValue(now, fields.updatedAt, data, fields.modifier);
    }
  }, false);

  collection.preSave((data: Record<string, any>) => {
    const now = new Date();

    if (!data[fields.createdAt]) {
      data[fields.createdAt] = formatValue(now, fields.createdAt, data, fields.modifier);
    }

    data[fields.updatedAt] = formatValue(now, fields.updatedAt, data, fields.modifier);
  }, false);
}

export const RxDBTimestampsPlugin: RxPlugin = {
  name: 'timestamps',
  rxdb: true,
  hooks: {
    preCreateRxCollection: {
      after: (args: RxTimestampsCollectionOptions & { name: string; database: RxDatabase }) => {
        validateTimestampSchema(args.database, args, args.name);
      },
    },
    createRxCollection: {
      after: ({ collection }: { collection: RxCollection }) => {
        initializeTimestamps(collection);
      },
    },
  },
};
