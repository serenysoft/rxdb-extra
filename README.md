# RxDB extra plugins

This package provides small utility plugins for RxDB, including searchable fields and automatic timestamps.

## Install

```bash
npm i rxdb-extra --save
```

## Usage

```ts
import { addRxPlugin, createRxDatabase } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { RxDBSimpleSearchPlugin } from 'rxdb-extra';

addRxPlugin(RxDBSimpleSearchPlugin);

const database = await createRxDatabase({
  name: 'appdb',
  storage: getRxStorageMemory(),
});

await database.addCollections({
  users: {
    schema: {
      version: 0,
      primaryKey: 'id',
      type: 'object',
      properties: {
        id: { type: 'string', maxLength: 100 },
        name: { type: 'string' },
        age: { type: 'integer' },
        searchIndex: { type: 'string', default: '' },
      },
    },
    options: {
      searchable: {
        fields: ['name', 'age'], // required
        index: 'searchIndex',
      },
    },
  },
});

const doc = await database.users.insert({
  id: '1',
  name: 'Bill Gates',
  age: 67,
});

console.log(doc.toJSON().searchIndex); // "bill gates 67"
```

`searchable.fields` is required and defines which attributes are merged into the stored search string.

## Modify values before indexing

If you want to keep the default serializer but normalize a specific field first, use `modifier`.
This is useful for formatting date values.

```ts
options: {
  searchable: {
    fields: ['name', 'createdAt'],
    index: 'searchIndex',
    modifier: (value, field) =>
      field === 'createdAt' ? String(value ?? '').slice(0, 10) : value,
  },
}
```

## Custom serializer

```ts
options: {
  searchable: {
    fields: ['name', 'age'],
    index: 'searchIndex',
    serializer: (data, fields) =>
      fields.map((field) => String(data[field] ?? '')).join('|').toUpperCase(),
  },
}
```

You can then query the stored field with regular RxDB selectors, for example using `$regex`.

## Timestamps plugin

The timestamps plugin automatically maintains `createdAt` and `updatedAt` fields for each document.
It can be enabled per collection or at database level.
The timestamp fields must already be declared in `schema.properties`; the plugin does not mutate the schema.

```ts
import { addRxPlugin, createRxDatabase } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { RxDBTimestampsPlugin } from 'rxdb-extra';

addRxPlugin(RxDBTimestampsPlugin);

const database = await createRxDatabase({
  name: 'appdb',
  storage: getRxStorageMemory(),
  options: {
    timestamps: true,
  },
});

await database.addCollections({
  users: {
    schema: {
      version: 0,
      primaryKey: 'id',
      type: 'object',
      properties: {
        id: { type: 'string', maxLength: 100 },
        name: { type: 'string' },
        createdAt: { type: 'string', format: 'date-time', final: true },
        updatedAt: { type: 'string', format: 'date-time' },
      },
      required: ['id', 'name', 'createdAt', 'updatedAt'],
    },
  },
});
```

You can also customize the field names with:

```ts
options: {
  timestamps: {
    createdAt: 'created_on',
    updatedAt: 'updated_on',
  },
}
```

To format generated timestamps before save, use `modifier`:

```ts
options: {
  timestamps: {
    modifier: (value, field) =>
      value instanceof Date ? value.toISOString().slice(0, 10) : value,
  },
}
```
