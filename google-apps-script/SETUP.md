# OLP teacher welcome email using Google Apps Script

This sender uses the Google account that owns the script. Teachers receive a welcome email from that account with “OLP Homework Hub” as the sender name. They are asked to use the in-app support chat; the email itself does not receive replies into OLP.

## Create and authorize the mailer

1. Sign in to the Google account you want to send OLP emails from.
2. Open https://script.google.com and create a standalone project called “OLP Homework Hub Mailer”.
3. Replace the editor contents with `TeacherWelcomeMailer.gs` from this folder and save.
4. Select `authorizeMailer` and click **Run**. Google will ask you to authorize email sending. Approve it.
5. Select `generateMailerToken` and click **Run**. In the execution log, copy the generated token and keep it private.
6. In **Project Settings → Script Properties**, confirm the property `OLP_MAILER_TOKEN` exists. The function sets it automatically.

## Deploy the web app

1. Click **Deploy → New deployment**.
2. Select **Web app**.
3. Set **Execute as** to your account.
4. Set **Who has access** to **Anyone** (including users not signed in), then deploy. Supabase calls this endpoint without a Google session; the endpoint accepts email requests only when the private 64-character shared token is correct.
5. Copy the deployment URL ending in `/exec`. Do not use the development `/dev` URL.

## Add Supabase Edge Function secrets

In Supabase → Edge Functions → Secrets, add:

- `APPS_SCRIPT_WEB_APP_URL`: the deployed `/exec` URL
- `APPS_SCRIPT_SHARED_SECRET`: the generated token
- `OLP_APP_URL`: `https://olp-homework-hub-web.olp-homeworkhub.workers.dev`

The shared token must match the Script Property `OLP_MAILER_TOKEN`. Do not put the token in this repository or send it in chat.

## Sending and daily limits

The Teachers Forum’s **Send welcome emails** button sends once to teachers who have not already received the message. Future teacher signups and owner invitations send automatically. The script checks Google’s remaining daily recipient quota before each email. Google currently lists a 100-recipients/day quota for consumer Gmail accounts; Workspace account quotas differ and Google can change these limits.

After PR #20 is merged, apply its Supabase migration and deploy the updated `owner-users` and `public-signup` Edge Functions before using the feature.
