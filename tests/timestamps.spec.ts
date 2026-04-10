import { afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import { addRxPlugin } from 'rxdb';
import { RxDBTimestampsPlugin } from '../src';
import { initDatabase, userSchema } from './database';

const timestampedUserSchema = {
  ...userSchema,
  properties: {
    ...userSchema.properties,
    createdAt: {
      type: 'string',
      format: 'date-time',
      final: true,
    },
    updatedAt: {
      type: 'string',
      format: 'date-time',
    },
  },
};

const customTimestampUserSchema = {
  ...userSchema,
  properties: {
    ...userSchema.properties,
    created_on: {
      type: 'string',
      format: 'date-time',
      final: true,
    },
    updated_on: {
      type: 'string',
      format: 'date-time',
    },
  },
};

const formattedTimestampUserSchema = {
  ...userSchema,
  properties: {
    ...userSchema.properties,
    createdAt: {
      type: 'string',
      final: true,
    },
    updatedAt: {
      type: 'string',
    },
  },
};

describe('Timestamps plugin', () => {
  let database: any;

  beforeAll(() => {
    addRxPlugin(RxDBTimestampsPlugin);
  });

  afterEach(async () => {
    if (database) {
      await database.remove();
      database = undefined;
    }
  });

  it('should throw when timestamp fields are not declared in schema.properties', async () => {
    database = await initDatabase();

    await expect(
      database.addCollections({
        users: {
          schema: userSchema,
          options: {
            timestamps: true,
          },
        },
      }),
    ).rejects.toThrow('schema.properties');
  });

  it('should add createdAt and updatedAt fields and keep createdAt stable across updates', async () => {
    database = await initDatabase();

    await database.addCollections({
      users: {
        schema: timestampedUserSchema,
        options: {
          timestamps: true,
        },
      },
    });

    const inserted = await database.users.insert({
      id: '1',
      name: 'Grace Hopper',
      age: 85,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    });

    expect(inserted.toJSON().createdAt).toBe('2024-01-01T00:00:00.000Z');
    expect(inserted.toJSON().updatedAt).toBe('2024-01-01T00:00:00.000Z');

    let user = await database.users.findOne('1').exec();
    await user.patch({
      age: 86,
    });

    user = await database.users.findOne('1').exec();

    expect(user.toJSON().createdAt).toBe('2024-01-01T00:00:00.000Z');
    expect(user.toJSON().updatedAt).not.toBe('2024-01-01T00:00:00.000Z');
  });

  it('should support custom timestamp field names', async () => {
    database = await initDatabase();

    await database.addCollections({
      users: {
        schema: customTimestampUserSchema,
        options: {
          timestamps: {
            createdAt: 'created_on',
            updatedAt: 'updated_on',
          },
        },
      },
    });

    const inserted = await database.users.insert({
      id: '2',
      name: 'Alan Turing',
      age: 41,
    });

    expect(typeof inserted.toJSON().created_on).toBe('string');
    expect(typeof inserted.toJSON().updated_on).toBe('string');
  });

  it('should support a transform to format dates before save', async () => {
    database = await initDatabase();

    await database.addCollections({
      users: {
        schema: formattedTimestampUserSchema,
        options: {
          timestamps: {
            transform: (value: unknown) =>
              value instanceof Date ? value.toISOString().slice(0, 10) : value,
          },
        },
      },
    });

    const inserted = await database.users.insert({
      id: '3',
      name: 'Margaret Hamilton',
      age: 37,
    });

    expect(inserted.toJSON().createdAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(inserted.toJSON().updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should allow enabling timestamps from database options', async () => {
    database = await initDatabase({
      options: {
        timestamps: true,
      },
    });

    await database.addCollections({
      users: {
        schema: timestampedUserSchema,
      },
    });

    const inserted = await database.users.insert({
      id: '4',
      name: 'Margaret Hamilton',
      age: 37,
    });

    expect(typeof inserted.toJSON().createdAt).toBe('string');
    expect(typeof inserted.toJSON().updatedAt).toBe('string');
  });
});
