import { pgTable, serial, integer, text, timestamp, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
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
  answers: jsonb("answers").$type<Record<string, string>>().default({}),
  messages: jsonb("messages").$type<Array<{ role: string; content: string }>>().default([]),
  stage: text("stage").default("welcome").notNull(),
  step: text("step").default("0").notNull(),
  lang: text("lang").default("en").notNull(),
  mirror: text("mirror").default(""),
  tier: text("tier").default("free").notNull(),
  msgCount: integer("msg_count").default(0).notNull(),
  msgCountDate: text("msg_count_date").default(""),
  identityProfile: jsonb("identity_profile").$type<Record<string, any>>().default({}),
  memories: jsonb("memories").$type<Array<{ id: string; fact: string; tags: string[]; date: string; source: string }>>().default([]),
  moodLog: jsonb("mood_log").$type<Array<{ date: string; score: number; note: string; hour?: number }>>().default([]),
  threadSummaries: jsonb("thread_summaries").$type<Record<string, string>>().default({}),
  lastActiveDate: text("last_active_date").default(""),
  patterns: jsonb("patterns").$type<{
    topics: Record<string, number>;
    recurringChallenges: Array<{ text: string; count: number; firstSeen: string; lastSeen: string }>;
    activityLog: Array<{ date: string; hour: number; msgCount: number }>;
    goalProgress: Array<{ goal: string; mentions: number; lastMentioned: string; status: string }>;
    weeklyTopics: Record<string, Record<string, number>>;
  }>().default({ topics: {}, recurringChallenges: [], activityLog: [], goalProgress: [], weeklyTopics: {} }),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertUserDataSchema = createInsertSchema(userData).omit({ id: true, updatedAt: true });

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UserData = typeof userData.$inferSelect;
