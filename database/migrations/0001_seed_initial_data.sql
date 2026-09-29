-- Seed: default task statuses and the singleton settings row.
-- Idempotent: safe to run on any database state.

INSERT INTO statuses (name, kanban_group, color, sort_order, is_default, show_on_board) VALUES
  ('In Progress',   'in_progress', '#f59e0b', 0, true,  true),
  ('Completed',     'completed',   '#10b981', 1, false, true),
  ('Paid & Closed', 'paid',        '#8b5cf6', 2, false, true),
  ('Revoked',       'in_progress', '#ef4444', 3, false, false)
ON CONFLICT (name) DO NOTHING;

INSERT INTO settings (id, worker_email) VALUES (1, '')
ON CONFLICT (id) DO NOTHING;
