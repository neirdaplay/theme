/* ==========================================================================
   guarantee.js
   Behaviour for sections/guarantee.liquid
   Sole job: make the CTA scroll smoothly to its anchor, clearing a sticky
   header and leaving keyboard focus on the target.
   ========================================================================== */

(function () {
  'use strict';

  function $$(sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  }

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function scrollToTarget(target, offset) {
    var top = target.getBoundingClientRect().top + window.pageYOffset - offset;

    window.scrollTo({
      top: top < 0 ? 0 : top,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth'
    });

    // Keyboard and screen-reader users must land on the target too, not just
    // see it. tabindex="-1" makes a non-interactive element focusable.
    if (!target.hasAttribute('tabindex')) {
      target.setAttribute('tabindex', '-1');
    }
    target.focus({ preventScroll: true });
  }

  function bind(root) {
    var offset = parseInt(root.getAttribute('data-scroll-offset'), 10);
    if (isNaN(offset)) offset = 0;

    $$('[data-guarantee-anchor]', root).forEach(function (link) {
      link.addEventListener('click', function (event) {
        var hash = link.getAttribute('href') || '';
        if (hash.charAt(0) !== '#' || hash.length < 2) return;

        var target = document.querySelector(hash);
        // No such anchor on this page: let the browser do whatever it would.
        if (!target) return;

        event.preventDefault();
        scrollToTarget(target, offset);

        // Reflect the destination in the URL without a second jump.
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, '', hash);
        }
      });
    });
  }

  function init() {
    $$('[data-guarantee-root]').forEach(function (root) {
      if (root.dataset.guaranteeReady === 'true') return;
      root.dataset.guaranteeReady = 'true';
      bind(root);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('shopify:section:load', init);
})();
