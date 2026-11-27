-- TASK-202: the steps of an SPK are frozen at approval (DEC-145, DEC-146). While the SPK is not
-- Draft or Rejected, a step cannot be added, removed, moved to another SPK, or changed in its
-- structure; its lifecycle columns (status, times, executor, verifier, location) stay writable.
-- A change request applies an approved revision with SET LOCAL bmi.step_revision = 'on' (TASK-611),
-- as the audit archive does with bmi.audit_archive (migration 0013).

CREATE FUNCTION refuse_change_of_frozen_step() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  spk_status spk_status_t;
BEGIN
  IF current_setting('bmi.step_revision', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  SELECT status INTO spk_status FROM spks
    WHERE id = CASE WHEN TG_OP = 'INSERT' THEN NEW.spk_id ELSE OLD.spk_id END;
  IF spk_status IN ('Draft', 'Rejected') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'UPDATE'
     AND NEW.spk_id IS NOT DISTINCT FROM OLD.spk_id
     AND NEW.sequence_no IS NOT DISTINCT FROM OLD.sequence_no
     AND NEW.module IS NOT DISTINCT FROM OLD.module
     AND NEW.step_config IS NOT DISTINCT FROM OLD.step_config
     AND NEW.is_optional IS NOT DISTINCT FROM OLD.is_optional
     AND NEW.executor_roles IS NOT DISTINCT FROM OLD.executor_roles
     AND NEW.verifier_role IS NOT DISTINCT FROM OLD.verifier_role THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'The steps of this SPK are frozen at approval: % is not allowed (DEC-145)', TG_OP;
END;
$$;

CREATE TRIGGER spk_assignments_frozen BEFORE INSERT OR UPDATE OR DELETE ON spk_assignments
  FOR EACH ROW EXECUTE FUNCTION refuse_change_of_frozen_step();
