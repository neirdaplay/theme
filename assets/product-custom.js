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
   * Collapse — animated height, used by the FAQ, the frequency help
   * panel and the contaminant list.
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
   * Roving-tabindex radio group (WAI-ARIA radiogroup keyboard pattern)
   * ------------------------------------------------------------------ */

  function bindRadioKeys(group, radioSelector, onSelect) {
    group.addEventListener('keydown', function (event) {
      var radios = $$(radioSelector, group);
      var index = radios.indexOf(document.activeElement);
      if (index === -1) return;

      var next = null;
      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          next = radios[(index + 1) % radios.length];
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          next = radios[(index - 1 + radios.length) % radios.length];
          break;
        case ' ':
        case 'Enter':
          event.preventDefault();
          onSelect(radios[index]);
          return;
        default:
          return;
      }

      event.preventDefault();
      next.focus();
      onSelect(next);
    });
  }

  /* ------------------------------------------------------------------ *
   * Section controller
   * ------------------------------------------------------------------ */

  function PdpSection(root) {
    this.root = root;
    this.config = this.readConfig();
    if (!this.config) return;

    this.state = {
      mode: 'onetime',
      variantId: this.config.variantId,
      sellingPlanId: null
    };

    this.initCollapses();
    this.initTooltips();
    this.initGallery();
    this.initPlans();
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

  /* ---- Tooltips ---- */

  PdpSection.prototype.initTooltips = function () {
    var open = null;

    function close() {
      if (open) {
        open.setAttribute('aria-expanded', 'false');
        open = null;
      }
    }

    $$('[data-pdp-tooltip]', this.root).forEach(function (trigger) {
      trigger.addEventListener('click', function (event) {
        event.stopPropagation();
        var wasOpen = trigger.getAttribute('aria-expanded') === 'true';
        close();
        if (!wasOpen) {
          trigger.setAttribute('aria-expanded', 'true');
          open = trigger;
        }
      });
    });

    document.addEventListener('click', close);
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') close();
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

  /* ---- Plan selector ---- */

  PdpSection.prototype.initPlans = function () {
    var self = this;
    var group = $('[data-pdp-plan-group]', this.root);
    if (!group) return;

    var radios = $$('[data-pdp-plan-radio]', group);
    var freqGroup = $('[data-pdp-freq-group]', this.root);
    var freqButtons = freqGroup ? $$('[data-pdp-freq]', freqGroup) : [];

    // Seed the selling plan from whichever frequency starts checked.
    var checkedFreq = freqButtons.filter(function (btn) {
      return btn.getAttribute('aria-checked') === 'true';
    })[0];
    if (checkedFreq) {
      self.state.sellingPlanId = checkedFreq.getAttribute('data-selling-plan-id');
    }

    function selectMode(mode) {
      self.state.mode = mode;

      $$('[data-pdp-plan-card]', group).forEach(function (card) {
        card.setAttribute(
          'data-selected',
          card.getAttribute('data-pdp-plan-card') === mode ? 'true' : 'false'
        );
      });

      radios.forEach(function (radio) {
        var active = radio.getAttribute('data-pdp-plan-radio') === mode;
        radio.setAttribute('aria-checked', active ? 'true' : 'false');
        radio.tabIndex = active ? 0 : -1;
      });

      self.syncStickySummary();
    }

    radios.forEach(function (radio) {
      radio.addEventListener('click', function () {
        selectMode(radio.getAttribute('data-pdp-plan-radio'));
      });
    });

    bindRadioKeys(group, '[data-pdp-plan-radio]', function (radio) {
      selectMode(radio.getAttribute('data-pdp-plan-radio'));
    });

    /* Frequency sub-group */
    if (freqGroup) {
      var selectFreq = function (button) {
        freqButtons.forEach(function (btn) {
          var active = btn === button;
          btn.setAttribute('aria-checked', active ? 'true' : 'false');
          btn.tabIndex = active ? 0 : -1;
        });

        self.state.sellingPlanId = button.getAttribute('data-selling-plan-id');
        self.updateSubscriptionPrice();

        // Picking a frequency implies the subscription card.
        selectMode('subscription');
      };

      freqButtons.forEach(function (button) {
        button.addEventListener('click', function () {
          selectFreq(button);
        });
      });

      bindRadioKeys(freqGroup, '[data-pdp-freq]', selectFreq);
    }

    // Apply the server-rendered default so state and DOM agree from the start.
    var preselected = radios.filter(function (radio) {
      return radio.getAttribute('aria-checked') === 'true';
    })[0];
    selectMode(preselected ? preselected.getAttribute('data-pdp-plan-radio') : 'onetime');
    this.updateSubscriptionPrice();
  };

  /**
   * Swap the subscription price for the selected plan. Prices come pre-formatted
   * from Liquid's `money` filter, so no currency logic is reimplemented here.
   */
  PdpSection.prototype.updateSubscriptionPrice = function () {
    var plan = this.config.plans[this.state.sellingPlanId];
    if (!plan) return;

    var amount = $('[data-pdp-sub-amount]', this.root);
    if (amount) amount.textContent = plan.priceFormatted;

    var compare = $('[data-pdp-sub-compare]', this.root);
    if (compare) {
      var showCompare = plan.price < this.config.oneTime.price;
      compare.hidden = !showCompare;
      if (showCompare) compare.textContent = plan.compareAtFormatted;
    }

    this.syncStickySummary();
  };

  /** Overridden once the sticky bar ships; harmless no-op until then. */
  PdpSection.prototype.syncStickySummary = function () {};

  /* ---- Add to cart ---- */

  PdpSection.prototype.currentSelection = function () {
    return {
      variantId: this.config.variantId,
      sellingPlanId: this.state.mode === 'subscription' ? this.state.sellingPlanId : null
    };
  };

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

    var selection = this.currentSelection();
    if (!selection.variantId) {
      this.showError(this.config.strings.soldOut);
      return;
    }

    this.clearError();
    button.classList.add('is-loading');

    addToCart(selection.variantId, selection.sellingPlanId, this.config.cartAddUrl)
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
