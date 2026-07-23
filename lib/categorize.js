// lib/categorize.js
//
// Category guessing has two layers:
// 1. Learned rules — if you've manually recategorized this exact
//    counterparty before, that correction is remembered and reused.
// 2. Keyword fallback — a best-guess based on common Kenyan business
//    names/patterns, used only when there's no learned rule yet.
// Anything that matches neither lands in "Uncategorized" for you to tag.

const KEYWORD_RULES = [
  { match: /KPLC|KENYA POWER/i, category: 'Bills - Electricity' },
  { match: /NAIROBI WATER|WATER COMPANY|WASREB/i, category: 'Bills - Water' },
  { match: /ZUKU|SAFARICOM HOME|JTL|FAIBA/i, category: 'Bills - Internet' },
  { match: /DSTV|GOTV|STARTIMES/i, category: 'Bills - TV Subscription' },
  { match: /^Airtime$/i, category: 'Airtime & Data' },
  { match: /NAIVAS|CARREFOUR|QUICKMART|CHANDARANA|TUSKYS|SUPERMARKET/i, category: 'Groceries' },
  { match: /UBER|BOLT|LITTLE CAB|MATATU|SACCO SHUTTLE/i, category: 'Transport' },
  { match: /NHIF|SHA\b/i, category: 'Health Insurance' },
  { match: /HOSPITAL|CLINIC|PHARMACY|CHEMIST/i, category: 'Health' },
  { match: /RENT|LANDLORD/i, category: 'Rent' },
  { match: /SCHOOL|ACADEMY|COLLEGE|UNIVERSITY/i, category: 'School Fees' },
  { match: /RIDASWIFT/i, category: 'RidaSwift Business' },
  { match: /SWIFT SHOPPER/i, category: 'Swift Shopper Business' },
  { match: /^Agent withdrawal$/i, category: 'Cash Withdrawal' },
  { match: /^Cash deposit$/i, category: 'Cash Deposit' },
  { match: /^Fuliza overdraft$/i, category: 'Fuliza / Loan' },
  { match: /M-SHWARI|KCB M-PESA|TALA|BRANCH|ZENKA/i, category: 'Loan' },
  { match: /SACCO|CHAMA|WELFARE/i, category: 'Sacco / Chama' },
];

async function categorize(db, counterpartyName, direction) {
  if (!counterpartyName) {
    return { category: 'Uncategorized', source: 'none' };
  }

  const key = counterpartyName.trim().toUpperCase();

  // 1. Check learned rule first.
  const learnedDoc = await db.collection('categoryRules').doc(key).get();
  if (learnedDoc.exists) {
    return { category: learnedDoc.data().category, source: 'learned' };
  }

  // 2. Keyword fallback.
  for (const rule of KEYWORD_RULES) {
    if (rule.match.test(counterpartyName)) {
      return { category: rule.category, source: 'keyword' };
    }
  }

  // 3. Give up — default bucket, direction-aware.
  return {
    category: direction === 'income' ? 'Uncategorized Income' : 'Uncategorized Expense',
    source: 'none',
  };
}

module.exports = { categorize, KEYWORD_RULES };
