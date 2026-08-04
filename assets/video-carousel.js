/* ==========================================================================
   video-carousel.js
   Behaviour for sections/video-carousel.liquid
   Vanilla JS, no dependencies.
   ========================================================================== */

(function () {
  'use strict';

  function $(sel, ctx) {
    return (ctx || document).querySelector(sel);
  }

  function $$(sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  }

  /** Every carousel on the page, so only one video plays at a time overall. */
  var instances = [];

  function pauseAllExcept(video) {
    instances.forEach(function (instance) {
      instance.cards.forEach(function (card) {
        if (card.video && card.video !== video && !card.video.paused) {
          card.video.pause();
        }
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * Carousel
   * ------------------------------------------------------------------ */

  function VideoCarousel(root) {
    this.root = root;
    this.track = $('[data-vcar-track]', root);
    if (!this.track) return;

    this.prev = $('[data-vcar-prev]', root);
    this.next = $('[data-vcar-next]', root);
    this.autoplay = root.getAttribute('data-vcar-autoplay') === 'true';

    this.cards = $$('[data-vcar-card]', this.track).map(this.setupCard, this);

    this.bindNav();
    this.observeSize();
    this.observeVisibility();

    instances.push(this);
  }

  /* ---- Card wiring ---- */

  VideoCarousel.prototype.setupCard = function (el) {
    var card = {
      el: el,
      video: $('[data-vcar-video]', el),
      playBtn: $('[data-vcar-play]', el),
      soundBtn: $('[data-vcar-sound]', el)
    };

    if (!card.video) return card;

    var self = this;

    // Keep the class and the button label in sync with the real media state,
    // whichever way playback was started or stopped.
    card.video.addEventListener('play', function () {
      el.classList.add('is-playing');
      if (card.playBtn) {
        card.playBtn.setAttribute('aria-label', card.playBtn.getAttribute('data-label-pause'));
      }
      pauseAllExcept(card.video);
    });

    card.video.addEventListener('pause', function () {
      el.classList.remove('is-playing');
      if (card.playBtn) {
        card.playBtn.setAttribute('aria-label', card.playBtn.getAttribute('data-label-play'));
      }
    });

    if (card.playBtn) {
      card.playBtn.addEventListener('click', function () {
        self.toggle(card);
      });
    }

    if (card.soundBtn) {
      card.soundBtn.addEventListener('click', function (event) {
        event.stopPropagation();
        self.toggleSound(card);
      });
    }

    return card;
  };

  VideoCarousel.prototype.toggle = function (card) {
    if (!card.video) return;

    if (card.video.paused) {
      var attempt = card.video.play();
      // Autoplay policies reject muted playback only rarely, but a rejected
      // promise must not surface as an unhandled error.
      if (attempt && typeof attempt.catch === 'function') {
        attempt.catch(function () {
          card.el.classList.remove('is-playing');
        });
      }
    } else {
      card.video.pause();
    }
  };

  VideoCarousel.prototype.toggleSound = function (card) {
    if (!card.video || !card.soundBtn) return;

    var muted = !card.video.muted;
    card.video.muted = muted;
    card.soundBtn.setAttribute('data-muted', muted ? 'true' : 'false');
    card.soundBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
    card.soundBtn.setAttribute(
      'aria-label',
      card.soundBtn.getAttribute(muted ? 'data-label-unmute' : 'data-label-mute')
    );

    // Turning sound on implies the viewer wants to watch this one.
    if (!muted && card.video.paused) this.toggle(card);
  };

  /* ---- Arrows ---- */

  VideoCarousel.prototype.step = function () {
    var first = this.cards[0] && this.cards[0].el;
    if (!first) return 300;
    var gap = parseFloat(getComputedStyle(this.track).columnGap) || 0;
    return first.getBoundingClientRect().width + gap;
  };

  VideoCarousel.prototype.bindNav = function () {
    var self = this;

    if (this.prev) {
      this.prev.addEventListener('click', function () {
        self.track.scrollBy({ left: -self.step(), behavior: 'smooth' });
      });
    }

    if (this.next) {
      this.next.addEventListener('click', function () {
        self.track.scrollBy({ left: self.step(), behavior: 'smooth' });
      });
    }

    this.track.addEventListener('scroll', function () {
      self.updateNav();
    });
  };

  VideoCarousel.prototype.updateNav = function () {
    var scrollable = this.track.scrollWidth - this.track.clientWidth > 2;
    this.track.classList.toggle('is-scrollable', scrollable);

    // A non-scrolling track keeps its cards centred and needs no arrows.
    [this.prev, this.next].forEach(function (button) {
      if (button) button.hidden = !scrollable;
    });
    if (!scrollable) return;

    var left = this.track.scrollLeft;
    var max = this.track.scrollWidth - this.track.clientWidth;
    if (this.prev) this.prev.disabled = left <= 2;
    if (this.next) this.next.disabled = left >= max - 2;
  };

  VideoCarousel.prototype.observeSize = function () {
    var self = this;
    this.updateNav();

    if (typeof ResizeObserver === 'function') {
      new ResizeObserver(function () {
        self.updateNav();
      }).observe(this.track);
    } else {
      window.addEventListener('resize', function () {
        self.updateNav();
      });
    }
  };

  /* ---- Pause offscreen, optionally autoplay in view ---- */

  VideoCarousel.prototype.observeVisibility = function () {
    var self = this;
    if (typeof IntersectionObserver !== 'function') return;

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          var card = self.cards.filter(function (c) {
            return c.el === entry.target;
          })[0];
          if (!card || !card.video) return;

          if (entry.isIntersecting) {
            if (self.autoplay && card.video.paused) self.toggle(card);
          } else if (!card.video.paused) {
            card.video.pause();
          }
        });
      },
      { threshold: 0.5 }
    );

    this.cards.forEach(function (card) {
      if (card.video) observer.observe(card.el);
    });
  };

  /* ------------------------------------------------------------------ *
   * Boot
   * ------------------------------------------------------------------ */

  function init() {
    $$('[data-vcar-root]').forEach(function (root) {
      if (root.dataset.vcarReady === 'true') return;
      root.dataset.vcarReady = 'true';
      new VideoCarousel(root);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* Theme editor hooks */
  document.addEventListener('shopify:section:load', function (event) {
    instances = instances.filter(function (instance) {
      return !event.target.contains(instance.root);
    });
    init();
  });

  // Bring the card a merchant just selected into view.
  document.addEventListener('shopify:block:select', function (event) {
    var card = event.target.closest ? event.target.closest('[data-vcar-card]') : null;
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  });
})();
