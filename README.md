# ColanPh

Portfolio fotografico pubblicato su Netlify, con immagini su Cloudinary e area amministrativa privata.

## Deploy

Netlify esegue `npm run build` e pubblica la cartella `dist/`. Le Netlify Functions restano fuori dalla cartella pubblica.

## Configurazione una tantum dell'area admin

1. In Netlify abilita **Identity**.
2. Imposta la registrazione su **Invite only**.
3. Invita l'email dell'amministratore da **Identity > Users**.
4. Apri l'utente invitato e assegna il ruolo `admin`. Dopo un cambio ruolo, esci e rientra per ottenere un token aggiornato.
5. In **Project configuration > Environment variables** aggiungi:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
6. Esegui un nuovo deploy.
7. Accedi da `/login.html`; l'area privata è `/admin/`.

Il secret Cloudinary non deve essere scritto in HTML/JS, `.env` committati o GitHub.

## Area admin

L'admin è diviso in cinque aree:

- **Home**: riordino drag & drop delle fotografie mostrate in Home.
- **About**: modifica dei testi e dei contatti della pagina About.
- **Aspetto**: tema e colori delle pagine pubbliche.
- **Sezioni**: creazione/rimozione di categorie come Eventi, Architettura, Food, Street, Interni, Attività e nuove sezioni future.
- **Progetti / Lavori**: creazione/rimozione di lavori commissionati, ciascuno con titolo IT/EN, descrizione IT/EN, fotografie e didascalie IT/EN.

Nell'editor di ogni foto, **Mostra in Home** decide se quella fotografia entra nel wall della Home. Il suo ordine si gestisce poi dalla scheda Home. Dentro ogni Sezione/Progetto le fotografie possono essere riordinate con drag & drop o ↑/↓; quell'ordine viene usato sia nella galleria sia nella rotazione dello sfondo della pagina Works.

## Dati e pubblicazione

- Le immagini sono archiviate su Cloudinary.
- Sezioni, progetti, didascalie e ordine Home sono salvati in Netlify Blobs nello store `colanph-content`.
- Finché non viene effettuata la prima pubblicazione dall'admin, il sito usa i contenuti iniziali incorporati nelle Functions.
- **Pubblica modifiche** salva direttamente i dati live; non crea commit GitHub e non richiede un nuovo deploy.
- Le URL pubbliche sono data-driven: `/works/sezioni/<slug>` e `/works/progetti/<slug>`.

## Preparazione immagini automatica

Nel pannello admin, i file JPEG/PNG/WebP vengono preparati direttamente nel browser prima dell'upload: lato lungo massimo 2560 px, WebP qualità 84, nessun upscaling e rimozione dei metadata tramite ricodifica Canvas. Anche un originale superiore a 10 MB viene quindi ridotto prima di essere inviato a Cloudinary. Se il file risultante fosse ancora superiore a 10 MB, l'upload viene bloccato. Lo script `tools/prepare-images-for-cloudinary.py` resta disponibile per elaborazioni batch offline.
