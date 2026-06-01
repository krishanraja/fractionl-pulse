/**
 * One-shot Stripe setup for Pulse Pro (Fractionl AI account, shared with Circle).
 *
 * Creates the Pulse Pro product and two recurring prices (monthly 9900,
 * annual 94800), idempotently: each price is looked up by a stable lookup_key
 * before anything is created, so re-running is safe and never duplicates.
 * Every object is stamped app=pulse + stripe_account=fractionl_ai so Pulse
 * revenue stays separable from Circle on the shared account.
 *
 * Run: PULSE_STRIPE_SECRET_KEY=sk_test_... npx tsx scripts/stripe-setup.ts
 * (Use a TEST key first to verify, then a live key for production.)
 *
 * Prints the resulting price IDs and the exact `supabase secrets set` command
 * to wire them into the create-checkout-session function. The secret key is
 * read from the environment and is never written to disk or committed.
 */

const STRIPE_KEY = process.env.PULSE_STRIPE_SECRET_KEY || '';

const PRODUCT_LOOKUP = { app: 'pulse', stripe_account: 'fractionl_ai', pulse_product: 'pro' };
const MONTHLY_LOOKUP_KEY = 'pulse_pro_monthly';
const ANNUAL_LOOKUP_KEY = 'pulse_pro_annual';
const MONTHLY_AMOUNT = 9900; // 99 USD / month
const ANNUAL_AMOUNT = 94800; // 79 USD / month billed annually = 948 USD / year

interface StripeObject {
  id: string;
  [key: string]: unknown;
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${STRIPE_KEY}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
}

async function stripePost(path: string, params: Record<string, string>): Promise<StripeObject> {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body: new URLSearchParams(params).toString(),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`POST ${path} failed: ${body?.error?.message || res.status}`);
  }
  return body as StripeObject;
}

async function stripeGet(path: string): Promise<any> {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, { headers: authHeaders() });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`GET ${path} failed: ${body?.error?.message || res.status}`);
  }
  return body;
}

// The lookup_keys list endpoint is immediately consistent (unlike search), so it
// is the reliable idempotency check: a price with this lookup_key already exists.
async function findPriceByLookupKey(lookupKey: string): Promise<StripeObject | null> {
  const q = `prices?active=true&limit=1&lookup_keys[]=${encodeURIComponent(lookupKey)}&expand[]=data.product`;
  const body = await stripeGet(q);
  return body?.data?.length ? (body.data[0] as StripeObject) : null;
}

async function findOrCreateProduct(): Promise<StripeObject> {
  // Products have no lookup_key, so match on our stable metadata triple.
  const query = `metadata['app']:'${PRODUCT_LOOKUP.app}' AND metadata['pulse_product']:'${PRODUCT_LOOKUP.pulse_product}'`;
  const found = await stripeGet(`products/search?query=${encodeURIComponent(query)}&limit=1`);
  if (found?.data?.length) {
    console.log(`Reusing existing product ${found.data[0].id}`);
    return found.data[0] as StripeObject;
  }
  const product = await stripePost('products', {
    name: 'Pulse Pro',
    description: 'Pulse Pro: full sub-index breakdown, 12-month history, all signals, AI insight cards, custom weight tuning, and brief export.',
    'metadata[app]': PRODUCT_LOOKUP.app,
    'metadata[stripe_account]': PRODUCT_LOOKUP.stripe_account,
    'metadata[pulse_product]': PRODUCT_LOOKUP.pulse_product,
  });
  console.log(`Created product ${product.id}`);
  return product;
}

async function ensurePrice(
  lookupKey: string,
  unitAmount: number,
  interval: 'month' | 'year',
  productId: string,
): Promise<StripeObject> {
  const existing = await findPriceByLookupKey(lookupKey);
  if (existing) {
    console.log(`Reusing existing price ${existing.id} (${lookupKey})`);
    return existing;
  }
  const price = await stripePost('prices', {
    product: productId,
    currency: 'usd',
    unit_amount: String(unitAmount),
    'recurring[interval]': interval,
    lookup_key: lookupKey,
    nickname: lookupKey === MONTHLY_LOOKUP_KEY ? 'Pulse Pro Monthly' : 'Pulse Pro Annual',
    'metadata[app]': 'pulse',
    'metadata[stripe_account]': 'fractionl_ai',
    'metadata[pulse_product]': 'pro',
  });
  console.log(`Created price ${price.id} (${lookupKey}, ${unitAmount} usd / ${interval})`);
  return price;
}

async function main(): Promise<void> {
  if (!STRIPE_KEY) {
    console.error('Missing PULSE_STRIPE_SECRET_KEY in the environment.');
    process.exit(1);
  }

  // Short-circuit on the prices themselves: if both already exist we never touch
  // the product, so a successful run is fully idempotent on re-run.
  const existingMonthly = await findPriceByLookupKey(MONTHLY_LOOKUP_KEY);
  const existingAnnual = await findPriceByLookupKey(ANNUAL_LOOKUP_KEY);

  let productId =
    (existingMonthly?.product as StripeObject | undefined)?.id ||
    (existingAnnual?.product as StripeObject | undefined)?.id ||
    '';
  if (!productId) {
    productId = (await findOrCreateProduct()).id;
  } else {
    console.log(`Reusing product ${productId} from an existing price`);
  }

  const monthly = existingMonthly || (await ensurePrice(MONTHLY_LOOKUP_KEY, MONTHLY_AMOUNT, 'month', productId));
  const annual = existingAnnual || (await ensurePrice(ANNUAL_LOOKUP_KEY, ANNUAL_AMOUNT, 'year', productId));

  console.log('\n==================== Pulse Pro pricing ready ====================');
  console.log(`Product            : ${productId}`);
  console.log(`Monthly price id   : ${monthly.id}  (${MONTHLY_AMOUNT} usd / month)`);
  console.log(`Annual price id    : ${annual.id}  (${ANNUAL_AMOUNT} usd / year)`);
  console.log('\nSet these as Supabase secrets for create-checkout-session:');
  console.log(`  supabase secrets set PULSE_PRICE_MONTHLY=${monthly.id} PULSE_PRICE_ANNUAL=${annual.id} --project-ref dtlcprcpvdomrehbejhw`);
  console.log('=================================================================\n');
}

main().catch((err) => {
  console.error(String(err));
  process.exit(1);
});
