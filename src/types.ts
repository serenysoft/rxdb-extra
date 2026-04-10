export type RxSimpleSearchSerializer = (
  data: Record<string, any>,
  fields: string[],
) => string | Promise<string>;

export type RxTransform = (
  value: unknown,
  field: string,
  data: Record<string, any>,
) => unknown;

export interface RxSimpleSearchableOptions {
  fields: string[];
  index?: string;
  serializer?: RxSimpleSearchSerializer;
  transform?: RxTransform;
}

export interface RxSimpleSearchCollectionOptions {
  searchable: RxSimpleSearchableOptions;
}

export interface ResolvedCollectionSearchOptions {
  fields: string[];
  index: string;
  serializer: RxSimpleSearchSerializer;
}

export interface RxTimestampFields {
  createdAt?: string;
  updatedAt?: string;
  transform?: RxTransform;
}

export type RxTimestampsOptions = boolean | RxTimestampFields;

export interface RxTimestampsCollectionOptions {
  timestamps?: RxTimestampsOptions;
}

export interface ResolvedTimestampFields {
  createdAt: string;
  updatedAt: string;
  transform?: RxTransform;
}

export interface RxCollectionCreatorLike {
  schema: Record<string, any>;
  options?: RxTimestampsCollectionOptions & Record<string, any>;
}
