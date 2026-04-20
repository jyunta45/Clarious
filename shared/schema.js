import { pgTable, serial, integer, text, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
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
  patterns: jsonb("patterns").default({}),
  memorySeeded: boolean("memory_seeded").default(false),
  lastIdentityUpdate: timestamp("last_identity_update"),
  lastOpeningMessage: text("last_opening_message").default(""),
  userSentMessageToday: boolean("user_sent_message_today").default(false),
  guidanceMode: boolean("guidance_mode").default(false),
  guidanceDay: integer("guidance_day").default(0),
  lastGuidanceDate: text("last_guidance_date").default(""),
  lastActiveAt: text("last_active_at").default(""),
  guidanceDayOpenCount: integer("guidance_day_open_count").default(0),
  openLoops: jsonb("open_loops").default([]),
  onboardingMode: text("onboarding_mode").default("conversational"),
  onboardingComplete: boolean("onboarding_complete").default(false),
  onboardingCompletedAt: text("onboarding_completed_at").default(""),
  onboardingProgress: jsonb("onboarding_progress").default({}),
  onboardingState: jsonb("onboarding_state").default({}),
  deepSessionId: integer("deep_session_id").default(0),
  deepSessionSummaries: jsonb("deep_session_summaries").default([]),
  memoryDigest: text("memory_digest"),
  memoryDigestUpdatedAt: text("memory_digest_updated_at"),
  tierUpdatedAt: text("tier_updated_at").default(""),
  stripeCustomerId: text("stripe_customer_id").default(""),
  stripeSubscriptionId: text("stripe_subscription_id").default(""),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertUserDataSchema = createInsertSchema(userData).omit({ id: true, updatedAt: true });
