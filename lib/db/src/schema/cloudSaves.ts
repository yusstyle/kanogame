import { pgTable, uuid, integer, jsonb, varchar, bigint, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { usersTable } from "./users";

export const cloudSavesTable = pgTable(
  "cloud_saves",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    saveVersion: integer("save_version").default(1).notNull(),
    revision: integer("revision").default(1).notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    checksum: varchar("checksum", { length: 64 }).notNull(),
    clientSavedAt: bigint("client_saved_at", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("cloud_saves_user_id_idx").on(table.userId),
    index("cloud_saves_updated_at_idx").on(table.updatedAt),
  ],
);

export const insertCloudSaveSchema = createInsertSchema(cloudSavesTable);
export const selectCloudSaveSchema = createSelectSchema(cloudSavesTable);

export type CloudSave = typeof cloudSavesTable.$inferSelect;
export type InsertCloudSave = typeof cloudSavesTable.$inferInsert;

