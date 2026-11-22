# The Compact Media: Owner Dashboard (Part 2)

A private CMS for the website. Plain HTML + CSS + JavaScript (no build, no install). It talks to **Supabase** (Auth, Postgres, Storage). The public website uses the **same** Supabase project, so anything published here appears there with no code changes.

```
index.html        login + dashboard shell        css/admin.css   styles
js/config.js      YOUR SUPABASE SETTINGS         js/core.js      client, helpers, uploads
js/editor.js      create/edit drawer             js/manager.js   Our Work + Our Testimonials
js/views.js       Overview, Live Now, Customer Feedback         js/app.js  login, routing
supabase/setup.sql   database + security + storage (run once)
```
Pages (hash routes): `#/overview`, `#/live`, `#/work`, `#/testimonials`, `#/feedback`.

> Status: the code was exercised against a simulated Supabase (login, CRUD, publish/unpublish, reorder, feedback approval, conversion, logout) but **not yet against a live Supabase project**. Do the setup below and run the checklist at the end.

## 1. Create the Supabase project (free tier is fine)
1. supabase.com → New project. Save the database password.
2. **SQL Editor → New query**: paste all of `supabase/setup.sql` → Run. (Creates tables, row-level security, storage buckets `media` and `feedback-images`.)
3. **Authentication → Providers → Email**: turn **OFF** “Allow new users to sign up” (no public registration).
4. **Authentication → Users → Add user**: owner’s email + strong password, tick **Auto confirm**.
5. **SQL Editor**: run (with the owner’s email):
   `insert into public.admins (user_id) select id from auth.users where email = 'OWNER_EMAIL_HERE';`
   Only users listed in `admins` can use the dashboard, even if someone else obtained an account.
6. **Authentication → URL Configuration**: set *Site URL* and add to *Redirect URLs* the exact address where this dashboard will live (needed for “Forgot password”).
7. **Project Settings → API**: copy the **Project URL** and **anon public** key.

## 2. Configure
Edit `js/config.js`: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SITE_URL` (public website address). Use the same URL/key in the website’s `js/config.js`.
**Never** put the `service_role` key anywhere in these files.

## 3. Run / deploy
Local: `python3 -m http.server 8000` in this folder → http://localhost:8000 (add it to Supabase Redirect URLs for testing).
Deploy: upload the folder to any static host (Netlify, Vercel, Cloudflare Pages, GitHub Pages, cPanel), ideally on a private-looking subdomain such as `admin.yourdomain.com`. HTTPS is required in production. The page is `noindex`.
The only external script is `@supabase/supabase-js@2.45.4` from jsDelivr (pinned). To self-host, download that file into `js/` and change the `<script>` tag in `index.html`.

## What each page does
- **Overview**: live counts, recent items, pending feedback, quick actions.
- **Live Now**: everything currently public, with Edit and Unpublish.
- **Our Work**: add/edit/delete/duplicate projects, cover + gallery upload (reorder with ← →), video/project URLs, services, featured, publish/unpublish, reorder with ↑ ↓ (works on touch and desktop).
- **Our Testimonials**: owner-written testimonials with optional photo (initial shown otherwise), rating, featured, publish, reorder.
- **Customer Feedback**: submissions from the website arrive as **Pending**. Approve & publish, Reject, Unpublish, Delete, or **Convert to testimonial** (pre-filled editor; the feedback record stays as is). Private emails are visible only here.

## Data contract (shared with the website)
Tables: `projects`, `testimonials`, `customer_feedback`, `feedback_private` (customer email, admin-only), `admins`. Public (anon) access: read rows where `status='published'`; insert feedback only as `pending`; upload to `feedback-images`. Everything else needs the owner login. Drafts, rejected feedback and emails are never readable publicly. Fields are documented in `supabase/setup.sql`.

## Security notes
- Authorization is enforced by Postgres row-level security and storage policies, not by the front end.
- Image uploads are limited to JPG/PNG/WebP (5 MB owner uploads, 2 MB customer uploads), enforced by the storage buckets.
- Spam on the public form: hidden honeypot field + 1-minute client throttle + length/rating constraints in the database. For heavy abuse, add Cloudflare Turnstile or a Supabase Edge Function rate limiter.
- Deleting an item removes its uploaded images (only files stored in that record’s own folder).

## Test checklist (after setup)
1. Open the dashboard → setup screen disappears, login appears. Wrong password shows an error.
2. Log in → Overview shows zeros. Log out → protected pages are gone; log in again.
3. Our Work → add project with cover image → Publish → it appears on the public site after refresh. Unpublish → it disappears.
4. Testimonials → add one without a photo → Publish → appears on the site.
5. On the public site submit a review → it shows as Pending here → Approve → appears under Customer Feedback on the site.
6. Convert a feedback to testimonial → saves; original feedback remains.
7. Forgot password → email arrives → set new password → sign in.

## Troubleshooting
- *“Backend setup required” screen*: `js/config.js` is empty or the URL isn’t `https://…`.
- *“This account is not authorized”*: the owner isn’t in `public.admins` (step 5).
- *“Not allowed” when saving*: session expired or not an admin; sign in again.
- *Image upload fails*: bucket missing (re-run setup.sql) or file isn’t JPG/PNG/WebP within the size limit.
- *Reset link opens the wrong page*: fix Redirect URLs (step 6).
- *Public site shows demo items*: its `js/config.js` has no Supabase URL/key.
