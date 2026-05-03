import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgSchema,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// Supabase's built-in auth schema. We only reference auth.users(id) so
// owner_id FKs cascade when a user is deleted — we never insert or read
// from auth.users via drizzle.
const authSchema = pgSchema("auth");
const authUsers = authSchema.table("users", {
  id: uuid("id").primaryKey(),
});

// Projects: user-owned folders grouping related figures. Mirrors
// supabase/migrations/0002_projects.sql.
export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("Untitled Project"),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("projects_owner_id_updated_at_idx").on(
      t.ownerId,
      t.updatedAt.desc()
    ),
  ]
);

// Figures: one row per document. Canvas state lives in `content` as JSONB.
// Mirrors supabase/migrations/0001_figures.sql + the project_id column
// added in 0002_projects.sql.
export const figures = pgTable(
  "figures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    title: text("title").notNull().default("Untitled Figure"),
    content: jsonb("content")
      .notNull()
      .default(sql`'{"pages":[]}'::jsonb`),
    thumbnailUrl: text("thumbnail_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastOpenedAt: timestamp("last_opened_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("figures_owner_id_updated_at_idx").on(
      t.ownerId,
      t.updatedAt.desc()
    ),
    index("figures_project_id_updated_at_idx").on(
      t.projectId,
      t.updatedAt.desc()
    ),
  ]
);

// User-uploaded visuals (SVG + rasters) in Supabase bucket `custom-images`.
export const customImages = pgTable(
  "custom_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    format: text("format").notNull(),
    storagePath: text("storage_path").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    width: integer("width"),
    height: integer("height"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("custom_images_owner_id_created_at_idx").on(
      t.ownerId,
      t.createdAt.desc()
    ),
  ]
);

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Figure = typeof figures.$inferSelect;
export type NewFigure = typeof figures.$inferInsert;
export type CustomImage = typeof customImages.$inferSelect;
export type NewCustomImage = typeof customImages.$inferInsert;
