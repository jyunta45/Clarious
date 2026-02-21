import { pgTable, serial, integer, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userData = pgTable("user_data", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull().unique(),
  answers: jsonb("answers").default({}),
  messages: jsonb("messages").default([]),
  stage: text("stage").default("welcome").notNull(),
  step: text("step").default("0").notNull(),
  lang: text("lang").default("en").notNull(),
  mirror: text("mirror").default(""),
  tier: text("tier").default("free").notNull(),
  msgCount: integer("msg_count").default(0).notNull(),
  msgCountDate: text("msg_count_date").default(""),
  identityProfile: jsonb("identity_profile").default({}),
  memories: jsonb("memories").default([]),
  moodLog: jsonb("mood_log").default([]),
  threadSummaries: jsonb("thread_summaries").default({}),
  lastActiveDate: text("last_active_date").default(""),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertUserDataSchema = createInsertSchema(userData).omit({ id: true, updatedAt: true });
