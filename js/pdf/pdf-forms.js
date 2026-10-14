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
// liteAECO - (pdf-forms.js)
// ========





























(function () {
    'use strict';

    const WIDGET = 20;                         
    const HIDE_PREFIX = 'pdfjs_internal_editor_liteHide_';

    let S = null;                              

    
    const kindOf = (d) => d.fieldType === 'Tx' ? 'text'
        : d.fieldType === 'Ch' ? 'choice'
            : d.checkBox ? 'checkbox' : d.radioButton ? 'radio' : d.pushButton ? 'button' : 'other';
    function initialOf(d) {
        const k = kindOf(d);
        if (k === 'checkbox') return !!d.fieldValue && d.fieldValue !== 'Off' && d.fieldValue === d.exportValue;
        if (k === 'radio') return d.fieldValue !== null && d.fieldValue !== undefined && d.fieldValue === d.buttonValue;
        if (k === 'choice') return d.fieldValue;
        return d.fieldValue == null ? '' : d.fieldValue;
    }
    function defaultOf(d) {
        const k = kindOf(d);
        if (k === 'checkbox') return (d.defaultFieldValue || 'Off') === d.exportValue;
        if (k === 'radio') return d.defaultFieldValue != null && d.defaultFieldValue === d.buttonValue;
        if (k === 'choice') return d.defaultFieldValue || '';
        return d.defaultFieldValue == null ? '' : d.defaultFieldValue;
    }
    function norm(v, d) {
        const k = kindOf(d);
        if (k === 'checkbox' || k === 'radio') return v === true || (typeof v === 'string' && v !== 'Off' && v !== '' && v === (k === 'radio' ? d.buttonValue : d.exportValue)) ? '1' : '0';
        if (k === 'choice') return JSON.stringify([].concat(v == null || v === '' ? [] : v).map(String));
        return String(v == null ? '' : v);
    }
    function currentRaw(id) {
        if (!S) return undefined;
        const r = S.storage.getRawValue(id);
        return r && typeof r === 'object' && 'value' in r ? r : undefined;
    }
    function currentOf(id) {
        const r = currentRaw(id);
        return r ? r.value : S.initial.get(id);
    }
    function widgetDirty(id) {
        const d = S.data.get(id), r = currentRaw(id);
        return !!(d && r) && norm(r.value, d) !== S.base.get(id);
    }

    
    function hookStorage(storage) {
        const orig = storage.setValue;
        storage.setValue = function (key, value) {
            orig.call(this, key, value);
            if (S && S.storage === this && typeof key === 'string' && key.indexOf(HIDE_PREFIX) !== 0 && S.data.has(key)) changed(key);
        };
        return () => { storage.setValue = orig; };
    }
    function changed(id) {
        const n = S.pageOf.get(id);
        if (n) {
            clearTimeout(S.redraw.get(n));
            S.redraw.set(n, setTimeout(() => { if (S) S.opts.invalidate(n); }, 220));
        }
        clearTimeout(S.draftTimer);
        S.draftTimer = setTimeout(saveDraft, 500);
        if (S.opts.onChange) S.opts.onChange();
    }

    
    function saveDraft() {
        if (!S || !S.opts.draftKey) return;
        const out = {};
        let n = 0;
        for (const id of S.data.keys()) if (widgetDirty(id)) { out[id] = currentRaw(id); n++; }
        try {
            if (n) localStorage.setItem(S.opts.draftKey, JSON.stringify({ v: 1, values: out }));
            else localStorage.removeItem(S.opts.draftKey);
        } catch (e) {  }
    }
    function readDraft() {
        try {
            const d = JSON.parse(localStorage.getItem(S.opts.draftKey) || 'null');
            return d && d.values && typeof d.values === 'object' ? d.values : null;
        } catch (e) { return null; }
    }

    
    async function startScripting() {
        const C = window.PDFV_CORE;
        if (!C || !C.sandboxUrl) return null;
        const doc = S.doc;
        const mod = await import(C.sandboxUrl());
        const make = mod.QuickJSSandbox || (globalThis.pdfjsSandbox && globalThis.pdfjsSandbox.QuickJSSandbox);
        const sandbox = await make(new URL(C.wasmUrl, document.baseURI).href);
        const [objects, calculationOrder, actions, md] = await Promise.all([
            doc.getFieldObjects(), doc.getCalculationOrderIds(), doc.getJSActions(), doc.getMetadata().catch(() => ({})),
        ]);
        if (!S || S.doc !== doc) { try { sandbox.nukeSandbox(); } catch (e) { } return null; }
        const meta = md && md.metadata;
        sandbox.create({
            objects, calculationOrder,
            appInfo: { platform: navigator.platform, language: navigator.language },
            docInfo: Object.assign({}, (md && md.info) || {}, {
                baseURL: '', URL: '', filename: S.opts.fileName || '', filesize: S.opts.bytes ? S.opts.bytes.byteLength : 0,
                metadata: meta && meta.getRaw ? meta.getRaw() : undefined,
                authors: meta && meta.get ? meta.get('dc:creator') : undefined,
                numPages: doc.numPages, actions,
            }),
        });
        return sandbox;
    }
    function toSandbox(detail) {
        if (!S || !S.sandbox) return;
        const sb = S.sandbox;
        setTimeout(() => { try { sb.dispatchEvent(detail); } catch (e) { console.warn('[forms] sandbox event failed', e); } }, 0);
    }
    function onSandboxUpdate(event) {
        if (!S || !S.sandbox) return;
        const detail = Object.assign({}, event.detail || {});
        const { id, siblings, command, value } = detail;
        if (!id) {
            const nav = S.opts.onPageNav || {};
            switch (command) {
                case 'page-num': S.opts.goToPage(value + 1); break;
                case 'FirstPage': nav.first && nav.first(); break;
                case 'LastPage': nav.last && nav.last(); break;
                case 'NextPage': nav.next && nav.next(); break;
                case 'PrevPage': nav.prev && nav.prev(); break;
                case 'println': console.log('[pdf script]', value); break;
                case 'error': console.error('[pdf script]', value); break;
                default: break;   
            }
            return;
        }
        delete detail.id;
        delete detail.siblings;
        for (const eid of siblings ? [id, ...siblings] : [id]) {
            const el = document.querySelector('[data-element-id="' + eid + '"]');
            if (el) el.dispatchEvent(new CustomEvent('updatefromsandbox', { detail }));
            else S.storage.setValue(eid, detail);
        }
    }
    async function pageOpen(n) {
        if (!S || !S.sandbox || S.opened.has(n)) return;
        S.opened.add(n);
        let actions = null;
        try { actions = await (await S.doc.getPage(n)).getJSActions(); } catch (e) { }
        toSandbox({ id: 'page', name: 'PageOpen', pageNumber: n, actions });
    }

    
    function linkService() {
        return {
            eventBus: {
                dispatch: (name, payload) => { if (name === 'dispatcheventinsandbox' && payload) toSandbox(payload.detail); },
                on() { }, off() { }, _on() { }, _off() { },
            },
            externalLinkTarget: 0, externalLinkRel: 'noopener noreferrer nofollow', externalLinkEnabled: false,
            isInPresentationMode: false,
            get pagesCount() { return S ? S.opts.numPages : 0; },
            get page() { return 1; }, set page(v) { if (S) S.opts.goToPage(v); },
            get rotation() { return 0; },
            addLinkAttributes() { }, getDestinationHash: () => '#', getAnchorUrl: () => '#',
            goToDestination() { }, goToPage(n) { if (S) S.opts.goToPage(n); }, navigateTo() { },
            executeNamedAction() { }, executeSetOCGState() { }, getAttachmentContent: async () => null,
        };
    }
    async function renderLayer(n) {
        const L = S.layers.get(n);
        if (!L) return;
        const page = await S.doc.getPage(n);
        const rot = (page.rotate + (S.opts.rotation ? S.opts.rotation() : 0)) % 360;
        const viewport = page.getViewport({ scale: 1, rotation: rot }).clone({ dontFlip: true });
        L.div.replaceChildren();
        const layer = new window.pdfjsLib.AnnotationLayer({
            div: L.div, page, viewport, linkService: S.link, annotationStorage: S.storage,
            accessibilityManager: null, annotationCanvasMap: null, annotationEditorUIManager: null,
            structTreeLayer: null, commentManager: null,
        });
        await layer.render({
            annotations: L.widgets, viewport, div: L.div, page, linkService: S.link,
            renderForms: true, annotationStorage: S.storage,
            enableScripting: !!S.sandbox, hasJSActions: S.hasJS, fieldObjects: S.fieldObjects,
            imageResourcesPath: '', downloadManager: null,
        });
        L.layer = layer;
    }
    function mountLayers() {
        for (const [n, L] of S.layers) {
            const wrap = S.opts.wrapOf(n);
            if (!wrap) continue;
            if (L.div.parentNode !== wrap) wrap.appendChild(L.div);
        }
    }

    
    async function attach(opts) {
        detach();
        const doc = opts.doc;
        let fieldObjects = null;
        try { fieldObjects = await doc.getFieldObjects(); } catch (e) { fieldObjects = null; }
        if (!fieldObjects) return { count: 0 };
        
        const pages = new Set();
        for (const name in fieldObjects) {
            for (const w of fieldObjects[name] || []) {
                if (w && w.type !== 'signature' && w.page >= 0) pages.add(w.page + 1);
            }
        }
        if (!pages.size) return { count: 0 };

        S = {
            doc, opts, fieldObjects, storage: doc.annotationStorage,
            data: new Map(), pageOf: new Map(), initial: new Map(), base: new Map(),
            layers: new Map(), redraw: new Map(), opened: new Set(),
            sandbox: null, hasJS: false, draftTimer: 0, unhook: null, link: null, hl: true,
        };
        S.link = linkService();
        for (const n of [...pages].sort((a, b) => a - b)) {
            const page = await doc.getPage(n);
            let anns = [];
            try { anns = await page.getAnnotations({ intent: 'display' }); } catch (e) { anns = []; }
            const widgets = anns.filter(a => a.annotationType === WIDGET && a.fieldType && a.fieldType !== 'Sig' && !a.noHTML);
            if (!widgets.length) continue;
            for (const w of widgets) {
                S.data.set(w.id, w);
                S.pageOf.set(w.id, n);
                S.initial.set(w.id, initialOf(w));
                S.base.set(w.id, norm(initialOf(w), w));
            }
            const div = document.createElement('div');
            div.className = 'annotationLayer pdfv-forms';
            div.dataset.page = String(n);
            S.layers.set(n, { div, widgets, layer: null });
        }
        if (!S.data.size) { S = null; return { count: 0 }; }
        if (!S) return { count: 0 };
        S.unhook = hookStorage(S.storage);

        
        let restored = 0;
        const draft = opts.draftKey ? readDraft() : null;
        if (draft) {
            for (const id in draft) {
                if (S.data.has(id) && draft[id] && typeof draft[id] === 'object') { S.storage.setValue(id, draft[id]); restored++; }
            }
        }

        try { S.hasJS = !!(await doc.hasJSActions()); } catch (e) { S.hasJS = false; }
        if (S.hasJS) {
            try {
                S.sandbox = await startScripting();
                if (S && S.sandbox) {
                    S.onUpdate = onSandboxUpdate;
                    window.addEventListener('updatefromsandbox', S.onUpdate);
                }
            } catch (e) {
                console.warn('[forms] form scripts disabled:', e);
                if (S) S.sandbox = null;
            }
        }
        if (!S) return { count: 0 };
        for (const n of S.layers.keys()) {
            try { await renderLayer(n); } catch (e) { console.warn('[forms] layer ' + n + ' failed', e); }
        }
        if (!S) return { count: 0 };
        mountLayers();
        S.opts.stack && S.opts.stack.classList.toggle('forms-hl', S.hl);
        if (S.sandbox) {
            toSandbox({ id: 'doc', name: 'Open' });
            pageOpen(1);
        }
        if (restored) for (const n of S.layers.keys()) S.opts.invalidate(n);
        const fields = list();
        return { count: fields.length, required: fields.filter(f => f.required).length, hasJS: S.hasJS, scripts: !!S.sandbox, restored };
    }
    function detach() {
        if (!S) return;
        const s = S;
        S = null;
        clearTimeout(s.draftTimer);
        for (const t of s.redraw.values()) clearTimeout(t);
        if (s.unhook) s.unhook();
        if (s.onUpdate) window.removeEventListener('updatefromsandbox', s.onUpdate);
        if (s.sandbox) {
            try { s.sandbox.dispatchEvent({ id: 'doc', name: 'WillClose' }); } catch (e) { }
            try { s.sandbox.nukeSandbox(); } catch (e) { }
        }
        for (const L of s.layers.values()) L.div.remove();
        if (s.opts.stack) s.opts.stack.classList.remove('forms-hl');
    }

    
    function list() {
        if (!S) return [];
        const by = new Map();
        for (const [id, d] of S.data) {
            const name = d.fieldName || id;
            if (!by.has(name)) by.set(name, { name, label: d.alternativeText || d.fieldName || id, kind: kindOf(d), page: S.pageOf.get(id), ids: [], required: !!d.required, readOnly: !!d.readOnly });
            const f = by.get(name);
            f.ids.push(id);
            f.required = f.required || !!d.required;
            f.readOnly = f.readOnly && !!d.readOnly;
        }
        const out = [];
        for (const f of by.values()) {
            if (f.kind === 'button') continue;
            f.value = displayValue(f);
            f.empty = f.value === '';
            f.dirty = f.ids.some(widgetDirty);
            out.push(f);
        }
        return out.sort((a, b) => a.page - b.page || pos(a) - pos(b));
    }
    function pos(f) {   
        const r = S.data.get(f.ids[0]).rect;
        return -r[3] * 10000 + r[0];
    }
    function displayValue(f) {
        if (f.kind === 'checkbox') return f.ids.some(id => norm(currentOf(id), S.data.get(id)) === '1') ? '✓' : '';
        if (f.kind === 'radio') {
            const on = f.ids.find(id => norm(currentOf(id), S.data.get(id)) === '1');
            return on ? String(S.data.get(on).buttonValue || '●') : '';
        }
        const id = f.ids[0], raw = currentRaw(id);
        let v = raw ? (raw.formattedValue != null ? raw.formattedValue : raw.value) : S.initial.get(id);
        if (f.kind === 'choice') {
            const d = S.data.get(id);
            const lab = (x) => { const o = (d.options || []).find(o => o.exportValue === x); return o ? o.displayValue : x; };
            v = [].concat(v == null ? [] : v).filter(x => x !== '').map(lab).join(', ');
        }
        return v == null ? '' : String(v);
    }
    const count = () => list().length;
    function dirtyCount() {
        if (!S) return 0;
        const names = new Set();
        for (const id of S.data.keys()) if (widgetDirty(id)) names.add(S.data.get(id).fieldName || id);
        return names.size;
    }

    
    function focusField(name) {
        if (!S) return;
        const f = list().find(x => x.name === name);
        if (!f) return;
        S.opts.goToPage(f.page);
        const id = f.ids[0];
        setTimeout(() => {
            const el = document.querySelector('[data-element-id="' + id + '"]');
            if (!el) return;
            el.scrollIntoView({ block: 'center', inline: 'nearest' });
            if (!el.disabled) el.focus({ preventScroll: true });
            el.closest('section') && el.closest('section').animate(
                [{ boxShadow: '0 0 0 3px rgba(79,70,229,.55)' }, { boxShadow: '0 0 0 3px rgba(79,70,229,0)' }],
                { duration: 900 });
        }, 120);
    }
    
    function nextEmpty(requiredOnly) {
        if (!S) return null;
        const fields = list().filter(f => f.empty && !f.readOnly && (!requiredOnly || f.required));
        if (!fields.length) return null;
        const act = document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute('data-element-id');
        const all = list();
        const curIdx = act ? all.findIndex(f => f.ids.includes(act)) : -1;
        const next = fields.find(f => all.indexOf(f) > curIdx) || fields[0];
        focusField(next.name);
        return next;
    }
    function clear() {
        if (!S) return;
        for (const [id, d] of S.data) {
            if (d.readOnly || kindOf(d) === 'button') continue;
            S.storage.setValue(id, { value: defaultOf(d), formattedValue: null });
            const el = document.querySelector('[data-element-id="' + id + '"]');
            if (el) el.dispatchEvent(new Event('resetform'));
        }
        if (S.sandbox) toSandbox({ id: 'doc', name: 'Calculate' });
    }
    function setHighlight(on) {
        if (!S) return;
        S.hl = !!on;
        if (S.opts.stack) S.opts.stack.classList.toggle('forms-hl', S.hl);
    }
    async function relayout() {
        if (!S) return;
        for (const n of S.layers.keys()) { try { await renderLayer(n); } catch (e) { } }
    }
    function pageChanged(prev, next) {
        if (!S || !S.sandbox || prev === next) return;
        if (prev) toSandbox({ id: 'page', name: 'PageClose', pageNumber: prev });
        S.opened.delete(next);
        pageOpen(next);
    }

    
    
    
    async function bytesWithValues(bytes) {
        if (!S) return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
        const pdfjsLib = window.pdfjsLib;
        const src = new Uint8Array(bytes instanceof ArrayBuffer ? bytes : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
        const C = window.PDFV_CORE;
        const task = pdfjsLib.getDocument({ data: src.slice(), isEvalSupported: false, wasmUrl: C && C.wasmUrl ? new URL(C.wasmUrl, document.baseURI).href : undefined });
        const d2 = await task.promise;
        try {
            if (S.sandbox) { try { S.sandbox.dispatchEvent({ id: 'doc', name: 'WillSave' }); } catch (e) { } }
            let n = 0;
            for (const id of S.data.keys()) {
                const raw = currentRaw(id);
                if (raw) { d2.annotationStorage.setValue(id, JSON.parse(JSON.stringify(raw))); n++; }
            }
            if (!n) return src;
            const out = await d2.saveDocument();
            return out instanceof Uint8Array ? out : new Uint8Array(out);
        } finally {
            try { await d2.destroy(); } catch (e) { }
        }
    }
    
    function markSaved() {
        if (!S) return;
        for (const [id, d] of S.data) {
            const r = currentRaw(id);
            if (r) S.base.set(id, norm(r.value, d));
        }
        try { if (S.opts.draftKey) localStorage.removeItem(S.opts.draftKey); } catch (e) { }
        if (S.sandbox) toSandbox({ id: 'doc', name: 'DidSave' });
        if (S.opts.onChange) S.opts.onChange();
    }

    window.PDFV_FORMS = {
        attach, detach, list, count, dirtyCount, focusField, nextEmpty, clear,
        setHighlight, highlight: () => !!(S && S.hl), relayout, pageChanged,
        bytesWithValues, markSaved,
        hasForm: () => !!S,
        scripts: () => !!(S && S.sandbox),
    };
})();
