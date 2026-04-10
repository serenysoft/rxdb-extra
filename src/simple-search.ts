import type { MangoQuery, RxCollection, RxDocument, RxPlugin, RxQuery } from 'rxdb';

export type RxSimpleSearchSerializer = (
  data: Record<string, any>,
  fields: string[],
) => string | Promise<string>;
export type RxSimpleSearchTransform = (
  value: unknown,
  field: string,
  data: Record<string, any>,
) => unknown;

export interface RxSimpleSearchableOptions {
  fields: string[];
  index?: string;
  serializer?: RxSimpleSearchSerializer;
  transform?: RxSimpleSearchTransform;
}

export interface RxSimpleSearchCollectionOptions {
  searchable: RxSimpleSearchableOptions;
}

interface ResolvedCollectionSearchOptions {
  fields: string[];
  index: string;
  serializer: RxSimpleSearchSerializer;
}

function getPathSegments(field: string): string[] {
  return String(field)
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function getSchemaProperty(schema: Record<string, any> | undefined, key: string): Record<string, any> | undefined {
  if (!schema) {
    return undefined;
  }

  if (schema.properties && typeof schema.properties === 'object') {
    return schema.properties[key] as Record<string, any> | undefined;
  }

  if (schema.type === 'array') {
    const items = Array.isArray(schema.items) ? schema.items[0] : schema.items;
    if (items?.properties && typeof items.properties === 'object') {
      return items.properties[key] as Record<string, any> | undefined;
    }
  }

  return undefined;
}

function isRxDocumentLike(value: unknown): value is RxDocument {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as RxDocument).populate === 'function' &&
      typeof (value as RxDocument).toJSON === 'function',
  );
}

async function populateRefValue(
  collection: RxCollection,
  schema: Record<string, any>,
  value: unknown,
  path?: string,
  source?: RxDocument,
): Promise<unknown> {
  if (value === null || value === undefined || !schema?.ref) {
    return value;
  }

  if (source && path) {
    const populated = await source.populate(path);
    if (populated) {
      return populated;
    }
  }

  const refCollection = (collection.database.collections as Record<string, RxCollection | undefined>)[
    String(schema.ref)
  ];

  if (!refCollection) {
    return value;
  }

  if (schema.type === 'array' && Array.isArray(value)) {
    const docs = await refCollection.findByIds(value).exec();
    return Array.from(docs.values());
  }

  return refCollection.findOne(String(value)).exec();
}

async function resolveFieldValue(
  collection: RxCollection,
  data: Record<string, any>,
  field: string,
  instance?: RxDocument,
): Promise<unknown> {
  const segments = getPathSegments(field);

  if (!segments.length) {
    return undefined;
  }

  let currentValue: unknown = data;
  let currentSchema = collection.schema?.jsonSchema as Record<string, any> | undefined;
  let currentCollection = collection;
  let currentDocument = instance;
  let pathFromDocumentRoot: string[] = [];

  for (let index = 0; index < segments.length; index += 1) {
    if (currentValue === null || currentValue === undefined) {
      return currentValue;
    }

    if (Array.isArray(currentValue)) {
      const remainingPath = segments.slice(index).join('.');
      const resolvedEntries = await Promise.all(
        currentValue.map((entry) =>
          resolveFieldValue(
            currentCollection,
            isRxDocumentLike(entry) ? entry.toJSON() : (entry as Record<string, any>),
            remainingPath,
            isRxDocumentLike(entry) ? entry : undefined,
          ),
        ),
      );

      return resolvedEntries.flatMap((entry) => (Array.isArray(entry) ? entry : [entry]));
    }

    const segment = segments[index];
    const schemaPart = getSchemaProperty(currentSchema, segment);
    const nextValue =
      typeof currentValue === 'object' ? (currentValue as Record<string, any>)[segment] : undefined;

    if (schemaPart?.ref && index < segments.length - 1) {
      const populatePath = [...pathFromDocumentRoot, segment].join('.');
      currentValue = await populateRefValue(
        currentCollection,
        schemaPart,
        nextValue,
        populatePath,
        currentDocument,
      );
      currentCollection =
        (currentCollection.database.collections as Record<string, RxCollection | undefined>)[
          String(schemaPart.ref)
        ] ?? currentCollection;
      currentSchema = currentCollection.schema?.jsonSchema as Record<string, any> | undefined;
      pathFromDocumentRoot = [];

      if (isRxDocumentLike(currentValue)) {
        currentDocument = currentValue;
        currentValue = currentValue.toJSON();
      } else {
        currentDocument = undefined;
      }

      continue;
    }

    currentValue = nextValue;
    currentSchema = schemaPart;
    pathFromDocumentRoot.push(segment);
  }

  return currentValue;
}

async function createSearchData(
  collection: RxCollection,
  data: Record<string, any>,
  fields: string[],
  instance?: RxDocument,
): Promise<Record<string, any>> {
  const resolvedEntries = await Promise.all(
    fields.map(
      async (field) => [field, await resolveFieldValue(collection, data, field, instance)] as const,
    ),
  );

  return {
    ...data,
    ...Object.fromEntries(resolvedEntries),
  };
}

function normalizeValue(value: unknown): string[] {
  if (value === null || value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => normalizeValue(entry));
  }

  if (value instanceof Date) {
    return [value.toISOString()];
  }

  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).flatMap((entry) =>
      normalizeValue(entry),
    );
  }

  return [String(value)];
}

export function defaultSearchSerializer(
  data: Record<string, any>,
  fields: string[],
  transform?: RxSimpleSearchTransform,
): string {
  return fields
    .flatMap((field) =>
      normalizeValue(transform ? transform(data[field], field, data) : data[field]),
    )
    .map((value) => value.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function resolveSearchOptions(
  collection: RxCollection,
  strict = true,
): ResolvedCollectionSearchOptions | null {
  const options = (collection.options ?? {}) as RxSimpleSearchCollectionOptions;
  const { searchable } = options;

  if (!searchable && !strict) {
    return null;
  }

  if (!searchable?.fields?.length) {
    throw new Error(
      `Collection "${collection.name}" must define searchable.fields with at least one attribute.`,
    );
  }

  const index = searchable.index || 'textSearch';
  const fields = searchable.fields.filter(
    (field, position, current) => current.indexOf(field) === position && field !== index,
  );

  return {
    fields,
    index,
    serializer:
      searchable.serializer ||
      ((data: Record<string, any>, configuredFields: string[]) =>
        defaultSearchSerializer(data, configuredFields, searchable.transform)),
  };
}

async function updateSearchField(
  collection: RxCollection,
  data: Record<string, any>,
  options: ResolvedCollectionSearchOptions,
  instance?: RxDocument,
): Promise<void> {
  const { index, fields, serializer } = options;
  const searchData = await createSearchData(collection, data, fields, instance);
  data[index] = await serializer(searchData, fields);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createSearchQuery<RxDocumentType>(
  collection: RxCollection<RxDocumentType>,
  text: string,
  query: MangoQuery<RxDocumentType> = {},
): MangoQuery<RxDocumentType> {
  const normalizedText = String(text ?? '').trim();

  if (!normalizedText) {
    return query;
  }

  const { index } = resolveSearchOptions(collection);
  const selector = {
    [index]: {
      $regex: escapeRegExp(normalizedText),
      $options: 'i',
    },
  } as NonNullable<MangoQuery<RxDocumentType>['selector']>;

  return {
    ...query,
    selector: query.selector
      ? ({
          $and: [query.selector, selector],
        } as NonNullable<MangoQuery<RxDocumentType>['selector']>)
      : selector,
  };
}

export function search<RxDocumentType, OrmMethods = {}, Reactivity = unknown>(
  this: RxCollection<RxDocumentType, OrmMethods, any, any, Reactivity>,
  text: string,
  query: MangoQuery<RxDocumentType> = {},
): RxQuery<
  RxDocumentType,
  RxDocument<RxDocumentType, OrmMethods, Reactivity>[],
  OrmMethods,
  Reactivity
> {
  return this.find(createSearchQuery(this, text, query));
}

export function initializeSimpleSearch(collection: RxCollection): void {
  const options = resolveSearchOptions(collection, false);

  if (!options) {
    return;
  }

  collection.preInsert(async (data: Record<string, any>) => {
    await updateSearchField(collection, data, options);
  }, false);

  collection.preSave(async (data: Record<string, any>, instance: RxDocument) => {
    await updateSearchField(collection, data, options, instance);
  }, false);
}

export const RxDBSimpleSearchPlugin: RxPlugin = {
  name: 'searchable-fields',
  rxdb: true,
  prototypes: {
    RxCollection: (proto: any) => {
      proto.search = search;
    },
  },
  hooks: {
    createRxCollection: {
      after: ({ collection }: { collection: RxCollection }) => {
        initializeSimpleSearch(collection);
      },
    },
  },
};
