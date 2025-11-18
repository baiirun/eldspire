import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const pages = sqliteTable('pages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  content: text('content')
});
