/* ============================================================
   ColanPh — contenuti data-driven
   Home order | Works (sezioni/progetti) | About | work dinamici
   Dati live: Netlify Blobs via /.netlify/functions/site-data
   ============================================================ */
(() => {
  'use strict';

  let siteData = null;
  let worksCleanup = null;
  let primaryThemeApplied = false;

  const DEFAULT_APPEARANCE = Object.freeze({ theme: 'white', backgroundColor: '', titleColor: '', captionColor: '' });
  const DEFAULT_ABOUT = Object.freeze({
    label: { it: 'About', en: 'About' },
    intro: { it: 'Fotografo freelance specializzato in food, eventi, architettura, ritratti, fashion e street photography.', en: 'Freelance photographer specialising in food, events, architecture, portraits, fashion and street photography.' },
    detail: { it: 'Collaboro con ristoranti, chef, agenzie di comunicazione e brand nel settore food & hospitality. Ogni progetto è un racconto visivo costruito con cura, dalla pre-produzione allo scatto finale.', en: 'I collaborate with restaurants, chefs, communication agencies and brands in food and hospitality. Every project is a visual story developed with care, from pre-production to the final shot.' },
    services: {
      it: ['Food Photography', 'Ritratti — Artisti & Attori', 'Fashion', 'Architettura & Interni', 'Street Photography', 'Eventi & Concerti'],
      en: ['Food Photography', 'Portraits — Artists & Actors', 'Fashion', 'Architecture & Interiors', 'Street Photography', 'Events & Concerts']
    },
    contactTitle: { it: 'Iniziamo a', en: "Let's" },
    contactEmphasis: { it: 'lavorare insieme.', en: 'work together.' },
    phone: '+39 347 899 7588',
    phoneHref: 'https://wa.me/393478997588',
    email: 'fabiocolan.ph@gmail.com',
    instagram: '@fabiocolan_ph',
    instagramUrl: 'https://www.instagram.com/fabiocolan_ph/',
    availability: { it: 'Disponibile per nuovi progetti', en: 'Available for new projects' },
    backgroundPublicId: 'colanph/hero/ritratti-fabio-18',
    profilePublicId: 'colanph/profile/profile'
  });

  const currentLanguage = () => document.documentElement.lang === 'en' ? 'en' : 'it';
  const localized = value => {
    if (!value || typeof value !== 'object') return '';
    const lang = currentLanguage();
    return String(value[lang] || value.it || value.en || '');
  };

  const workUrl = item => item.type === 'project'
    ? `/works/progetti/${encodeURIComponent(item.slug)}`
    : `/works/sezioni/${encodeURIComponent(item.slug)}`;

  const allItems = data => [...(data.sections || []), ...(data.projects || [])];

  function appearance(value, fallbackTheme = 'white') {
    const source = value && typeof value === 'object' ? value : {};
    return {
      theme: ['white', 'dark', 'retro', 'inherit'].includes(source.theme) ? source.theme : fallbackTheme,
      backgroundColor: String(source.backgroundColor || ''),
      titleColor: String(source.titleColor || ''),
      captionColor: String(source.captionColor || '')
    };
  }

  function mergedAppearance(base, override) {
    const baseValue = appearance(base, 'white');
    const overrideValue = appearance(override, 'inherit');
    return {
      theme: overrideValue.theme === 'inherit' ? baseValue.theme : overrideValue.theme,
      backgroundColor: overrideValue.backgroundColor || baseValue.backgroundColor,
      titleColor: overrideValue.titleColor || baseValue.titleColor,
      captionColor: overrideValue.captionColor || baseValue.captionColor
    };
  }

  function setRootVariable(name, value) {
    if (value) document.documentElement.style.setProperty(name, value);
    else document.documentElement.style.removeProperty(name);
  }

  function applyAppearance(value) {
    const settings = appearance(value, 'white');
    if (!primaryThemeApplied && settings.theme !== 'inherit') {
      document.documentElement.dataset.theme = settings.theme;
      primaryThemeApplied = true;
      document.dispatchEvent(new CustomEvent('colanph:pagetheme', { detail: { theme: settings.theme } }));
    }
    setRootVariable('--page-background-color', settings.backgroundColor);
    setRootVariable('--page-title-color', settings.titleColor);
    setRootVariable('--page-caption-color', settings.captionColor);
  }

  function ensureClientData(data) {
    data.pageSettings ||= {};
    data.pageSettings.home ||= { ...DEFAULT_APPEARANCE, theme: 'white' };
    data.pageSettings.works ||= { ...DEFAULT_APPEARANCE, theme: 'dark', backgroundColor: '#000000', titleColor: '#FFFFFF', captionColor: '#F4F1EA' };
    data.pageSettings.about ||= { ...DEFAULT_APPEARANCE, theme: 'dark', titleColor: '#FFFFFF', captionColor: '#F4F1EA' };
    data.pageSettings.work ||= { ...DEFAULT_APPEARANCE, theme: 'white' };
    data.about ||= structuredClone(DEFAULT_ABOUT);
    allItems(data).forEach(item => { item.appearance ||= { theme: 'inherit', backgroundColor: '', titleColor: '', captionColor: '' }; });
    return data;
  }

  function imageIndex(data) {
    const map = new Map();
    allItems(data).forEach(item => {
      (item.images || []).forEach(image => map.set(image.publicId, { image, item }));
    });
    return map;
  }

  async function loadSiteData() {
    if (siteData) return siteData;
    const response = await fetch('/.netlify/functions/site-data', { cache: 'no-store', credentials: 'same-origin' });
    if (!response.ok) throw new Error('Impossibile caricare i contenuti.');
    siteData = ensureClientData(await response.json());
    return siteData;
  }

  function renderHome(data) {
    applyAppearance(data.pageSettings?.home);
    const track = document.getElementById('home-wall-track');
    if (!track || !window.ColanPhCloudinary) return;
    const index = imageIndex(data);
    const sequence = document.createElement('div');
    sequence.className = 'home-wall-sequence';

    (data.home?.order || []).forEach((publicId, position) => {
      const found = index.get(publicId);
      if (!found) return;
      const { image } = found;
      const frame = document.createElement('div');
      frame.className = 'home-wall-item';
      const img = document.createElement('img');
      img.src = window.ColanPhCloudinary.url(image.publicId);
      img.width = Number(image.width) || 1;
      img.height = Number(image.height) || 1;
      img.alt = localized(image.caption);
      img.decoding = 'async';
      img.loading = position < 6 ? 'eager' : 'lazy';
      img.draggable = false;
      frame.appendChild(img);
      sequence.appendChild(frame);
    });
    track.replaceChildren(sequence);
  }

  function startWorksBackground(item) {
    const background = document.getElementById('works-background');
    if (!background || !window.ColanPhCloudinary) return { start() {}, clear() {} };
    const layers = [...background.querySelectorAll('.works-background-layer')];
    const urls = (item.images || []).map(image => window.ColanPhCloudinary.url(image.publicId));
    let timer = null;
    let token = 0;
    let activeLayer = 0;
    let imagePosition = 0;

    const clear = () => {
      token += 1;
      if (timer) window.clearInterval(timer);
      timer = null;
      layers.forEach(layer => layer.classList.remove('is-visible'));
    };

    const show = (src, session) => {
      if (!src || layers.length < 2) return;
      const nextLayer = layers[activeLayer].classList.contains('is-visible') ? (activeLayer === 0 ? 1 : 0) : activeLayer;
      const preloader = new Image();
      preloader.onload = () => {
        if (session !== token) return;
        layers[nextLayer].style.backgroundImage = `url("${src.replace(/"/g, '\\"')}")`;
        layers[nextLayer].classList.add('is-visible');
        layers[nextLayer === 0 ? 1 : 0].classList.remove('is-visible');
        activeLayer = nextLayer;
      };
      preloader.src = src;
    };

    const start = () => {
      clear();
      if (!urls.length) return;
      const session = ++token;
      imagePosition = 0;
      show(urls[imagePosition], session);
      if (urls.length > 1) {
        timer = window.setInterval(() => {
          if (session !== token) return;
          imagePosition = (imagePosition + 1) % urls.length;
          show(urls[imagePosition], session);
        }, 4000);
      }
    };
    return { start, clear };
  }

  function createWorksLink(item) {
    const link = document.createElement('a');
    link.className = 'works-category';
    link.href = workUrl(item);
    link.textContent = localized(item.title);
    const background = startWorksBackground(item);
    link.addEventListener('mouseenter', background.start);
    link.addEventListener('mouseleave', background.clear);
    link.addEventListener('focus', background.start);
    link.addEventListener('blur', background.clear);
    return { link, cleanup: background.clear };
  }

  function renderWorks(data) {
    applyAppearance(data.pageSettings?.works);
    if (worksCleanup) worksCleanup();
    const sectionsRoot = document.getElementById('works-sections');
    const projectsRoot = document.getElementById('works-projects');
    const emptyProjects = document.getElementById('works-projects-empty');
    if (!sectionsRoot || !projectsRoot) return;
    const cleanups = [];
    sectionsRoot.replaceChildren(...(data.sections || []).map(item => {
      const created = createWorksLink(item); cleanups.push(created.cleanup); return created.link;
    }));
    projectsRoot.replaceChildren(...(data.projects || []).map(item => {
      const created = createWorksLink(item); cleanups.push(created.cleanup); return created.link;
    }));
    if (emptyProjects) emptyProjects.hidden = (data.projects || []).length > 0;
    worksCleanup = () => cleanups.forEach(fn => fn());
  }

  function renderAbout(data) {
    applyAppearance(data.pageSettings?.about);
    const about = { ...DEFAULT_ABOUT, ...(data.about || {}) };
    const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    setText('about-label', localized(about.label));
    setText('about-intro', localized(about.intro));
    setText('about-detail', localized(about.detail));
    setText('about-contact-title', localized(about.contactTitle));
    setText('about-contact-emphasis', localized(about.contactEmphasis));
    setText('about-availability', localized(about.availability));

    const servicesRoot = document.getElementById('about-services');
    if (servicesRoot) {
      const services = Array.isArray(about.services?.[currentLanguage()]) ? about.services[currentLanguage()] : (about.services?.it || []);
      servicesRoot.replaceChildren(...services.map(text => {
        const item = document.createElement('div'); item.className = 'svc'; item.textContent = text; return item;
      }));
    }

    const phone = document.getElementById('about-phone');
    if (phone) { phone.textContent = about.phone || ''; phone.href = about.phoneHref || '#'; }
    const email = document.getElementById('about-email');
    if (email) { email.textContent = about.email || ''; email.href = about.email ? `mailto:${about.email}` : '#'; }
    const instagram = document.getElementById('about-instagram');
    if (instagram) { instagram.textContent = about.instagram || ''; instagram.href = about.instagramUrl || '#'; }

    if (window.ColanPhCloudinary) {
      if (about.backgroundPublicId) document.body.style.setProperty('--about-bg-image', `url("${window.ColanPhCloudinary.url(about.backgroundPublicId)}")`);
      const profile = document.getElementById('about-profile-photo');
      if (profile && about.profilePublicId) profile.src = window.ColanPhCloudinary.url(about.profilePublicId);
    }
  }

  function routeInfo() {
    const url = new URL(window.location.href);
    const match = url.pathname.match(/^\/works\/(sezioni|progetti)\/([^/?#]+)\/?$/);
    if (match) {
      return {
        type: match[1] === 'progetti' ? 'project' : 'section',
        slug: decodeURIComponent(match[2]).trim().toLowerCase()
      };
    }
    const queryType = url.searchParams.get('type');
    const querySlug = url.searchParams.get('slug');
    if (queryType && querySlug) {
      return {
        type: queryType === 'project' ? 'project' : 'section',
        slug: decodeURIComponent(querySlug).replace(/^:/, '').trim().toLowerCase()
      };
    }
    return null;
  }

  function renderWork(data) {
    const info = routeInfo();
    const detail = document.getElementById('work-detail');
    const notFound = document.getElementById('work-not-found');
    if (!detail || !notFound || !info) {
      if (notFound) notFound.hidden = false;
      return;
    }
    const list = info.type === 'project' ? (data.projects || []) : (data.sections || []);
    const legacyIds = { eventi: 'events', architettura: 'architecture', street: 'street', food: 'food', interni: 'interiors', attivita: 'activity' };
    const index = list.findIndex(item => {
      const slug = String(item.slug || '').toLowerCase();
      const id = String(item.id || '').toLowerCase();
      return slug === info.slug || id === info.slug || (legacyIds[info.slug] && id === legacyIds[info.slug]);
    });
    if (index < 0) {
      detail.hidden = true;
      notFound.hidden = false;
      return;
    }

    const item = list[index];
    applyAppearance(mergedAppearance(data.pageSettings?.work, item.appearance));
    detail.hidden = false;
    notFound.hidden = true;
    document.title = `${localized(item.title)} — Works — ColanPh`;

    const description = document.getElementById('work-description');
    if (description) {
      description.textContent = localized(item.description);
      description.closest('.project-info')?.classList.toggle('is-empty', !description.textContent.trim());
    }

    const gallery = document.getElementById('work-gallery');
    if (gallery && window.ColanPhCloudinary) {
      const nodes = (item.images || []).map((image, position) => {
        const figure = document.createElement('figure');
        figure.className = 'img-wrap work-photo';
        figure.dataset.gallery = `work-${item.id}`;
        const img = document.createElement('img');
        img.src = window.ColanPhCloudinary.url(image.publicId);
        img.width = Number(image.width) || 1;
        img.height = Number(image.height) || 1;
        img.alt = localized(image.caption) || localized(item.title);
        img.loading = position < 3 ? 'eager' : 'lazy';
        img.decoding = 'async';
        figure.appendChild(img);
        const captionText = localized(image.caption).trim();
        if (captionText) {
          const caption = document.createElement('figcaption');
          caption.className = 'work-photo-caption';
          caption.textContent = captionText;
          figure.appendChild(caption);
        }
        return figure;
      });
      gallery.replaceChildren(...nodes);
    }

    const pagination = document.getElementById('work-pagination');
    if (pagination) {
      if (list.length <= 1) {
        const current = document.createElement('div');
        current.className = 'project-pagination-current';
        current.setAttribute('aria-current', 'page');
        current.textContent = localized(item.title);
        pagination.replaceChildren(current);
      } else {
        const previous = list[(index - 1 + list.length) % list.length];
        const next = list[(index + 1) % list.length];
        const prev = document.createElement('a');
        prev.className = 'project-pagination-link project-pagination-prev';
        prev.href = workUrl(previous);
        const prevArrow = document.createElement('span');
        prevArrow.className = 'project-pagination-arrow'; prevArrow.setAttribute('aria-hidden', 'true'); prevArrow.textContent = '‹';
        const prevLabel = document.createElement('span');
        prevLabel.className = 'project-pagination-label'; prevLabel.textContent = localized(previous.title);
        prev.append(prevArrow, prevLabel);
        const current = document.createElement('div');
        current.className = 'project-pagination-current'; current.setAttribute('aria-current', 'page'); current.textContent = localized(item.title);
        const nextLink = document.createElement('a');
        nextLink.className = 'project-pagination-link project-pagination-next'; nextLink.href = workUrl(next);
        const nextLabel = document.createElement('span');
        nextLabel.className = 'project-pagination-label'; nextLabel.textContent = localized(next.title);
        const nextArrow = document.createElement('span');
        nextArrow.className = 'project-pagination-arrow'; nextArrow.setAttribute('aria-hidden', 'true'); nextArrow.textContent = '›';
        nextLink.append(nextLabel, nextArrow);
        pagination.replaceChildren(prev, current, nextLink);
      }
    }
  }

  function renderForPage(data) {
    switch (document.body?.dataset.contentPage) {
      case 'home': renderHome(data); break;
      case 'works': renderWorks(data); break;
      case 'about': renderAbout(data); break;
      case 'work': renderWork(data); break;
      default: break;
    }
  }

  document.addEventListener('colanph:languagechange', () => { if (siteData) renderForPage(siteData); });

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const data = await loadSiteData();
      renderForPage(data);
    } catch (error) {
      console.error(error);
      const target = document.getElementById('home-wall-track') || document.querySelector('.works-index-page') || document.getElementById('work-not-found');
      if (target) {
        const message = document.createElement('p');
        message.className = 'content-load-error';
        message.textContent = 'Impossibile caricare i contenuti. Riprova tra poco.';
        if (target.id === 'work-not-found') target.hidden = false;
        target.appendChild(message);
      }
    }
  });
})();
