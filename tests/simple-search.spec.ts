import { afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import { addRxPlugin } from 'rxdb';
import { defaultSearchSerializer, RxDBSimpleSearchPlugin } from '../src';
import { initDatabase, userSchema } from './database';

describe('Search plugin', () => {
  let database: any;

  beforeAll(() => {
    addRxPlugin(RxDBSimpleSearchPlugin);
  });

  afterEach(async () => {
    if (database) {
      await database.remove();
      database = undefined;
    }
  });

  it('should populate the configured index from searchable.fields and searchable.index', async () => {
    database = await initDatabase();

    await database.addCollections({
      users: {
        schema: userSchema,
        options: {
          searchable: {
            fields: ['name', 'age'],
            index: 'searchIndex',
          },
        },
      },
    });

    const inserted = await database.users.insert({
      id: '1',
      name: 'Bill Gates',
      age: 67,
    });

    expect(inserted.toJSON().searchIndex).toBe('bill gates 67');

    let user = await database.users.findOne('1').exec();
    await user.patch({
      name: 'Max Lynch',
      age: 32,
    });

    user = await database.users.findOne('1').exec();
    expect(user.toJSON().searchIndex).toBe('max lynch 32');
  });

  it('should throw when searchable.fields is not defined', async () => {
    database = await initDatabase();

    await expect(
      database.addCollections({
        users: {
          schema: userSchema,
          options: {
            searchable: {
              index: 'searchIndex',
            },
          },
        },
      }),
    ).rejects.toThrow('searchable.fields');
  });

  it('should support a custom serializer', async () => {
    database = await initDatabase();

    await database.addCollections({
      users: {
        schema: userSchema,
        options: {
          searchable: {
            fields: ['name', 'age'],
            index: 'searchIndex',
            serializer: (data: Record<string, unknown>, fields: string[]) =>
              fields
                .map((field) => String(data[field] ?? ''))
                .join('|')
                .toUpperCase(),
          },
        },
      },
    });

    const inserted = await database.users.insert({
      id: '1',
      name: 'Mark Zuckerberg',
      age: 39,
    });

    expect(inserted.toJSON().searchIndex).toBe('MARK ZUCKERBERG|39');
  });

  it('should support a custom target field', async () => {
    database = await initDatabase();

    await database.addCollections({
      users: {
        schema: {
          ...userSchema,
          properties: {
            ...userSchema.properties,
            searchSummary: {
              type: 'string',
              default: '',
            },
          },
        },
        options: {
          searchable: {
            fields: ['name'],
            index: 'searchSummary',
          },
        },
      },
    });

    const inserted = await database.users.insert({
      id: '1',
      name: 'Jeff Bezos',
      age: 59,
    });

    expect(inserted.toJSON().searchSummary).toBe('jeff bezos');
  });

  it('should support field paths that read from referenced documents', async () => {
    database = await initDatabase();

    await database.addCollections({
      departments: {
        schema: {
          version: 0,
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
          },
          required: ['id', 'name'],
        },
      },
      users: {
        schema: {
          ...userSchema,
          properties: {
            ...userSchema.properties,
            department: {
              type: 'string',
              ref: 'departments',
            },
          },
        },
        options: {
          searchable: {
            fields: ['name', 'department.name'],
            index: 'searchIndex',
          },
        },
      },
    });

    await database.departments.insert({
      id: 'dep-1',
      name: 'Engineering',
    });

    const inserted = await database.users.insert({
      id: '1',
      name: 'Grace Hopper',
      age: 85,
      department: 'dep-1',
    });

    expect(inserted.toJSON().searchIndex).toBe('grace hopper engineering');
  });

  it('should support a modifier to format date values', () => {
    const createdAt = new Date('2024-03-15T10:20:30.000Z');

    const searchIndex = defaultSearchSerializer(
      {
        name: 'Ada Lovelace',
        createdAt,
      },
      ['name', 'createdAt'],
      (value: unknown, field: string) =>
        field === 'createdAt' && value instanceof Date
          ? value.toISOString().slice(0, 10)
          : value,
    );

    expect(searchIndex).toBe('ada lovelace 2024-03-15');
  });

  it('should add a search method that merges text with a MangoQuery selector', async () => {
    database = await initDatabase();

    await database.addCollections({
      users: {
        schema: userSchema,
        options: {
          searchable: {
            fields: ['name', 'age'],
            index: 'searchIndex',
          },
        },
      },
    });

    await database.users.bulkInsert([
      { id: '1', name: 'Bill Gates', age: 67 },
      { id: '2', name: 'Steve Jobs', age: 67 },
      { id: '3', name: 'Ada Lovelace', age: 36 },
    ]);

    const results = await database.users
      .search('gates', {
        selector: {
          age: 67,
        },
      })
      .exec();

    expect(results).toHaveLength(1);
    expect(results[0].toJSON().name).toBe('Bill Gates');
  });
});
