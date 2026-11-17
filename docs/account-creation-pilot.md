# Commissioner account creation pilot (v0.5)

This is **prepared source**, not deployed. The GitHub Pages site cannot safely call Supabase Auth admin APIs directly.

## Security design
- Supabase Edge Function holds the service-role credential server-side; never copy that key into browser JS, SQL screenshots, or GitHub.
- Requires a valid logged-in Supabase Auth session; checks the calling user's current active commissioner status in the database on every request.
- Only POST from the Locker Room GitHub Pages origin is accepted; CORS is a browser safeguard, **not** the authorization boundary.
- Creates an ordinary (non-commissioner) Auth user and matching active `league_members` profile. Attempts Auth cleanup if profile creation fails.
- Returns no password. Account creation does not assign teams, import roster members, or grant commissioner roles.
- This pilot uses **email/password login**, matching the current working test pages. Username-based login and password resets are separate features.
- Real participants should **not** be provisioned until the function has been deployed, authorization-denial tests passed, and the intended login identifier strategy is agreed.

## Deployment checklist (Supabase Dashboard)
1. In the existing Supabase project, go to **Edge Functions** and create `commissioner-create-member` using `supabase/functions/commissioner-create-member/index.ts`.
2. Keep JWT verification **enabled** at the platform layer when available. This function also independently validates the JWT and commissioner status.
3. The function expects the standard Supabase environment variables `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` available to Edge Functions. Verify these in Supabase's function secrets settings; do not paste secret values into chat.
4. Do not deploy a public account-creation form until testing. First test unauthenticated requests (401), participant requests (403), then one commissioner-created dummy account (201).
5. Test duplicate username, invalid inputs, and rollback behavior; review Auth Users and `league_members` together.

**Note:** A real email address is required by this pilot. We have not yet decided whether the final product should use private real emails or a synthetic internal login scheme. Do not create the 29 roster accounts until that decision is made.
