(() => {
  'use strict';

  const MAX_FILE_BYTES = 10 * 1024 * 1024;
  const state = {
    data: null,
    etag: null,
    dirty: false,
    active: { section: null, project: null }
  };

  const status = document.getElementById('admin-status');
  const publishButton = document.getElementById('publish-button');
  const adminUser = document.getElementById('admin-user');

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
    const up = button('↑', 'Sposta su', () => reorderHome(index, index - 1));
    const down = button('↓', 'Sposta giù', () => reorderHome(index, index + 1));
    const remove = button('Togli', 'Togli dalla Home', () => setInHome(publicId, false), 'danger-text');
    actions.append(up, down, remove);
    row.append(handle, img, info, actions);
    return row;
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
      row.addEventListener('dragend', () => {
        row.classList.remove('is-dragging');
        fromIndex = null;
      });
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

  function createNewItem(type) {
    const id = `${type}-${crypto.randomUUID()}`;
    const item = {
      id,
      type,
      slug: '',
      order: collection(type).length,
      title: { it: '', en: '' },
      description: { it: '', en: '' },
      images: []
    };
    collection(type).push(item);
    state.active[type] = id;
    markDirty();
    renderCollectionList(type);
    renderEditor(type);
  }

  function updateNested(item, path, value) {
    const [root, key] = path.split('.');
    if (key) item[root][key] = value;
    else item[root] = value;
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
    renderCollectionList(type);
    renderEditor(type);
    renderHomeOrder();
  }

  function removePhoto(type, item, publicId) {
    if (!window.confirm('Rimuovere questa fotografia? Verrà eliminata da Cloudinary quando pubblichi, se non è usata altrove.')) return;
    item.images = item.images.filter(image => image.publicId !== publicId);
    state.data.home.order = state.data.home.order.filter(id => id !== publicId);
    markDirty();
    renderEditor(type);
    renderHomeOrder();
  }

  function createPhotoRow(type, item, image) {
    const row = document.createElement('div');
    row.className = 'photo-row';

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
    actions.className = 'photo-row-actions';
    actions.append(button('Rimuovi foto', 'Rimuovi fotografia', () => removePhoto(type, item, image.publicId), 'danger-button'));

    row.append(img, fields, actions);
    return row;
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

  async function uploadFiles(type, item, files, progress) {
    if (!item.slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug)) {
      throw new Error('Prima inserisci uno slug URL valido.');
    }

    const validFiles = [...files];
    for (const file of validFiles) {
      if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} supera 10 MB. Preparalo prima con lo script di compressione.`);
      progress.textContent = `Caricamento ${file.name}…`;
      const base = file.name.replace(/\.[^.]+$/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'foto';
      const uid = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
      const folder = type === 'project' ? 'projects' : 'sections';
      const publicId = `colanph/${folder}/${item.slug}/${base}-${uid}`;

      const signResponse = await fetch('/.netlify/functions/cloudinary-sign', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ publicId })
      });
      const signed = await signResponse.json();
      if (!signResponse.ok) throw new Error(signed.error || 'Firma Cloudinary non disponibile.');

      const form = new FormData();
      form.append('file', file);
      form.append('api_key', signed.apiKey);
      form.append('timestamp', String(signed.timestamp));
      form.append('signature', signed.signature);
      form.append('public_id', signed.publicId);

      const uploadResponse = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(signed.cloudName)}/image/upload`, { method: 'POST', body: form });
      const uploaded = await uploadResponse.json();
      if (!uploadResponse.ok) throw new Error(uploaded?.error?.message || `Upload fallito: ${file.name}`);

      item.images.push({
        id: uploaded.public_id,
        publicId: uploaded.public_id,
        width: uploaded.width,
        height: uploaded.height,
        caption: { it: '', en: '' }
      });
      markDirty();
    }
    progress.textContent = validFiles.length ? 'Upload completato. Ricorda di pubblicare le modifiche.' : '';
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
      const [rootKey, childKey] = path.split('.');
      field.value = childKey ? item[rootKey][childKey] : item[rootKey];
      field.addEventListener('input', () => {
        updateNested(item, path, field.value);
        if (path === 'slug') slugManuallyEdited = true;
        if (path === 'title.it' && !slugManuallyEdited) {
          item.slug = slugify(field.value);
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

    const photoList = fragment.querySelector('[data-photo-list]');
    photoList.replaceChildren(...item.images.map(image => createPhotoRow(type, item, image)));
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
    for (const type of ['section', 'project']) {
      const items = collection(type);
      if (!state.active[type] && items.length) state.active[type] = items[0].id;
      renderCollectionList(type);
      renderEditor(type);
    }
  }

  async function load() {
    setStatus('Caricamento contenuti…');
    const response = await fetch('/.netlify/functions/admin-data', { credentials: 'same-origin', cache: 'no-store' });
    if (response.status === 401 || response.status === 403) {
      window.location.assign('/login.html');
      return;
    }
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Impossibile caricare i dati.');
    state.data = payload.data;
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
      state.data = payload.data;
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

  document.querySelectorAll('[data-new-type]').forEach(button => {
    button.addEventListener('click', () => createNewItem(button.dataset.newType));
  });

  publishButton.addEventListener('click', publish);
  document.getElementById('logout-button').addEventListener('click', async () => {
    try {
      await fetch('/.netlify/functions/auth-logout', { method: 'POST', credentials: 'same-origin' });
    } finally {
      window.location.assign('/login.html');
    }
  });

  window.addEventListener('beforeunload', event => {
    if (!state.dirty) return;
    event.preventDefault();
    event.returnValue = '';
  });

  load().catch(error => setStatus(error.message, true));
})();
