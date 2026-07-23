# M-Pesa Ledger

Automatically records every M-Pesa SMS you receive, sorts it into income
or expense, guesses a category, and shows it all in a dashboard —
without needing any Safaricom business registration.

## How it works

1. An SMS-forwarding app on your phone watches for texts from "MPESA"
   and forwards each one to `/api/sms-webhook`
2. That function parses the message (amount, sender/receiver, type),
   guesses a category, and saves it to Firestore
3. The dashboard (`index.html`) shows everything live, with totals and
   filters, and lets you fix any wrong category — which it then
   remembers for next time

## Deploy steps (same pattern as the RidaSwift M-Pesa backend)

1. Create a new GitHub repo, upload all these files (keep the folder
   structure: `api/`, `lib/`, plus the root files)
2. Import it into Vercel (should already be connected to your GitHub
   from before)
3. Add environment variables from `.env.example`:
   - `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
     — generate a **fresh** Firebase service account key for this (don't
     reuse the RidaSwift one)
   - `SMS_WEBHOOK_SECRET` — make up any long random string yourself,
     you'll need to enter this exact same string in the SMS-forwarding
     app later
4. Deploy

## Set up SMS forwarding on your phone

1. Install a free SMS-forwarding app from the Play Store (e.g. "SMS
   Forwarder" by Fasil, or similar — look for one that supports
   "forward to webhook/URL" and lets you filter by sender)
2. Set it to trigger only on messages from **MPESA**
3. Set the destination URL to:
   `https://<your-vercel-project>.vercel.app/api/sms-webhook`
4. Add a custom header: `x-webhook-secret` with the same value as
   `SMS_WEBHOOK_SECRET`
5. Set the request body to send the message text as JSON:
   `{ "message": "<sms text>" }` (exact field name/format depends on
   the app — some call it differently, we'll adjust the code to match
   whichever app you pick)

## Set the dashboard PIN

Open `index.html`, find this line near the top of the script:
```js
const PIN = '0000'; // change this before real use
```
Change `0000` to a real PIN before using this for real — this ledger
holds all your financial activity, personal and business combined.

## Known limitation

Category guesses are best-effort. Income vs. expense is reliable (it's
determined directly from the SMS wording), but specific categories
(groceries, bills, etc.) rely on keyword matching against the sender/
receiver name, or on rules you've taught it by correcting a category
once. Expect to do some manual correcting early on — accuracy improves
as it learns your regular counterparties.
