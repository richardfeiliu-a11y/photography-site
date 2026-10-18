/* global window, document, fetch */
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const ready = fetch('/data.json').then(response => { if (!response.ok) throw new Error('Content unavailable'); return response.json(); });
const image = (photo, sizes = '100vw', eager = false) => `<img src="${escapeHtml(photo.src)}" srcset="${escapeHtml(photo.srcset)}" sizes="${escapeHtml(sizes)}" width="${photo.width}" height="${photo.height}" alt="${escapeHtml(photo.alt)}" loading="${eager ? 'eager' : 'lazy'}" decoding="async">`;
window.DesignLab = { ready, image, escape: escapeHtml };
const dialog = document.createElement('dialog');
dialog.className = 'lab-viewer';
dialog.setAttribute('aria-labelledby', 'lab-collection-title');
dialog.innerHTML = `<div class="lab-viewer-bar"><div><span id="lab-collection-title" class="lab-viewer-title"></span><span class="lab-viewer-count"></span></div><button type="button" data-close aria-label="Close collection">Close</button></div><div class="lab-viewer-content"></div>`;
document.body.append(dialog);
dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
dialog.addEventListener('close', () => { document.body.style.overflow = ''; });
document.addEventListener('click', async event => {
  const trigger = event.target.closest('[data-gallery]');
  if (!trigger) return;
  const data = await ready;
  const gallery = data.archive.find(g => g.id === trigger.dataset.gallery) ?? data.galleries[Number(trigger.dataset.gallery)];
  if (!gallery) return;
  dialog.querySelector('.lab-viewer-title').textContent = gallery.title;
  const monthYear = iso => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso.slice(0, 7) : d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  };
  dialog.querySelector('.lab-viewer-count').textContent = `${monthYear(gallery.date)} · ${gallery.count} photographs`;
  // Photographs only: the per-photo caption carries what a reader needs;
  // the gallery blurb is not rendered here (owner decision, 2026-10-17).
  dialog.querySelector('.lab-viewer-content').innerHTML = window.DesignLab.renderGallery ? window.DesignLab.renderGallery(gallery) : `<div class="lab-viewer-sequence">${gallery.photos.map((photo, i) => `<figure>${image(photo, '90vw', i === 0)}<figcaption>${escapeHtml(photo.caption)} <span>${i + 1} / ${gallery.count}</span></figcaption></figure>`).join('')}</div>`;
  document.body.style.overflow = 'hidden';
  dialog.showModal();
  dialog.scrollTop = 0;
});
