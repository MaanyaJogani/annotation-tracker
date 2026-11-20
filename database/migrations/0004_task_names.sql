ALTER TABLE tasks ADD COLUMN name text NOT NULL DEFAULT '';
ALTER TABLE tasks ADD COLUMN type_number integer NOT NULL DEFAULT 0;
UPDATE tasks SET type_number = task_number, name = CASE WHEN task_type = 'review' THEN 'Review ' ELSE 'Task ' END || task_number;
CREATE SEQUENCE annotation_name_number;
CREATE SEQUENCE review_name_number;
SELECT setval('annotation_name_number', COALESCE((SELECT max(type_number) FROM tasks WHERE task_type = 'annotation'), 0) + 1, false);
SELECT setval('review_name_number', COALESCE((SELECT max(type_number) FROM tasks WHERE task_type = 'review'), 0) + 1, false);
CREATE FUNCTION assign_task_name() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prefix text;
BEGIN
  prefix := CASE WHEN NEW.task_type = 'review' THEN 'Review ' ELSE 'Task ' END;
  IF TG_OP = 'INSERT' OR NEW.task_type IS DISTINCT FROM OLD.task_type THEN
    NEW.type_number := nextval(CASE WHEN NEW.task_type = 'review' THEN 'review_name_number' ELSE 'annotation_name_number' END);
    IF TG_OP = 'UPDATE' THEN
      IF NEW.name = OLD.name AND OLD.name = (CASE WHEN OLD.task_type = 'review' THEN 'Review ' ELSE 'Task ' END || OLD.type_number) THEN
        NEW.name := '';
      END IF;
    END IF;
  END IF;
  IF btrim(NEW.name) = '' THEN NEW.name := prefix || NEW.type_number; END IF;
  NEW.name := btrim(NEW.name);
  RETURN NEW;
END;
$$;
CREATE TRIGGER tasks_assign_name BEFORE INSERT OR UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION assign_task_name();
