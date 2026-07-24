// api/recategorize.js
//
// Called from the dashboard when you manually change a transaction's
// category. This updates that one transaction AND saves a "learned rule"
// for the counterparty, so future transactions from the same person/
// business get auto-tagged correctly without you fixing it again.

const admin = require('firebase-admin');

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
    const { transactionId, category, counterpartyName, learnForCounterparty, direction } = req.body || {};
    if (!transactionId || !category) {
      res.status(400).json({ error: 'transactionId and category are required' });
      return;
    }

    const updateData = {
      category,
      categorySource: 'manual',
    };
    // Only unparsed transactions need their direction fixed here — parsed
    // ones already have a correct direction from the SMS wording, so we
    // don't let a stray value overwrite that.
    if (direction === 'income' || direction === 'expense') {
      updateData.direction = direction;
    }

    await db.collection('transactions').doc(transactionId).update(updateData);

    if (learnForCounterparty !== false && counterpartyName) {
      const key = counterpartyName.trim().toUpperCase();
      await db.collection('categoryRules').doc(key).set({
        category,
        updatedAt: Date.now(),
      });
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('recategorize error:', err);
    res.status(500).json({ error: 'Internal error', detail: String(err) });
  }
};
