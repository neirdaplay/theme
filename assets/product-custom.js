/* ==========================================================================
   product-custom.js
   Behaviour for sections/main-product-custom.liquid
   Vanilla JS, no dependencies, no network calls except /cart/add.js
   ========================================================================== */

(function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   * Helpers
   * ------------------------------------------------------------------ */

  var REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $(sel, ctx) {
    return (ctx || document).querySelector(sel);
  }

  function $$(sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  }

  /**
   * Add a line to the cart.
   * @param {number|string} variantId
   * @param {number|string} [sellingPlanId]
   * @returns {Promise<object>} the /cart/add.js payload
   */
  function addToCart(variantId, sellingPlanId, cartAddUrl) {
    var item = { id: variantId, quantity: 1 };
    if (sellingPlanId) item.selling_plan = sellingPlanId;

    return fetch(cartAddUrl || '/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ items: [item] })
    }).then(function (res) {
      if (!res.ok) {
        return res
          .json()
          .catch(function () {
            return {};
          })
          .then(function (err) {
            throw new Error(err.description || err.message || 'Erreur panier');
          });
      }
      return res.json();
    });
  }

  /* ------------------------------------------------------------------ *
   * Collapse — animated height, used by the FAQ
   * ------------------------------------------------------------------ */

  function openCollapse(panel) {
    panel.hidden = false;

    if (REDUCED_MOTION) {
      panel.style.height = 'auto';
      return;
    }

    var target = panel.scrollHeight;
    panel.style.height = '0px';
    void panel.offsetHeight; // force reflow so the transition runs
    panel.style.height = target + 'px';

    panel.addEventListener('transitionend', function onEnd(event) {
      if (event.propertyName !== 'height' || event.target !== panel) return;
      panel.style.height = 'auto';
      panel.removeEventListener('transitionend', onEnd);
    });
  }

  function closeCollapse(panel) {
    if (REDUCED_MOTION) {
      panel.style.height = '';
      panel.hidden = true;
      return;
    }

    panel.style.height = panel.scrollHeight + 'px';
    void panel.offsetHeight;
    panel.style.height = '0px';

    panel.addEventListener('transitionend', function onEnd(event) {
      if (event.propertyName !== 'height' || event.target !== panel) return;
      panel.hidden = true;
      panel.removeEventListener('transitionend', onEnd);
    });
  }

  function toggleCollapse(trigger) {
    var panel = document.getElementById(trigger.getAttribute('aria-controls'));
    if (!panel) return;

    var isOpen = trigger.getAttribute('aria-expanded') === 'true';
    trigger.setAttribute('aria-expanded', isOpen ? 'false' : 'true');

    if (isOpen) closeCollapse(panel);
    else openCollapse(panel);
  }

  /* ------------------------------------------------------------------ *
   * Section controller
   * ------------------------------------------------------------------ */

  function PdpSection(root) {
    this.root = root;
    this.config = this.readConfig();
    if (!this.config) return;

    this.initCollapses();
    this.initGallery();
    this.initReviewPopover();
    this.initImpactDialog();
    this.initAddToCart();
  }

  PdpSection.prototype.readConfig = function () {
    var node = $('[data-pdp-config]', this.root);
    if (!node) return null;
    try {
      return JSON.parse(node.textContent);
    } catch (error) {
      console.warn('[pdp] invalid config JSON', error);
      return null;
    }
  };

  /* ---- Collapses ---- */

  PdpSection.prototype.initCollapses = function () {
    $$('[data-pdp-collapse-trigger]', this.root).forEach(function (trigger) {
      trigger.addEventListener('click', function () {
        toggleCollapse(trigger);
      });
    });
  };

  /* ---- Gallery ---- */

  PdpSection.prototype.initGallery = function () {
    var root = this.root;
    var thumbs = $$('[data-pdp-thumb]', root);
    if (!thumbs.length) return;

    var slides = $$('[data-pdp-slide]', root);

    function select(index) {
      slides.forEach(function (slide) {
        slide.hidden = slide.getAttribute('data-pdp-slide') !== String(index);
      });
      thumbs.forEach(function (thumb) {
        var active = thumb.getAttribute('data-pdp-thumb') === String(index);
        thumb.setAttribute('aria-selected', active ? 'true' : 'false');
        thumb.tabIndex = active ? 0 : -1;
      });
    }

    thumbs.forEach(function (thumb) {
      thumb.addEventListener('click', function () {
        select(thumb.getAttribute('data-pdp-thumb'));
      });
    });

    var list = thumbs[0].parentNode;
    list.addEventListener('keydown', function (event) {
      var index = thumbs.indexOf(document.activeElement);
      if (index === -1) return;

      var nextIndex = null;
      if (event.key === 'ArrowRight') nextIndex = (index + 1) % thumbs.length;
      else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + thumbs.length) % thumbs.length;
      else return;

      event.preventDefault();
      thumbs[nextIndex].focus();
      select(thumbs[nextIndex].getAttribute('data-pdp-thumb'));
    });
  };

  /* ------------------------------------------------------------------ *
   * Review popover — summary, histogram and a one-at-a-time carousel
   * ------------------------------------------------------------------ */

  PdpSection.prototype.initReviewPopover = function () {
    var root = this.root;
    var toggle = $('[data-pdp-reviews-toggle]', root);
    var pop = $('[data-pdp-revpop]', root);
    if (!toggle || !pop) return;

    function open() {
      pop.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
      window.requestAnimationFrame(function () {
        pop.classList.add('is-open');
      });
    }

    function close(returnFocus) {
      if (pop.hidden) return;
      pop.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');

      var done = false;
      var finish = function () {
        if (done) return;
        done = true;
        pop.hidden = true;
        if (returnFocus) toggle.focus();
      };
      pop.addEventListener('transitionend', function once(event) {
        if (event.target !== pop) return;
        pop.removeEventListener('transitionend', once);
        finish();
      });
      window.setTimeout(finish, 300);
    }

    toggle.addEventListener('click', function (event) {
      event.stopPropagation();
      if (pop.hidden) open();
      else close(false);
    });

    $$('[data-pdp-reviews-close]', pop).forEach(function (btn) {
      btn.addEventListener('click', function () {
        close(true);
      });
    });

    /* A click anywhere else, or Escape, dismisses it. */
    document.addEventListener('click', function (event) {
      if (pop.hidden) return;
      if (pop.contains(event.target) || toggle.contains(event.target)) return;
      close(false);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') close(true);
    });

    /* ---- Carousel ---- */

    var reviews = $$('[data-pdp-review]', pop);
    if (reviews.length < 2) return;

    var dots = $$('[data-pdp-review-dot]', pop);
    var index = 0;

    function show(next) {
      index = (next + reviews.length) % reviews.length;
      reviews.forEach(function (review, i) {
        review.hidden = i !== index;
      });
      dots.forEach(function (dot, i) {
        if (i === index) dot.setAttribute('aria-current', 'true');
        else dot.removeAttribute('aria-current');
      });
    }

    var prev = $('[data-pdp-review-prev]', pop);
    var next = $('[data-pdp-review-next]', pop);
    if (prev) {
      prev.addEventListener('click', function () {
        show(index - 1);
      });
    }
    if (next) {
      next.addEventListener('click', function () {
        show(index + 1);
      });
    }

    dots.forEach(function (dot, i) {
      dot.addEventListener('click', function () {
        show(i);
      });
    });
  };

  /* ------------------------------------------------------------------ *
   * Impact dialog
   * ------------------------------------------------------------------ */

  PdpSection.prototype.initImpactDialog = function () {
    var root = this.root;
    var trigger = $('[data-pdp-open-impact]', root);
    var modal = $('[data-pdp-impact]', root);
    if (!trigger || !modal) return;

    var dialog = $('[data-pdp-impact-dialog]', modal);
    var closeBtn = $('.pdp-modal__close', modal);
    var FOCUSABLE =
      'button:not([tabindex="-1"]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

    function lockScroll(locked) {
      document.documentElement.style.overflow = locked ? 'hidden' : '';
      document.body.style.overflow = locked ? 'hidden' : '';
    }

    function open() {
      modal.hidden = false;
      lockScroll(true);
      window.requestAnimationFrame(function () {
        modal.classList.add('is-open');
      });
      if (closeBtn) closeBtn.focus();
    }

    function close() {
      modal.classList.remove('is-open');
      lockScroll(false);

      var done = false;
      var finish = function () {
        if (done) return;
        done = true;
        modal.hidden = true;
        trigger.focus();
      };
      modal.addEventListener('transitionend', function once(event) {
        if (event.target !== modal) return;
        modal.removeEventListener('transitionend', once);
        finish();
      });
      window.setTimeout(finish, 320);
    }

    trigger.addEventListener('click', open);

    $$('[data-pdp-impact-close]', modal).forEach(function (el) {
      el.addEventListener('click', close);
    });

    document.addEventListener('keydown', function (event) {
      if (modal.hidden) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }

      /* Keep Tab inside the dialog while it owns the screen. */
      if (event.key === 'Tab' && dialog) {
        var items = $$(FOCUSABLE, dialog).filter(function (el) {
          return el.offsetParent !== null;
        });
        if (!items.length) return;

        var first = items[0];
        var last = items[items.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });
  };

  /* ------------------------------------------------------------------ *
   * Add to cart
   * ------------------------------------------------------------------ */

  PdpSection.prototype.showError = function (message) {
    var box = $('[data-pdp-error]', this.root);
    if (!box) return;
    box.textContent = message;
    box.hidden = false;
  };

  PdpSection.prototype.clearError = function () {
    var box = $('[data-pdp-error]', this.root);
    if (box) box.hidden = true;
  };

  PdpSection.prototype.initAddToCart = function () {
    var self = this;

    $$('[data-pdp-add]', this.root).forEach(function (button) {
      button.addEventListener('click', function () {
        self.handleAdd(button);
      });
    });
  };

  PdpSection.prototype.handleAdd = function (button) {
    var self = this;
    if (button.classList.contains('is-loading')) return;
    if (button.getAttribute('aria-disabled') === 'true') return;

    if (!this.config.variantId) {
      this.showError(this.config.strings.soldOut);
      return;
    }

    this.clearError();
    button.classList.add('is-loading');

    addToCart(this.config.variantId, null, this.config.cartAddUrl)
      .then(function (payload) {
        document.dispatchEvent(
          new CustomEvent('pdp:cart-added', { bubbles: true, detail: payload })
        );
        self.afterAdd();
      })
      .catch(function (error) {
        button.classList.remove('is-loading');
        self.showError(error.message || self.config.strings.genericError);
      });
  };

  PdpSection.prototype.afterAdd = function () {
    var action = this.config.afterAdd;

    if (action === 'cart') {
      window.location.href = this.config.cartUrl;
      return;
    }

    if (action === 'drawer') {
      var drawer = document.querySelector('cart-drawer, [data-cart-drawer]');
      if (drawer && typeof drawer.open === 'function') {
        drawer.open();
        $$('[data-pdp-add].is-loading', this.root).forEach(function (button) {
          button.classList.remove('is-loading');
        });
        return;
      }
      // No drawer in this theme — fall back to the cart page.
      window.location.href = this.config.cartUrl;
      return;
    }

    window.location.href = this.config.checkoutUrl;
  };

  /* ------------------------------------------------------------------ *
   * Boot
   * ------------------------------------------------------------------ */

  function init() {
    $$('[data-pdp-root]').forEach(function (root) {
      if (root.dataset.pdpReady === 'true') return;
      root.dataset.pdpReady = 'true';
      new PdpSection(root);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-initialise when the theme editor re-renders the section.
  document.addEventListener('shopify:section:load', init);
})();
