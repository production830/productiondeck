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

The default route is the full-screen Tatamata home page using the supplied behind-the-scenes photo, with an **Enter library** link leading to the existing light workspace. Browse remains member-only; signed-out users see the existing sign-in form before the catalog loads. The sidebar logo returns home. Home category links open Locations, Props or Casting directly, and browser back/forward and direct `#browse`, `#locations`, `#props`, `#casting` links work. The home photo is a public branding asset at `public/brand/home-backdrop.png`, with subtle CSS blur and dark overlay; library images remain behind their authenticated media routes.

In Add/Edit reference, select a radio tile under **Choose the thumbnail** for either a saved or newly chosen photo, then save. The selected photo becomes the library/Project Deck/related-card thumbnail and starts the detail gallery. No image bytes are reordered or deleted. Legacy references retain the original first-photo fallback. `coverImage` lives in existing item JSON and the Worker verifies that it belongs to that reference. No new SQL is needed.

Select a Project Deck in the sidebar and click **Edit Project Deck** to rename it and choose locations, props and casting from a searchable checklist. Selection persists when filtering the checklist. The × button on a deck card removes only that deck selection. **Delete Project Deck** removes the deck while preserving every library reference and its photos. Existing decks are retained in the same `pd_boards` rows, with no migration.

Backend checks cover cross-reference thumbnail rejection, thumbnail preservation on metadata edits, deck creation with mixed references, independent name/selection updates, atomic rejection of invalid changes and safe deck deletion. Desktop/mobile browser tests exercise routing, saved and new-photo cover choices, gallery/thumbnail consistency, checklist search and selection preservation, and deck CRUD with simulated data.

The home background uses the user-uploaded PNG unchanged, aliased to a stable filename. Blur and darkening are CSS effects, with the existing supplied Tatamata SVG shown in white. The original uploaded filename is retained in Git. Session checks continue while signed-in users are on the home page and recheck when returning to Browse.

## Fixed categories and subcategories

Each reference has exactly one top-level category: **Lokacion**, **Rekuizita**, or **Kasting**, stored using the existing `type` enum. The free-text category field has been removed. Choose zero to ten subcategories from the searchable 120-option checkbox list. Selection is preserved when searching, and unselected options become disabled once ten are chosen. The full ordered vocabulary is defined once in `public/taxonomy.js` and shared by the browser and Worker. It begins City, Village, Outdoors, Indoors, Exterior, Interior, Car, Bus, Truck, Apartment, Building, Corporate, Office, Field, Stadium, Medical, then covers rooms, buildings, landscapes, transport, services, props and casting roles. Manual tags remain independent.

Browse provides separate Category and Subcategory filters, alongside the existing city, setting, availability and casting filters. Free-text search includes all selected subcategories and preserved previous category text. Similar locations/props now use shared subcategories and manual tags; sharing only the broad Location/Props category does not make references similar.

No SQL or destructive batch migration is required. Existing free-text categories map to known subcategories on read when possible (for example Apartment, Outdoor → Outdoors, or Actor). Historical category text is retained as `legacyCategory`, including custom values that do not match the fixed vocabulary. The original database row is unchanged until edited. Edits preserve that historical text, and older clients that omit subcategories preserve the existing selection. Existing references, photos, thumbnails, casting details and Project Decks remain intact.

## Project Deck PDF export

Open a Project Deck and click **Export PDF**, choose optional content, then **Download PDF**. This generates a real downloadable A4 PDF locally in the browser, with Tatamata branding, a cover, project/date/category counts, chosen thumbnails, reference details, selected subcategories, manual tags and page numbers. It includes all saved references in that deck in deck order, regardless of current browse filters. Long details continue on numbered pages rather than being truncated.

Options add up to four photos per reference, production notes, or contacts/addresses/costs. Notes and internal details are unchecked by default for client-facing use. The PDF font supports Albanian names such as Prishtinë, Arbër and Çela. Photos use the existing authenticated media route; expired sessions are refreshed before retrying a photo. Closing the export dialog cancels processing. No records are modified, no PDF is uploaded anywhere, and no paid PDF API or third-party browser CDN is used.

Wrangler's custom build runs `node scripts/vendor-pdf.mjs`, which downloads the pinned jsPDF 4.2.1 runtime and a pinned Noto Sans font, verifies SHA-256 digests and emits self-hosted assets. A changed or unavailable dependency stops deployment without replacing the live site. Generated JS/font assets are excluded from Git. Their MIT and SIL Open Font License notices are included under `public/vendor/pdf/NOTICES.txt`.

Verification covers the exact 120-option count/order, category validation, ten-subcategory server limit, legacy data preservation, metadata similarity, safe PDF filenames, cancellation and empty-deck handling. Desktop/mobile browser checks cover selecting/filtering subcategories, independent manual tags, existing home/deck/gallery/thumbnail workflows and actual PDF downloads under the production CSP. Exported PDFs were rendered and text-checked for photos, page flow, Albanian characters, complete long notes, and exclusion/inclusion of internal fields. The clean dependency build and Wrangler dry run also passed. All verification uses simulated records and does not alter the live library.

## Albanian reference fields and standardized cities

The home page, navigation, buttons and account controls stay in English. Reference/editor/filter labels, category names, all 120 subcategory labels, settings and availability values are shown in Albanian. PDF reference metadata uses those same Albanian labels. User-entered titles, manual tags, notes, languages, skills and other content are never automatically translated. Existing English subcategory keys and setting/status enums remain stable in storage, so previous references and filters still match. Both Albanian labels and English keys work in subcategory search, including searches without accents. Up to ten subcategories are accepted in the editor and enforced by the Worker.

The 30 added subcategories cover graffiti, murals, street art, walls, facades, monuments, sculpture, squares, old towns, alleys, underpasses, ruins, castles, historic sites, abandoned buildings, industrial sites, art galleries/studios, concert halls, event venues, recording studios, backstage areas, public transport, motorcycles, bicycles, costumes, makeup, musical instruments, equipment and street markets.

The city selector is grouped by country: all 38 Kosovo municipal centers, 25 major Albanian cities, and Shkup, Tetovë and Kumanovë in North Macedonia. Common alternative spellings (including Prishtina/Pristina, Tirana, Skopje and names without accents) normalize to a single Albanian spelling on read and when saved. Reads do not rewrite historical rows. New arbitrary city spellings are rejected; an unrecognized existing area can be retained on its original reference until a listed city is selected, and it remains filterable. Older clients omitting the city field preserve the previous city on edit. No Supabase migration is required.

## Standalone Shooting Schedules

**Shooting Schedules** is a separate page below Project Decks in the sidebar (`#schedules`). Schedules are shared across the authorized team and are independent of decks: deleting a deck never deletes a schedule. Start a new schedule from the editable day template, enter project/client/date/crew call/meeting point/contact, and add, duplicate, reorder or remove up to 100 timed rows. Row types include scene, setup, travel, break and wrap. Start/end times follow the day start and row durations; `+1d` indicates the next calendar day. Each row can select a location, multiple casting profiles and props from the full authorized library, with additional location text and notes. Total duration is limited to 24 hours. Duplicate day preserves the plan while clearing the date.

Fields and reference labels use Albanian; navigation, buttons and general help remain English. Closing an edited draft asks before discarding changes. **Save schedule** persists the document for the team. **Export PDF** downloads the current filled template as a Tatamata-branded landscape A4 PDF with timing, reference names, crew details and notes. Export can include unsaved changes, which are clearly flagged afterwards. Long rows and notes continue across numbered pages, with table headers repeated. The same self-hosted jsPDF runtime and Unicode font as Project Deck export are reused; there is no paid service or third-party upload.

Schedules are namespaced JSON documents (`data.type = shooting_schedule`) in the existing private `pd_items` document store. This requires no SQL migration. Library reads filter these documents at the database and response boundaries. Reference edit/delete/photo routes reject schedule IDs, and schedule routes reject reference IDs. `/api/schedules` supports GET/POST; `/api/schedules/:id` supports GET/PUT/DELETE under the same session, CSRF and membership checks as the rest of the workspace. Saving validates referenced IDs/types in batches, stores title snapshots for later PDF use if a reference is removed, and uses revision comparison plus an atomic conditional PATCH to prevent silently overwriting another person's edit. Clearing a deleted reference allows saving again. Schedules do not change the reference records or their photos.

Verification covers server lifecycle, authorization, stale edit conflicts, independent deck deletion, type-safe reference selections, invalid durations/dates/row shapes, deleted-reference snapshots, overnight timing and row limits. Browser checks exercise the standalone route, template editing, save/reopen, duplicate/delete, reordering, unsaved-change protection, desktop/mobile layout and actual PDF downloads. PDF text and rendered pages were inspected for Unicode names, full long notes, continuation layout and selected reference names. All checks use simulated records.

## Standalone Call Sheets

Open **Call Sheets** below Shooting Schedules (`#call-sheets`). The commercial/film template includes project/client/date, shoot day and total days, issue/version, Draft or Issued status, general crew call, shoot start, breakfast/lunch/estimated wrap, meeting point and production contact. Add locations with addresses, parking/access notes and HTTPS map links; crew/department contacts with call times; cast with role/contact/pickup/arrival/makeup/wardrobe/on-set times; and a scene/day-plan section. Weather, temperature, sunrise/sunset, nearest hospital/address/phone, emergency numbers, safety instructions and general notices are entered and verified by the production team. They are not inferred from location names or populated with unverified emergency data.

**Import schedule** explicitly replaces the current template with an editable snapshot of a saved shooting schedule. It copies date/project/client, general calls, meeting point/contact, calculated day-plan times (including `+1d`), selected location names/addresses, cast names/contacts, props in the plan, and notes. Individual cast calls remain blank. The import does not alter its source schedule or library references; later source edits/deletion do not change the sheet. Sheets can also be filled entirely manually, saved for the team, duplicated with a cleared date and Draft status, reordered within sections, or deleted independently. Unsaved changes are confirmed before closing. Navigation/buttons remain English and data field labels are Albanian.

**Export PDF** produces a local, branded portrait A4 call sheet with a prominent general crew call/date/day block, issue/status, production/timing/weather details, emergency information, locations, cast calls, crew contacts, day plan and general notices. Map links are clickable in the PDF. Repeated table headers, numbered pages and flowing text preserve long notes across pages. The existing self-hosted PDF runtime and Albanian-capable font are reused; no data is sent to a PDF service or emailed automatically. Export includes the current filled template, including unsaved changes.

Call sheets use private `pd_items` JSON documents with `data.type = call_sheet` and `/api/call-sheets` GET/POST plus `/api/call-sheets/:id` GET/PUT/DELETE. No SQL migration or paid service is required. All routes use the existing session, membership and same-origin protections. Library reads exclude schedule and call-sheet documents at database and response boundaries, and reference/photo/schedule routes reject call-sheet IDs. Validation enforces valid dates, 24-hour calls, shoot-day bounds, unique row identifiers, 100 rows per section and safe map URLs. Optimistic revisions and an atomic conditional update prevent silently overwriting another editor's changes.

Tests cover document lifecycle, anonymity/CSRF rejection, revision conflicts, isolation from library/schedule routes, validation, snapshot imports and cancellation. Desktop/mobile browser checks exercise import, individual calls, section row editing, save/reopen, duplicate/delete, unsaved guards, navigation and actual PDF downloads. PDF extraction/rendering checks verify Albanian text, important crew/emergency fields, complete long notes and pagination. All verification uses simulated records.

## Casting gender and branded library navigation

Casting profiles have an optional **Gjinia** field: **Mashkull** (Male), **Femër** (Female), or unrecorded. The Casting filter supports either value and an unrecorded-only view, alongside existing casting filters. It is visible in the Casting collection or when Category is set to Casting, and never filters locations or props. The field appears in casting details/cards and Project Deck PDF metadata. Existing profiles are not inferred or batch-classified: edit a profile to select its value. Older clients that omit gender on edits preserve a previously recorded selection; explicit empty selection clears it. The Worker validates values and stores gender only inside casting data. No schema migration is needed.

The All references, Locations, Props and Casting sidebar buttons now use the supplied `tatamata-icon.svg` as a decorative image, keeping their text labels and counts accessible. This replaces the generic Unicode navigation symbols.

## Crew Directory

**Crew Directory** (`#crew`) sits directly below Casting. It is a private, spreadsheet-style contact table for project-based freelancers and contractors, separate from casting profiles and team login accounts. Fields are name, surname, multiple roles, city, phone, email, optional daily rate, past collaboration status and working notes. Names/surnames and at least one role are required; contact/rate/notes are optional. Add/edit/delete opens a compact form with no photo upload. Names or rows open full details; valid phone/email values are clickable. The table scrolls horizontally on smaller screens. Search covers names, roles, contacts and notes; role, city and past-collaboration filters and name/surname/recent-update sorting help find people.

The nine predefined roles are Director of Photography (DP), Camera Operator, Camera Assistant (1st AC), Gaffer, Sound Recordist, Makeup Artist, Hair Stylist, Costume Designer and Drone Operator, displayed with Albanian labels. Select multiple roles and/or enter up to five custom roles in the blank Other roles field, separated by commas. Custom roles are deduplicated without case/accent differences and appear automatically in the role filter. Common predefined role names typed in the custom field normalize to their existing role rather than creating another spelling. Cities reuse the standardized Kosovo/Albania/North Macedonia list. No role or past-collaboration status is guessed.

Crew contacts use namespaced private JSON documents (`data.type = crew_contact`) in the existing data store and authenticated `/api/crew` GET/POST plus `/api/crew/:id` GET/PUT/DELETE. No SQL migration or paid service is needed. Revision checks and atomic conditional updates protect concurrent edits; closing an edited form asks before discarding changes. These records do not grant login access, send invitations, create casting profiles, modify call sheets, or change references. Library reads exclude internal documents at both database and response boundaries; reference/photo/schedule/call-sheet endpoints reject crew contact IDs. Names, roles, email and cities are validated server-side.

Tests cover predefined/custom role normalization, validation, safe phone links, shared contact lifecycle, stale-edit conflicts, route isolation and unauthorized writes. Browser checks exercise adding/editing/deleting contacts, custom-only roles, search/filter controls, contact links, unsaved changes, navigation and desktop/mobile layouts using simulated data.

Grip has been removed from the predefined Crew Directory choices. Previously saved Grip assignments are preserved on read/edit for compatibility, and custom roles remain available.
