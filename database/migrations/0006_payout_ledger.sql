ALTER TABLE weekly_payouts ADD COLUMN paid_on date;
--> statement-breakpoint
ALTER TABLE tasks ADD COLUMN payout_id uuid REFERENCES weekly_payouts(id) ON DELETE SET NULL;
