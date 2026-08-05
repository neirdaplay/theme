/* ==========================================================================
   guarantee.js
   Behaviour for sections/guarantee.liquid
   Sole job: make the CTA scroll smoothly to the product area, clearing a
   sticky header and leaving keyboard focus on the target.
   ========================================================================== */

(function () {
  'use strict';

  /**
   * Tried in order when the configured anchor is not on the page — which is
   * the normal case on a theme that does not use main-product-custom.liquid.
   * Ordered from "this theme's own product section" to generic markers that
   * exist on virtually every product template.
   */
  var FALLBACK_SELECTORS = [
    '#main-product',
    '[data-pdp-root]',
    'product-info',
    '[id^="MainProduct-"]',
    '[id^="ProductInfo-"]',
    '.product__info-wrapper',
    '.product__info-container',
    'form[action*="/cart/add"]',
    'main .product',
    '.shopify-section--main-product'
  ];

  function $$(sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  }

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function query(selector) {
    try {
      return document.querySelector(selector);
    } catch (error) {
      // A merchant-typed anchor can be an invalid selector; ignore it.
      return null;
    }
  }

  /**
   * @returns {{el: Element, exact: boolean}|null}
   */
  function resolveTarget(root, hash) {
    if (hash && hash.length > 1) {
      var exact = query(hash);
      if (exact && !root.contains(exact)) return { el: exact, exact: true };
    }

    for (var i = 0; i < FALLBACK_SELECTORS.length; i++) {
      var el = query(FALLBACK_SELECTORS[i]);
      // Never scroll to something inside this very section.
      if (el && !root.contains(el)) return { el: el, exact: false };
    }

    return null;
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
        var found = resolveTarget(root, hash);

        if (!found) {
          // Say why nothing happened instead of failing silently.
          console.warn(
            '[guarantee] Aucune cible trouvée pour « ' +
              hash +
              ' ». Vérifie que l’élément existe sur la page, ou change l’ancre ' +
              'dans les réglages de la section. Sélecteurs de repli essayés : ' +
              FALLBACK_SELECTORS.join(', ')
          );
          event.preventDefault();
          return;
        }

        event.preventDefault();
        scrollToTarget(found.el, offset);

        // Only advertise the anchor in the URL when it is the one that was
        // actually used; a fallback target may have no id at all.
        if (found.exact && window.history && window.history.replaceState) {
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
