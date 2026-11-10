# Ward Sadasya: app + admin panel

Three parts:

| Folder | What | Where it runs |
| --- | --- | --- |
| `supabase/` | Database, file storage, app API | Supabase |
| `admin/` | Admin panel and analytics dashboard | Vercel |
| `android/` | Android app for ward members (APK) | Built in Android Studio |

Setup takes about 45 minutes, in this order.

---

## 1. Supabase (about 10 min)

1. Create a new project in Supabase, region **Mumbai (ap-south-1)**. Upgrade it to the **Pro** plan: the free plan has only 1 GB of file storage, and the videos will be in the hundreds of GB.
2. Open **SQL Editor**, paste all of `supabase/schema.sql`, and click **Run**.
3. Deploy the app API. On the developer's laptop, with the Supabase CLI installed:
   ```
   supabase login
   supabase link --project-ref YOUR-PROJECT-REF
   supabase functions deploy app --no-verify-jwt
   ```
   (`--no-verify-jwt` is required. The app uses its own login by mobile number.)
4. Create the admin login. Go to **Authentication > Users > Add user**, enter an email and password, and copy the new user's **ID**. Then run this in the SQL Editor:
   ```sql
   insert into admins (user_id, label) values ('PASTE-USER-ID', 'Rahil');
   ```
   Repeat for each person who needs the admin panel.
5. Note down two values from **Project Settings > API**:
   - Project URL, e.g. `https://abcd.supabase.co`
   - `anon` public key

## 2. Admin panel on Vercel (about 5 min)

1. Push this whole folder to a GitHub repo.
2. In Vercel, click **Add New > Project** and import the repo. Set **Root Directory** to `admin` (Vite is auto-detected).
3. Add two **Environment Variables**:
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = anon key
4. Deploy, then open the site and log in with the admin email.

To run it locally instead: `cd admin && cp .env.example .env` (fill in both values), then `npm install && npm run dev`.

## 3. Load the data (about 10 min)

1. **Ward members tab > Download template.** Fill in `name`, `mobile`, `ward` (1 to 250). Optional columns: `ward name`, `zone`, `assembly`. The heat map groups wards by zone, so fill in zone if you have it.
2. Click **Upload Excel**. Bad rows are skipped and listed by row number. Re-uploading the same numbers updates them.
3. **Tasks tab > + New task.** Add each day's tasks:
   - **Task with video upload:** set the number of videos (1 to 5). The member can tick only after at least 1 video is uploaded.
   - **Share card:** for "watch and reshare" posts. Paste the X, Instagram, Facebook links and the WhatsApp text. It shows as buttons, not as a task.
4. **Reminders and links tab:** fill in Devender Yadav ji's Facebook, X and Instagram links and the helpline number.
5. **Leader messages tab:** upload a landscape video or an audio file.

## 4. Android APK (about 20 min, needs Android Studio)

1. Open the `android` folder in Android Studio (Koala or newer, JDK 17) and let Gradle sync. If it asks to create the Gradle wrapper, accept it.
2. In `android/gradle.properties`, fill in:
   ```
   WS_API_URL=https://YOUR-PROJECT.supabase.co/functions/v1/app
   WS_ANON_KEY=YOUR-ANON-KEY
   ```
3. Choose **Build > Build App Bundle(s) / APK(s) > Build APK(s)**. For the release variant, run `./gradlew assembleRelease`. It is signed with the debug key, which is fine for sharing the APK directly.
4. The APK is in `android/app/build/outputs/apk/`. Send it to the calling team for WhatsApp.

**Important:** build every future update on the same machine. Android only installs an update over the old app when both are signed with the same key.

The code has not been compiled yet, so expect to fix the odd compile error during the first build.

Alternative: GitHub can build the APK. Add repo secrets `WS_API_URL` and `WS_ANON_KEY`, then run **Actions > Build APK**.

## 5. Before sending the APK to 1,400 people

Test these on one real phone:

- [ ] Log in with a number from the Excel. A number that is not on the list shows the helpline.
- [ ] Upload a video. The tick button turns on, tick, and the dashboard shows the task as completed within 30 sec.
- [ ] The leader message plays, and its view count goes up in the admin panel.
- [ ] Allow notifications when the app asks.

---

## How it works

- **Login:** mobile number only, no OTP, as decided. Anyone who knows a member's number can log in as them. To block a number, go to **Ward members > Block/unblock**.
- **Uploads:** files go straight from the phone to Supabase Storage. The size limit is 500 MB per file. The app must stay open during an upload, and a failed upload retries 3 times.
- **Reminders:** there is no Firebase. The phone checks in with the server about every 3 hours. It shows a notification when tasks are pending, a new leader message is up, or the admin has sent a message. Android decides the exact timing, so reminders come roughly every 3 hours, not exactly at 7, 10 and 1. Some phone brands (Xiaomi, Vivo, Oppo) delay background checks to save battery. Exact-time pushes would need Firebase Cloud Messaging added later.
- **Dashboard:** refreshes every 30 sec. Ranking is by tasks completed, then videos uploaded. There are no points or approvals.
- **Day dates:** India time. Tasks show on their own date. Members can still upload to past days.
- **Heat map:** wards are grouped by the zone or assembly from the Excel. A real ward boundary map can be added once the 250-ward map file is available.

## Storage estimate

At 1,000 active members × about 3 videos × 11 days, roughly 30,000 videos. If videos average 20 to 40 MB, that is about 0.6 to 1.2 TB. Supabase Pro includes 100 GB, and extra storage is billed per GB. Check the current Supabase pricing page before launch.
