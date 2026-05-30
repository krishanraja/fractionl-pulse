/* Fractional Working Index embeddable badge.
 *
 * Usage (one line, no build step):
 *   <script src="https://pulse.fractionl.ai/embed.js" async></script>
 *   <div data-fwi-badge></div>            // or data-fwi-badge="card" for the larger card
 *
 * Renders the live FWI score + band, self-updating, with an attributed link back
 * to pulse.fractionl.ai. The link is rel="nofollow noopener" by design: the value
 * is the live data and the earned citation, not anchor-text. Dependency-free.
 */
(function () {
  var API = 'https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/current';
  var SITE = 'https://pulse.fractionl.ai/?utm_source=fwi-badge&utm_medium=embed';

  var BANDS = [
    { min: 75, label: 'Surging', color: '#10b981' },
    { min: 60, label: 'Growing', color: '#22c55e' },
    { min: 45, label: 'Stable', color: '#eab308' },
    { min: 30, label: 'Cooling', color: '#f97316' },
    { min: 0, label: 'Contracting', color: '#ef4444' },
  ];
  function band(score) { for (var i = 0; i < BANDS.length; i++) { if (score >= BANDS[i].min) return BANDS[i]; } return BANDS[BANDS.length - 1]; }

  function render(el, data) {
    var card = el.getAttribute('data-fwi-badge') === 'card';
    var score = data && data.score ? data.score.overall : null;
    var b = score != null ? band(score) : { label: 'FWI', color: '#64748b' };
    var fontStack = '-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif';
    var a = document.createElement('a');
    a.href = SITE; a.target = '_blank'; a.rel = 'nofollow noopener';
    a.style.cssText = 'display:inline-flex;align-items:center;gap:8px;text-decoration:none;font-family:' + fontStack +
      ';border:1px solid #e2e8f0;border-radius:10px;padding:' + (card ? '12px 16px' : '6px 10px') +
      ';background:#fff;color:#0f172a;line-height:1.2;box-shadow:0 1px 2px rgba(0,0,0,.04)';
    a.innerHTML =
      '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + b.color + '"></span>' +
      '<span style="font-weight:700;font-size:' + (card ? '20px' : '14px') + '">' + (score != null ? score.toFixed(1) : '--') + '</span>' +
      '<span style="color:' + b.color + ';font-weight:600;font-size:' + (card ? '13px' : '12px') + '">' + b.label + '</span>' +
      (card ? '<span style="color:#64748b;font-size:11px;margin-left:4px">Fractional Working Index</span>' : '') +
      '<span style="color:#94a3b8;font-size:10px;margin-left:6px">Pulse by Fractionl</span>';
    el.innerHTML = '';
    el.appendChild(a);
  }

  function init() {
    var nodes = document.querySelectorAll('[data-fwi-badge]');
    if (!nodes.length) return;
    fetch(API).then(function (r) { return r.json(); }).then(function (data) {
      nodes.forEach(function (el) { render(el, data); });
    }).catch(function () {
      nodes.forEach(function (el) { render(el, null); });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
