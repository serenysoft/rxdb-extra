export type RxModifier = (
  value: unknown,
  field: string,
  data: Record<string, any>,
) => unknown;

export type RxSimpleSearchSerializer = (
  data: Record<string, any>,
  fields: string[],
) => string | Promise<string>;

export interface RxSimpleSearchableOptions {
  fields: string[];
  index?: string;
  serializer?: RxSimpleSearchSerializer;
  modifier?: RxModifier;
}

export interface RxTimestampOptions {
  createdAt?: string;
  updatedAt?: string;
  modifier?: RxModifier;
}

export interface RxTimestampsCollectionOptions {
  schema: Record<string, any>;
  options?: {
    timestamps?: boolean | RxTimestampOptions;
  } & Record<string, any>;
}
