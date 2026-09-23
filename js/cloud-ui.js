import {
  configureCloud, disconnectCloud, generateWorkspaceKey,
  getStorageStatus, migrateLocalGamesToCloud
} from './storage.js';
import { $ , toast } from './state-v2.js';

export function initCloudUI() {
  const actions = document.querySelector('.home-actions');
  if (actions && !$('#cloud-home-button')) {
    const button = document.createElement('button');
    button.id = 'cloud-home-button';
    button.className = 'btn';
    button.type = 'button';
    button.textContent = '☁ Cloud';
    button.addEventListener('click', openCloudSettings);
    actions.append(button);
  }
  refreshCloudButton();
}

export function refreshCloudButton() {
  const button = $('#cloud-home-button');
  if (!button) return;
  const status = getStorageStatus();
  if (status.backend === 'cloud') {
    button.textContent = '☁ Cloud verbunden';
    button.title = 'Spiele werden in Supabase gespeichert';
  } else if (status.configured && status.cloudError) {
    button.textContent = '☁ Cloud prüfen';
    button.title = status.cloudError;
  } else {
    button.textContent = '☁ Cloud einrichten';
    button.title = 'Supabase als Speicher verbinden';
  }
}

export function openCloudSettings() {
  const status = getStorageStatus();
  const modal = $('#modal');
  const content = $('#modal-content');
  modal.dataset.persistent = '0';
  content.innerHTML = `
    <div style="text-align:left">
      <p class="eyebrow">Speicher</p>
      <h3 style="margin-top:0">Supabase Cloud</h3>
      <p class="microcopy" id="cloud-status-copy"></p>

      <label class="field-label" for="cloud-url">Supabase Project URL</label>
      <input id="cloud-url" class="text-input" type="url" autocomplete="off" placeholder="https://xxxx.supabase.co">

      <label class="field-label" for="cloud-key" style="margin-top:14px;display:block">Publishable Key</label>
      <input id="cloud-key" class="text-input" type="password" autocomplete="off" placeholder="sb_publishable_...">

      <label class="field-label" for="cloud-workspace" style="margin-top:14px;display:block">Cloud Code</label>
      <input id="cloud-workspace" class="text-input" type="password" autocomplete="off" placeholder="Persönlicher Cloud Code">

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
        <button class="btn small" type="button" id="cloud-generate">Cloud Code erzeugen</button>
        <button class="btn small" type="button" id="cloud-show">Codes anzeigen</button>
        <button class="btn small" type="button" id="cloud-copy">Cloud Code kopieren</button>
      </div>

      <p class="microcopy" style="margin-top:14px">Der Cloud Code funktioniert wie ein Passwort für deine gespeicherten Spiele. Verwende auf allen Geräten denselben Code. Der Supabase Publishable Key darf im Browser verwendet werden. Einen service_role Key hier niemals eintragen.</p>

      <div id="cloud-error" style="min-height:22px;color:#ff8898;font-weight:700;margin-top:8px"></div>

      <div class="modal-actions" style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:18px">
        <button class="btn ghost" type="button" id="cloud-close">Schliessen</button>
        <button class="btn" type="button" id="cloud-disconnect">Nur lokal</button>
        <button class="btn" type="button" id="cloud-migrate">Lokale Spiele hochladen</button>
        <button class="btn primary" type="button" id="cloud-connect">Verbinden</button>
      </div>
    </div>`;

  $('#cloud-url').value = status.url || '';
  $('#cloud-key').value = status.publishableKey || '';
  $('#cloud-workspace').value = status.workspaceKey || '';
  updateStatusCopy();
  $('#cloud-migrate').disabled = status.backend !== 'cloud';
  $('#cloud-disconnect').disabled = !status.configured;

  $('#cloud-close').onclick = close;
  $('#cloud-generate').onclick = () => {
    $('#cloud-workspace').value = generateWorkspaceKey();
    toast('Neuer Cloud Code erzeugt. Bitte sicher aufbewahren.');
  };
  $('#cloud-show').onclick = () => {
    const visible = $('#cloud-key').type === 'text';
    $('#cloud-key').type = visible ? 'password' : 'text';
    $('#cloud-workspace').type = visible ? 'password' : 'text';
    $('#cloud-show').textContent = visible ? 'Codes anzeigen' : 'Codes verbergen';
  };
  $('#cloud-copy').onclick = async () => {
    const value = $('#cloud-workspace').value.trim();
    if (!value) return toast('Noch kein Cloud Code vorhanden.', true);
    try {
      await navigator.clipboard.writeText(value);
      toast('Cloud Code kopiert.');
    } catch {
      $('#cloud-workspace').select();
      toast('Cloud Code markiert.');
    }
  };
  $('#cloud-connect').onclick = connect;
  $('#cloud-disconnect').onclick = () => {
    disconnectCloud();
    refreshCloudButton();
    toast('Cloud getrennt. Neue Änderungen werden lokal gespeichert.');
    close();
  };
  $('#cloud-migrate').onclick = async () => {
    const button = $('#cloud-migrate');
    button.disabled = true;
    $('#cloud-error').textContent = '';
    try {
      const count = await migrateLocalGamesToCloud();
      toast(count ? `${count} lokale Spiele in die Cloud kopiert.` : 'Keine lokalen Spiele zum Hochladen gefunden.');
    } catch (error) {
      $('#cloud-error').textContent = error.message || String(error);
    } finally {
      button.disabled = false;
    }
  };

  modal.classList.remove('hidden');
}

async function connect() {
  const button = $('#cloud-connect');
  button.disabled = true;
  button.textContent = 'Verbinde ...';
  $('#cloud-error').textContent = '';
  try {
    await configureCloud({
      url: $('#cloud-url').value,
      publishableKey: $('#cloud-key').value,
      workspaceKey: $('#cloud-workspace').value
    });
    refreshCloudButton();
    updateStatusCopy();
    $('#cloud-migrate').disabled = false;
    $('#cloud-disconnect').disabled = false;
    toast('Supabase Cloud verbunden.');
  } catch (error) {
    $('#cloud-error').textContent = error.message || String(error);
  } finally {
    button.disabled = false;
    button.textContent = 'Verbinden';
  }
}

function updateStatusCopy() {
  const target = $('#cloud-status-copy');
  if (!target) return;
  const status = getStorageStatus();
  if (status.backend === 'cloud') target.textContent = 'Cloud aktiv. Gespeicherte Spiele werden über Supabase geladen und gespeichert.';
  else if (status.configured && status.cloudError) target.textContent = `Cloud momentan nicht aktiv: ${status.cloudError}`;
  else target.textContent = 'Aktuell werden Spiele nur in diesem Browser gespeichert.';
}

function close() {
  $('#modal').classList.add('hidden');
  $('#modal').dataset.persistent = '0';
}
