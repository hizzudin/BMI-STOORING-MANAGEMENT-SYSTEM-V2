-- §9.2 audit_logs, DEC-57, DEC-138: the one exception to append-only BR-10. The monthly archive job
-- deletes rows older than one year, after they are written to storage, in a transaction that marks
-- itself with SET LOCAL bmi.audit_archive = 'on'. Every UPDATE, and every other DELETE, is refused.
-- The other append-only tables keep refuse_change_of_append_only().

CREATE FUNCTION audit_log_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE'
     AND current_setting('bmi.audit_archive', true) = 'on'
     AND OLD.at < (now() AT TIME ZONE 'UTC') - interval '1 year' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION '% is append-only: % is not allowed (BR-10)', TG_TABLE_NAME, TG_OP;
END;
$$;

DROP TRIGGER audit_logs_append_only ON audit_logs;
CREATE TRIGGER audit_logs_append_only BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_log_append_only();
