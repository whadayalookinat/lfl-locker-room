# Username/password account pilot (v0.5)

**Prepared in GitHub only; not deployed. Do not invite participants yet.**

## Agreed design
- Participant enters an editable username and commissioner-issued password; no participant email required.
- Auth stores a random opaque internal email per account, unrelated to the username. Existing email-based test accounts remain unchanged.
- The permanent Supabase Auth UUID connects login, profile, comments and seasonal teams. Renaming a username does not change the UUID or internal email.
- `commissioner-create-member` validates an active commissioner's bearer token and creates a non-commissioner Auth account plus profile. No real roster members are created automatically.
- `username-login` looks up the username **on the server**, authenticates with Supabase Auth, and returns session tokens to the browser. The browser will use `supabase.auth.setSession()` once a future UI is implemented.
- Never put the Supabase service-role secret in GitHub Pages, browser JavaScript, or chat.

## Deployment blockers / QA checklist
1. Add effective **server-side login rate limiting** (per IP and username, with reasonable abuse controls) before exposing the username-login endpoint. Supabase Auth limits alone may not sufficiently protect the username-lookup endpoint. CORS is not authentication.
2. Confirm Supabase Auth accepts internal `@locker-room.invalid` identifiers with `email_confirm: true` in this project. If not, choose a controlled internal domain before provisioning accounts.
3. Review how account recovery works when participants have no email address. Commissioner-only password reset source is now prepared in `supabase/functions/commissioner-reset-password/index.ts`; it has not been deployed or tested. It refuses self-resets and resets of other commissioners, and accepts the permanent user UUID rather than editable username. An administrator must deliver the new password securely. Existing sessions may remain valid after a password change, so session revocation needs separate verification before launch.
4. Deploy both Edge Functions in Supabase, verify environment secrets and platform JWT settings. The public username-login function cannot require a logged-in JWT; the commissioner-create-member function must verify commissioner identity (and ideally platform JWT verification).
5. Verify anonymous and regular-participant callers cannot create users; confirm commissioner creation of **one dummy user**; test duplicate usernames, failed profile creation/cleanup, deactivation, username changes, and session handling.
6. Implement and test the username login UI separately from existing working email-based pilot pages. Do not replace production until the new flow passes.
7. Keep the 29-person roster preview as review-only until all security tests pass.

**Existing Supabase users:** Doug and testplayer2 were created with email/password in the previous pilot. The username-login function can resolve those existing Auth emails too; no migration of their Auth identities is needed.

## Next isolated password-reset QA
1. Deploy only after reviewing authentication configuration and endpoint security.
2. Verify no token returns 401 and ordinary participant token returns 403.
3. Verify an active commissioner can reset the `testplayer2` dummy account using its UUID, without altering its profile, comments, or team assignments.
4. Verify the new password works and the old password fails for new logins; separately test whether previously issued sessions remain active.
5. Verify the function rejects commissioner targets and the caller's own account.
6. Avoid printing, logging, committing, or sharing passwords in chat.
