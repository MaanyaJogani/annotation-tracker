ALTER TABLE "tasks" ADD COLUMN "timer_remainder_ms" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "active_focus" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "task_type" text DEFAULT 'annotation' NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "review_worker_email" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "tasker_decision" text;--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_one_active_focus" ON "tasks" USING btree ("active_focus") WHERE "tasks"."active_focus" = true;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_timer_remainder_valid" CHECK ("tasks"."timer_remainder_ms" >= 0 AND "tasks"."timer_remainder_ms" < 60000);--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_task_type_valid" CHECK ("tasks"."task_type" IN ('annotation', 'review'));--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_tasker_decision_valid" CHECK ("tasks"."tasker_decision" IS NULL OR "tasks"."tasker_decision" IN ('pass', 'fail'));--> statement-breakpoint
-- Derive focus eligibility from status so all task creation/edit paths share the rule.
CREATE FUNCTION sync_task_active_focus() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE active boolean;
DECLARE elapsed_ms bigint;
BEGIN
  SELECT kanban_group = 'in_progress' AND show_on_board INTO active FROM statuses WHERE id = NEW.status_id;
  NEW.active_focus := coalesce(active, false);
  IF TG_OP = 'UPDATE' AND OLD.active_focus AND NOT NEW.active_focus THEN
    IF NEW.timer_started_at IS NOT NULL THEN
      elapsed_ms := NEW.time_spent_minutes::bigint * 60000 + NEW.timer_remainder_ms
        + greatest(0, floor(extract(epoch FROM (clock_timestamp() - NEW.timer_started_at)) * 1000)::bigint);
      NEW.time_spent_minutes := elapsed_ms / 60000;
      NEW.timer_remainder_ms := elapsed_ms % 60000;
      NEW.timer_started_at := NULL;
    END IF;
    NEW.end_at := coalesce(NEW.end_at, clock_timestamp());
  END IF;
  IF NEW.timer_started_at IS NOT NULL AND NOT NEW.active_focus THEN
    RAISE EXCEPTION 'Only the in-progress task can run a timer' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER tasks_sync_active_focus BEFORE INSERT OR UPDATE ON tasks
FOR EACH ROW EXECUTE FUNCTION sync_task_active_focus();
--> statement-breakpoint
-- Fail safely if existing data has multiple active tasks; never silently discard work.
UPDATE tasks SET active_focus = active_focus;
