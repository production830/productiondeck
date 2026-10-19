# Tatamata Productiondeck

A private visual library of your company's locations, props, and casting talent, with a light Tatamata workspace, photos, tags, combined filters, and shared Project Decks for commercial shoots.

## Free hosting setup

This version is designed for **Cloudflare Workers Free + Supabase Free**. It does not require a Render server, a paid disk, Vercel Pro, an R2 subscription, or a purchased domain. Use the supplied `workers.dev` address.

Free means within provider quotas, not unlimited storage. At the time this setup was prepared, Supabase Free includes 1 GB file storage and a 500 MB database. It may pause inactive projects after a week. Cloudflare Workers Free includes 100,000 dynamic requests per day; static asset requests are free. Usage beyond free limits can interrupt service. Stay on Free plans and do not enable paid upgrades to follow this setup.

Official limits: [Supabase pricing](https://supabase.com/pricing), [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).

Photos are converted in your browser to JPEG, maximum 1600 pixels along the longest side, before upload. This saves storage and bandwidth. These are browsing copies, not an archive of your full-resolution originals. Keep originals in your existing company storage.

## 1. Create a Supabase Free project

1. Sign up at [Supabase](https://supabase.com/dashboard) using your company account. Choose a **Free** organization and create a **dedicated new project** named `productiondeck`.
2. Save your database password privately. It is not a website login and is not an app setting.
3. Open **SQL Editor**, create a query, paste all of [`supabase/migrations/001_productiondeck.sql`](supabase/migrations/001_productiondeck.sql), and run it. Then run [`supabase/migrations/002_twenty_photos.sql`](supabase/migrations/002_twenty_photos.sql) to enable 20-photo records. These queries create four `pd_` tables and a **private** `productiondeck-photos` bucket. Keep that bucket private and do not add public storage policies.
4. In **Authentication → Sign In / Providers**, disable **Allow new users to sign up**. Password/email sign-in must remain enabled. The admin API can create coworkers while public signup is disabled.
5. Open **Authentication → Users → Add user → Create new user**. Enter your company administrator email and a unique password of at least 12 characters. Enable **Auto Confirm User** when available. This creates your first website account without requiring an invitation email.
6. In SQL Editor, run the following after replacing `YOUR_ADMIN_EMAIL` privately with the email you just used:

```sql
insert into public.pd_members (id, email, name, admin)
select id, email, 'Administrator', true
from auth.users
where lower(email) = lower('YOUR_ADMIN_EMAIL')
on conflict (id) do update set admin = true;

select id, email, name, admin from public.pd_members;
```

Confirm your administrator appears in the result. A Supabase Auth account alone does not grant library access; membership is checked on every protected request.

7. Find your **Project URL**, **anon** API key, and **service_role** API key in project settings. These JWT keys may be under **Legacy API Keys**. Do not use the database password as an API key. Keep the service_role key private: it belongs only in Cloudflare's encrypted secrets. Do not put it in GitHub, browser JavaScript, screenshots, or chat.

## 2. Deploy on Cloudflare Workers Free

1. Sign up or sign in at [Cloudflare](https://dash.cloudflare.com/) using your company account. Stay on the **Workers Free** plan.
2. Open **Workers & Pages → Create application → Import a repository** (or **Connect GitHub** under Workers).
3. Authorize the GitHub account that owns this repository, then select `production830/productiondeck` and branch `main`.
4. Use the **Worker** flow, not a static-only Pages deployment. The Worker name must match `productiondeck` in `wrangler.jsonc`.
5. Build command: `npm test`. Deploy command: `npx wrangler@4 deploy`. Root directory: repository root. No npm dependencies or frontend build are required.
6. Deploy. The first deployment can show the login screen, but signing in will say the library is not configured until you add the following **runtime** settings under **Worker → Settings → Variables and Secrets**:

| Name | Type | Value |
| --- | --- | --- |
| `SUPABASE_URL` | Text or secret | Your Supabase Project URL |
| `SUPABASE_ANON_KEY` | Secret | Your Supabase legacy anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | Your Supabase legacy service_role key |

Add them as Worker runtime bindings, not merely Git build variables. Save/deploy the updated settings. The supplied Wrangler file intentionally contains no secrets. If you create a separate preview or staging Worker, leave production keys off it or use a separate Supabase test project.

7. Open the generated HTTPS `workers.dev` URL and sign in with your administrator account. No custom domain purchase is needed.
8. Create a reference with a photo, add tags and a Project Deck, then reload and confirm it remains. Sign out and confirm both records and a copied `/media/...` image URL are inaccessible. Test a second teammate's account.

If a project-creation screen asks you to upgrade, subscribe, or enter payment details, stop and check that you selected the Free plan and did not add a paid service. This setup does not intentionally provision billable resources.

## 3. Add teammates

Open **Manage team** from your administrator account. Create a name, email, and temporary password for each person. Share their password privately; no email is sent. They can change it using the settings icon beside their name.

All members can view, create, edit, and delete the shared references and Project Decks. Only admins can manage membership. Removing a member blocks their library requests immediately, including photo requests, even if their login token has not expired. Password changes clear the current browser session and revoke refresh tokens; existing access tokens on other devices may last until Supabase's configured JWT expiry. Account removal is the immediate way to revoke library access.

If a teammate cannot sign in, use **Manage team → Reset password** next to their existing account. Set a new temporary password of at least 12 characters and share it privately. This also confirms that existing authorized teammate's email without deleting their membership, changing their permissions, or modifying library records. Before reporting success, the app now verifies a password sign-in with Supabase for the same account. If Supabase rejects that verification, the screen reports the failure rather than claiming a verified reset. The teammate can change the temporary password after signing in. This control does not send an invitation email.

To investigate a failed reset without changing the password again, open that teammate’s reset dialog, enter the password already issued, and choose **Test sign-in**. This administrator-only check verifies the Supabase account/email match and tests normal sign-in; it creates and signs out a temporary verification session without replacing the administrator’s browser cookies. No password or token is returned in the result. Share only the displayed diagnostic message when asking for help.

Sign-in errors distinguish incorrect credentials, accounts needing confirmation, disabled email/password sign-in, expired sessions, rate limiting, and temporary upstream outages. If the Email provider is disabled, enable it under Supabase Authentication's email provider settings while keeping public signup off. Browser session failures after an otherwise successful login have their own message. Concurrent API calls share one session refresh, and temporary upstream outages preserve existing session cookies.

There is no public registration or in-app password-reset email flow. If an administrator loses their password, the Supabase project owner can use Auth administration to reset that user's password. Do not delete project data to reset an account.

## Photo limits

Locations and props support **20 photos per record**; casting profiles support **12**. Existing photos count toward the total. Each selected input photo must be no larger than 8 MB, and browsing copies are resized before upload.

For an existing project created before this update, run [`002_twenty_photos.sql`](supabase/migrations/002_twenty_photos.sql) in Supabase SQL Editor with **Database** selected. It expands the existing photo slot check without deleting rows or storage files. The app alone cannot apply this database migration. Until it is run, the database rejects photos beyond the old 12-photo capacity and the app shows a setup message.

## Browsing record photos and related references

Open a location, prop, or talent record to see one large photo. Use the left/right buttons, arrow keys, or thumbnails to change photos; on touchscreens, swipe horizontally. Navigation loops through all photos. Single-photo records have no navigation arrows, and records without photos show an empty state. **Open image** opens the current photo separately.

Locations and props show **Similar locations** or **Similar props** directly below the viewer. Suggestions come from other records of the same type across the authorized library, ranked mainly by shared tags and then by category. Shared tags are shown on each suggestion. This is metadata matching, not AI image recognition. It does not call external services or incur image-analysis fees. If nothing shares tags or category, no unrelated fallback suggestions are shown. Add descriptive tags for more useful matches.

## Casting sheet

Choose **Casting** in navigation and click **Add talent**. Use the name as the title and choose a talent type or role (actor, model, voice artist, extra, presenter, etc.). Add headshots, playing age, height, languages, skills, contact/agent details, fee notes, availability, previous experience, and an HTTPS showreel/portfolio link. Mark whether the person has worked with the team before; leave unknown information as **Not recorded**.

The Casting section has portrait cards and filters for talent type, city, availability, language, skill, and past collaboration. Text search also includes casting skills, languages, and playing age. Project Decks can mix talent, locations, and props for the same production. Profiles and headshots use the same member-only API and private storage as the rest of the library.

Casting fields are stored inside the existing `pd_items.data` JSON column; existing projects do **not** need a new migration or more SQL. No demonstration records are added to the production database.

## Privacy and storage

The login screen, branding SVGs, and frontend assets are public. Records, Project Decks, membership data, and photo downloads require an authenticated member. Session tokens use Secure, HttpOnly, SameSite cookies; they are not stored in browser localStorage. Database tables have row-level security enabled and browser roles have no table privileges. The Worker alone holds the service-role key. Authentication and database requests use HTTPS.

Supabase's free allowance is shared by your project/organization according to its current terms. Watch storage and bandwidth usage in its dashboard. Keep your own backups of important photos and records: the Free plan is not an automatic backup service. Free projects may need restoring from the Supabase dashboard after inactivity. No automated activity is generated to prevent provider pausing.

Deleting a reference permanently deletes its browsing photos. Deleting a Project Deck keeps the references. The record catalog is loaded into the browser; very large libraries will need further pagination and search work. This version does not automatically migrate any SQLite data from the earlier unhosted Render version.

## Local development and verification

Requires Node.js 22 or later. `npm test` runs the related-record ranking tests and Worker handler tests against a simulated Supabase HTTP service, with no real credentials or live database. `npm run check` checks JavaScript syntax. These checks cover access control, private photos, refresh behavior, shared CRUD, Project Decks, upload cleanup, membership revocation, and catalog pagination. They do not prove live Supabase configuration, Cloudflare deployment, live provider quotas. The light layout and casting interactions were also checked locally on desktop and mobile using simulated records, without changing the live library.

For local Worker development, copy `.dev.vars.example` to `.dev.vars`, fill it using a dedicated Supabase **test** project, and run `npm run dev`. Wrangler is fetched through `npx`. Production cookies use Secure and the `__Host-` prefix; use a local HTTPS preview for browser sign-in. Do not commit `.dev.vars`.

The four logo SVGs under `public/brand/` are the company's supplied artwork, retained unchanged. The horizontal variant is used in navigation, the original in sign-in, the icon in workspace chrome and the favicon, and the wordmark in the footer. The artwork is shown in its original black on the light interface.

## Hosting migration status

The paid Render blueprint and disk-based server were removed from this version. The source is prepared for the free setup above. Local browser QA covers login, photo cards, search, filters, casting forms, editing, details, navigation, and sign-out. Live deployment and provider configuration must still be verified separately.

## Home, thumbnails and Project Deck editing

The prepared home screen is gated by `data-home-ready` on the document body until the supplied photo is attached as a downloadable file and installed at `public/brand/home-backdrop.jpg`. The current deployment keeps the original sign-in/browse entry. After that gate is enabled, the default route is the full-screen Tatamata home page, with an **Enter library** link leading to the existing light workspace. Browse remains member-only; signed-out users see the existing sign-in form before the catalog loads. The sidebar logo returns home. Home category links open Locations, Props or Casting directly, and browser back/forward and direct `#browse`, `#locations`, `#props`, `#casting` links work. The home photo is a public branding asset at `public/brand/home-backdrop.jpg`, with subtle CSS blur and dark overlay; library images remain behind their authenticated media routes.

In Add/Edit reference, select a radio tile under **Choose the thumbnail** for either a saved or newly chosen photo, then save. The selected photo becomes the library/Project Deck/related-card thumbnail and starts the detail gallery. No image bytes are reordered or deleted. Legacy references retain the original first-photo fallback. `coverImage` lives in existing item JSON and the Worker verifies that it belongs to that reference. No new SQL is needed.

Select a Project Deck in the sidebar and click **Edit Project Deck** to rename it and choose locations, props and casting from a searchable checklist. Selection persists when filtering the checklist. The × button on a deck card removes only that deck selection. **Delete Project Deck** removes the deck while preserving every library reference and its photos. Existing decks are retained in the same `pd_boards` rows, with no migration.

Backend checks cover cross-reference thumbnail rejection, thumbnail preservation on metadata edits, deck creation with mixed references, independent name/selection updates, atomic rejection of invalid changes and safe deck deletion. Desktop/mobile browser tests exercise routing, saved and new-photo cover choices, gallery/thumbnail consistency, checklist search and selection preservation, and deck CRUD with simulated data.
