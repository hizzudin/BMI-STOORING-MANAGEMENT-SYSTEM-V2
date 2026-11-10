-- DEC-117, REQ-IAM-005: approvals stay with the Supervisor, GM and System Admin, and managing
-- accounts stays with Access Managers, so these cells are off and locked for every other role.
-- defaultRolePermissions() in @bmi/shared holds the same rule; an integration test keeps them equal.
UPDATE role_permissions
SET allowed = false, is_locked = true
WHERE (permission_code IN ('spk.approve', 'count.approve')
       AND role NOT IN ('Supervisor', 'GM', 'System_Admin'))
   OR (permission_code IN ('accounts.manage', 'iam.planner_approval_switch')
       AND role <> 'Access_Manager');
