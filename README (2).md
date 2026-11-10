# Ward Sadasya

**A task, video-upload and live-analytics platform for the Delhi Pradesh Congress Committee's 1,400 MCD ward members across all 250 Delhi wards.**

Members get daily field tasks on an Android app and complete each one by uploading video. The party's command team watches completion, ward heat maps and live rankings from a web dashboard as the uploads arrive. It replaces WhatsApp-group follow-ups with one auditable system: every member, every task, every video, per ward.

![Platform](https://img.shields.io/badge/app-Android%207.0%2B-1B4FA8) ![Admin](https://img.shields.io/badge/admin-React%2018%20%2B%20Vite-1B4FA8) ![Backend](https://img.shields.io/badge/backend-Supabase-1B4FA8) ![Status](https://img.shields.io/badge/status-pre--release-C2560A)

---

## Table of contents

- [Key features](#key-features)
- [Architecture and how it works](#architecture-and-how-it-works)
- [Getting started](#getting-started)
- [Running the application](#running-the-application)
- [API reference and usage](#api-reference-and-usage)
- [Performance and capacity](#performance-and-capacity)
- [Contributing and license](#contributing-and-license)

---

## Key features

**Member app (Android, Hindi first)**

- **One-step login:** members enter the 10-digit mobile number they registered with. No password, no OTP.
- **Daily task list:** 2 to 4 tasks a day, with a date strip to move between campaign days.
- **Video-gated completion:** a task can be ticked only after at least one video has fully reached the server. Each task has 1 to 5 video slots, plus an optional photo section.
- **Share cards:** posts to watch and reshare open directly in X, Instagram, Facebook or WhatsApp. These are not counted as tasks.
- **Leader messages:** landscape video or audio from the DPCC President, with a watched/listened marker on each.
- **Reminders:** a notification about every 3 hours while tasks are pending, plus admin messages and new leader messages.

**Admin panel and dashboard (web)**

- **Live analytics:** a 250-ward heat map grouped by MCD zone or assembly, zone ranking, top and bottom 5 wards, daily completion trend, uploads by hour, and a reach funnel. It refreshes every 30 seconds.
- **Live ranking:** every member ranked by tasks completed, then videos uploaded, both Delhi-wide and within their ward.
- **Task manager:** create, schedule, edit and delete tasks and share cards for each day.
- **Member management:** bulk Excel upload with validation, filters by ward and status, every member's videos and photos in one place, and block/unblock.
- **Broadcasts:** upload leader messages and track their reach. Send one-off messages to everyone, one zone, one ward, or only members with pending tasks.
- **Exports:** a full member report as an Excel file.

---

## Architecture and how it works

The system has three parts around one Supabase project. The Android app never talks to the database directly. It calls a single Edge Function, which checks the member's session and runs every rule with the service role. The admin panel uses Supabase Auth, and row-level security limits every table to users listed in `admins`.

```
 ┌────────────────────────┐                     ┌──────────────────────────────────────────┐
 │  Android app (Kotlin,  │  POST {action,...}   │  Supabase                                │
 │  Jetpack Compose)      │ ───────────────────▶ │  ┌────────────────────────────────────┐  │
 │                        │   x-session header   │  │ Edge Function `app` (Deno, TS)     │  │
 │  • Login by mobile     │ ◀─────────────────── │  │  login · home · upload_url ·       │  │
 │  • Tasks + uploads     │        JSON          │  │  attach · complete · messages ·    │  │
 │  • Leader messages     │                      │  │  message_seen · poll               │  │
 │  • WorkManager (~3 h)  │                      │  └───────────────┬────────────────────┘  │
 └──────────┬─────────────┘                      │                  │ service role          │
            │  PUT file to signed URL            │  ┌───────────────▼────────────────────┐  │
            └──────────────────────────────────▶ │  │ Postgres (RLS on every table)      │  │
                                                 │  │ members · tasks · media ·          │  │
                                                 │  │ completions · leader_messages ·    │  │
                                                 │  │ announcements · settings · views   │  │
                                                 │  └───────────────▲────────────────────┘  │
                                                 │  ┌───────────────┴────────────────────┐  │
                                                 │  │ Storage: uploads (private)         │  │
                                                 │  │          leader  (public)          │  │
                                                 │  └───────────────▲────────────────────┘  │
                                                 └──────────────────┼───────────────────────┘
 ┌────────────────────────┐   supabase-js (admin JWT + RLS)         │
 │  Admin panel (React +  │ ────────────────────────────────────────┘
 │  Vite, on Vercel)      │   tables, summary views, signed URLs for videos
 └────────────────────────┘
```

### Tech stack

| Layer | Technology | Why |
| --- | --- | --- |
| Member app | Kotlin, Jetpack Compose, OkHttp, WorkManager | Native and light on low-end phones; streams large files without loading them into memory |
| App API | Supabase Edge Function (Deno, TypeScript) | One endpoint holds every rule; it is the only path the app uses into the database |
| Database | Supabase Postgres, row-level security, summary views | Relational data, with dashboard totals worked out in SQL rather than in the browser |
| File storage | Supabase Storage with signed upload URLs | Phones upload straight to storage, so video bytes never pass through the API |
| Admin panel | React 18, Vite 5, supabase-js, SheetJS | A static site with no server to run; Excel import and export happen in the browser |
| Hosting | Supabase (Mumbai region), Vercel | Low latency in India; deploys straight from GitHub |

### Request lifecycle: completing a task

1. The app calls `upload_url`. The API checks the session and the task's video limit, then returns a signed storage URL.
2. The app streams the video straight to storage with `PUT`, showing progress and retrying up to 3 times.
3. The app calls `attach` to record the file against the task.
4. The member taps the tick, and the app calls `complete`. The API turns it down unless at least 1 video exists.
5. The dashboard's views show the completion at its next refresh, within 30 seconds.

> [!NOTE]
> The video-before-tick rule is enforced on the server, not only in the app. A modified client cannot complete a task without an uploaded video.

### Repository layout

```
ward-sadasya/
├── supabase/
│   ├── schema.sql              # tables, RLS policies, views, storage buckets
│   └── functions/app/index.ts  # the app API (single Edge Function)
├── admin/                      # React + Vite admin panel
│   ├── src/                    # Dashboard, Tasks, Members, Messages, Reminders
│   └── .env.example
├── android/                    # Kotlin + Compose member app
│   ├── app/src/main/java/com/coceptual/wardsadasya/
│   │   ├── MainActivity.kt     # all screens and navigation
│   │   ├── Api.kt              # API client, streaming uploader, session store
│   │   └── ReminderWorker.kt   # background check-ins and notifications
│   └── gradle.properties       # WS_API_URL, WS_ANON_KEY
└── .github/workflows/android-apk.yml   # optional cloud APK build
```

---

## Getting started

### Prerequisites

| Tool | Version | Needed for |
| --- | --- | --- |
| Node.js | 18 or later (20 LTS recommended) | Admin panel |
| npm | 9 or later | Admin panel |
| Supabase CLI | latest | Deploying the Edge Function |
| Android Studio | Koala (2024.1) or later | Building the APK |
| JDK | 17 | Android build |
| Android SDK | Platform 34 | Android build |
| Accounts | Supabase (Pro plan), Vercel, GitHub | Hosting |

> [!IMPORTANT]
> Use the **Supabase Pro** plan. The free plan has 1 GB of file storage, and this campaign will produce hundreds of GB of video.

### 1. Clone the repository

```bash
git clone https://github.com/YOUR-ORG/ward-sadasya.git
cd ward-sadasya
```

### 2. Set up the backend

1. Create a Supabase project in **Mumbai (ap-south-1)**.
2. Open the **SQL Editor**, paste the whole of `supabase/schema.sql`, and run it.
3. Deploy the API:

```bash
supabase login
supabase link --project-ref YOUR-PROJECT-REF
supabase functions deploy app --no-verify-jwt
```

> [!WARNING]
> `--no-verify-jwt` is required. The app signs members in with its own session tokens, not Supabase Auth JWTs.

4. Create an admin account. Add a user under **Authentication > Users**, then register that user as an admin:

```sql
insert into admins (user_id, label) values ('PASTE-AUTH-USER-ID', 'Admin name');
```

### 3. Configure the environment

**Admin panel:** `admin/.env`

```bash
cd admin
cp .env.example .env
```

```dotenv
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

**Android app:** `android/gradle.properties`

```properties
WS_API_URL=https://YOUR-PROJECT.supabase.co/functions/v1/app
WS_ANON_KEY=YOUR-ANON-KEY
```

| Variable | Where | Source |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Admin | Supabase > Project Settings > API > Project URL |
| `VITE_SUPABASE_ANON_KEY` | Admin | Supabase > Project Settings > API > `anon` key |
| `WS_API_URL` | Android | Project URL + `/functions/v1/app` |
| `WS_ANON_KEY` | Android | Same `anon` key |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Edge Function | Injected by Supabase automatically; no setup needed |

> [!CAUTION]
> Never put the `service_role` key in the admin panel or the app. The `anon` key is safe to ship because row-level security blocks every table for anyone who is not an admin.

### 4. Install dependencies

```bash
cd admin
npm install
```

---

## Running the application

### Admin panel

| Task | Command |
| --- | --- |
| Development server (hot reload) | `npm run dev` |
| Production build (to `admin/dist`) | `npm run build` |
| Preview the production build | `npm run preview` |

**Deploying to Vercel:** import the repository, set **Root Directory** to `admin`, add the two `VITE_` variables, and deploy.

### Android app

```bash
cd android
./gradlew assembleDebug      # debug APK
./gradlew assembleRelease    # release APK, signed with the debug key
```

You can also use **Build > Build App Bundle(s) / APK(s) > Build APK(s)** in Android Studio. Output: `android/app/build/outputs/apk/`.

> [!IMPORTANT]
> Build every update on the same machine, or with the same keystore. Android refuses to install an update over the old app if the signing key differs. Before wide distribution, switch `signingConfig` to a dedicated release keystore and back it up.

**Cloud build (optional):** add the repository secrets `WS_API_URL` and `WS_ANON_KEY`, then run **Actions > Build APK** and download the APK from the run's artifacts.

### Testing and linting

> [!NOTE]
> There is no automated test suite or linter configured yet. Until there is, use the checks below.

| Check | Command or step |
| --- | --- |
| Admin compiles | `cd admin && npm run build` |
| Edge Function syntax | `npx esbuild supabase/functions/app/index.ts --format=esm --platform=neutral > /dev/null` |
| Android compiles | `cd android && ./gradlew assembleDebug` |
| Android lint | `cd android && ./gradlew lint` |
| End-to-end check on a real phone | Log in with a listed number → upload a video → tick → see it on the dashboard within 30 s → play a leader message → allow notifications |

### Docker

Not used. The admin panel builds to a static site and the backend runs on Supabase. To self-host the admin panel, serve `admin/dist` from any static web server:

```dockerfile
FROM nginx:alpine
COPY admin/dist /usr/share/nginx/html
```

---

## API reference and usage

### Member app API

There is a single endpoint. The `action` field in the body selects the operation.

```
POST https://YOUR-PROJECT.supabase.co/functions/v1/app
Content-Type: application/json
apikey: <anon key>
Authorization: Bearer <anon key>
x-session: <session token from login>     # every action except login
```

| Action | Purpose | Auth | Key parameters |
| --- | --- | --- | --- |
| `login` | Start a session with a registered mobile number | None | `mobile` |
| `home` | Member profile, tasks for a date, latest leader message, social links | Session | `date` (optional, `YYYY-MM-DD`) |
| `upload_url` | Get a signed URL for one file | Session | `task_id`, `kind` (`video` or `photo`), `ext` |
| `attach` | Record a file after it has uploaded | Session | `task_id`, `kind`, `path`, `size` |
| `complete` | Tick a task (needs at least 1 video) | Session | `task_id` |
| `messages` | All published leader messages, each with a seen flag | Session | none |
| `message_seen` | Mark a leader message as watched or listened to | Session | `id` |
| `poll` | Background check-in: pending count, announcements, new message | Session | `since` (optional ISO timestamp) |

**Errors** come back as `{"error": "<code>"}` with an HTTP status:

| Code | HTTP | Meaning |
| --- | --- | --- |
| `invalid_mobile` | 400 | Not a valid 10-digit Indian mobile number |
| `not_registered` | 404 | Number not on the member list, or blocked. The response includes `helpline` |
| `unauthorized` | 401 | Missing or unknown session token |
| `no_task` | 404 | Task does not exist or is a share card |
| `limit_reached` | 400 | All video slots (or 10 photos) for this task are used |
| `need_video` | 400 | Tick attempted with no video uploaded |
| `bad_path` | 400 | File path does not belong to this member |
| `server_error` | 500 | Unexpected failure; `detail` holds the message |

<details>
<summary><b>login</b>: request and response</summary>

```json
// Request
{ "action": "login", "mobile": "9876543210" }
```

```json
// 200 OK
{
  "token": "3f6c1e2a-8a4b-4c55-9d0e-1b2c3d4e5f60",
  "member": {
    "mobile": "9876543210",
    "name": "Ramesh Kumar",
    "ward_no": 17,
    "ward_name": null,
    "zone": "Central",
    "assembly": null,
    "active": true
  }
}
```

```json
// 404 Not Found
{ "error": "not_registered", "helpline": "9000000000" }
```
</details>

<details>
<summary><b>home</b>: request and response</summary>

```json
// Request
{ "action": "home", "date": "2026-11-11" }
```

```json
// 200 OK
{
  "today": "2026-11-11",
  "date": "2026-11-11",
  "days": ["2026-11-11", "2026-11-12", "2026-11-13"],
  "member": { "mobile": "9876543210", "name": "Ramesh Kumar", "ward_no": 17, "zone": "Central" },
  "tasks": [
    {
      "id": 41, "task_date": "2026-11-11", "sort": 1, "kind": "upload",
      "title": "3 स्थानीय लोगों से वायु प्रदूषण पर बात करें, बाइट रिकॉर्ड करें",
      "description": null, "video_slots": 3, "allow_photos": true,
      "videos": 1, "photos": 0, "done": false
    },
    {
      "id": 42, "task_date": "2026-11-11", "sort": 2, "kind": "share",
      "title": "आज का वीडियो: अस्पताल दौरा",
      "link_x": "https://x.com/...", "link_instagram": "https://www.instagram.com/...",
      "link_whatsapp": "Share text", "videos": 0, "photos": 0, "done": false
    }
  ],
  "leader": {
    "id": 5, "title": "वादों का हिसाब दो, दिल्ली को जवाब दो", "kind": "video",
    "url": "https://YOUR-PROJECT.supabase.co/storage/v1/object/public/leader/1731300000000.mp4",
    "seen": false
  },
  "social": { "facebook": "https://www.facebook.com/...", "x": "https://x.com/...", "instagram": "https://www.instagram.com/..." },
  "helpline": "9000000000"
}
```
</details>

<details>
<summary><b>upload_url → PUT → attach → complete</b>: full upload flow</summary>

```json
// 1. Request a signed URL
{ "action": "upload_url", "task_id": 41, "kind": "video", "ext": "mp4" }
```

```json
// 200 OK
{
  "path": "2026-11-11/41/17/9876543210/video-1731310000000.mp4",
  "signed_url": "https://YOUR-PROJECT.supabase.co/storage/v1/object/upload/sign/uploads/2026-11-11/41/17/9876543210/video-1731310000000.mp4?token=..."
}
```

```bash
# 2. Upload the file bytes straight to storage
curl -X PUT "$SIGNED_URL" -H "Content-Type: video/mp4" -H "x-upsert: false" --data-binary @clip.mp4
```

```json
// 3. Record the file
{ "action": "attach", "task_id": 41, "kind": "video", "path": "2026-11-11/41/17/9876543210/video-1731310000000.mp4", "size": 18874368 }
```

```json
// 200 OK
{ "task": { "id": 41, "videos": 2, "photos": 0, "done": false } }
```

```json
// 4. Tick the task
{ "action": "complete", "task_id": 41 }
```

```json
// 200 OK
{ "ok": true }

// 400 if no video was uploaded
{ "error": "need_video" }
```
</details>

<details>
<summary><b>poll</b>: background reminder check</summary>

```json
// Request
{ "action": "poll", "since": "2026-11-11T07:30:00.000Z" }
```

```json
// 200 OK
{
  "pending": 2,
  "total": 3,
  "announcements": [
    { "id": 9, "body": "आज के काम रात 11:59 तक पूरे करें", "ward_no": null, "zone": null, "only_pending": true }
  ],
  "new_message": { "id": 6, "title": "नया संदेश", "published_at": "2026-11-11T09:00:00+00:00" },
  "reminder_hours": "7,10,13,16,19,22",
  "now": "2026-11-11T10:30:00.000Z"
}
```
</details>

### Admin data access

The admin panel reads and writes through Supabase's auto-generated REST API (`/rest/v1/<table>`) with the signed-in admin's token. Row-level security allows access only to users listed in `admins`.

| Resource | Type | Used for |
| --- | --- | --- |
| `members` | Table | Member list, Excel upsert, block/unblock |
| `tasks` | Table | Task manager |
| `media` | Table | Member upload gallery (plus signed URLs from `uploads`) |
| `completions` | Table | Ticks, with video and photo counts |
| `leader_messages`, `message_views` | Tables | Broadcasts and reach |
| `announcements` | Table | One-off reminder messages |
| `settings` | Table | Social links, helpline, reminder hours |
| `member_stats` | View | Ranking and member totals |
| `day_stats` | View | Daily completion trend |
| `ward_day_stats` | View | Ward heat map and zone ranking |
| `hour_stats` | View | Uploads-by-hour chart |
| `is_admin()` | RPC | Admin gate at login |

---

## Performance and capacity

> [!NOTE]
> The system has **not been load-tested yet**. The figures below are design limits and planning estimates, not measurements. Load-test with real phones before launch and replace this section with measured results.

### Expected load

| Metric | Estimate | Basis |
| --- | --- | --- |
| Registered members | 1,400 | Member list |
| Daily active members | 700 to 1,000 | Campaign expectation |
| Task completions per day | up to 3,500 | 1,000 active × about 3.5 tasks |
| Video uploads per day | 3,000 to 10,000 | 1 to 3 videos per completion |
| Video storage over 11 days | about 0.6 to 1.2 TB | about 30,000 videos × 20 to 40 MB |
| Peak window | 6 pm to 11 pm IST | End-of-day deadline at 11:59 pm |

### Design choices for performance

- **Direct-to-storage uploads.** Phones `PUT` video to signed URLs, so file bytes never touch the Edge Function. The API only handles small JSON calls, which keeps the function fast and cheap at the evening peak.
- **Streaming upload.** The app streams files in 64 KB chunks and never holds a whole video in memory. That matters on 2 to 3 GB RAM phones.
- **Retries.** Each upload is retried up to 3 times. The write timeout is 15 minutes for slow mobile data.
- **Totals worked out in SQL.** The dashboard reads `day_stats`, `ward_day_stats` (at most 250 rows a day) and `hour_stats`, not raw rows. One refresh pulls about 1,400 member rows plus a few hundred summary rows.
- **Indexes** on `members(ward_no)`, `tasks(task_date, sort)`, `media(task_id, mobile)` and `completions(task_id)`.
- **Polling, not sockets.** The dashboard refreshes every 30 seconds, which avoids holding open real-time connections for a handful of admins.
- **Spread-out background checks.** WorkManager runs about every 3 hours, needs a network connection, and timing varies by device. That naturally avoids 1,000 phones calling at the same moment.

### Known limits

| Area | Limit | Mitigation |
| --- | --- | --- |
| File size | 500 MB per file (bucket limit and app check) | Ask members for short clips; add on-device compression later |
| Background uploads | The upload stops if the app is closed mid-upload | The app warns "ऐप खुला रखें"; move uploads to a WorkManager job later |
| Reminder timing | About every 3 hours, not exact; battery savers on Xiaomi, Vivo and Oppo can delay it | Add Firebase Cloud Messaging for exact-time pushes |
| Member list in admin | 500 rows shown at once | Ward filter and search |
| Supabase row limit | 1,000 rows per request | `fetchAll()` pages through automatically |

### Security notes

| Topic | Current state |
| --- | --- |
| Member login | Mobile number only, no OTP (a product decision). Anyone who knows a number can sign in as that member. Admins can block a number. |
| Sessions | Random UUID tokens in `sessions`. They do not expire, and a member can have more than one. |
| Data access | RLS is on for every table. Members reach data only through the Edge Function, which checks each file path against the member's own number. |
| Member videos | Private bucket. Admins view them through signed URLs that expire after 1 hour. |

---

## Contributing and license

### Contributing

1. Create a branch from `main`: `git checkout -b feature/short-description`.
2. Keep changes focused. Put database changes in `supabase/schema.sql` as statements that are safe to re-run (`create ... if not exists`, `create or replace`).
3. Before opening a pull request, check that `npm run build` and `./gradlew assembleDebug` both pass, then run the end-to-end check on a real phone.
4. Write user-facing app copy in Hindi first, and have a native speaker review it.
5. Open a pull request with a short summary, screenshots for UI changes, and any migration steps.

**Commit style:** `type: summary`, for example `feat: add ward filter to members list`, `fix: retry upload on timeout`, `docs: update setup steps`.

### License

`[LICENSE TYPE: e.g. Proprietary, all rights reserved / MIT / Apache-2.0]`

Copyright © 2026 `[OWNER: e.g. Coceptual Media]`. Add a `LICENSE` file to the repository root once the license is decided.
