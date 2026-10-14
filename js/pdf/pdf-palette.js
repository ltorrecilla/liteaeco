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
// liteAECO - (pdf-palette.js)
// ========






















(function () {
    'use strict';

    const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
    const MOD = IS_MAC ? '⌘' : 'Ctrl';
    const RECENT_KEY = 'liteaeco-palette-recent';
    const MAX_ROWS = 60;

    let cfg = null, root = null, input = null, list = null, foot = null;
    let rows = [], active = 0, lastFocus = null;

    const tt = (k, fb) => (cfg && cfg.t ? cfg.t(k, fb) : fb);

    
    function recents() {
        try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').filter(x => typeof x === 'string'); }
        catch (e) { return []; }
    }
    function remember(id) {
        if (!id || /^smart:/.test(id)) return;
        try {
            const r = recents().filter(x => x !== id);
            r.unshift(id);
            localStorage.setItem(RECENT_KEY, JSON.stringify(r.slice(0, 5)));
        } catch (e) {  }
    }

    
    function cleanLabel(s) {
        return String(s || '').replace(/\s*\((?:Ctrl|Cmd|⌘|Del|Esc|[A-Z])(?:[+ ][^)]*)?\)\s*$/, '').replace(/\s+/g, ' ').trim();
    }
    function fromButton(id, o) {
        o = o || {};
        const el = document.getElementById(id);
        if (!el || el.classList.contains('hidden')) return null;
        const label = o.label || cleanLabel(el.getAttribute('title') || el.textContent);
        if (!label) return null;
        return {
            id: o.id || id,
            label,
            group: o.group || '',
            keys: o.keys || null,
            keywords: o.keywords || '',
            icon: el.querySelector('svg') || o.icon || null,
            run: () => { if (o.before) o.before(); el.click(); },
            enabled: () => {
                if (o.enabled) { const r = o.enabled(); if (r !== true) return r; }
                return !el.disabled;
            },
        };
    }

    
    
    
    function score(text, q) {
        if (!q) return 1;
        text = text.toLowerCase();
        const at = text.indexOf(q);
        if (at === 0) return 1000 - text.length;
        if (at > 0) return (/[\s/·-]/.test(text[at - 1]) ? 800 : 600) - text.length;
        let ti = 0, s = 0, run = 0;
        for (const ch of q) {
            const f = text.indexOf(ch, ti);
            if (f < 0) return 0;
            run = f === ti ? run + 1 : 0;
            s += 1 + run * 2 + (f === 0 || /[\s/·-]/.test(text[f - 1]) ? 3 : 0);
            ti = f + 1;
        }
        return s >= q.length * 3 ? s : 0;
    }
    
    function groupScore(group, q) {
        const g = String(group || '').toLowerCase();
        return g && (g.indexOf(q) === 0 || g.indexOf(' ' + q) > 0) ? 500 : 0;
    }

    
    function build() {
        if (root) return;
        const css = document.createElement('style');
        css.textContent = `
        .pal-root { position: fixed; inset: 0; z-index: 400; display: flex; justify-content: center; align-items: flex-start;
            padding-top: 12vh; background: rgba(15, 23, 42, 0.28); backdrop-filter: blur(1px); }
        .pal-root.hidden { display: none; }
        .pal-box { width: 560px; max-width: calc(100vw - 32px); background: #fff; border-radius: 10px; overflow: hidden;
            box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.06), 0 20px 50px -12px rgba(15, 23, 42, 0.35); font-family: Inter, system-ui, sans-serif; }
        .pal-in-wrap { display: flex; align-items: center; gap: 10px; padding: 0 16px; border-bottom: 1px solid #f1f5f9; }
        .pal-in-wrap svg { flex: 0 0 auto; color: #94a3b8; }
        .pal-in { flex: 1; height: 48px; border: none; outline: none; font-size: 14px; color: #0f172a; background: transparent; }
        .pal-in::placeholder { color: #94a3b8; }
        .pal-list { max-height: min(420px, 56vh); overflow-y: auto; padding: 6px; }
        .pal-group { font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #94a3b8; padding: 10px 10px 4px; }
        .pal-row { display: flex; align-items: center; gap: 10px; width: 100%; padding: 7px 10px; border: none; background: none;
            border-radius: 6px; text-align: left; cursor: pointer; font-size: 13px; color: #1e293b; }
        .pal-row .pal-ic { width: 16px; height: 16px; flex: 0 0 16px; color: #64748b; display: flex; align-items: center; justify-content: center; }
        .pal-row .pal-ic svg { width: 15px; height: 15px; }
        .pal-row .pal-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pal-row .pal-why { font-size: 11px; color: #94a3b8; white-space: nowrap; }
        .pal-row .pal-keys { display: flex; gap: 3px; }
        .pal-row kbd { font: 600 10px Inter, system-ui, sans-serif; color: #64748b; background: #f1f5f9; border-radius: 4px; padding: 2px 5px; min-width: 18px; text-align: center; }
        .pal-row.on { background: #eef2ff; }
        .pal-row.on .pal-ic { color: #4f46e5; }
        .pal-row.off { cursor: default; }
        .pal-row.off .pal-label, .pal-row.off .pal-ic { color: #cbd5e1; }
        .pal-row.off.on { background: #f8fafc; }
        .pal-empty { padding: 18px 12px; font-size: 12px; color: #94a3b8; text-align: center; }
        .pal-foot { display: flex; gap: 14px; padding: 7px 14px; border-top: 1px solid #f1f5f9; font-size: 10px; color: #94a3b8; }
        .pal-foot kbd { font: 600 10px Inter, system-ui, sans-serif; background: #f1f5f9; border-radius: 3px; padding: 1px 4px; margin-right: 3px; }
        @media print { .pal-root { display: none !important; } }`;
        document.head.appendChild(css);

        root = document.createElement('div');
        root.className = 'pal-root hidden';
        root.innerHTML = `
            <div class="pal-box" role="dialog" aria-modal="true">
                <div class="pal-in-wrap">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                    <input class="pal-in" type="text" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="true" aria-controls="pal-list">
                </div>
                <div class="pal-list" id="pal-list" role="listbox"></div>
                <div class="pal-foot"></div>
            </div>`;
        document.body.appendChild(root);
        input = root.querySelector('.pal-in');
        list = root.querySelector('.pal-list');
        foot = root.querySelector('.pal-foot');

        root.addEventListener('mousedown', e => { if (e.target === root) close(); });
        input.addEventListener('input', () => { active = 0; render(); });
        input.addEventListener('keydown', e => {
            e.stopPropagation();   
            if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
            else if (e.key === 'PageDown') { e.preventDefault(); move(8); }
            else if (e.key === 'PageUp') { e.preventDefault(); move(-8); }
            else if (e.key === 'Enter') { e.preventDefault(); runAt(active); }
            else if (e.key === 'Escape') { e.preventDefault(); close(); }
            else if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); close(); }
        });
        list.addEventListener('mousemove', e => {
            const r = e.target.closest('.pal-row');
            if (r && +r.dataset.i !== active) { active = +r.dataset.i; mark(); }
        });
        list.addEventListener('click', e => {
            const r = e.target.closest('.pal-row');
            if (r) runAt(+r.dataset.i);
        });
    }

    function iconNode(icon) {
        const box = document.createElement('span');
        box.className = 'pal-ic';
        if (icon && icon.nodeType === 1) box.appendChild(icon.cloneNode(true));
        else if (typeof icon === 'string' && window.lucide && window.lucide.icons) {
            
            const key = icon.replace(/(^|-)(\w)/g, (m, a, b) => b.toUpperCase());
            const node = window.lucide.icons[key];
            if (node && window.lucide.createElement) {
                try { box.appendChild(window.lucide.createElement(node)); } catch (e) {  }
            }
        }
        return box;
    }

    function availability(c) {
        let r;
        try { r = c.enabled ? c.enabled() : true; } catch (e) { r = false; }
        if (r === true || r === undefined) return { ok: true };
        return { ok: false, why: typeof r === 'string' ? r : '' };
    }

    function collect(q) {
        let cmds = [];
        try { cmds = (cfg.commands() || []).filter(Boolean); } catch (e) { console.warn('[palette] commands failed', e); }
        let smart = [];
        try { smart = q && cfg.smart ? (cfg.smart(q) || []).filter(Boolean) : []; } catch (e) { smart = []; }
        const seen = new Set();
        cmds = cmds.filter(c => !seen.has(c.id) && seen.add(c.id));
        if (!q) {
            const rec = recents(), byId = new Map(cmds.map(c => [c.id, c]));
            const recent = rec.map(id => byId.get(id)).filter(Boolean)
                .map(c => Object.assign({}, c, { group: tt('palRecent', 'Recent'), _recent: true }));
            return recent.concat(cmds);
        }
        const ql = q.toLowerCase();
        const scored = [];
        for (const c of cmds) {
            const s = Math.max(score(c.label, ql), groupScore(c.group, ql), c.keywords ? score(c.keywords, ql) * 0.7 : 0);
            if (s > 0) scored.push({ c, s: s + (availability(c).ok ? 0 : -50) });
        }
        scored.sort((a, b) => b.s - a.s);
        
        
        const flat = (c) => Object.assign({ group: '' }, c, { _flat: true });
        return smart.filter(c => !c.last).map(flat)
            .concat(scored.slice(0, MAX_ROWS).map(x => flat(x.c)))
            .concat(smart.filter(c => c.last).map(flat));
    }

    function render() {
        const q = input.value.trim();
        rows = collect(q).map(c => Object.assign(c, { _av: availability(c) }));
        list.innerHTML = '';
        if (!rows.length) {
            list.innerHTML = '<div class="pal-empty"></div>';
            list.firstChild.textContent = tt('palNoMatch', 'No matching command');
            return;
        }
        if (active >= rows.length) active = rows.length - 1;
        let lastGroup = null;
        const frag = document.createDocumentFragment();
        rows.forEach((c, i) => {
            const g = c._flat ? '' : (c.group || '');
            if (!c._flat && g !== lastGroup) {
                const h = document.createElement('div');
                h.className = 'pal-group';
                h.textContent = g;
                frag.appendChild(h);
                lastGroup = g;
            }
            const r = document.createElement('div');
            r.className = 'pal-row' + (c._av.ok ? '' : ' off');
            r.setAttribute('role', 'option');
            r.id = 'pal-opt-' + i;
            r.dataset.i = String(i);
            r.appendChild(iconNode(c.icon));
            const l = document.createElement('span');
            l.className = 'pal-label';
            l.textContent = c.label;
            r.appendChild(l);
            if (c._flat && c.group) {
                const gg = document.createElement('span');
                gg.className = 'pal-why';
                gg.textContent = c.group;
                r.appendChild(gg);
            }
            if (!c._av.ok) {
                const w = document.createElement('span');
                w.className = 'pal-why';
                w.textContent = c._av.why || tt('palUnavailable', 'Not available now');
                r.appendChild(w);
            } else if (c.keys && c.keys.length) {
                const k = document.createElement('span');
                k.className = 'pal-keys';
                c.keys.forEach(key => {
                    const b = document.createElement('kbd');
                    b.textContent = key === 'Mod' ? MOD : key;
                    k.appendChild(b);
                });
                r.appendChild(k);
            }
            frag.appendChild(r);
        });
        list.appendChild(frag);
        mark();
    }
    function mark() {
        list.querySelectorAll('.pal-row').forEach(r => r.classList.toggle('on', +r.dataset.i === active));
        const cur = list.querySelector('.pal-row.on');
        if (cur) { cur.scrollIntoView({ block: 'nearest' }); input.setAttribute('aria-activedescendant', cur.id); }
    }
    function move(d) {
        if (!rows.length) return;
        active = Math.min(rows.length - 1, Math.max(0, active + d));
        mark();
    }
    function runAt(i) {
        const c = rows[i];
        if (!c || !c._av.ok) return;
        close(true);
        remember(c.id);
        
        setTimeout(() => {
            try { c.run(); } catch (e) { console.error('[palette] command failed', c.id, e); }
        }, 0);
    }

    
    function open() {
        if (!cfg) return;
        build();
        lastFocus = document.activeElement;
        input.value = '';
        input.placeholder = tt('palPlaceholder', 'Type a command, a page number or text to find…');
        foot.innerHTML = '';
        [['↑↓', tt('palNav', 'move')], ['↵', tt('palRun', 'run')], ['Esc', tt('palClose', 'close')]].forEach(([k, l]) => {
            const s = document.createElement('span');
            const b = document.createElement('kbd'); b.textContent = k;
            s.appendChild(b); s.appendChild(document.createTextNode(l));
            foot.appendChild(s);
        });
        active = 0;
        root.classList.remove('hidden');
        render();
        input.focus();
    }
    function close(keepFocus) {
        if (!root || root.classList.contains('hidden')) return;
        root.classList.add('hidden');
        if (!keepFocus && lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) { } }
    }
    const isOpen = () => !!root && !root.classList.contains('hidden');

    function init(options) {
        cfg = options || {};
        if (cfg.button) cfg.button.addEventListener('click', () => (isOpen() ? close() : open()));
        
        document.addEventListener('keydown', e => {
            if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.key === 'k' || e.key === 'K')) {
                e.preventDefault();
                e.stopPropagation();
                if (isOpen()) close(); else open();
            }
        }, true);
    }

    window.PDFV_PALETTE = { init, open, close, isOpen, fromButton, MOD };
})();
