
// lib/parseMpesaSms.js
//
// Safaricom M-Pesa SMS messages follow a handful of fairly consistent
// formats depending on transaction type. This tries each known pattern
// in turn. If nothing matches, it still returns the raw text tagged as
// "unparsed" rather than silently dropping it — those show up in the
// dashboard for manual review instead of vanishing.

function cleanAmount(str) {
  return parseFloat(str.replace(/,/g, ''));
}

function extractCode(text) {
  // The M-Pesa transaction code is the first token, e.g. "SFC1A2B3C4"
  const m = text.match(/^([A-Z0-9]{10})\s/);
  return m ? m[1] : null;
}

function extractBalance(text) {
  const m = text.match(/(?:New M-PESA balance is|New utility balance is)\s*Ksh([\d,]+\.\d{2})/i);
  return m ? cleanAmount(m[1]) : null;
}

function extractDateTime(text) {
  const m = text.match(/on\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+at\s+([\d:]+\s?[APM]{2})/i);
  return m ? { date: m[1], time: m[2] } : null;
}

function extractCost(text) {
  const m = text.match(/Transaction cost,?\s*Ksh([\d,]+\.\d{2})/i);
  return m ? cleanAmount(m[1]) : 0;
}

const PATTERNS = [
  {
    type: 'received',
    direction: 'income',
    re: /Confirmed\.?\s*You have received Ksh([\d,]+\.\d{2}) from ([A-Z0-9 ]+?)\s+(\d{6,12})\s+on/i,
    parse: (m, text) => ({
      amount: cleanAmount(m[1]),
      counterpartyName: m[2].trim(),
      counterpartyPhone: m[3],
    }),
  },
  {
    type: 'received_business', // till/paybill owner receiving a customer payment
    direction: 'income',
    re: /Confirmed\.?\s*You have received Ksh([\d,]+\.\d{2}) from ([A-Z0-9 ]+?)\s+(\d{6,12})\s+for account\s*([A-Z0-9\- ]*)\s+on/i,
    parse: (m) => ({
      amount: cleanAmount(m[1]),
      counterpartyName: m[2].trim(),
      counterpartyPhone: m[3],
      accountRef: m[4].trim(),
    }),
  },
  {
    type: 'sent',
    direction: 'expense',
    re: /Confirmed\.?\s*Ksh([\d,]+\.\d{2}) sent to ([A-Z0-9 ]+?)\s+(\d{9,12})\s+on/i,
    parse: (m) => ({
      amount: cleanAmount(m[1]),
      counterpartyName: m[2].trim(),
      counterpartyPhone: m[3],
    }),
  },
  {
    type: 'paybill',
    direction: 'expense',
    re: /Confirmed\.?\s*Ksh([\d,]+\.\d{2}) (?:sent to|paid to) ([A-Z0-9 &.\-]+?) for account\s*([A-Z0-9\- ]*)\s+on/i,
    parse: (m) => ({
      amount: cleanAmount(m[1]),
      counterpartyName: m[2].trim(),
      accountRef: m[3].trim(),
    }),
  },
  {
    type: 'till',
    direction: 'expense',
    re: /Confirmed\.?\s*Ksh([\d,]+\.\d{2}) paid to ([A-Z0-9 &.\-]+?)\.?\s+on/i,
    parse: (m) => ({
      amount: cleanAmount(m[1]),
      counterpartyName: m[2].trim(),
    }),
  },
  {
    type: 'airtime',
    direction: 'expense',
    re: /Confirmed\.?\s*You bought Ksh([\d,]+\.\d{2}) of airtime/i,
    parse: (m) => ({
      amount: cleanAmount(m[1]),
      counterpartyName: 'Airtime',
    }),
  },
  {
    type: 'withdrawal',
    direction: 'expense',
    re: /Confirmed\.?\s*[Yy]ou have withdrawn Ksh([\d,]+\.\d{2}) from (?:agent\s*)?(\d+)?\s*-?\s*([A-Z0-9 &.\-]*?)\s+on/i,
    parse: (m) => ({
      amount: cleanAmount(m[1]),
      counterpartyName: (m[3] || 'Agent withdrawal').trim(),
      counterpartyPhone: m[2] || null,
    }),
  },
  {
    type: 'deposit',
    direction: 'income',
    re: /Confirmed\.?\s*[Yy]ou have deposited Ksh([\d,]+\.\d{2})/i,
    parse: (m) => ({
      amount: cleanAmount(m[1]),
      counterpartyName: 'Cash deposit',
    }),
  },
  {
    type: 'fuliza',
    direction: 'expense',
    re: /Fuliza M-PESA amount is Ksh([\d,]+\.\d{2})/i,
    parse: (m) => ({
      amount: cleanAmount(m[1]),
      counterpartyName: 'Fuliza overdraft',
    }),
  },
];

function parseMpesaSms(rawText) {
  const text = (rawText || '').replace(/\s+/g, ' ').trim();
  const code = extractCode(text);
  const balance = extractBalance(text);
  const dateTime = extractDateTime(text);
  const cost = extractCost(text);

  for (const pattern of PATTERNS) {
    const m = text.match(pattern.re);
    if (m) {
      const fields = pattern.parse(m, text);
      return {
        parsed: true,
        type: pattern.type,
        direction: pattern.direction,
        code,
        balance,
        cost,
        date: dateTime ? dateTime.date : null,
        time: dateTime ? dateTime.time : null,
        rawText: text,
        ...fields,
      };
    }
  }

  // Nothing matched — surface it for manual review rather than dropping it.
  return {
    parsed: false,
    type: 'unparsed',
    direction: null,
    code,
    balance,
    cost,
    date: dateTime ? dateTime.date : null,
    time: dateTime ? dateTime.time : null,
    rawText: text,
    amount: null,
    counterpartyName: null,
  };
}

module.exports = { parseMpesaSms };
