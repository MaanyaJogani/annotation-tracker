CREATE TYPE "public"."approval_status" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."kanban_group" AS ENUM('in_progress', 'completed', 'paid');--> statement-breakpoint
CREATE TYPE "public"."rate_source" AS ENUM('auto', 'manual');--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"min_rate" numeric(10, 2) DEFAULT '0' NOT NULL,
	"max_rate" numeric(10, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"worker_email" text DEFAULT '' NOT NULL,
	"usd_inr_rate" numeric(10, 4),
	"rate_source" "rate_source" DEFAULT 'auto' NOT NULL,
	"rate_updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "statuses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kanban_group" "kanban_group" NOT NULL,
	"color" text DEFAULT '#6b7280' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"show_on_board" boolean DEFAULT true NOT NULL,
	CONSTRAINT "statuses_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_number" integer GENERATED ALWAYS AS IDENTITY (sequence name "tasks_task_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"project_id" uuid NOT NULL,
	"task_uuid" text DEFAULT '' NOT NULL,
	"stage_uuid" text DEFAULT '' NOT NULL,
	"time_spent_minutes" integer DEFAULT 0 NOT NULL,
	"timer_started_at" timestamp with time zone,
	"status_id" uuid,
	"approval_status" "approval_status" DEFAULT 'pending' NOT NULL,
	"reviewer_comment" text DEFAULT '' NOT NULL,
	"start_at" timestamp with time zone,
	"end_at" timestamp with time zone,
	"min_rate" numeric(10, 2) DEFAULT '0' NOT NULL,
	"max_rate" numeric(10, 2) DEFAULT '0' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"week_number" integer GENERATED ALWAYS AS IDENTITY (sequence name "weekly_payouts_week_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"start_date" date,
	"end_date" date,
	"payout_usd" numeric(12, 2) DEFAULT '0' NOT NULL,
	"payout_inr" numeric(12, 2) DEFAULT '0' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_status_id_statuses_id_fk" FOREIGN KEY ("status_id") REFERENCES "public"."statuses"("id") ON DELETE set null ON UPDATE no action;