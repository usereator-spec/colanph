/* ============================================================
   ColanPh — Cloudinary delivery configuration
   Public frontend configuration only. No API key or secret lives here.
   All portfolio images are delivered from Cloudinary using stable public IDs.
   ============================================================ */

(() => {
  'use strict';

  const CLOUD_NAME = 'dygvuyjz';
  const DELIVERY_BASE = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload`;
  const DEFAULT_FORMAT = 'webp';

  function encodePublicId(publicId) {
    return String(publicId)
      .split('/')
      .filter(Boolean)
      .map(segment => encodeURIComponent(segment))
      .join('/');
  }

  function url(publicId, options = {}) {
    const { transformation = '', format = DEFAULT_FORMAT } = options;
    const encodedId = encodePublicId(publicId);
    const transformPart = transformation ? `/${transformation}` : '';
    const formatPart = format ? `.${format}` : '';
    return `${DELIVERY_BASE}${transformPart}/${encodedId}${formatPart}`;
  }

  function apply(root = document) {
    root.querySelectorAll('[data-cld-src]').forEach(element => {
      element.src = url(element.dataset.cldSrc);
    });

    root.querySelectorAll('[data-cld-srcset]').forEach(element => {
      element.srcset = url(element.dataset.cldSrcset);
    });

    root.querySelectorAll('[data-cld-bg]').forEach(element => {
      element.style.setProperty('--about-bg-image', `url("${url(element.dataset.cldBg)}")`);
    });
  }

  window.ColanPhCloudinary = Object.freeze({
    cloudName: CLOUD_NAME,
    url,
    apply,
  });

  // The script is loaded after page markup, so assets can be resolved immediately.
  apply();
})();
