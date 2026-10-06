/*
 * Copyright 2026 Luis Torrecilla (liteAECO)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// ========
// liteAECO - (ifc-property-manager.js)
// ========

(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const state = { coord: null, file: null, index: null, queue: [], busy: false };
  const lockedSet = name => /^(IfcRelDefinesByType|BaseQuantities)$/i.test(name) || /(^Qto_|Common$|Dimensions$|Constraints$|Quantity$|Requirements$)/i.test(name);
  const lockedProperty = name => ['_hash','_globalId','_elementName','Length','Width','Height','Thickness','GrossVolume','NetVolume','GrossArea','NetArea','CrossSectionArea','IsExternal'].includes(name) || /(storey|level|opening\s*id|layer|omniclass)/i.test(name);
  const appendLog = (message, error = false) => {
    $('logAreaWrapper').classList.remove('hidden');
    $('logAreaWrapper').classList.add('flex');
    const line = document.createElement('div');
    line.textContent = message;
    if (error) line.className = 'text-amber-300';
    $('logArea').append(line);
    while ($('logArea').childElementCount > 100) $('logArea').firstElementChild.remove();
    $('logArea').scrollTop = $('logArea').scrollHeight;
    if (error) $('logArea').closest('details').open = true;
  };
  const status = (message, error = false) => {
    $('status').textContent = message;
    $('status').className = 'text-xs mt-4 ' + (error ? 'text-rose-700' : 'text-slate-600');
    appendLog(message, error);
  };
  const selected = element => Array.from(element.selectedOptions).map(o => o.value);
  const busy = value => { state.busy = value; $('generateBtn').disabled = value || !state.queue.length; updateActionState(); };
  function coordinator() {
    const worker = new Worker('../js/ifc-pset-worker.js?v=11');
    const pending = new Map();
    let sequence = 0;
    let readyResolve, readyReject;
    const ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
    const timer = setTimeout(() => { worker.terminate(); readyReject(new Error('Worker startup timed out.')); }, 12000);
    worker.onmessage = ({data}) => {
      if (data.type === 'ready') {
        clearTimeout(timer);
        if (data.proto === 11) readyResolve();
        else { worker.terminate(); readyReject(new Error('Worker version mismatch.')); }
      } else if (data.type === 'log') {
        appendLog(data.msg, data.warn);
      } else if (data.type === 'result' || data.type === 'error') {
        const item = pending.get(data.reqId);
        if (!item) return;
        pending.delete(data.reqId);
        data.type === 'result' ? item.resolve(data) : item.reject(new Error(data.msg));
      }
    };
    worker.onerror = event => {
      clearTimeout(timer);
      const error = new Error(event.message || 'Worker failed.');
      readyReject(error);
      for (const item of pending.values()) item.reject(error);
      pending.clear();
    };
    return {
      terminate: () => {
        clearTimeout(timer);
        worker.terminate();
        for (const item of pending.values()) item.reject(new Error('Worker stopped.'));
        pending.clear();
      },
      async call(action, payload = {}) {
        await ready;
        const reqId = ++sequence;
        return new Promise((resolve, reject) => {
          pending.set(reqId, {resolve, reject});
          worker.postMessage({action, reqId, ...payload});
        });
      }
    };
  }
  function displayIndex(index, resetSelection = false) {
    state.index = index;
    $('workspace').classList.remove('hidden');
    $('modelInfo').textContent = state.file.name;
    $('info-date').textContent = index.meta.date || '-';
    $('info-size').textContent = `${(state.file.size / 1048576).toFixed(2)} MB`;
    $('info-schema').textContent = index.meta.schema || '-';
    $('info-app').textContent = index.meta.app || '-';
    $('info-person').textContent = index.meta.person || '-';
    $('info-units').textContent = index.meta.unit || '-';
    const site = index.meta.site;
    $('info-xyz').textContent = site ? `${site.lat} / ${site.lon} / ${site.elev}` : '- / - / -';
    if (resetSelection) $('psetSelect').replaceChildren();
    $('classSelect').replaceChildren(...Object.keys(index.classData).sort().map(name => new Option(`${name} (${index.classCounts[name] || 0})`, name, false, true)));
    displayPsets();
  }
  function displayPsets() {
    const classes = selected($('classSelect'));
    const names = new Set();
    for (const cls of classes) for (const name of Object.keys(state.index.classData[cls] || {})) names.add(name);
    const old = new Set(selected($('psetSelect')));
    const sorted = Array.from(names).sort();
    const editable = sorted.filter(name => !lockedSet(name));
    const protectedNames = sorted.filter(lockedSet);
    const options = editable.map(name => new Option(name, name, false, old.has(name)));
    if (editable.length && protectedNames.length) {
      const separator = new Option('────── Protected Schema ──────', '', false, false);
      separator.disabled = true;
      separator.classList.add('text-center', 'text-slate-300', 'py-1');
      options.push(separator);
    }
    for (const name of protectedNames) {
      const option = new Option(name, name, false, old.has(name));
      option.classList.add('text-slate-400', 'bg-slate-50/50', 'italic');
      option.title = 'Protected schema: export only';
      options.push(option);
    }
    $('psetSelect').replaceChildren(...options);
    updateActionState();
  }
  async function load(file) {
    if (state.busy) { status('Finish the current operation first.', true); return; }
    if (!file || !/\.ifc$/i.test(file.name)) { status('Choose an .ifc file.', true); return; }
    busy(true);
    state.coord?.terminate();
    state.coord = coordinator();
    state.file = null;
    state.index = null;
    state.queue = [];
    $('workspace').classList.add('hidden');
    $('classSelect').replaceChildren();
    $('psetSelect').replaceChildren();
    renderQueue();
    status('Loading model...');
    try {
      const index = await state.coord.call('psetLoad', {file, fileName: file.name});
      state.file = file;
      displayIndex(index, true);
      status('Model ready. Select an action.');
    } catch (error) { state.coord.terminate(); state.coord = null; status(error.message, true); }
    finally { busy(false); }
  }
  function targetDefinitions() {
    const classes = selected($('classSelect'));
    const names = selected($('psetSelect'));
    const ids = new Set();
    for (const cls of classes) for (const name of names) {
      for (const id of state.index.classData[cls]?.[name]?.psetIds || []) ids.add(String(id));
    }
    if (classes.length === Object.keys(state.index.classData).length) {
      for (const name of names) for (const id of state.index.psetNameToIds[name] || []) ids.add(String(id));
    }
    return {classes, names, ids: Array.from(ids)};
  }
  function queue(item) { state.queue.push(item); renderQueue(); updateActionState(); }
  function renderQueue() {
    const list = $('queueList');
    list.replaceChildren();
    if (!state.queue.length) list.innerHTML = '<li class="text-slate-500">No changes queued.</li>';
    state.queue.forEach((item, index) => {
      const li = document.createElement('li');
      li.className = 'flex justify-between gap-3 border-b border-slate-100 pb-2';
      const label = document.createElement('span');
      label.textContent = item.label;
      const remove = document.createElement('button');
      remove.textContent = 'Remove';
      remove.className = 'text-rose-700';
      remove.onclick = () => { state.queue.splice(index, 1); renderQueue(); };
      li.append(label, remove);
      list.append(li);
    });
    $('generateBtn').disabled = state.busy || !state.queue.length;
    updateActionState();
  }
  function updateActionState() {
    const tab = document.querySelector('.tab[aria-selected="true"]')?.dataset.tab || 'export';
    $('allPsets').textContent = tab === 'export' ? window.t('allPsetsExport', 'Select all sets') : window.t('allPsetsEdit', 'Select editable sets');
    const classes = selected($('classSelect'));
    const names = selected($('psetSelect'));
    const target = state.index ? targetDefinitions() : {ids: []};
    const protectedSelected = names.some(lockedSet);
    const newName = $('newName').value.trim();
    const injectSet = $('injectSet').value.trim();
    const injectName = $('injectName').value.trim();
    const injectValue = $('injectValue').value.trim();
    const injectType = $('injectType').value;
    let warning = '';
    if ((tab === 'rename' || tab === 'delete') && protectedSelected) {
      warning = window.t('protectedWarning', 'This Property Set is protected and cannot be modified.');
    } else if (tab === 'rename' && newName && lockedSet(newName)) {
      warning = window.t('protectedNameWarning', 'The new name is protected.');
    } else if (tab === 'inject' && ((injectSet && lockedSet(injectSet)) || (injectName && lockedProperty(injectName)))) {
      warning = window.t('protectedPropertyWarning', 'Protected properties cannot be changed.');
    }
    $('securityWarning').classList.toggle('hidden', !warning);
    $('securityWarning').classList.toggle('flex', !!warning);
    $('securityWarningText').textContent = warning;
    const selectedLinks = classes.reduce((total, cls) => total + names.reduce((count, name) => count + (state.index?.classData[cls]?.[name]?.objectCount || 0), 0), 0);
    const showStats = (tab === 'rename' || tab === 'delete') && !!target.ids.length && !protectedSelected;
    $('selectionStats').classList.toggle('hidden', !showStats);
    $('selectionStats').classList.toggle('flex', showStats);
    if (showStats) $('selectionStatsText').textContent = window.t('selectionCount', '{links} linked objects · {definitions} definitions', {links:selectedLinks, definitions:target.ids.length});
    const conflicting = state.queue.some(item => item.ids?.some(id => target.ids.includes(id)));
    $('exportBtn').disabled = state.busy || !classes.length || !names.length || !target.ids.length;
    $('newName').disabled = state.busy || classes.length === 0 || names.length !== 1 || !target.ids.length || protectedSelected;
    $('queueRename').disabled = $('newName').disabled || !newName || newName === names[0] || lockedSet(newName) || conflicting;
    $('queueDelete').disabled = state.busy || !target.ids.length || protectedSelected || conflicting || state.queue.some(item => item.kind === 'inject' && names.includes(item.psetName));
    const validValue = !(['IFCINTEGER','IFCREAL'].includes(injectType) && (injectValue === '' || !Number.isFinite(Number(injectValue)))) && (injectType !== 'IFCINTEGER' || Number.isInteger(Number(injectValue))) && (injectType !== 'IFCBOOLEAN' || /^(true|false|1|0|t|f)$/i.test(injectValue));
    const deletedTarget = state.queue.some(item => item.kind === 'delete' && item.ids.some(id => (state.index?.psetNameToIds[injectSet] || []).map(String).includes(id)));
    $('queueInject').disabled = state.busy || !classes.length || !injectSet || !injectName || lockedSet(injectSet) || lockedProperty(injectName) || !validValue || deletedTarget;
  }
  function protectedTargets(names) {
    if (names.some(lockedSet)) { status('Protected sets allow export only.', true); return true; }
    return false;
  }
  $('modelFile').onchange = event => load(event.target.files[0]);
  const drop = $('dropZone');
  drop.ondragover = event => { event.preventDefault(); drop.classList.add('border-indigo-500'); };
  drop.ondragleave = () => drop.classList.remove('border-indigo-500');
  drop.ondrop = event => { event.preventDefault(); drop.classList.remove('border-indigo-500'); load(event.dataTransfer.files[0]); };
  $('classSelect').onchange = displayPsets;
  $('psetSelect').onchange = updateActionState;
  for (const id of ['newName','injectSet','injectName','injectValue','injectType']) $(id).addEventListener('input', updateActionState);
  $('allClasses').onclick = () => { for (const option of $('classSelect').options) option.selected = true; displayPsets(); };
  $('allPsets').onclick = () => {
    const editing = document.querySelector('.tab[aria-selected="true"]')?.dataset.tab !== 'export';
    for (const option of $('psetSelect').options) option.selected = !option.disabled && (!editing || !lockedSet(option.value));
    updateActionState();
  };
  document.querySelectorAll('.tab').forEach(tab => tab.onclick = () => {
    document.querySelectorAll('.tab').forEach(button => {
      const active = button === tab;
      button.classList.toggle('border-indigo-200', active);
      button.classList.toggle('bg-indigo-50', active);
      button.classList.toggle('text-indigo-700', active);
      button.classList.toggle('border-slate-200', !active);
      button.classList.toggle('text-slate-600', !active);
      button.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('.panel').forEach(panel => {
      const active = panel.dataset.panel === tab.dataset.tab;
      panel.classList.toggle('hidden', !active);
      panel.classList.toggle('flex', active);
    });
    updateActionState();
  });
  document.querySelectorAll('.tab').forEach((tab, index, tabs) => tab.onkeydown = event => {
    if (!['ArrowRight','ArrowLeft','ArrowDown','ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    const delta = ['ArrowRight','ArrowDown'].includes(event.key) ? 1 : -1;
    const next = tabs[(index + delta + tabs.length) % tabs.length];
    next.focus(); next.click();
  });
  $('queueRename').onclick = () => {
    const target = targetDefinitions();
    const name = $('newName').value.trim();
    if (target.names.length !== 1 || !target.ids.length) return status('Select one applicable Property Set.', true);
    if (protectedTargets(target.names) || lockedSet(name)) return status('Protected names cannot be changed.', true);
    if (!name || name === target.names[0]) return status('Enter a different set name.', true);
    if (state.queue.some(item => item.ids?.some(id => target.ids.includes(id)))) return status('These definitions already have edits.', true);
    queue({kind:'rename', ids:target.ids, name, label:`Rename ${target.names[0]} → ${name} (${target.ids.length} definitions)`});
    status('Rename queued.');
  };
  $('queueDelete').onclick = () => {
    const target = targetDefinitions();
    if (!target.names.length || !target.ids.length) return status('Select applicable Property Sets.', true);
    if (protectedTargets(target.names)) return;
    if (state.queue.some(item => item.ids?.some(id => target.ids.includes(id)))) return status('These definitions already have edits.', true);
    if (state.queue.some(item => item.kind === 'inject' && target.names.includes(item.psetName))) return status('Injected sets cannot be deleted.', true);
    queue({kind:'delete', ids:target.ids, label:`Delete ${target.names.join(', ')} (${target.ids.length} definitions)`});
    status('Deletion queued.');
  };
  $('queueInject').onclick = () => {
    const ifcClasses = selected($('classSelect'));
    const psetName = $('injectSet').value.trim(), name = $('injectName').value.trim();
    const type = $('injectType').value, value = $('injectValue').value;
    if (!ifcClasses.length || !psetName || !name) return status('Select classes and enter names.', true);
    if (lockedSet(psetName) || lockedProperty(name)) return status('Protected properties cannot change.', true);
    if (['IFCINTEGER','IFCREAL'].includes(type) && (value.trim() === '' || !Number.isFinite(Number(value)) || (type === 'IFCINTEGER' && !Number.isInteger(Number(value))))) return status('Enter a valid numeric value.', true);
    if (type === 'IFCBOOLEAN' && !/^(true|false|1|0|t|f)$/i.test(value.trim())) return status('Enter true or false.', true);
    if (state.queue.some(item => item.kind === 'delete' && item.ids.some(id => (state.index.psetNameToIds[psetName] || []).map(String).includes(id)))) return status('Deleted sets cannot receive properties.', true);
    queue({kind:'inject', ifcClasses, psetName, name, type, value, label:`Inject ${psetName}.${name} into ${ifcClasses.length} classes`});
    status('Property queued.');
  };
  const spreadsheetRows = workbook => {
    const merged = new Map();
    for (const sheetName of workbook.SheetNames) {
      if (sheetName === 'INFO') continue;
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {header:1, defval:''});
      if (rows.length < 3) continue;
      const sets = rows[0], headers = rows[1], idCol = headers.indexOf('Element ID');
      if (idCol < 0) continue;
      for (const row of rows.slice(2)) {
        const elementID = Number(row[idCol]);
        if (!Number.isInteger(elementID) || elementID <= 0) continue;
        const entry = merged.get(elementID) || {elementID, props:[]};
        for (let col = 4; col < headers.length; col++) {
          const pset = String(sets[col] || '').trim(), name = String(headers[col] || '').trim();
          const value = row[col];
          if (!pset || !name || value === '' || value === undefined || value === null || lockedSet(pset) || lockedProperty(name)) continue;
          entry.props.push({pset, name, value});
        }
        if (entry.props.length) merged.set(elementID, entry);
      }
    }
    return Array.from(merged.values());
  };
  $('spreadsheetFile').onchange = async event => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), {type:'array'});
      const rows = spreadsheetRows(workbook);
      const count = rows.reduce((n, row) => n + row.props.length, 0);
      if (!count) throw new Error('No editable values found.');
      queue({kind:'spreadsheet', rows, label:`Import ${count} values from ${file.name}`});
      $('importStatus').textContent = `${count} updates queued.`;
    } catch (error) { status(error.message, true); }
    event.target.value = '';
  };
  $('clearQueue').onclick = () => { state.queue = []; renderQueue(); status('Queue cleared.'); };
  const download = (blob, name) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = name; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };
  $('generateBtn').onclick = async () => {
    if (!state.queue.length || state.busy) return;
    const renames = {}, deletePsetIds = [], queued = [], excelRows = [];
    for (const item of state.queue) {
      if (item.kind === 'rename') for (const id of item.ids) renames[id] = item.name;
      if (item.kind === 'delete') deletePsetIds.push(...item.ids);
      if (item.kind === 'inject') queued.push(item);
      if (item.kind === 'spreadsheet') excelRows.push(...item.rows);
    }
    const deletedNames = new Set();
    for (const [name, ids] of Object.entries(state.index.psetNameToIds)) if (ids.some(id => deletePsetIds.includes(String(id)))) deletedNames.add(name);
    if (excelRows.some(row => row.props.some(prop => deletedNames.has(prop.pset)))) return status('Imported values target deleted sets.', true);
    busy(true); status('Generating modified IFC...');
    try {
      const result = await state.coord.call('psetCommit', {ops:{renames, deletePsetIds, queued, excelRows}});
      const output = new File(result.parts, state.file.name.replace(/\.ifc$/i,'_Properties.ifc'), {type:'application/x-step'});
      download(output, output.name);
      state.file = output;
      state.index = null;
      state.queue = [];
      renderQueue();
      $('workspace').classList.add('hidden');
      try {
        const index = await state.coord.call('psetLoad', {file:output, fileName:output.name});
        displayIndex(index, true);
        status(`Modified IFC downloaded. ${result.summary.injected ? 'Properties injected; ' : ''}${result.summary.renamed} sets renamed; ${result.summary.deleted} deleted.`);
      } catch (reloadError) {
        state.coord.terminate();
        state.coord = null;
        status(`Modified IFC downloaded. Reload failed: ${reloadError.message}`, true);
      }
    } catch (error) { status(error.message, true); }
    finally { busy(false); }
  };
  function sheetRows(rows) {
    const keys = Array.from(new Set(rows.flatMap(row => Object.keys(row.props)))).sort();
    const psetRow = ['Property Set', 'Property Set', 'Property Set', 'Property Set', ...keys.map(key => key.split(':::')[0])];
    const header = ['IFC Class','Global ID','Element ID','Element Name', ...keys.map(key => key.split(':::').slice(1).join(':::'))];
    return [psetRow, header, ...rows.map(row => [row.cls,row.g,row.i,row.n,...keys.map(key => row.props[key] ?? '')])];
  }
  $('exportBtn').onclick = async () => {
    if (state.busy) return;
    const classes = selected($('classSelect')), psetNames = selected($('psetSelect'));
    if (!classes.length || !psetNames.length) return status('Select classes and Property Sets.', true);
    busy(true); status('Preparing property export...');
    try {
      const format = $('exportFormat').value, layout = $('exportLayout').value;
      const base = state.file.name.replace(/\.ifc$/i,'') + '_Psets';
      if (format === 'csv') {
        const result = await state.coord.call('psetCsv', {classes, psetNames});
        if (!result.totalElements) throw new Error('No matching properties found.');
        download(new Blob(result.parts, {type:'text/csv;charset=utf-8'}), base + '.csv');
        status(`Exported ${result.totalElements} elements.`);
      } else {
        const result = await state.coord.call('psetTable', {classes, psetNames});
        if (!result.totalElements) throw new Error('No matching properties found.');
        const allRows = Object.values(result.classes).flatMap(entry => entry.rows);
        const book = XLSX.utils.book_new();
        if (layout === 'multiple') {
          for (const [cls, entry] of Object.entries(result.classes)) {
            const name = cls.replace(/[\\/?*\[\]:]/g,'_').slice(0,31);
            XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(sheetRows(entry.rows)), name);
          }
        } else XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(sheetRows(allRows)), 'All_Elements');
        XLSX.writeFile(book, `${base}.${format}`, {compression:true});
        status(`Exported ${result.totalElements} elements.`);
      }
    } catch (error) { status(error.message, true); }
    finally { busy(false); }
  };
  const labels = {dropText:'dropText',allClasses:'allClasses',allPsets:'allPsets',exportBtn:'exportBtn',queueRename:'queueRename',queueDelete:'queueDelete',queueInject:'queueInject',generateBtn:'generateBtn',clearQueue:'clearQueue'};
  for (const [id,key] of Object.entries(labels)) $(id).dataset.i18n = key;
  document.querySelectorAll('.tab').forEach(tab => { tab.dataset.i18n = 'tab' + tab.dataset.tab[0].toUpperCase() + tab.dataset.tab.slice(1); });
  document.querySelector('label[for="classSelect"]').dataset.i18n = 'classLabel';
  document.querySelector('label[for="psetSelect"]').dataset.i18n = 'psetLabel';
  document.querySelector('label[for="newName"]').dataset.i18n = 'newNameLabel';
  document.querySelector('label[for="spreadsheetFile"]').dataset.i18n = 'importLabel';
  autoDetectLanguage();
  window.injectUI({showNav:true, transparentNav:false, showSignIn:false, showCategories:true, showNews:false, showHelp:true, showFooter:true, showFooterLinks:true});
  window.injectCookieBanner();
  document.addEventListener('languageLoaded', updateActionState);
  window.loadLanguage(currentLang, window.pageScriptPrefix);
  if (window.lucide) lucide.createIcons();
})();
