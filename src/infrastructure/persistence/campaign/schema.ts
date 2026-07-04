import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const campaigns = sqliteTable('campaigns', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  config: text('config', { mode: 'json' }).notNull(),
  platform: text('platform', { mode: 'json' }).notNull(),
  objective: text('objective').notNull(),
  totalBudget: integer('total_budget').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  currentVersion: integer('current_version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const campaignVersions = sqliteTable('campaign_versions', {
  id: text('id').primaryKey(),
  campaignId: text('campaign_id').references(() => campaigns.id),
  version: integer('version').notNull(),
  config: text('config', { mode: 'json' }).notNull(),
  diffs: text('diffs', { mode: 'json' }),
  timestamp: text('timestamp').notNull(),
  authoredBy: text('authored_by').notNull(),
  commitMessage: text('commit_message').notNull(),
});
