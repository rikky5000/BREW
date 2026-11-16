// Gemensamma UI-hjälpare.
export function fieldHtml(f, value) {
  const id = `f-${f.key}`;
  let control;
  if (f.type === 'text') {
    control = `<input id="${id}" name="${f.key}" type="text" value="${esc(value)}">`;
  } else if (f.options) {
    control = `<select id="${id}" name="${f.key}">${f.options
      .map((o) => `<option value="${o}"${Number(value) === o ? ' selected' : ''}>${o}</option>`).join('')}</select>`;
  } else {
    control = `<input id="${id}" name="${f.key}" type="number" inputmode="decimal" step="${f.step ?? 'any'}" value="${esc(value)}">`;
  }
  return `
    <div class="field${f.type === 'text' ? ' text' : ''}">
      <label for="${id}">${f.label}${f.hint ? `<small>${f.hint}</small>` : ''}</label>
      <div class="input-wrap">${control}${f.unit ? `<span class="unit">${f.unit}</span>` : ''}</div>
    </div>`;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

let toastTimer;
export function toast(msg) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1600);
}

