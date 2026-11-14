# INC MCD NETWORK (Ward Sadasya): app + admin panel

Three parts:

| Folder | What | Where it runs |
| --- | --- | --- |
| `supabase/` | Database, file storage, app API | Supabase |
| `admin/` | Admin panel and analytics dashboard | Vercel |
| `android/` | Android app for ward members (APK) | Built in Android Studio |

Setup takes about 45 minutes, in this order.

---


> **Upgrading to v1.3 (INC MCD NETWORK)?** Follow [Upgrade to v1.3](#upgrade-to-v13-inc-mcd-network) at the end. You need to re-run the schema, deploy two new functions and, for instant notifications, set up Firebase.

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

---

## Upgrade to v1.3 (INC MCD NETWORK)

### What's new

| Area | Change |
| --- | --- |
| App | New name **INC MCD NETWORK**. Points (20 per video, 10 per photo, 15 per share; no points for the tick itself) on the home screen and a "मेरे अंक" screen. |
| App | Share panel after every completed task and on the home screen: Retweet and Like on X, plus Facebook, Instagram and WhatsApp. Links open in the matching app; WhatsApp shares the text directly. |
| App | Instant high-priority notifications through Firebase, with the 15-minute background check kept as a fallback. |
| App | Bottom navigation bar (होम, संदेश, सूचनाएं, मेरे अंक) and a footer. Smoother screen transitions; home shows cached data instantly while refreshing. |
| Admin | **Team** tab: the master admin creates telecallers (name, mobile, password, districts, remarks) and other admins. |
| Admin | **Calling** tab: telecallers log in with mobile + password and see only their districts' members, sorted by who needs a call (not logged in, inactive, pending today, follow-up due). One-tap call and WhatsApp, call outcome, remarks and follow-up date. |
| Admin | **Reports** tab: a full report per ward member (every task, video, photo, share and call) plus a task report with share counts. Excel exports. |
| Admin | Notifications go out instantly; new tasks and leader messages can notify all members on save. |
| Data | "Zone" is now "District" everywhere. The district list comes from the members Excel, so any number of districts works. |

### Steps

0. **Easiest: let GitHub deploy it.** Add the repo secret `SUPABASE_ACCESS_TOKEN` (Supabase > Account preferences > Access Tokens). Every push to main that changes `supabase/` then runs the schema and deploys all four functions (Actions > Deploy backend). You can also run it by hand from the Actions tab. The steps below are the manual way.
1. **Re-run the schema.** Open Supabase **SQL Editor**, paste all of `supabase/schema.sql` and run it. It is safe on the existing database: it adds the new tables and the `district` columns, copies old zone values into district, and leaves your data alone.
2. **Turn off public sign-ups.** Supabase **Authentication > Sign In / Providers > Email**: turn off **Allow new users to sign up**. Logins are now created only from the admin panel's Team tab.
   > [!WARNING]
   > The old schema made every new sign-up an admin. v1.3 removes that trigger. Check the `admins` table and delete any user you don't recognise.
3. **Deploy the functions:**
   ```bash
   supabase functions deploy app --no-verify-jwt
   supabase functions deploy leader --no-verify-jwt
   supabase functions deploy push
   supabase functions deploy admin
   ```
   `push` and `admin` keep JWT verification on: only signed-in admins can call them.
4. **Firebase, for instant notifications (about 15 min):**
   1. Go to [console.firebase.google.com](https://console.firebase.google.com), **Add project**, and turn off Google Analytics.
   2. **Add app > Android**, package name `com.coceptual.wardsadasya`, and download `google-services.json`. Don't add the file to the project; just copy four values out of it:

      | gradle.properties / GitHub secret | Value in google-services.json |
      | --- | --- |
      | `FCM_APP_ID` | `client[0].client_info.mobilesdk_app_id` |
      | `FCM_API_KEY` | `client[0].api_key[0].current_key` |
      | `FCM_PROJECT_ID` | `project_info.project_id` |
      | `FCM_SENDER_ID` | `project_info.project_number` |
   3. Put them in `android/gradle.properties`, or add them as GitHub repo secrets with the same names for the cloud build.
   4. **Project settings > Service accounts > Generate new private key.** Store the whole JSON as a Supabase secret:
      ```bash
      supabase secrets set FIREBASE_SERVICE_ACCOUNT="$(cat service-account.json)"
      ```
   Without Firebase everything still works; notifications then arrive at the phone's next background check (up to about 15 minutes).
5. **Build and publish the APK** (v1.3, build 4). After it is out, set **Notifications and links > Android App Latest Version Code** to `4` so older phones see the update prompt.
6. **Create the telecallers** in the **Team** tab. Each one logs in at the admin panel URL with their mobile number and password.

### Notes

- Telecallers only see members whose district matches one of their districts (case and spaces ignored). Members with no district appear only for admins.
- Share points count the first tap per task and platform. The app cannot confirm that the member actually retweeted or posted.
- On phones with aggressive battery savers (Xiaomi, Vivo, Oppo, Realme), ask members to set the app's battery use to "No restrictions" for reliable notifications.

