import { Link } from 'react-router-dom';
import LegalPage from '@/components/layout/LegalPage';
import { LEGAL_CONTACT } from '@/lib/legal';

const Privacy = () => (
  <LegalPage title="Privacy policy" documentTitle="Privacy policy | Pulse by Fractionl">
    <h2>Who we are</h2>
    <p>
      Pulse is operated by Mindmaker LLC, a United States company, and Mindmaker Ltd, a United Kingdom company
      (together, "Mindmaker", "we", "us"). Mindmaker LLC and Mindmaker Ltd are responsible for the personal
      information described in this policy.
    </p>

    <h2>Reading the index</h2>
    <p>
      You can read the index, the role pages, the brief, the API and the MCP tools without an account. The index itself
      is built from public market sources, not from information about you.
    </p>

    <h2>What we collect</h2>
    <ul>
      <li>
        <strong>Browser storage.</strong> Pulse keeps a random visitor identifier, how you first arrived (referrer,
        landing page and any campaign tags in the link), your chosen role and your display preferences in your
        browser's local storage. The identifier and arrival details can be sent with a small number of product events
        (for example sign-up) to Pulse's own event service.
      </li>
      <li>
        <strong>Analytics.</strong> We use PostHog to count page views and page exits. It loads after your first
        interaction or after 15 seconds, and it sets its own cookies or browser storage.
      </li>
      <li>
        <strong>Accounts.</strong> If you create an account we store your email address and the role you choose.
        Sign-in is handled by Supabase Auth, by email and password or with Google if you choose it. We do not see your
        password.
      </li>
      <li>
        <strong>API keys.</strong> If you create a key we store it against your account and count its requests for
        rate limits.
      </li>
      <li>
        <strong>Ask the Index.</strong> Your question is sent to OpenAI to write the answer, with the current public
        index reading. We do not store the question. To rate limit requests we keep a one-way hash of your network
        address for a short time window, not the address itself.
      </li>
      <li>
        <strong>Email.</strong> If you write to us, we keep the correspondence.
      </li>
    </ul>
    <p>Pulse does not take card payments on the site, does not run advertising and does not sell personal information.</p>

    <h2>Who processes it</h2>
    <p>
      Supabase (database, sign-in and server functions), Vercel (hosting), PostHog (analytics), OpenAI (Ask the Index
      answers), Google (fonts, and sign-in if you choose it). Each handles information only to provide its service to us.
    </p>

    <h2>How long we keep it</h2>
    <p>
      Account and API key information is kept while your account exists. Browser storage stays on your device until you
      clear it.
    </p>

    <h2>Your choices</h2>
    <ul>
      <li>Clear your browser storage or block analytics in your browser at any time; the index still works.</li>
      <li>Ask us for a copy of, a correction to, or deletion of your personal information, including your account.</li>
    </ul>

    <h2>Changes</h2>
    <p>
      We will update this policy when what Pulse collects changes. The date at the top shows the latest version. The
      rules for using Pulse are in the <Link to="/terms">terms of use</Link>.
    </p>

    <h2>Contact</h2>
    <p>
      Privacy questions and requests: <a href={`mailto:${LEGAL_CONTACT}`}>{LEGAL_CONTACT}</a>.
    </p>
  </LegalPage>
);

export default Privacy;
