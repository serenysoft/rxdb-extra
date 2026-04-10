# RxDB searchable fields plugin

This package derives a searchable string from document fields and stores it on the document through RxDB hooks.

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

## Transform values before indexing

If you want to keep the default serializer but normalize a specific field first, use `transform`.
This is useful for formatting date values.

```ts
options: {
  searchable: {
    fields: ['name', 'createdAt'],
    index: 'searchIndex',
    transform: (value, field) =>
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
