import { Link } from 'react-router-dom';
import LegalPage from '@/components/layout/LegalPage';
import { LEGAL_CONTACT } from '@/lib/legal';

const Terms = () => (
  <LegalPage title="Terms of use" documentTitle="Terms of use | Pulse by Fractionl">
    <h2>Who we are</h2>
    <p>
      Pulse is operated by Mindmaker LLC, a United States company, and Mindmaker Ltd, a United Kingdom company
      (together, "Mindmaker", "we", "us"). Pulse is published under the Fractionl name.
    </p>

    <h2>What Pulse is</h2>
    <p>
      Pulse publishes the Fractional Working Index, a private 0 to 100 composite of the fractional executive market,
      with its components, role-demand pages, a weekly brief, a public API and hosted MCP tools. It is not an
      official, institutional or government index, and nothing on Pulse is financial, investment, career or rate advice.
    </p>

    <h2>Using the index and the API</h2>
    <ul>
      <li>Reading the index, the public API and the MCP tools is free and needs no account.</li>
      <li>You may cite the index with attribution to the Fractional Working Index.</li>
      <li>Requests are rate limited. Do not try to get around the limits or disrupt the service.</li>
      <li>An optional account lets you save your role and manage an API key. Keep your key private; we may disable a key that is used abusively.</li>
    </ul>

    <h2>Accuracy</h2>
    <p>
      The index is built from third-party public sources that can be late, incomplete or wrong. Each reading shows its
      data completeness and source health so you can judge how much weight to give it. Ask the Index produces
      AI-generated interpretation that can be mistaken. Pulse is provided as it is, and you use it at your own judgement.
    </p>

    <h2>Benchmark partners</h2>
    <p>
      Founding Benchmark Partner pilots and any other paid arrangement are agreed separately in writing. Those
      agreements, not these terms, govern partner data and fees.
    </p>

    <h2>Liability</h2>
    <p>
      To the extent the law allows, we are not liable for losses that come from relying on the index, the API or Ask the
      Index. Nothing in these terms limits any liability that cannot be limited by law.
    </p>

    <h2>Changes</h2>
    <p>
      We may update these terms when the product changes. The date at the top shows the latest version. How we handle
      personal information is set out in the <Link to="/privacy">privacy policy</Link>.
    </p>

    <h2>Contact</h2>
    <p>
      Questions about these terms: <a href={`mailto:${LEGAL_CONTACT}`}>{LEGAL_CONTACT}</a>.
    </p>
  </LegalPage>
);

export default Terms;
