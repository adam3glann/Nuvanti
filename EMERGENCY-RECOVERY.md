# Emergency lockdown recovery

The admin dashboard's **Download snapshot & lock down store** action pauses new checkout, revokes all staff sessions, clears active staff email sign-in challenges and password reset tokens, and blocks admin pages and staff sign-in. The snapshot contains customer and order personal data. Keep it in a restricted location.

## Restore admin and checkout access

1. Open the Railway project and select the PostgreSQL database used by the backend.
2. Open the database query tool.
3. Run this statement to disable the app lockdown:

   ```sql
   UPDATE emergency_lockdown
   SET is_active = FALSE, activated_at = NULL, activated_by = NULL
   WHERE id = 1;
   ```

4. Ask each staff member to sign in again. All prior sessions were invalidated.
5. If credentials or provider accounts may have been exposed, rotate the relevant passwords, API keys, database credentials, mail credentials, payment credentials, image-host credentials, and Railway application secrets in their provider dashboards. The app button cannot rotate those external secrets. Review Railway and provider audit logs, recent orders, admin changes, and backups before reopening the store.

This feature does not cancel existing orders, invalidate payment links already issued by a payment provider, block customer accounts, or stop payment-provider webhooks from updating existing transactions. It is an emergency containment control, not a substitute for incident investigation and provider-level credential rotation.
