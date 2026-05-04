import { afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import { addRxPlugin } from 'rxdb';
import { RxDBStrictSchemaPlugin } from '../src';
import { initDatabase, userSchema } from './database';

describe('StrictSchema plugin', () => {
  let database: any;

  beforeAll(() => {
    addRxPlugin(RxDBStrictSchemaPlugin);
  });

  afterEach(async () => {
    if (database) {
      await database.remove();
      database = undefined;
    }
  });

  it('should strip extra properties on insert', async () => {
    database = await initDatabase();

    await database.addCollections({
      users: {
        schema: userSchema,
      },
    });

    const inserted = await database.users.insert({
      id: '2',
      name: 'Alan Turing',
      age: 41,
      extraField: 'should be removed',
      anotherExtra: 123,
    });

    const data = inserted.toJSON();
    expect(data.name).toBe('Alan Turing');
    expect(data.age).toBe(41);
    expect(data).not.toHaveProperty('extraField');
    expect(data).not.toHaveProperty('anotherExtra');
  });

  it('should strip extra properties on save', async () => {
    database = await initDatabase();

    await database.addCollections({
      users: {
        schema: userSchema,
      },
    });

    await database.users.insert({
      id: '3',
      name: 'Margaret Hamilton',
      age: 37,
    });

    let user = await database.users.findOne('3').exec();
    await user.patch({ age: 38 });

    user = await database.users.findOne('3').exec();
    const data = user.toJSON();
    expect(data.age).toBe(38);
    expect(data).not.toHaveProperty('extraField');
  });

  it('should keep all schema-defined properties intact', async () => {
    database = await initDatabase();

    await database.addCollections({
      users: {
        schema: userSchema,
      },
    });

    const inserted = await database.users.insert({
      id: '4',
      name: 'Ada Lovelace',
      age: 36,
    });

    const data = inserted.toJSON();
    expect(data.id).toBe('4');
    expect(data.name).toBe('Ada Lovelace');
    expect(data.age).toBe(36);
  });
});
