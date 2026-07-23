// api/sms-webhook.js
//
// Your phone's SMS-forwarding app sends each M-Pesa message here as it
// arrives. This parses it, applies a category guess, and saves it to
// Firestore so the dashboard picks it up in real time.

const admin = require('firebase-admin');
const { parseMpesaSms } = require('../lib/parseMpesaSms');
const { categorize } = require('../lib/categorize');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
  });
}
const db = admin.firestore();

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Simple shared-secret check so random internet traffic can't write
    // fake transactions into your ledger.
    const secret = req.headers['x-webhook-secret'];
    if (secret !== process.env.SMS_WEBHOOK_SECRET) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const smsText = (req.body && req.body.message) || (req.body && req.body.text) || '';
    if (!smsText) {
      res.status(400).json({ error: 'No SMS text provided' });
      return;
    }

    const parsed = parseMpesaSms(smsText);

    let categoryResult = { category: 'Uncategorized', source: 'none' };
    if (parsed.parsed) {
      categoryResult = await categorize(db, parsed.counterpartyName, parsed.direction);
    }

    const record = {
      ...parsed,
      category: categoryResult.category,
      categorySource: categoryResult.source,
      receivedAt: Date.now(),
    };

    const docRef = await db.collection('transactions').add(record);

    res.status(200).json({ success: true, id: docRef.id, parsed: parsed.parsed, category: categoryResult.category });
  } catch (err) {
    console.error('sms-webhook error:', err);
    res.status(500).json({ error: 'Internal error', detail: String(err) });
  }
};
