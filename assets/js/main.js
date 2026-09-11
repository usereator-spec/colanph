/* ============================================================
   ColanPh — main.js
   Navigazione | lingua | temi | Home wall | Works hover |
   gallerie progetto | lightbox | fade-in
   ============================================================ */

(() => {
  'use strict';

  const VALID_THEMES = ['white', 'dark', 'retro'];
  const VALID_LANGUAGES = ['it', 'en'];

  function readPreference(key, fallback, validValues) {
    try {
      const value = window.localStorage.getItem(key);
      return validValues.includes(value) ? value : fallback;
    } catch (_) {
      return fallback;
    }
  }

  // Applica le preferenze il prima possibile; il tema di default resta Bianco.
  document.documentElement.dataset.theme = readPreference('colanph-theme', 'white', VALID_THEMES);
  document.documentElement.lang = readPreference('colanph-language', 'it', VALID_LANGUAGES);
})();

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  const THEMES = ['white', 'dark', 'retro'];
  const LANGUAGES = ['it', 'en'];

  const safeStorage = {
    get(key, fallback) {
      try { return window.localStorage.getItem(key) || fallback; }
      catch (_) { return fallback; }
    },
    set(key, value) {
      try { window.localStorage.setItem(key, value); }
      catch (_) { /* localStorage può essere disabilitato */ }
    }
  };

  let currentLanguage = LANGUAGES.includes(document.documentElement.lang)
    ? document.documentElement.lang
    : 'it';
  let currentTheme = THEMES.includes(document.documentElement.dataset.theme)
    ? document.documentElement.dataset.theme
    : 'white';

  const translations = window.ColanPhTranslations || {};

  function getTranslation(language, key) {
    return key.split('.').reduce((value, segment) => value?.[segment], translations[language]);
  }

  function refreshControlLabels() {
    const languageToggle = document.getElementById('language-toggle');
    const languageLabel = document.getElementById('language-toggle-label');
    const themeToggle = document.getElementById('theme-toggle');
    const themeLabel = document.getElementById('theme-toggle-label');

    if (languageLabel) languageLabel.textContent = currentLanguage === 'it' ? 'EN' : 'IT';
    if (languageToggle) {
      const label = getTranslation(currentLanguage, 'controls.language');
      if (label) languageToggle.setAttribute('aria-label', label);
    }

    const localizedTheme = getTranslation(currentLanguage, `themes.${currentTheme}`) || currentTheme;
    if (themeLabel) themeLabel.textContent = localizedTheme;
    if (themeToggle) {
      const template = getTranslation(currentLanguage, 'controls.theme') || 'Change theme. Current theme: {theme}';
      themeToggle.setAttribute('aria-label', template.replace('{theme}', localizedTheme));
    }
  }

  function applyTranslations(language, persist = true) {
    if (!LANGUAGES.includes(language) || !translations[language]) return;
    currentLanguage = language;
    document.documentElement.lang = language;

    document.querySelectorAll('[data-i18n]').forEach(element => {
      const value = getTranslation(language, element.dataset.i18n);
      if (typeof value === 'string') element.textContent = value;
    });

    document.querySelectorAll('[data-i18n-html]').forEach(element => {
      const value = getTranslation(language, element.dataset.i18nHtml);
      if (typeof value === 'string') element.innerHTML = value;
    });

    document.querySelectorAll('[data-i18n-aria-label]').forEach(element => {
      const value = getTranslation(language, element.dataset.i18nAriaLabel);
      if (typeof value === 'string') element.setAttribute('aria-label', value);
    });

    document.querySelectorAll('[data-i18n-alt]').forEach(element => {
      const value = getTranslation(language, element.dataset.i18nAlt);
      if (typeof value === 'string') element.setAttribute('alt', value);
    });

    if (persist) safeStorage.set('colanph-language', language);
    refreshControlLabels();
  }

  function applyTheme(theme, persist = true) {
    if (!THEMES.includes(theme)) return;
    currentTheme = theme;
    document.documentElement.dataset.theme = theme;
    if (persist) safeStorage.set('colanph-theme', theme);
    refreshControlLabels();
  }

  // Ripristina le preferenze persistenti e aggiorna subito la UI.
  const storedLanguage = safeStorage.get('colanph-language', currentLanguage);
  const storedTheme = safeStorage.get('colanph-theme', currentTheme);
  applyTheme(THEMES.includes(storedTheme) ? storedTheme : 'white', false);
  applyTranslations(LANGUAGES.includes(storedLanguage) ? storedLanguage : 'it', false);

  const languageToggle = document.getElementById('language-toggle');
  if (languageToggle) {
    languageToggle.addEventListener('click', () => {
      applyTranslations(currentLanguage === 'it' ? 'en' : 'it');
    });
  }

  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const index = THEMES.indexOf(currentTheme);
      applyTheme(THEMES[(index + 1) % THEMES.length]);
    });
  }

  /* --------------------------------------------------------
     NAVBAR
  -------------------------------------------------------- */
  const nav = document.getElementById('nav');
  if (nav) {
    const syncNavState = () => nav.classList.toggle('scrolled', window.scrollY > 60);
    window.addEventListener('scroll', syncNavState, { passive: true });
    syncNavState();
  }

  const hamburger = document.getElementById('nav-hamburger');
  const navLinks = document.getElementById('nav-links');

  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('open');
      hamburger.classList.toggle('open', isOpen);
      hamburger.setAttribute('aria-expanded', String(isOpen));
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('open');
        hamburger.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
    });
  }

  /* --------------------------------------------------------
     HOME — wall manuale
     Desktop: scroll orizzontale | Mobile: scroll verticale
     Nessun autoplay. Su desktop la rotellina verticale muove la galleria
     in orizzontale; sono supportati anche trackpad e trascinamento.
  -------------------------------------------------------- */
  const homeWall = document.getElementById('home-wall');
  const homeTrack = document.getElementById('home-wall-track');
  const homeData = document.getElementById('home-wall-images');

  if (homeWall && homeTrack && homeData && window.ColanPhCloudinary) {
    let images = [];
    try {
      images = JSON.parse(homeData.textContent) || [];
    } catch (_) {
      images = [];
    }

    if (images.length) {
      const sequence = document.createElement('div');
      sequence.className = 'home-wall-sequence';

      images.forEach((item, index) => {
        const frame = document.createElement('div');
        frame.className = 'home-wall-item';

        const img = document.createElement('img');
        img.src = window.ColanPhCloudinary.url(item.id);
        img.width = Number(item.width) || 1;
        img.height = Number(item.height) || 1;
        img.alt = '';
        img.decoding = 'async';
        img.loading = index < 6 ? 'eager' : 'lazy';
        img.draggable = false;

        frame.appendChild(img);
        sequence.appendChild(frame);
      });

      homeTrack.replaceChildren(sequence);

      const mobileQuery = window.matchMedia('(max-width: 768px)');

      // Desktop: la rotellina verticale controlla lo scroll orizzontale.
      homeWall.addEventListener('wheel', event => {
        if (mobileQuery.matches) return;
        const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX)
          ? event.deltaY
          : event.deltaX;
        if (delta === 0) return;
        event.preventDefault();
        homeWall.scrollLeft += delta;
      }, { passive: false });

      // Desktop: trascinamento con mouse/puntatore, senza interferire col mobile.
      let dragging = false;
      let dragStartX = 0;
      let dragStartScrollLeft = 0;

      homeWall.addEventListener('pointerdown', event => {
        if (mobileQuery.matches || event.pointerType === 'touch') return;
        dragging = true;
        dragStartX = event.clientX;
        dragStartScrollLeft = homeWall.scrollLeft;
        homeWall.classList.add('is-dragging');
        homeWall.setPointerCapture?.(event.pointerId);
      });

      homeWall.addEventListener('pointermove', event => {
        if (!dragging) return;
        homeWall.scrollLeft = dragStartScrollLeft - (event.clientX - dragStartX);
      });

      const stopDragging = event => {
        if (!dragging) return;
        dragging = false;
        homeWall.classList.remove('is-dragging');
        if (event?.pointerId != null && homeWall.hasPointerCapture?.(event.pointerId)) {
          homeWall.releasePointerCapture(event.pointerId);
        }
      };

      homeWall.addEventListener('pointerup', stopDragging);
      homeWall.addEventListener('pointercancel', stopDragging);
      homeWall.addEventListener('pointerleave', event => {
        if (dragging && event.buttons === 0) stopDragging(event);
      });

      // Al cambio desktop/mobile si riparte dall'inizio nel nuovo asse.
      const resetHomeScroll = () => {
        homeWall.scrollLeft = 0;
        homeWall.scrollTop = 0;
      };
      if (typeof mobileQuery.addEventListener === 'function') {
        mobileQuery.addEventListener('change', resetHomeScroll);
      }
    }
  }

  /* --------------------------------------------------------
     FADE-IN
  -------------------------------------------------------- */
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('visible');
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.fade-in').forEach(element => observer.observe(element));
  } else {
    document.querySelectorAll('.fade-in').forEach(element => element.classList.add('visible'));
  }

  /* --------------------------------------------------------
     LIGHTBOX — pagine categoria
  -------------------------------------------------------- */
  const lightbox = document.getElementById('lightbox');
  const lbImg = document.getElementById('lb-img');
  const lbCount = document.getElementById('lb-count');

  if (lightbox && lbImg && lbCount) {
    let currentGallery = null;
    let currentIndex = 0;

    const getGalleryImages = galleryKey => [
      ...document.querySelectorAll(`.img-wrap[data-gallery="${galleryKey}"] img`)
    ];

    const updateLightbox = () => {
      const imgs = getGalleryImages(currentGallery);
      if (!imgs.length) return;
      lbImg.src = imgs[currentIndex].src;
      lbCount.textContent = `${currentIndex + 1} / ${imgs.length}`;
    };

    const openLightbox = (galleryKey, index) => {
      currentGallery = galleryKey;
      currentIndex = index;
      updateLightbox();
      lightbox.classList.add('open');
      document.body.style.overflow = 'hidden';
    };

    const closeLightbox = () => {
      lightbox.classList.remove('open');
      document.body.style.overflow = '';
    };

    const navigateLightbox = direction => {
      const imgs = getGalleryImages(currentGallery);
      if (!imgs.length) return;
      currentIndex = (currentIndex + direction + imgs.length) % imgs.length;
      updateLightbox();
    };

    document.addEventListener('click', event => {
      const wrap = event.target.closest('.img-wrap[data-gallery]');
      if (!wrap) return;
      const gallery = wrap.dataset.gallery;
      const allWraps = [...document.querySelectorAll(`.img-wrap[data-gallery="${gallery}"]`)];
      openLightbox(gallery, allWraps.indexOf(wrap));
    });

    lightbox.addEventListener('click', event => {
      if (event.target === lightbox) closeLightbox();
    });

    document.getElementById('lb-close')?.addEventListener('click', closeLightbox);
    document.getElementById('lb-prev')?.addEventListener('click', () => navigateLightbox(-1));
    document.getElementById('lb-next')?.addEventListener('click', () => navigateLightbox(1));

    document.addEventListener('keydown', event => {
      if (!lightbox.classList.contains('open')) return;
      if (event.key === 'Escape') closeLightbox();
      if (event.key === 'ArrowRight') navigateLightbox(1);
      if (event.key === 'ArrowLeft') navigateLightbox(-1);
    });
  }

  /* --------------------------------------------------------
     WORKS — nero di default; rotazione per categoria solo hover/focus
     Frequenza: 4 s | fade | sorgente: categoria indicata
  -------------------------------------------------------- */
  const worksBackground = document.getElementById('works-background');
  const worksBgData = document.getElementById('works-bg-images');
  const workCategories = [...document.querySelectorAll('.works-category[data-work-category]')];

  if (worksBackground && worksBgData && workCategories.length) {
    const layers = [...worksBackground.querySelectorAll('.works-background-layer')];
    let categoryMap = {};
    let rotationTimer = null;
    let sessionToken = 0;
    let activeLayer = 0;
    let currentIndex = 0;

    try {
      categoryMap = JSON.parse(worksBgData.textContent) || {};
    } catch (_) {
      categoryMap = {};
    }

    const toUrl = publicId => window.ColanPhCloudinary
      ? window.ColanPhCloudinary.url(publicId)
      : publicId;

    const clearTimer = () => {
      if (rotationTimer) {
        window.clearInterval(rotationTimer);
        rotationTimer = null;
      }
    };

    const setLayerImage = (layerIndex, src) => {
      layers[layerIndex].style.backgroundImage = `url("${src.replace(/"/g, '\\"')}")`;
    };

    const fadeToBlack = () => {
      sessionToken += 1;
      clearTimer();
      layers.forEach(layer => layer.classList.remove('is-visible'));
    };

    const showImage = (src, token) => {
      const nextLayer = layers[activeLayer].classList.contains('is-visible')
        ? (activeLayer === 0 ? 1 : 0)
        : activeLayer;
      const preloader = new Image();

      preloader.onload = () => {
        if (token !== sessionToken) return;
        setLayerImage(nextLayer, src);
        layers[nextLayer].classList.add('is-visible');
        layers[nextLayer === 0 ? 1 : 0]?.classList.remove('is-visible');
        activeLayer = nextLayer;
      };
      preloader.src = src;
    };

    const startCategory = categoryKey => {
      const ids = Array.isArray(categoryMap[categoryKey]) ? categoryMap[categoryKey] : [];
      const imagesForCategory = ids.filter(Boolean).map(toUrl);
      sessionToken += 1;
      const token = sessionToken;
      clearTimer();
      currentIndex = 0;

      if (!imagesForCategory.length || layers.length < 2) {
        layers.forEach(layer => layer.classList.remove('is-visible'));
        return;
      }

      showImage(imagesForCategory[currentIndex], token);
      if (imagesForCategory.length > 1) {
        rotationTimer = window.setInterval(() => {
          if (token !== sessionToken) return;
          currentIndex = (currentIndex + 1) % imagesForCategory.length;
          showImage(imagesForCategory[currentIndex], token);
        }, 4000);
      }
    };

    workCategories.forEach(link => {
      const key = link.dataset.workCategory;
      link.addEventListener('mouseenter', () => startCategory(key));
      link.addEventListener('mouseleave', fadeToBlack);
      link.addEventListener('focus', () => startCategory(key));
      link.addEventListener('blur', fadeToBlack);
    });
  }

  /* --------------------------------------------------------
     GALLERIE PROGETTO — rotella verticale convertita in orizzontale
     solo finché la galleria ha ancora spazio nella direzione richiesta.
  -------------------------------------------------------- */
  document.querySelectorAll('.project-horizontal-gallery').forEach(gallery => {
    gallery.addEventListener('wheel', event => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      const maxScroll = gallery.scrollWidth - gallery.clientWidth;
      if (maxScroll <= 0) return;

      const movingRight = event.deltaY > 0;
      const atStart = gallery.scrollLeft <= 0;
      const atEnd = gallery.scrollLeft >= maxScroll - 1;
      if ((movingRight && atEnd) || (!movingRight && atStart)) return;

      event.preventDefault();
      gallery.scrollLeft += event.deltaY;
    }, { passive: false });
  });
});
