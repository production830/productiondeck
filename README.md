# Productiondeck

A private visual library for a commercial production team. Upload the locations and props you already have, then find them by photo, tags, category, city, setting, availability, or text search. Save selections into shared shortlists for each client or shoot.

## What works

- Individual email/password accounts; no public registration.
- Administrator creates and removes teammates. Removal immediately revokes their sessions.
- Each member can change their password; doing so signs out their other sessions.
- Shared location and prop records, with up to 12 photos per record.
- Protected JPEG, PNG, and WebP photo uploads, up to 8 MB per photo.
- Tags, search, combined filters, sorting, and reusable project shortlists.
- Address/storage position, contact, cost, availability, and production notes.
- Responsive dark visual library with no external scripts, fonts, or image dependencies.
- Persistent SQLite database and local photo files, kept outside Git.

The library starts empty. Everyone with an account can view, add, edit, and delete shared references and shortlists. Only the administrator can manage membership. Creating an account does not send an email; give that teammate their temporary password through your usual private channel. They can change it from the settings icon beside their name.

## Run locally

Install Node.js 24 or later. There are no npm dependencies and no frontend build step.

1. Copy `.env.example` to `.env`.
2. Set your administrator email and a unique password of at least 12 characters.
3. Set `COOKIE_SECURE=false` **only for localhost HTTP development**.
4. Run `npm start`.
5. Open `http://localhost:3000` and sign in.

The first startup creates the administrator. Later changes to `ADMIN_EMAIL` or `ADMIN_PASSWORD` do not overwrite the existing account. Use the app to change your password.

## Publish privately

This app needs a Node server and a persistent disk. GitHub Pages and ordinary ephemeral serverless functions cannot run this version correctly.

A `render.yaml` blueprint is included for a single Docker service with a persistent disk. Once the files are in your GitHub repository:

1. In Render, create a new **Blueprint** from this repository.
2. Enter `ADMIN_EMAIL` and `ADMIN_PASSWORD` securely when requested. Do not commit a filled `.env` file.
3. Review the service and persistent disk pricing before creating it.
4. Deploy and open the generated **HTTPS** address.
5. Sign in, upload a reference, reload, and verify it persists.
6. Open **Manage team** to create your coworkers' accounts.

For another Docker host, mount a persistent directory at `/data`, set `DATA_DIR=/data`, supply the administrator variables, and put the service behind HTTPS. Keep `COOKIE_SECURE=true` in production. Run one app instance against the SQLite disk. The default port is 3000; the host can override `PORT`.

The login page and frontend assets are publicly reachable; all library records, member details, shortlists, and photo routes require an authenticated session. Photos are not stored under the public folder. The website has `noindex,nofollow`, but sign-in is what protects the library. A public source repository does not make uploaded records public: runtime data and credentials must stay outside it.

## Data and backups

`DATA_DIR` contains `productiondeck.sqlite`, SQLite journal files, and `images/`. Keep all of it on durable storage. Back up the whole directory while the service is stopped, or use a SQLite-aware backup workflow plus a matching image backup. Restore into an empty data directory, preserve filesystem ownership, and restart. Test restores before relying on backups.

Deleting a reference removes its photos permanently. Deleting a shortlist keeps its references. Shortlists ignore references that have subsequently been deleted.

## Checks

Run `npm test`. The integration test uses a disposable database and verifies sign-in, private image access, input validation, uploads, shared CRUD, shortlists, administrator boundaries, password changes, account revocation, cross-origin write rejection, and logout. It requires permission to listen on a local loopback port.

JavaScript syntax checks: `node --check server.js` and `node --check public/app.js`.

Browser visual QA and a live hosting deployment have not been completed in the authoring environment. Before entering real production data, complete the HTTPS upload/reload/sign-out checks on your chosen host.

## Scope of this first version

Tags are added manually; there is no AI tagging. There is no public signup, email delivery, forgotten-password flow, external SSO, booking calendar, per-project permission model, or automatic cloud photo backup. For a larger library, a future iteration can move uploads to object storage, generate thumbnails, and add pagination. This version loads the record catalog in the browser and serves original uploaded images; resize large photos before upload for faster browsing.

If an administrator loses access, the host operator can reset the account using a deliberate database maintenance operation after taking a backup. Do not delete the database to reset a password, because it contains your library records.
