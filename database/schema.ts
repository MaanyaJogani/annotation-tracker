import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";

export const approvalStatusEnum = pgEnum("approval_status", [
  "pending",
  "accepted",
  "rejected",
]);

export const kanbanGroupEnum = pgEnum("kanban_group", [
  "in_progress",
  "completed",
  "paid",
]);

export const rateSourceEnum = pgEnum("rate_source", ["auto", "manual"]);

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  minRate: numeric("min_rate", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  maxRate: numeric("max_rate", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const statuses = pgTable("statuses", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  kanbanGroup: kanbanGroupEnum("kanban_group").notNull(),
  color: text("color").notNull().default("#6b7280"),
  sortOrder: integer("sort_order").notNull().default(0),
  isDefault: boolean("is_default").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  showOnBoard: boolean("show_on_board").notNull().default(true),
});

export const tasks = pgTable("tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().default(""),
  payoutId: uuid("payout_id").references(() => weeklyPayouts.id, { onDelete: "set null" }),
  typeNumber: integer("type_number").notNull().default(0),
  taskNumber: integer("task_number").notNull().generatedByDefaultAsIdentity(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "restrict" }),
  taskUuid: text("task_uuid").notNull().default(""),
  stageUuid: text("stage_uuid").notNull().default(""),
  timeSpentMinutes: integer("time_spent_minutes").notNull().default(0),
  timerRemainderMs: integer("timer_remainder_ms").notNull().default(0),
  activeFocus: boolean("active_focus").notNull().default(false),
  taskType: text("task_type").notNull().default("annotation"),
  reviewJustification: text("review_justification").notNull().default(""),
  taskerFeedback: text("tasker_feedback").notNull().default(""),
  reviewWorkerEmail: text("review_worker_email").notNull().default(""),
  taskerDecision: text("tasker_decision"),
  timerStartedAt: timestamp("timer_started_at", { withTimezone: true }),
  statusId: uuid("status_id").references(() => statuses.id, {
    onDelete: "set null",
  }),
  approvalStatus: approvalStatusEnum("approval_status")
    .notNull()
    .default("pending"),
  reviewerComment: text("reviewer_comment").notNull().default(""),
  startAt: timestamp("start_at", { withTimezone: true }),
  endAt: timestamp("end_at", { withTimezone: true }),
  minRate: numeric("min_rate", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  maxRate: numeric("max_rate", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  uniqueIndex("tasks_one_active_focus").on(table.activeFocus).where(sql`${table.activeFocus} = true`),
  check("tasks_timer_remainder_valid", sql`${table.timerRemainderMs} >= 0 AND ${table.timerRemainderMs} < 60000`),
  check("tasks_task_type_valid", sql`${table.taskType} IN ('annotation', 'review')`),
  check("tasks_tasker_decision_valid", sql`${table.taskerDecision} IS NULL OR ${table.taskerDecision} IN ('pass', 'fail')`),
]);

export const weeklyPayouts = pgTable("weekly_payouts", {
  id: uuid("id").defaultRandom().primaryKey(),
  paidOn: date("paid_on"),
  weekNumber: integer("week_number").notNull().generatedAlwaysAsIdentity(),
  startDate: date("start_date"),
  endDate: date("end_date"),
  payoutUsd: numeric("payout_usd", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  payoutInr: numeric("payout_inr", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  workerEmail: text("worker_email").notNull().default(""),
  usdInrRate: numeric("usd_inr_rate", { precision: 10, scale: 4 }),
  rateSource: rateSourceEnum("rate_source").notNull().default("auto"),
  rateUpdatedAt: timestamp("rate_updated_at", { withTimezone: true }),
});
