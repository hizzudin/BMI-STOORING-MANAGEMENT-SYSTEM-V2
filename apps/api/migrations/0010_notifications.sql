-- §9.12 in-app notifications (REQ-NTF-001, REQ-NTF-005, DEC-125): the notice and its InApp delivery
-- are written in the transaction of the event (the outbox of 8.3); the Push worker comes with the app.

CREATE TABLE notifications (                  -- the only notifications table; in-app from release 1
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  kind VARCHAR(20) NOT NULL CHECK (kind IN ('Approval','Step','Alert','Schedule','Change_Request')),
  title VARCHAR(200) NOT NULL,
  body TEXT,
  link_record VARCHAR(60),
  dedupe_key VARCHAR(120),                    -- DEC-125: one notice per user and event
  read_at TIMESTAMP,
  UNIQUE (user_id, dedupe_key)
);
CREATE INDEX ix_notifications_user_unread ON notifications (user_id, read_at, id);

CREATE TABLE notification_deliveries (        -- one row per channel and device
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP,
  notification_id BIGINT NOT NULL REFERENCES notifications(id) ON DELETE RESTRICT,
  channel VARCHAR(10) NOT NULL CHECK (channel IN ('InApp','Push')),
  device_id BIGINT,                           -- reference added with push_devices (the mobile push task)
  status VARCHAR(10) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Sent','Failed')),
  sent_at TIMESTAMP
);
CREATE INDEX ix_notification_deliveries_notification ON notification_deliveries (notification_id);
