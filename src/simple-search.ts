import type { MangoQuery, RxCollection, RxDocument, RxPlugin, RxQuery } from 'rxdb';

export type RxSearchSerializer = (data: Record<string, any>, fields: string[]) => string;
export type RxSearchTransform = (
  value: unknown,
  field: string,
  data: Record<string, any>,
) => unknown;

export interface RxSearchableOption {
  fields: string[];
  index?: string;
  serializer?: RxSearchSerializer;
  transform?: RxSearchTransform;
}

export interface RxSearchCollectionOptions {
  searchable: RxSearchableOption;
}

interface ResolvedCollectionSearchOptions {
  fields: string[];
  index: string;
  serializer: RxSearchSerializer;
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
  transform?: RxSearchTransform,
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

function resolveSearchOptions(collection: RxCollection): ResolvedCollectionSearchOptions {
  const options = (collection.options ?? {}) as RxSearchCollectionOptions;
  const { searchable } = options;

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

function updateSearchField(
  data: Record<string, any>,
  options: ResolvedCollectionSearchOptions,
): void {
  const { index, fields, serializer } = options;
  data[index] = serializer(data, fields);
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

export function initialize(collection: RxCollection): void {
  const options = resolveSearchOptions(collection);

  collection.preInsert((data: Record<string, any>) => {
    updateSearchField(data, options);
  }, false);

  collection.preSave((data: Record<string, any>) => {
    updateSearchField(data, options);
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
        initialize(collection);
      },
    },
  },
};
