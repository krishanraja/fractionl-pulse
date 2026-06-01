/**
 * One-shot Stripe setup for Pulse Pro (Fractionl AI account, shared with Circle).
 *
 * Creates the Pulse Pro product and two recurring prices (monthly 9900,
 * annual 94800), idempotently: each price is looked up by a stable lookup_key
 * before anything is created, so re-running is safe and never duplicates.
 * Every object is stamped app=pulse + stripe_account=fractionl_ai so Pulse
 * revenue stays separable from Circle on the shared account. Re-running also
 * reconciles that metadata onto objects created by an earlier version.
 *
 * Run: PULSE_STRIPE_SECRET_KEY=sk_test_... npx tsx scripts/stripe-setup.ts
 * (Use a TEST key first to verify, then a live key for production. Note that
 * test-mode and live-mode produce different price IDs.)
 *
 * Prints the resulting price IDs and the exact `supabase secrets set` command
 * to wire them into the create-checkout-session function. The secret key is
 * read from the environment and is never written to disk or committed.
 */

const STRIPE_KEY = process.env.PULSE_STRIPE_SECRET_KEY || '';

// The stable separability triple stamped onto every object Pulse creates.
const PULSE_META: Record<string, string> = {
  app: 'pulse',
  stripe_account: 'fractionl_ai',
  pulse_product: 'pro',
};
const MONTHLY_LOOKUP_KEY = 'pulse_pro_monthly';
const ANNUAL_LOOKUP_KEY = 'pulse_pro_annual';
const MONTHLY_AMOUNT = 9900; // 99 USD / month
const ANNUAL_AMOUNT = 94800; // 79 USD / month billed annually = 948 USD / year

interface StripeObject {
  id: string;
  metadata?: Record<string, string>;
  product?: StripeObject;
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

// Add any missing separability metadata to an existing object. A no-op when the
// object already carries the full triple (as freshly created ones do).
async function reconcileMetadata(resource: 'products' | 'prices', obj: StripeObject): Promise<void> {
  const current = obj.metadata || {};
  const missing = Object.entries(PULSE_META).filter(([k, v]) => current[k] !== v);
  if (!missing.length) return;
  const params: Record<string, string> = {};
  for (const [k, v] of missing) params[`metadata[${k}]`] = v;
  await stripePost(`${resource}/${obj.id}`, params);
  console.log(`Reconciled metadata on ${obj.id}: ${missing.map(([k]) => k).join(', ')}`);
}

async function createProduct(): Promise<StripeObject> {
  const product = await stripePost('products', {
    name: 'Pulse Pro',
    description: 'Pulse Pro: full sub-index breakdown, 12-month history, all signals, AI insight cards, custom weight tuning, and brief export.',
    'metadata[app]': PULSE_META.app,
    'metadata[stripe_account]': PULSE_META.stripe_account,
    'metadata[pulse_product]': PULSE_META.pulse_product,
  });
  console.log(`Created product ${product.id}`);
  return product;
}

async function createPrice(
  lookupKey: string,
  unitAmount: number,
  interval: 'month' | 'year',
  productId: string,
): Promise<StripeObject> {
  const price = await stripePost('prices', {
    product: productId,
    currency: 'usd',
    unit_amount: String(unitAmount),
    'recurring[interval]': interval,
    lookup_key: lookupKey,
    nickname: lookupKey === MONTHLY_LOOKUP_KEY ? 'Pulse Pro Monthly' : 'Pulse Pro Annual',
    'metadata[app]': PULSE_META.app,
    'metadata[stripe_account]': PULSE_META.stripe_account,
    'metadata[pulse_product]': PULSE_META.pulse_product,
  });
  console.log(`Created price ${price.id} (${lookupKey}, ${unitAmount} usd / ${interval})`);
  return price;
}

async function main(): Promise<void> {
  if (!STRIPE_KEY) {
    console.error('Missing PULSE_STRIPE_SECRET_KEY in the environment.');
    process.exit(1);
  }

  // Look up by lookup_key first so a re-run reuses rather than duplicates.
  const existingMonthly = await findPriceByLookupKey(MONTHLY_LOOKUP_KEY);
  const existingAnnual = await findPriceByLookupKey(ANNUAL_LOOKUP_KEY);

  // Reuse the product the existing prices already point at, else create one.
  let product =
    (existingMonthly?.product as StripeObject | undefined) ||
    (existingAnnual?.product as StripeObject | undefined) ||
    null;
  if (product) {
    console.log(`Reusing product ${product.id} from an existing price`);
  } else {
    product = await createProduct();
  }
  await reconcileMetadata('products', product);

  const monthly = existingMonthly || (await createPrice(MONTHLY_LOOKUP_KEY, MONTHLY_AMOUNT, 'month', product.id));
  if (existingMonthly) console.log(`Reusing existing price ${monthly.id} (${MONTHLY_LOOKUP_KEY})`);
  await reconcileMetadata('prices', monthly);

  const annual = existingAnnual || (await createPrice(ANNUAL_LOOKUP_KEY, ANNUAL_AMOUNT, 'year', product.id));
  if (existingAnnual) console.log(`Reusing existing price ${annual.id} (${ANNUAL_LOOKUP_KEY})`);
  await reconcileMetadata('prices', annual);

  console.log('\n==================== Pulse Pro pricing ready ====================');
  console.log(`Product            : ${product.id}`);
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
