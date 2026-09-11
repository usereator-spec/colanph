/* ============================================================
   ColanPh — main.js
   Sezioni: Navbar scroll | Hamburger menu | Fade-in observer |
            Orientamento immagini | Lightbox | Layout switcher
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* --------------------------------------------------------
     NAVBAR: classe .scrolled al scroll
  -------------------------------------------------------- */
  const nav = document.getElementById('nav');

  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 60);
  });


  /* --------------------------------------------------------
     HAMBURGER MENU mobile
  -------------------------------------------------------- */
  const hamburger = document.getElementById('nav-hamburger');
  const navLinks  = document.getElementById('nav-links');

  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('open');
      hamburger.classList.toggle('open', isOpen);
      hamburger.setAttribute('aria-expanded', isOpen);
      // Blocca scroll del body quando menu è aperto
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    // Chiude il menu al click su un link
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('open');
        hamburger.classList.remove('open');
        hamburger.setAttribute('aria-expanded', false);
        document.body.style.overflow = '';
      });
    });
  }


  /* --------------------------------------------------------
     FADE-IN: IntersectionObserver per le sezioni
  -------------------------------------------------------- */
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) e.target.classList.add('visible');
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));


  /* --------------------------------------------------------
     LIGHTBOX
     Presente solo nella pagina Works.
  -------------------------------------------------------- */
  const lightbox = document.getElementById('lightbox');
  const lbImg    = document.getElementById('lb-img');
  const lbCount  = document.getElementById('lb-count');

  if (lightbox && lbImg && lbCount) {
    let currentGallery = null;
    let currentIndex   = 0;

    function getGalleryImages(galleryKey) {
      return [...document.querySelectorAll(`.img-wrap[data-gallery="${galleryKey}"] img`)];
    }

    function openLightbox(galleryKey, index) {
      currentGallery = galleryKey;
      currentIndex   = index;
      updateLightbox();
      lightbox.classList.add('open');
      document.body.style.overflow = 'hidden';
    }

    function updateLightbox() {
      const imgs = getGalleryImages(currentGallery);
      if (!imgs.length) return;
      lbImg.src = imgs[currentIndex].src;
      lbCount.textContent = `${currentIndex + 1} / ${imgs.length}`;
    }

    function navigateLightbox(dir) {
      const imgs = getGalleryImages(currentGallery);
      currentIndex = (currentIndex + dir + imgs.length) % imgs.length;
      updateLightbox();
    }

    function closeLightbox() {
      lightbox.classList.remove('open');
      document.body.style.overflow = '';
    }

    document.addEventListener('click', e => {
      const wrap = e.target.closest('.img-wrap[data-gallery]');
      if (wrap) {
        const gallery = wrap.dataset.gallery;
        const allWraps = [...document.querySelectorAll(`.img-wrap[data-gallery="${gallery}"]`)];
        const index = allWraps.indexOf(wrap);
        openLightbox(gallery, index);
      }
    });

    lightbox.addEventListener('click', e => {
      if (e.target === lightbox) closeLightbox();
    });

    const closeBtn = document.getElementById('lb-close');
    const prevBtn  = document.getElementById('lb-prev');
    const nextBtn  = document.getElementById('lb-next');

    if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
    if (prevBtn) prevBtn.addEventListener('click', () => navigateLightbox(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => navigateLightbox(1));

    document.addEventListener('keydown', e => {
      if (!lightbox.classList.contains('open')) return;
      if (e.key === 'Escape')     closeLightbox();
      if (e.key === 'ArrowRight') navigateLightbox(1);
      if (e.key === 'ArrowLeft')  navigateLightbox(-1);
    });
  }


  /* --------------------------------------------------------
     LAYOUT SWITCHER
     Gestisce i tre layout: grid | editorial | column
     Salva la scelta in localStorage.
     Default: grid su desktop, column su mobile.
  -------------------------------------------------------- */
  const LAYOUTS = ['layout-grid', 'layout-editorial', 'layout-column'];
  const btns    = document.querySelectorAll('.layout-btn');

  function isMobile() {
    return window.innerWidth <= 768;
  }

  function applyLayout(layout) {
    // Rimuove tutti i layout dal body
    LAYOUTS.forEach(l => document.body.classList.remove(l));
    document.body.classList.add(layout);

    // Aggiorna stato bottoni
    btns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.layout === layout);
    });

    // Salva preferenza
    localStorage.setItem('colanph-layout', layout);
  }

  function initLayout() {
    // Su mobile forza sempre il layout colonna, ignorando localStorage
    if (isMobile()) {
      applyLayout('layout-column');
      return;
    }
    const saved = localStorage.getItem('colanph-layout');
    if (saved && LAYOUTS.includes(saved)) {
      applyLayout(saved);
    } else {
      applyLayout('layout-grid');
    }
  }

  // Click sui bottoni layout
  btns.forEach(btn => {
    btn.addEventListener('click', () => applyLayout(btn.dataset.layout));
  });

  // Inizializza al caricamento
  initLayout();

}); // fine DOMContentLoaded
