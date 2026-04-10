export type RxTransform = (
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
  transform?: RxTransform;
}

export interface RxTimestampOptions {
  createdAt?: string;
  updatedAt?: string;
  transform?: RxTransform;
}

export interface RxTimestampsCollectionOptions {
  schema: Record<string, any>;
  options?: {
    timestamps?: boolean | RxTimestampOptions;
  } & Record<string, any>;
}
