(() => {
  'use strict';

  const MAX_FILE_BYTES = 10 * 1024 * 1024;
  const MAX_IMAGE_LONG_EDGE = 2560;
  const WEBP_QUALITY = 0.84;
  const ALLOWED_UPLOAD_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
  const THEMES = [
    ['white', 'Bianco'],
    ['dark', 'Nero'],
    ['retro', "80's"]
  ];
  const DEFAULT_APPEARANCE = { theme: 'white', backgroundColor: '', titleColor: '', captionColor: '' };
  const DEFAULT_ABOUT = {
    label: { it: 'About', en: 'About' },
    intro: { it: 'Fotografo freelance specializzato in food, eventi, architettura, ritratti, fashion e street photography.', en: 'Freelance photographer specialising in food, events, architecture, portraits, fashion and street photography.' },
    detail: { it: 'Collaboro con ristoranti, chef, agenzie di comunicazione e brand nel settore food & hospitality. Ogni progetto è un racconto visivo costruito con cura, dalla pre-produzione allo scatto finale.', en: 'I collaborate with restaurants, chefs, communication agencies and brands in food and hospitality. Every project is a visual story developed with care, from pre-production to the final shot.' },
    services: { it: ['Food Photography', 'Ritratti — Artisti & Attori', 'Fashion', 'Architettura & Interni', 'Street Photography', 'Eventi & Concerti'], en: ['Food Photography', 'Portraits — Artists & Actors', 'Fashion', 'Architecture & Interiors', 'Street Photography', 'Events & Concerts'] },
    contactTitle: { it: 'Iniziamo a', en: "Let's" },
    contactEmphasis: { it: 'lavorare insieme.', en: 'work together.' },
    phone: '+39 347 899 7588', phoneHref: 'https://wa.me/393478997588', email: 'fabiocolan.ph@gmail.com', instagram: '@fabiocolan_ph', instagramUrl: 'https://www.instagram.com/fabiocolan_ph/',
    availability: { it: 'Disponibile per nuovi progetti', en: 'Available for new projects' },
    backgroundPublicId: 'colanph/hero/ritratti-fabio-18',
    profilePublicId: 'colanph/profile/profile'
  };

  const state = {
    data: null,
    etag: null,
    dirty: false,
    active: { section: null, project: null }
  };

  const status = document.getElementById('admin-status');
  const publishButton = document.getElementById('publish-button');
  const adminUser = document.getElementById('admin-user');

  const clone = value => structuredClone(value);
  const setStatus = (message, error = false) => {
    status.textContent = message;
    status.classList.toggle('is-error', error);
  };
  const markDirty = () => {
    state.dirty = true;
    publishButton.disabled = false;
    publishButton.textContent = 'Pubblica modifiche *';
  };
  const markClean = () => {
    state.dirty = false;
    publishButton.disabled = true;
    publishButton.textContent = 'Pubblica modifiche';
  };
  const collection = type => type === 'project' ? state.data.projects : state.data.sections;
  const editorRoot = type => document.getElementById(type === 'project' ? 'project-editor' : 'section-editor');
  const listRoot = type => document.getElementById(type === 'project' ? 'projects-list' : 'sections-list');

  function slugify(value) {
    return String(value || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function uniqueSlug(base, type = 'section', currentId = null) {
    const root = slugify(base) || (type === 'project' ? 'progetto' : 'sezione');
    const used = new Set(collection(type).filter(item => item.id !== currentId).map(item => item.slug));
    if (!used.has(root)) return root;
    let i = 2;
    while (used.has(`${root}-${i}`)) i += 1;
    return `${root}-${i}`;
  }

  function ensureAppearance(value, theme = 'white') {
    const source = value && typeof value === 'object' ? value : {};
    return {
      theme: source.theme || theme,
      backgroundColor: source.backgroundColor || '',
      titleColor: source.titleColor || '',
      captionColor: source.captionColor || ''
    };
  }

  function ensureLocalized(value, fallback = { it: '', en: '' }) {
    const source = value && typeof value === 'object' ? value : fallback;
    return { it: String(source.it || ''), en: String(source.en || '') };
  }

  function ensureAdminDefaults(data) {
    data.sections ||= [];
    data.projects ||= [];
    data.home ||= { order: [] };
    data.home.order ||= [];
    data.pageSettings ||= {};
    data.pageSettings.home = ensureAppearance(data.pageSettings.home, 'white');
    data.pageSettings.works = ensureAppearance(data.pageSettings.works, 'dark');
    data.pageSettings.about = ensureAppearance(data.pageSettings.about, 'dark');
    data.pageSettings.work = ensureAppearance(data.pageSettings.work, 'white');

    data.about = { ...clone(DEFAULT_ABOUT), ...(data.about || {}) };
    for (const field of ['label', 'intro', 'detail', 'contactTitle', 'contactEmphasis', 'availability']) {
      data.about[field] = ensureLocalized(data.about[field], DEFAULT_ABOUT[field]);
    }
    data.about.services ||= { it: [], en: [] };
    data.about.services.it = Array.isArray(data.about.services.it) ? data.about.services.it : [];
    data.about.services.en = Array.isArray(data.about.services.en) ? data.about.services.en : [];
    data.about.backgroundPublicId ||= DEFAULT_ABOUT.backgroundPublicId;
    data.about.profilePublicId ||= DEFAULT_ABOUT.profilePublicId;

    for (const item of [...data.sections, ...data.projects]) {
      item.title = ensureLocalized(item.title);
      item.description = ensureLocalized(item.description);
      item.images ||= [];
      item.appearance = ensureAppearance(item.appearance, 'inherit');
      for (const image of item.images) image.caption = ensureLocalized(image.caption);
    }
    return data;
  }

  function allImageOwners() {
    const map = new Map();
    [...state.data.sections, ...state.data.projects].forEach(item => {
      item.images.forEach(image => map.set(image.publicId, { image, item }));
    });
    return map;
  }

  function isInHome(publicId) {
    return state.data.home.order.includes(publicId);
  }

  function setInHome(publicId, enabled) {
    const index = state.data.home.order.indexOf(publicId);
    if (enabled && index < 0) state.data.home.order.push(publicId);
    if (!enabled && index >= 0) state.data.home.order.splice(index, 1);
    markDirty();
    renderHomeOrder();
  }

  function moveInArray(array, from, to) {
    if (to < 0 || to >= array.length || from === to) return false;
    const [entry] = array.splice(from, 1);
    array.splice(to, 0, entry);
    return true;
  }

  function ownerLabel(item) {
    const prefix = item.type === 'project' ? 'Progetto' : 'Sezione';
    return `${prefix}: ${item.title.it || item.slug || 'Senza titolo'}`;
  }

  function button(text, label, onClick, className = '') {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = text;
    btn.setAttribute('aria-label', label);
    if (className) btn.className = className;
    btn.addEventListener('click', onClick);
    return btn;
  }

  function createHomeRow(publicId, index, ownerMap) {
    const found = ownerMap.get(publicId);
    if (!found) return null;
    const row = document.createElement('div');
    row.className = 'sortable-row home-row';
    row.draggable = true;
    row.dataset.index = index;

    const handle = document.createElement('span');
    handle.className = 'drag-handle';
    handle.textContent = '⋮⋮';
    handle.title = 'Trascina';

    const img = document.createElement('img');
    img.className = 'admin-thumb';
    img.src = window.ColanPhCloudinary.url(publicId, { transformation: 'c_fill,w_180,h_120,q_auto' });
    img.alt = '';

    const info = document.createElement('div');
    info.className = 'sortable-row-info';
    const title = document.createElement('strong');
    title.textContent = ownerLabel(found.item);
    const caption = document.createElement('span');
    caption.textContent = found.image.caption.it || found.image.publicId;
    info.append(title, caption);

    const actions = document.createElement('div');
    actions.className = 'row-actions';
    actions.append(
      button('↑', 'Sposta su', () => reorderHome(index, index - 1)),
      button('↓', 'Sposta giù', () => reorderHome(index, index + 1)),
      button('Togli', 'Togli dalla Home', () => setInHome(publicId, false), 'danger-text')
    );
    row.append(handle, img, info, actions);
    return row;
  }

  function reorderHome(from, to) {
    if (!moveInArray(state.data.home.order, from, to)) return;
    markDirty();
    renderHomeOrder();
  }

  function renderHomeOrder() {
    const root = document.getElementById('home-order-list');
    if (!root || !state.data) return;
    const owners = allImageOwners();
    const rows = state.data.home.order.map((publicId, index) => createHomeRow(publicId, index, owners)).filter(Boolean);
    root.replaceChildren(...rows);
    wireDrag(root, (from, to) => reorderHome(from, to));
    if (!rows.length) {
      const empty = document.createElement('p');
      empty.className = 'admin-empty';
      empty.textContent = 'Nessuna foto selezionata per la Home.';
      root.appendChild(empty);
    }
  }

  function wireDrag(root, onMove) {
    let fromIndex = null;
    root.querySelectorAll('[draggable="true"]').forEach(row => {
      row.addEventListener('dragstart', event => {
        fromIndex = Number(row.dataset.index);
        row.classList.add('is-dragging');
        event.dataTransfer.effectAllowed = 'move';
      });
      row.addEventListener('dragend', () => { row.classList.remove('is-dragging'); fromIndex = null; });
      row.addEventListener('dragover', event => event.preventDefault());
      row.addEventListener('drop', event => {
        event.preventDefault();
        const toIndex = Number(row.dataset.index);
        if (Number.isInteger(fromIndex) && Number.isInteger(toIndex)) onMove(fromIndex, toIndex);
      });
    });
  }

  function renderCollectionList(type) {
    const root = listRoot(type);
    const items = collection(type);
    const activeId = state.active[type];
    root.replaceChildren(...items.map(item => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `admin-item-button${item.id === activeId ? ' is-active' : ''}`;
      btn.textContent = item.title.it || item.slug || (type === 'project' ? 'Nuovo progetto' : 'Nuova sezione');
      btn.addEventListener('click', () => {
        state.active[type] = item.id;
        renderCollectionList(type);
        renderEditor(type);
      });
      return btn;
    }));
  }

  function getActiveItem(type) {
    return collection(type).find(item => item.id === state.active[type]) || null;
  }

  function createItemObject(type, title = '') {
    const slug = title ? uniqueSlug(title, type) : '';
    return {
      id: `${type}-${crypto.randomUUID()}`,
      type,
      slug,
      order: collection(type).length,
      title: { it: title, en: '' },
      description: { it: '', en: '' },
      appearance: { theme: 'inherit', backgroundColor: '', titleColor: '', captionColor: '' },
      images: []
    };
  }

  function createNewItem(type) {
    const item = createItemObject(type);
    collection(type).push(item);
    state.active[type] = item.id;
    markDirty();
    renderCollectionList(type);
    renderEditor(type);
  }

  function updateNested(item, path, value) {
    const parts = path.split('.');
    let cursor = item;
    while (parts.length > 1) cursor = cursor[parts.shift()];
    cursor[parts[0]] = value;
  }

  function deleteItem(type, item) {
    const label = item.title.it || item.slug || (type === 'project' ? 'questo progetto' : 'questa sezione');
    if (!window.confirm(`Rimuovere ${label}? Le foto saranno eliminate da Cloudinary quando pubblichi, se non sono usate altrove.`)) return;
    const removedIds = new Set(item.images.map(image => image.publicId));
    const items = collection(type);
    const index = items.findIndex(candidate => candidate.id === item.id);
    if (index >= 0) items.splice(index, 1);
    state.data.home.order = state.data.home.order.filter(id => !removedIds.has(id));
    state.active[type] = items[0]?.id || null;
    markDirty();
    renderAll();
  }

  function removePhoto(type, item, publicId) {
    if (!window.confirm('Rimuovere questa fotografia? Verrà eliminata da Cloudinary quando pubblichi, se non è usata altrove.')) return;
    item.images = item.images.filter(image => image.publicId !== publicId);
    state.data.home.order = state.data.home.order.filter(id => id !== publicId);
    markDirty();
    renderEditor(type);
    renderHomeOrder();
  }

  function findItemByKey(key) {
    const [type, id] = String(key || '').split(':');
    const item = collection(type).find(candidate => candidate.id === id);
    return item ? { type, item } : null;
  }

  function createDestinationSelect(currentItem) {
    const select = document.createElement('select');
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Sposta foto in…';
    select.appendChild(placeholder);

    const sectionsGroup = document.createElement('optgroup');
    sectionsGroup.label = 'Sezioni';
    state.data.sections.filter(item => item.id !== currentItem.id).forEach(item => {
      const option = document.createElement('option');
      option.value = `section:${item.id}`;
      option.textContent = item.title.it || item.slug;
      sectionsGroup.appendChild(option);
    });
    const newOption = document.createElement('option');
    newOption.value = '__new_section__';
    newOption.textContent = '+ Crea nuova sezione…';
    sectionsGroup.appendChild(newOption);
    select.appendChild(sectionsGroup);

    const projectsGroup = document.createElement('optgroup');
    projectsGroup.label = 'Progetti / Lavori';
    state.data.projects.filter(item => item.id !== currentItem.id).forEach(item => {
      const option = document.createElement('option');
      option.value = `project:${item.id}`;
      option.textContent = item.title.it || item.slug;
      projectsGroup.appendChild(option);
    });
    select.appendChild(projectsGroup);
    return select;
  }

  function movePhoto(type, item, image, destinationKey) {
    let destination;
    if (destinationKey === '__new_section__') {
      const title = window.prompt('Nome della nuova sezione:');
      if (!title?.trim()) return;
      const created = createItemObject('section', title.trim());
      state.data.sections.push(created);
      destination = { type: 'section', item: created };
    } else {
      destination = findItemByKey(destinationKey);
    }
    if (!destination) return;
    if (destination.item.images.some(candidate => candidate.publicId === image.publicId)) {
      window.alert('La fotografia è già presente nella destinazione.');
      return;
    }
    destination.item.images.push(image);
    item.images = item.images.filter(candidate => candidate.publicId !== image.publicId);
    markDirty();
    renderAll();
    setStatus(`Foto spostata in ${destination.item.title.it || destination.item.slug}. Ricorda di pubblicare.`);
  }

  function mergeSection(source, targetId) {
    const target = state.data.sections.find(item => item.id === targetId);
    if (!target || target.id === source.id) return;
    const sourceLabel = source.title.it || source.slug;
    const targetLabel = target.title.it || target.slug;
    if (!window.confirm(`Spostare tutte le foto di “${sourceLabel}” in “${targetLabel}” e rimuovere la sezione “${sourceLabel}”?`)) return;
    const existing = new Set(target.images.map(image => image.publicId));
    source.images.forEach(image => { if (!existing.has(image.publicId)) target.images.push(image); });
    state.data.sections = state.data.sections.filter(item => item.id !== source.id);
    state.active.section = target.id;
    markDirty();
    renderAll();
    setStatus(`Sezione “${sourceLabel}” unita a “${targetLabel}”. Ricorda di pubblicare.`);
  }

  function labelledInput(labelText, value, onInput) {
    const label = document.createElement('label');
    label.textContent = labelText;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = value || '';
    input.addEventListener('input', () => onInput(input.value));
    label.appendChild(input);
    return label;
  }

  function reorderItemImages(type, item, from, to) {
    if (!moveInArray(item.images, from, to)) return;
    markDirty();
    renderEditor(type);
    setStatus('Ordine fotografie aggiornato. Lo stesso ordine verrà usato nella galleria e nell’animazione di sfondo di Works. Ricorda di pubblicare.');
  }

  function createPhotoRow(type, item, image, index) {
    const row = document.createElement('div');
    row.className = 'photo-row';
    row.draggable = true;
    row.dataset.index = index;

    const handle = document.createElement('span');
    handle.className = 'drag-handle photo-drag-handle';
    handle.textContent = '⋮⋮';
    handle.title = 'Trascina per riordinare';

    const img = document.createElement('img');
    img.className = 'admin-photo-preview';
    img.src = window.ColanPhCloudinary.url(image.publicId, { transformation: 'c_fill,w_260,h_180,q_auto' });
    img.alt = '';

    const fields = document.createElement('div');
    fields.className = 'photo-fields';
    const captionIt = labelledInput('Didascalia IT', image.caption.it, value => { image.caption.it = value; markDirty(); });
    const captionEn = labelledInput('Didascalia EN', image.caption.en, value => { image.caption.en = value; markDirty(); });
    const homeLabel = document.createElement('label');
    homeLabel.className = 'home-checkbox';
    const homeCheck = document.createElement('input');
    homeCheck.type = 'checkbox';
    homeCheck.checked = isInHome(image.publicId);
    homeCheck.addEventListener('change', () => setInHome(image.publicId, homeCheck.checked));
    homeLabel.append(homeCheck, document.createTextNode(' Mostra in Home'));
    fields.append(captionIt, captionEn, homeLabel);

    const actions = document.createElement('div');
    actions.className = 'photo-row-actions photo-actions-stack';
    const destination = createDestinationSelect(item);
    const moveButton = button('Sposta', 'Sposta fotografia', () => {
      if (!destination.value) return;
      movePhoto(type, item, image, destination.value);
    });
    const orderButtons = document.createElement('div');
    orderButtons.className = 'photo-order-buttons';
    orderButtons.append(
      button('↑', 'Sposta foto prima', () => reorderItemImages(type, item, index, index - 1)),
      button('↓', 'Sposta foto dopo', () => reorderItemImages(type, item, index, index + 1))
    );
    const moveWrap = document.createElement('div');
    moveWrap.className = 'photo-move-control';
    moveWrap.append(destination, moveButton);
    actions.append(orderButtons, moveWrap, button('Rimuovi foto', 'Rimuovi fotografia', () => removePhoto(type, item, image.publicId), 'danger-button'));

    row.append(handle, img, fields, actions);
    return row;
  }

  function createThemeSelect(current, allowInherit, onChange) {
    const select = document.createElement('select');
    if (allowInherit) {
      const inherit = document.createElement('option');
      inherit.value = 'inherit';
      inherit.textContent = 'Eredita impostazione generale Work';
      select.appendChild(inherit);
    }
    THEMES.forEach(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    });
    select.value = current || (allowInherit ? 'inherit' : 'white');
    select.addEventListener('change', () => onChange(select.value));
    return select;
  }

  function colorField(labelText, value, onInput) {
    const label = document.createElement('label');
    label.textContent = labelText;
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = '#RRGGBB — opzionale';
    input.pattern = '#[0-9A-Fa-f]{6}';
    input.value = value || '';
    input.addEventListener('input', () => onInput(input.value.trim()));
    label.appendChild(input);
    return label;
  }

  function fillAppearanceFields(root, target, allowInherit = false) {
    root.replaceChildren();
    const themeLabel = document.createElement('label');
    themeLabel.textContent = 'Tema primario';
    themeLabel.appendChild(createThemeSelect(target.theme, allowInherit, value => { target.theme = value; markDirty(); }));
    root.append(
      themeLabel,
      colorField('Colore sfondo', target.backgroundColor, value => { target.backgroundColor = value; markDirty(); }),
      colorField('Colore titoli', target.titleColor, value => { target.titleColor = value; markDirty(); }),
      colorField('Colore didascalie / testo secondario', target.captionColor, value => { target.captionColor = value; markDirty(); })
    );
  }

  function renderPageAppearance() {
    const root = document.getElementById('page-appearance-editors');
    if (!root || !state.data) return;
    const pages = [
      ['home', 'Home'],
      ['works', 'Works'],
      ['about', 'About'],
      ['work', 'Pagine Sezione / Progetto — predefinito']
    ];
    root.replaceChildren(...pages.map(([key, title]) => {
      const card = document.createElement('div');
      card.className = 'appearance-card';
      const h2 = document.createElement('h2');
      h2.textContent = title;
      const fields = document.createElement('div');
      fields.className = 'editor-fields';
      fillAppearanceFields(fields, state.data.pageSettings[key], false);
      card.append(h2, fields);
      return card;
    }));
  }

  function renderAboutEditor() {
    const root = document.getElementById('about-editor');
    if (!root || !state.data) return;
    root.querySelectorAll('[data-about-field]').forEach(field => {
      const path = field.dataset.aboutField;
      const parts = path.split('.');
      let value = state.data.about;
      parts.forEach(part => { value = value?.[part]; });
      field.value = value || '';
      field.oninput = () => { updateNested(state.data.about, path, field.value); markDirty(); };
    });
    root.querySelectorAll('[data-about-list]').forEach(field => {
      const [rootKey, lang] = field.dataset.aboutList.split('.');
      field.value = (state.data.about[rootKey]?.[lang] || []).join('\n');
      field.oninput = () => {
        state.data.about[rootKey][lang] = field.value.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
        markDirty();
      };
    });
  }

  function formatBytes(bytes) {
    const value = Number(bytes) || 0;
    if (value < 1024) return `${value} B`;
    const units = ['KB', 'MB', 'GB'];
    let size = value / 1024;
    let unit = units[0];
    for (let i = 1; i < units.length && size >= 1024; i += 1) {
      size /= 1024;
      unit = units[i];
    }
    return `${size >= 10 ? size.toFixed(1) : size.toFixed(2)} ${unit}`;
  }

  function webpFileName(name) {
    const stem = String(name || 'foto').replace(/\.[^.]+$/, '') || 'foto';
    return `${stem}.webp`;
  }

  async function decodeImage(file) {
    if ('createImageBitmap' in window) {
      try {
        const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
        return {
          source: bitmap,
          width: bitmap.width,
          height: bitmap.height,
          dispose: () => bitmap.close?.()
        };
      } catch (_) {
        // Fallback below for browsers with partial createImageBitmap support.
      }
    }

    const objectUrl = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.decoding = 'async';
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error(`Impossibile leggere ${file.name}.`));
        image.src = objectUrl;
      });
      return {
        source: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        dispose: () => URL.revokeObjectURL(objectUrl)
      };
    } catch (error) {
      URL.revokeObjectURL(objectUrl);
      throw error;
    }
  }

  function canvasToWebp(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (!blob) {
          reject(new Error('Il browser non è riuscito a convertire la foto in WebP.'));
          return;
        }
        if (blob.type && blob.type !== 'image/webp') {
          reject(new Error('Questo browser non supporta la conversione WebP richiesta.'));
          return;
        }
        resolve(blob);
      }, 'image/webp', WEBP_QUALITY);
    });
  }

  async function prepareImageForUpload(file) {
    if (!ALLOWED_UPLOAD_TYPES.has(file.type)) {
      throw new Error(`${file.name}: formato non supportato. Usa JPEG, PNG o WebP.`);
    }

    const decoded = await decodeImage(file);
    try {
      const sourceWidth = decoded.width;
      const sourceHeight = decoded.height;
      if (!sourceWidth || !sourceHeight) throw new Error(`${file.name}: dimensioni immagine non valide.`);

      const longEdge = Math.max(sourceWidth, sourceHeight);
      const scale = Math.min(1, MAX_IMAGE_LONG_EDGE / longEdge);
      const width = Math.max(1, Math.round(sourceWidth * scale));
      const height = Math.max(1, Math.round(sourceHeight * scale));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { alpha: true, colorSpace: 'srgb' }) || canvas.getContext('2d');
      if (!context) throw new Error('Canvas non disponibile nel browser.');
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(decoded.source, 0, 0, width, height);

      const blob = await canvasToWebp(canvas);
      if (blob.size > MAX_FILE_BYTES) {
        throw new Error(`${file.name}: anche dopo la compressione il file pesa ${formatBytes(blob.size)} e supera 10 MB.`);
      }

      return {
        file: new File([blob], webpFileName(file.name), { type: 'image/webp', lastModified: Date.now() }),
        originalBytes: file.size,
        outputBytes: blob.size,
        sourceWidth,
        sourceHeight,
        width,
        height
      };
    } finally {
      decoded.dispose?.();
    }
  }

  async function uploadFiles(type, item, files, progress) {
    if (!item.slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug)) throw new Error('Prima inserisci uno slug URL valido.');
    const validFiles = [...files];
    progress.classList.remove('is-error');

    for (let index = 0; index < validFiles.length; index += 1) {
      const originalFile = validFiles[index];
      progress.textContent = `[${index + 1}/${validFiles.length}] Preparazione ${originalFile.name}…`;
      const prepared = await prepareImageForUpload(originalFile);
      progress.textContent = `[${index + 1}/${validFiles.length}] ${originalFile.name}: ${formatBytes(prepared.originalBytes)} → ${formatBytes(prepared.outputBytes)} · ${prepared.sourceWidth}×${prepared.sourceHeight} → ${prepared.width}×${prepared.height}. Caricamento…`;

      const base = originalFile.name.replace(/\.[^.]+$/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'foto';
      const uid = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
      const folder = type === 'project' ? 'projects' : 'sections';
      const publicId = `colanph/${folder}/${item.slug}/${base}-${uid}`;
      const signResponse = await fetch('/.netlify/functions/cloudinary-sign', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ publicId })
      });
      const signed = await signResponse.json();
      if (!signResponse.ok) throw new Error(signed.error || 'Firma Cloudinary non disponibile.');

      const form = new FormData();
      form.append('file', prepared.file);
      form.append('api_key', signed.apiKey);
      form.append('timestamp', String(signed.timestamp));
      form.append('signature', signed.signature);
      form.append('public_id', signed.publicId);

      const uploadResponse = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(signed.cloudName)}/image/upload`, { method: 'POST', body: form });
      const uploaded = await uploadResponse.json();
      if (!uploadResponse.ok) throw new Error(uploaded?.error?.message || `Upload fallito: ${originalFile.name}`);
      item.images.push({ id: uploaded.public_id, publicId: uploaded.public_id, width: uploaded.width, height: uploaded.height, caption: { it: '', en: '' } });
      markDirty();
    }

    progress.textContent = validFiles.length ? `${validFiles.length} foto preparate in WebP (max 2560 px, qualità 84) e caricate. Ricorda di pubblicare le modifiche.` : '';
  }

  function renderEditor(type) {
    const root = editorRoot(type);
    const item = getActiveItem(type);
    root.replaceChildren();
    if (!item) {
      const empty = document.createElement('div');
      empty.className = 'admin-empty-card';
      empty.textContent = type === 'project' ? 'Seleziona un progetto o creane uno nuovo.' : 'Seleziona una sezione o creane una nuova.';
      root.appendChild(empty);
      return;
    }

    const fragment = document.getElementById('editor-template').content.cloneNode(true);
    const card = fragment.querySelector('.editor-card');
    fragment.querySelector('[data-editor-heading]').textContent = item.title.it || (type === 'project' ? 'Nuovo progetto' : 'Nuova sezione');
    fragment.querySelector('[data-delete-item]').addEventListener('click', () => deleteItem(type, item));

    let slugManuallyEdited = Boolean(item.slug);
    fragment.querySelectorAll('[data-field]').forEach(field => {
      const path = field.dataset.field;
      const parts = path.split('.');
      let value = item;
      parts.forEach(part => { value = value?.[part]; });
      field.value = value || '';
      field.addEventListener('input', () => {
        updateNested(item, path, field.value);
        if (path === 'slug') slugManuallyEdited = true;
        if (path === 'title.it' && !slugManuallyEdited) {
          item.slug = uniqueSlug(field.value, type, item.id);
          const slugField = card.querySelector('[data-field="slug"]');
          if (slugField) slugField.value = item.slug;
        }
        if (path === 'title.it') {
          const heading = card.querySelector('[data-editor-heading]');
          heading.textContent = field.value || (type === 'project' ? 'Nuovo progetto' : 'Nuova sezione');
          renderCollectionList(type);
        }
        markDirty();
      });
    });

    fillAppearanceFields(fragment.querySelector('[data-item-appearance]'), item.appearance, true);

    const mergeBlock = fragment.querySelector('[data-section-merge]');
    if (type === 'section' && state.data.sections.length > 1) {
      mergeBlock.hidden = false;
      const select = mergeBlock.querySelector('[data-section-merge-target]');
      select.replaceChildren();
      const placeholder = document.createElement('option');
      placeholder.value = ''; placeholder.textContent = 'Scegli sezione destinazione…';
      select.appendChild(placeholder);
      state.data.sections.filter(candidate => candidate.id !== item.id).forEach(candidate => {
        const option = document.createElement('option');
        option.value = candidate.id;
        option.textContent = candidate.title.it || candidate.slug;
        select.appendChild(option);
      });
      mergeBlock.querySelector('[data-section-merge-button]').addEventListener('click', () => { if (select.value) mergeSection(item, select.value); });
    }

    const photoList = fragment.querySelector('[data-photo-list]');
    photoList.replaceChildren(...item.images.map((image, index) => createPhotoRow(type, item, image, index)));
    wireDrag(photoList, (from, to) => reorderItemImages(type, item, from, to));
    if (!item.images.length) {
      const empty = document.createElement('p');
      empty.className = 'admin-empty';
      empty.textContent = 'Nessuna fotografia.';
      photoList.appendChild(empty);
    }

    const uploadInput = fragment.querySelector('[data-upload-input]');
    const progress = fragment.querySelector('[data-upload-progress]');
    uploadInput.addEventListener('change', async () => {
      try {
        uploadInput.disabled = true;
        await uploadFiles(type, item, uploadInput.files, progress);
        renderEditor(type);
        renderHomeOrder();
      } catch (error) {
        progress.textContent = error.message;
        progress.classList.add('is-error');
      } finally {
        uploadInput.disabled = false;
        uploadInput.value = '';
      }
    });
    root.appendChild(fragment);
  }

  function renderAll() {
    renderHomeOrder();
    renderAboutEditor();
    renderPageAppearance();
    for (const type of ['section', 'project']) {
      const items = collection(type);
      if (!state.active[type] && items.length) state.active[type] = items[0].id;
      if (state.active[type] && !items.some(item => item.id === state.active[type])) state.active[type] = items[0]?.id || null;
      renderCollectionList(type);
      renderEditor(type);
    }
  }

  async function load() {
    setStatus('Caricamento contenuti…');
    const response = await fetch('/.netlify/functions/admin-data', { credentials: 'same-origin', cache: 'no-store' });
    if (response.status === 401 || response.status === 403) { window.location.assign('/login.html'); return; }
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Impossibile caricare i dati.');
    state.data = ensureAdminDefaults(payload.data);
    state.etag = payload.etag;
    adminUser.textContent = payload.user?.email || '';
    markClean();
    renderAll();
    setStatus(payload.source === 'default' ? 'Contenuti iniziali caricati. La prima pubblicazione creerà i dati live.' : 'Contenuti live caricati.');
  }

  async function publish() {
    publishButton.disabled = true;
    setStatus('Pubblicazione in corso…');
    try {
      const response = await fetch('/.netlify/functions/admin-data', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: state.data, etag: state.etag })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Pubblicazione non riuscita.');
      state.data = ensureAdminDefaults(payload.data);
      state.etag = payload.etag;
      markClean();
      renderAll();
      setStatus(payload.warnings?.length ? `Pubblicato. ${payload.warnings.join(' ')}` : 'Modifiche pubblicate sul sito live.');
    } catch (error) {
      publishButton.disabled = false;
      setStatus(error.message, true);
    }
  }

  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach(button => button.classList.toggle('is-active', button === tab));
      document.querySelectorAll('.admin-panel').forEach(panel => panel.classList.toggle('is-active', panel.dataset.panel === tab.dataset.tab));
    });
  });
  document.querySelectorAll('[data-new-type]').forEach(button => button.addEventListener('click', () => createNewItem(button.dataset.newType)));
  publishButton.addEventListener('click', publish);
  document.getElementById('logout-button').addEventListener('click', async () => {
    try { await fetch('/.netlify/functions/auth-logout', { method: 'POST', credentials: 'same-origin' }); }
    finally { window.location.assign('/login.html'); }
  });
  window.addEventListener('beforeunload', event => {
    if (!state.dirty) return;
    event.preventDefault();
    event.returnValue = '';
  });

  load().catch(error => setStatus(error.message, true));
})();
