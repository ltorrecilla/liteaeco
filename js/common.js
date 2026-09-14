window.handleCookieChoice = function (choice) {
    localStorage.setItem('cookieConsent', choice);
    const banner = document.getElementById('cookie-banner');
    if (banner) banner.remove();
    if (choice === 'declined') {
        window['ga-disable-G-WF672S6T88'] = true;
        if (window._paq) {
            _paq.push(['forgetConsentGiven']);
            _paq.push(['optUserOut']);
        }
    } else if (choice === 'accepted') {
        window['ga-disable-G-WF672S6T88'] = false;
    }
};
window.handleCookieChoice = function (choice) {
    localStorage.setItem('cookieConsent', choice);
    const banner = document.getElementById('cookie-banner');
    if (banner) banner.remove();
    if (choice === 'declined' && window._paq) {
        _paq.push(['forgetConsentGiven']);
        _paq.push(['optUserOut']);
    }
};
window.isHighPerformance = function () {
    let isHighPerf = true;
    if (navigator.deviceMemory && navigator.deviceMemory < 8) {
        isHighPerf = false;
    }
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) {
        isHighPerf = false;
    }
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
        isHighPerf = true;
    }
    return isHighPerf;
};
function getAutoPagePrefix() {
    const path = window.location.pathname;
    const filename = path.split('/').pop();
    if (!filename || !filename.endsWith('.html') || filename.toLowerCase() === 'index.html') {
        return '';
    }
    let cleanName = filename.replace('.html', '');
    cleanName = cleanName.replace(/^LiteAEC-/i, '').replace(/^liteAECO-/i, '');
    return cleanName.toLowerCase();
}
window.pageScriptPrefix = getAutoPagePrefix();
const BASE_GLOBAL = JSON.parse(JSON.stringify(window.GLOBAL_I18N || {}));
let currentLang = localStorage.getItem('liteAECOLang') || 'en';
const CATEGORIES = [
    { id: 'all', label: 'ALL' },
    { id: 'pm', label: 'PM' },
    { id: 'data', label: 'DATA' },
    { id: 'bim', label: 'VDC / BIM' },
    { id: 'ops', label: 'OPERATIONS' },
];
const APPS = [
    { id: 2, skipModal: false, icon: 'calendars', categories: ['ops', 'pm'], url: window.SITE_ROOT + 'tools/project-portfolio.html' },
    { id: 26, skipModal: false, icon: 'file-text', categories: ['ops'], url: window.SITE_ROOT + 'tools/pdf-viewer.html' },
    { id: 11, skipModal: false, icon: 'box', categories: ['bim'], url: window.SITE_ROOT + 'tools/ifc-audit.html' },
    { id: 3, skipModal: false, icon: 'file-badge', categories: ['data', 'bim'], url: window.SITE_ROOT + 'tools/ids-generator.html' },
    { id: 1, skipModal: false, icon: 'chart-bar', categories: ['pm', 'ops'], url: window.SITE_ROOT + 'tools/project-timeline.html', imageUrl: window.SITE_ROOT + 'img/tools/timeline.webp' },
    { id: 17, skipModal: false, icon: 'user-group', categories: ['pm', 'ops'], url: window.SITE_ROOT + 'tools/organizational-chart.html', imageUrl: window.SITE_ROOT + 'img/tools/org-chart.webp' },
    { id: 12, skipModal: false, icon: 'list-todo', categories: ['pm'], url: window.SITE_ROOT + 'tools/meetings.html', imageUrl: window.SITE_ROOT + 'img/tools/meetings.webp' },
    { id: 13, skipModal: false, icon: 'table-2', categories: ['pm'], url: window.SITE_ROOT + 'tools/responsibility-matrix.html' },
    { id: 21, skipModal: false, icon: 'file-search', categories: ['ops'], url: window.SITE_ROOT + 'tools/contract-obligations.html' },
    { id: 20, skipModal: false, icon: 'triangle-alert', categories: ['ops'], url: window.SITE_ROOT + 'tools/incident-rca.html' },
    { id: 18, skipModal: false, icon: 'zap', categories: ['bim'], url: window.SITE_ROOT + 'tools/ifc-optimizer.html' },
    { id: 4, skipModal: false, icon: 'merge', rotation: 90, categories: ['bim'], url: window.SITE_ROOT + 'tools/ifc-merger.html' },
    { id: 22, skipModal: false, icon: 'chart-spline', categories: ['pm'], url: window.SITE_ROOT + 'tools/monte-carlo-simulator.html' },
    { id: 8, skipModal: false, icon: 'square-arrow-right-exit', categories: ['data'], url: window.SITE_ROOT + 'tools/ifc-pset-export.html' },
    { id: 9, skipModal: false, icon: 'square-arrow-right-enter', rotation: 180, categories: ['data'], url: window.SITE_ROOT + 'tools/ifc-inject-properties.html' },
    { id: 16, skipModal: false, icon: 'combine', rotation: 180, categories: ['data'], url: window.SITE_ROOT + 'tools/data-merger.html' },
    { id: 6, skipModal: false, icon: 'spell-check-2', categories: ['bim'], url: window.SITE_ROOT + 'tools/ifc-pset-renamer.html' },
    { id: 7, skipModal: false, icon: 'shredder', categories: ['bim'], url: window.SITE_ROOT + 'tools/ifc-pset-delete.html' },
    { id: 5, skipModal: false, icon: 'app-window-mac', categories: ['bim'], url: window.SITE_ROOT + 'tools/ifc-application-changer.html' },
    { id: 10, skipModal: false, icon: 'map-pin', categories: ['bim'], url: window.SITE_ROOT + 'tools/ifc-reposition.html' },
    { id: 24, skipModal: false, icon: 'drafting-compass', categories: ['ops'], url: window.SITE_ROOT + 'tools/dxf-editor.html' },
    { id: 25, skipModal: false, icon: 'columns-2', categories: ['ops'], url: window.SITE_ROOT + 'tools/dxf-compare.html' },
    { id: 23, skipModal: false, icon: 'equal-not', categories: ['bim'], url: window.SITE_ROOT + 'tools/ifc-compare.html' }, 
];
let activeCategory = 'all';
const LANGS = ['en', 'de', 'es', 'fr', 'pt', 'it', 'ko', 'ja', 'zh']; 
const LANG_NAMES = {
    en: 'English', de: 'German', es: 'Spanish', fr: 'French',
    pt: 'Portuguese', it: 'Italian', ko: 'Korean', ja: 'Japanese', zh: 'Chinese'
};
function setLangLabel(code) {
    const label = document.getElementById('langToggleLabel');
    if (label) label.textContent = (code || 'en').toUpperCase();
}
function renderLangMenu() {
    const menu = document.getElementById('langMenu');
    if (!menu) return;
    menu.innerHTML = LANGS.map(code => {
        const upper = code.toUpperCase();
        const name = LANG_NAMES[code] || upper;
        const selected = code === currentLang;
        return `<li role="option" data-value="${code}" aria-selected="${selected}"
            class="px-3 py-1.5 text-[12px] font-semibold text-slate-700 cursor-pointer hover:bg-indigo-50 whitespace-nowrap flex items-center justify-between gap-4 ${selected ? 'bg-indigo-50 text-indigo-700' : ''}">
            <span><span class="text-slate-400">${upper}</span> - ${name}</span>
        </li>`;
    }).join('');
}
function openLangMenu() {
    const btn = document.getElementById('langToggle');
    const menu = document.getElementById('langMenu');
    if (!btn || !menu) return;
    renderLangMenu();
    menu.classList.remove('hidden');
    btn.setAttribute('aria-expanded', 'true');
}
function closeLangMenu() {
    const btn = document.getElementById('langToggle');
    const menu = document.getElementById('langMenu');
    if (!menu || menu.classList.contains('hidden')) return;
    menu.classList.add('hidden');
    if (btn) btn.setAttribute('aria-expanded', 'false');
}
function selectLang(code) {
    if (!code || !LANGS.includes(code)) return;
    closeLangMenu();
    if (code === currentLang) return;
    currentLang = code;
    setLangLabel(code);
    localStorage.setItem('liteAECOLang', code);
    window.loadLanguage(code, window.pageScriptPrefix);
}
let langRequestSeq = 0;
let activeGlobalSnapshot = null;
let activePageSnapshot = null;
window.loadLanguage = function (lang, pageScriptPrefix) {
    const seq = ++langRequestSeq;
    window.GLOBAL_I18N = { ...BASE_GLOBAL, categories: { ...BASE_GLOBAL.categories }, apps: { ...BASE_GLOBAL.apps } };
    if (window.BASE_PAGE) window.PAGE_I18N = { ...window.BASE_PAGE };
    ['dynamic-global-lang', 'dynamic-page-lang'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
    });
    const loadScript = (id, src, key) => new Promise((resolve) => {
        const script = document.createElement('script');
        script.id = id;
        script.src = src;
        script.onload = () => resolve({ ok: true, key, snapshot: window[key] });
        script.onerror = () => {
            console.warn(`Translation file missing: ${src} (Falling back to English for these strings)`);
            resolve({ ok: false, key });
        };
        document.body.appendChild(script);
    });
    const rootPath = window.SITE_ROOT || './';
    const scriptsToLoad = [loadScript('dynamic-global-lang', `${rootPath}lang/${lang}/global.js`, 'GLOBAL_I18N')];
    if (pageScriptPrefix) {
        scriptsToLoad.push(loadScript('dynamic-page-lang', `${rootPath}lang/${lang}/${pageScriptPrefix}.js`, 'PAGE_I18N'));
    }
    Promise.all(scriptsToLoad).then((results) => {
        if (seq !== langRequestSeq) {
            if (activeGlobalSnapshot) window.GLOBAL_I18N = activeGlobalSnapshot;
            if (activePageSnapshot) window.PAGE_I18N = activePageSnapshot;
            return;
        }
        results.forEach(r => {
            if (r.ok && r.snapshot) window[r.key] = r.snapshot;
        });
        const anySuccess = results.some(res => res.ok === true);
        if (anySuccess) {
            activeGlobalSnapshot = window.GLOBAL_I18N;
            activePageSnapshot = window.PAGE_I18N;
            applyLanguage();
        } else {
            console.warn(`No translation files found for ${lang}. Reverting fully to English.`);
            if (lang !== 'en') {
                currentLang = 'en';
                localStorage.setItem('liteAECOLang', 'en');
                setLangLabel('en');
                window.loadLanguage('en', pageScriptPrefix);
            } else {
                activeGlobalSnapshot = window.GLOBAL_I18N;
                activePageSnapshot = window.PAGE_I18N;
                applyLanguage();
            }
        }
    });
};
function autoDetectLanguage() {
    if (!localStorage.getItem('liteAECOLang')) {
        const browserLangFull = navigator.language || 'en';
        const browserLang = browserLangFull.split('-')[0].toLowerCase();
        currentLang = LANGS.includes(browserLang) ? browserLang : 'en';
        localStorage.setItem('liteAECOLang', currentLang);
    }
    setLangLabel(currentLang);
}
function getTranslations() {
    const curGlobal = window.GLOBAL_I18N || {};
    const curPage = window.PAGE_I18N || {};
    const basePage = window.BASE_PAGE || {};
    const merged = {
        ...BASE_GLOBAL,
        ...basePage,
        ...curGlobal,
        ...curPage,
        categories: { ...BASE_GLOBAL.categories, ...(curGlobal.categories || {}) }
    };
    merged.apps = {};
    for (const appId in BASE_GLOBAL.apps) {
        merged.apps[appId] = {
            ...BASE_GLOBAL.apps[appId],
            ...curGlobal.apps?.[appId]
        };
    }
    return merged;
}
window.t = function (key) {
    const d = typeof getTranslations === 'function' ? getTranslations() : (window.PAGE_I18N || {});
    return d[key] !== undefined ? d[key] : key;
};
function applyLanguage() {
    const d = typeof getTranslations === 'function' ? getTranslations() : window.PAGE_I18N;
    if (!d) return;
    document.documentElement.lang = currentLang;
    if (d.title) document.title = d.title;
    const kebabToCamel = (str) => str.replace(/-([a-z0-9])/ig, (g) => g[1].toUpperCase());
    const applyTranslation = (el, dictKey) => {
        if (d[dictKey] !== undefined) {
            if (el.tagName === 'INPUT' && el.hasAttribute('placeholder')) {
                el.placeholder = d[dictKey];
            } else {
                el.innerHTML = d[dictKey];
            }
        }
    };
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        applyTranslation(el, key);
    });
    document.querySelectorAll('[id^="ui-"]').forEach(el => {
        if (!el.hasAttribute('data-i18n')) {
            const baseId = el.id.substring(3);
            const dictKey = kebabToCamel(baseId);
            applyTranslation(el, dictKey);
        }
    });
    if (typeof renderNav === 'function') renderNav();
    if (typeof window.updateToolDynamicUI === 'function') {
        window.updateToolDynamicUI(d);
    }
    document.dispatchEvent(new Event('languageLoaded'));
    if (window.lucide) lucide.createIcons();
}
window._uiLinkTarget = null;
function applyUiLinkTarget(root) {
    if (!window._uiLinkTarget || !root) return;
    root.querySelectorAll('a[href]').forEach(a => {
        if (a.hasAttribute('target')) return;
        const href = a.getAttribute('href') || '';
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
        a.target = window._uiLinkTarget;
        a.rel = 'noopener noreferrer';
    });
}
window.injectUI = function (options = {}) {
    if (typeof options.linkTarget === 'string' && options.linkTarget) window._uiLinkTarget = options.linkTarget;
    const showSignIn = options.showSignIn !== false;
    const showCategories = options.showCategories !== false;
    const showNav = options.showNav !== false;
    const showHelp = options.showHelp !== false;
    const showNews = options.showNews !== false;
    const showDonation = options.showDonation !== true;
    window._showDonation = showDonation;
    const logoHref = (typeof options.logoHref === 'string' && options.logoHref)
        ? options.logoHref
        : `${window.SITE_ROOT}index.html`;
    const logoTarget = (typeof options.logoTarget === 'string' && options.logoTarget)
        ? ` target="${options.logoTarget}" rel="noopener noreferrer"`
        : '';
    const showFooter = options.showFooter !== false;
    const showFooterLinks = options.showFooterLinks !== false;
    const showFooterBottom = options.showFooterBottom !== false;
    if (showNav) {
        const nav = document.createElement('nav');
        let useTransparency;
        if (typeof options.transparentNav === 'boolean') {
            useTransparency = options.transparentNav; 
        } else {
            useTransparency = window.isHighPerformance(); 
        }
        const navBgClass = useTransparency
            ? "bg-white/80 backdrop-blur-md border-slate-50"
            : "bg-white border-slate-200"; 
        nav.className = `fixed top-0 left-0 right-0 z-[150] transition-all duration-300 border-b shadow-[0_4px_30px_rgba(0,0,0,0.03)] ${navBgClass}`;
        nav.innerHTML = `
            <div class="mx-auto px-4 md:px-8 h-12 flex items-center justify-between">
            <a href="${logoHref}"${logoTarget} class="flex items-center gap-3 cursor-pointer group">
                    <svg class="w-6 h-6 shadow-logo" xmlns="http:
                        <defs>
                            <linearGradient id="b"><stop offset="0" stop-color="#b6b6f7" /><stop offset="1" stop-color="#487af2" /></linearGradient>
                            <linearGradient id="a"><stop offset="0" stop-color="#6266f1" /><stop offset="1" stop-color="#2763ec" /></linearGradient>
                            <linearGradient href="#a" id="c" x1="73.9" x2="128.9" y1="78.9" y2="144.5" gradientTransform="matrix(.8 0 0 .8 -45 -53)" gradientUnits="userSpaceOnUse" />
                            <linearGradient href="#b" id="d" x1="122.8" x2="122.8" y1="90.3" y2="133.1" gradientTransform="matrix(.8 0 0 .8 -45 -53)" gradientUnits="userSpaceOnUse" />
                        </defs>
                        <path fill="url(#c)" d="m0 0 66 66H33L0 33Z" />
                        <path fill="url(#d)" d="M33 33 66 0v66z" />
                    </svg>
                    <span class="font-semibold text-lg tracking-tight text-slate-900">liteAECO</span>
                </a>
                ${showCategories ? `<div id="desktop-nav" class="hidden md:flex items-center h-full"></div>` : ''}
                <div class="hidden md:flex items-center gap-3 h-full">
                    ${showNews ? `
                    <a href="https:
                        News
                    </a>` : ''}
                    <div id="langToggleWrap" class="relative">
                        <button id="langToggle" type="button" aria-haspopup="listbox" aria-expanded="false"
                            class="flex items-center gap-1 bg-white/50 backdrop-blur-sm border border-slate-200 text-slate-700 text-[12px] rounded focus:outline-none focus:ring-2 focus:ring-indigo-500/50 py-1 px-2 cursor-pointer font-semibold uppercase tracking-wide transition-colors hover:bg-white/80">
                            <span id="langToggleLabel">EN</span>
                            <svg class="w-3 h-3 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
                        </button>
                        <ul id="langMenu" role="listbox" tabindex="-1"
                            class="hidden absolute right-0 font-mono mt-1 min-w-[10rem] bg-white border border-slate-200 rounded shadow-xl py-1 z-[200] max-h-[60vh] overflow-auto"></ul>
                    </div>
                    ${showSignIn ? `
                    <div class="border-l border-slate-200 pl-3 ml-1">
                        <a href="${window.SITE_ROOT}info/login.html" id="ui-nav-signin" data-i18n="signIn" class="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-widest transition-all duration-300 rounded-none inline-block">Sign In</a>
                    </div>` : ''}
                </div>
                ${showCategories ? `
                <button id="mobile-menu-toggle" class="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-none transition-colors">
                    <i data-lucide="menu"></i>
                </button>` : ''}
            </div>
            ${showCategories ? `
            <div id="mobile-menu" class="hidden md:hidden bg-white border-b border-slate-200 absolute top-full w-full left-0 shadow-lg max-h-[calc(100vh-3rem)] overflow-y-auto overscroll-contain">
                <div id="mobile-nav" class="flex flex-col"></div>
            </div>` : ''}
        `;
        document.body.insertBefore(nav, document.body.firstChild);
        const langToggle = document.getElementById('langToggle');
        const langMenu = document.getElementById('langMenu');
        if (langToggle && langMenu) {
            setLangLabel(currentLang);
            langToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                langMenu.classList.contains('hidden') ? openLangMenu() : closeLangMenu();
            });
            langMenu.addEventListener('click', (e) => {
                const li = e.target.closest('[data-value]');
                if (li) selectLang(li.getAttribute('data-value'));
            });
            document.addEventListener('click', (e) => {
                if (!e.target.closest('#langToggleWrap')) closeLangMenu();
            });
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') closeLangMenu();
            });
        }
        const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
        if (mobileMenuToggle) {
            mobileMenuToggle.addEventListener('click', () => window.toggleMobileMenu());
        }
        if (showHelp && typeof setupHelpButton === 'function') {
            setupHelpButton();
        }
        if (typeof renderNav === 'function') renderNav();
        applyUiLinkTarget(nav);
    }
    window.toggleMobileMenu = function () {
        const mobileMenu = document.getElementById('mobile-menu');
        if (mobileMenu) {
            mobileMenu.classList.toggle('hidden');
            mobileMenu.classList.toggle('md:hidden');
        }
    };
    if (showFooter) {
        const footer = document.createElement('footer');
        const ptClass = showFooterLinks ? "pt-4" : "pt-4";
        footer.className = `mt-auto relative z-10 border-t border-slate-200 bg-slate-50-50 pb-4 px-4 md:px-8 ${ptClass}`;
        let footerHTML = '';
        if (showFooterLinks) {
            footerHTML += `
            <div class="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 pt-4 pb-4 mb-4 border-b border-slate-200">
                <div class="col-span-1 md:col-span-2">
                    <div class="flex items-center gap-3 mb-6">
                        <svg class="w-6 h-6 shadow-logo" xmlns="http:
                            <defs>
                                <linearGradient id="b"><stop offset="0" stop-color="#b6b6f7" /><stop offset="1" stop-color="#487af2" /></linearGradient>
                                <linearGradient id="a"><stop offset="0" stop-color="#6266f1" /><stop offset="1" stop-color="#2763ec" /></linearGradient>
                                <linearGradient href="#a" id="c" x1="73.9" x2="128.9" y1="78.9" y2="144.5" gradientTransform="matrix(.8 0 0 .8 -45 -53)" gradientUnits="userSpaceOnUse" />
                                <linearGradient href="#b" id="d" x1="122.8" x2="122.8" y1="90.3" y2="133.1" gradientTransform="matrix(.8 0 0 .8 -45 -53)" gradientUnits="userSpaceOnUse" />
                            </defs>
                            <path fill="url(#c)" d="m0 0 66 66H33L0 33Z" />
                            <path fill="url(#d)" d="M33 33 66 0v66z" />
                        </svg>
                        <span class="font-semibold text-lg tracking-tight text-slate-900">liteAECO</span>
                    </div>
                    <p id="ui-footer-desc" data-i18n="footerDesc" class="text-slate-600 text-sm max-w-sm leading-relaxed">
                        Free tools for AEC project teams. Built with a focus on speed, utility, and operational clarity.
                    </p>
                </div>
                <div>
                    <h4 id="ui-footer-legal" data-i18n="footerLegal" class="font-semibold text-slate-900 text-sm mb-4 uppercase tracking-widest">Legal</h4>
                    <ul class="space-y-3 text-sm text-slate-600">
                        <li><a href="${window.SITE_ROOT}info/terms-of-service.html" id="ui-link-terms" data-i18n="linkTerms" class="hover:text-indigo-600 transition-colors">Terms of Service</a></li>
                        <li><a href="${window.SITE_ROOT}info/privacy-policy.html" id="ui-link-privacy" data-i18n="linkPrivacy" class="hover:text-indigo-600 transition-colors">Privacy Policy</a></li>
                        <li><a href="${window.SITE_ROOT}info/data-procesing.html" id="ui-link-data" data-i18n="linkData" class="hover:text-indigo-600 transition-colors">Data Processing</a></li>
                        <li><a href="${window.SITE_ROOT}info/fund.html" id="ui-link-media" data-i18n="linkDonate" class="hover:text-indigo-600 transition-colors">Donate</a></li>
                    </ul>
                </div>
                <div>
                    <h4 id="ui-footer-info" data-i18n="footerInfo" class="font-semibold text-slate-900 text-sm mb-4 uppercase tracking-widest">Information</h4>
                    <ul class="space-y-3 text-sm text-slate-600">
                        <li><a href="${window.SITE_ROOT}info/contact.html" id="ui-link-contact" data-i18n="linkContact" class="hover:text-indigo-600 transition-colors">Contact</a></li>
                        <li><a href="${window.SITE_ROOT}info/about.html" id="ui-link-about" data-i18n="linkAbout" class="hover:text-indigo-600 transition-colors">About</a></li>
                        <li><a href="${window.SITE_ROOT}info/faqs.html" id="ui-link-faqs" data-i18n="linkFAQs" class="hover:text-indigo-600 transition-colors">FaQs</a></li>
                        <li><a href="${window.SITE_ROOT}info/pricing.html" id="ui-link-pricing" data-i18n="linkPricing" class="hover:text-indigo-600 transition-colors">Pricing</a></li>
                    </ul>
                </div>
            </div>`;
        }
        if (showFooterBottom) {
            footerHTML += `
            <div class="max-w-7xl mx-auto flex flex-col md:flex-row justify-center items-center text-[10px] text-slate-500 uppercase tracking-widest">
                <p>&copy; <span id="current-year"></span> liteAECO. All rights reserved.&nbsp;</p>
                <p class="mt-4 md:mt-0 flex items-center gap-2">
                    <span id="ui-footer-engineered" data-i18n="footerEngineered">Engineered in Switzerland</span>
                    <svg class="w-3 h-3 rounded-none" viewBox="0 0 32 32" xmlns="http:
                        <path d="m0 0h32v32h-32z" fill="#f00" />
                        <path d="m13 6h6v7h7v6h-7v7h-6v-7h-7v-6h7z" fill="#fff" />
                    </svg>
                    <span id="ui-footer-nocloud" data-i18n="footerNoCloud">No Cloud Uploads. Processed Locally.</span>
                </p>
            </div>`;
        }
        footer.innerHTML = footerHTML;
        document.body.appendChild(footer);
        applyUiLinkTarget(footer);
        const yearElement = document.getElementById('current-year');
        if (yearElement) yearElement.textContent = new Date().getFullYear();
    }
};
function renderNav() {
    const desktopNav = document.getElementById('desktop-nav');
    const mobileNav = document.getElementById('mobile-nav');
    if (!desktopNav || !mobileNav) return;
    const d = getTranslations();
    desktopNav.innerHTML = CATEGORIES.map(cat => {
        const catLabel = (d.categories && d.categories[cat.id]) || cat.label;
        if (cat.id === 'all') {
            return `
            <div class="relative group h-full flex items-center">
                <a href="${window.SITE_ROOT}index.html" class="h-full flex items-center px-6 text-xs font-bold uppercase tracking-widest border-b-2 transition-all duration-300 focus:outline-none ${activeCategory === cat.id ? 'border-indigo-600 text-indigo-700 bg-white' : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-white'}">
                    ${catLabel}
                </a>
            </div>`;
        }
        const appsInCat = APPS.filter(app => app.categories && app.categories.includes(cat.id));
        return `
            <div class="relative group h-full flex items-center">
                <button onclick="setCategory('${cat.id}')" class="h-full px-6 text-xs font-bold uppercase tracking-widest border-b-2 transition-all duration-300 focus:outline-none ${activeCategory === cat.id ? 'border-indigo-600 text-indigo-700 bg-white' : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-white'}">
                    ${catLabel}
                </button>
                <div class="absolute top-12 left-0 w-64 bg-white border border-slate-200 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform translate-y-1 group-hover:translate-y-0 z-50">
                    <div class="p-2 space-y-1 max-h-[60vh] overflow-y-auto custom-scrollbar">
                        ${appsInCat.map(app => {
            const appTitle = (d.apps && d.apps[app.id] && d.apps[app.id].title) || 'Unknown Tool';
            const appFileName = app.url.split('/').pop();
            const isCurrentApp = window.location.pathname.includes(appFileName);
            let rotationClass = '';
            if (app.rotation == 90) rotationClass = 'rotate-90';
            if (app.rotation == -90) rotationClass = '-rotate-90';
            if (app.rotation == 180) rotationClass = 'rotate-180';
            return `
                                <a href="${app.url}" class="flex items-center gap-3 p-2 hover:bg-indigo-50 rounded-none transition-colors group/item block ${isCurrentApp ? 'bg-indigo-50/50' : ''}">
                                    <div class="w-8 h-8 bg-white border flex items-center justify-center shrink-0 ${isCurrentApp ? 'border-indigo-300 text-indigo-600 shadow-sm' : 'border-slate-100 text-slate-500 group-hover/item:text-indigo-600'}">
                                        <i data-lucide="${app.icon}" class="w-4 h-4 transition-transform ${rotationClass}"></i>
                                    </div>
                                    <span class="text-sm ${isCurrentApp ? 'font-bold text-indigo-700' : 'font-medium text-slate-700 group-hover/item:text-indigo-700'}">${appTitle}</span>
                                </a>`
        }).join('')}
                    </div>
                </div>
            </div>`;
    }).join('');
    if (window._showDonation) {
        const donateLabel = d.linkDonate || 'Donate';
        desktopNav.innerHTML += `
            <div class="h-full flex items-center">
                <a href="${window.SITE_ROOT}info/fund.html" id="ui-link-donate"
                    class="h-full flex items-center px-6 text-xs font-bold uppercase tracking-widest border-b-2 border-transparent text-indigo-600 hover:text-indigo-700 hover:bg-white transition-all duration-300 focus:outline-none">
                    ${donateLabel}
                </a>
            </div>`;
    }
    const openCat = window._mobileOpenCat || null;
    mobileNav.innerHTML = CATEGORIES.map(cat => {
        const catLabel = (d.categories && d.categories[cat.id]) || cat.label;
        if (cat.id === 'all') {
            return `
            <a href="${window.SITE_ROOT}index.html" class="block text-left px-6 py-4 text-xs font-bold uppercase tracking-widest border-b border-slate-100 transition-colors focus:outline-none ${activeCategory === cat.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}">
                ${catLabel}
            </a>`;
        }
        const appsInCat = APPS.filter(app => app.categories && app.categories.includes(cat.id));
        const isOpen = openCat === cat.id;
        const appsHTML = appsInCat.map(app => {
            const appTitle = (d.apps && d.apps[app.id] && d.apps[app.id].title) || 'Unknown Tool';
            const appFileName = app.url.split('/').pop();
            const isCurrentApp = window.location.pathname.includes(appFileName);
            let rotationClass = '';
            if (app.rotation == 90) rotationClass = 'rotate-90';
            if (app.rotation == -90) rotationClass = '-rotate-90';
            if (app.rotation == 180) rotationClass = 'rotate-180';
            return `
                <a href="${app.url}" class="flex items-center gap-3 px-6 py-3 border-b border-slate-100 last:border-b-0 transition-colors ${isCurrentApp ? 'bg-indigo-50/70' : 'hover:bg-white'}">
                    <div class="w-7 h-7 bg-white border flex items-center justify-center shrink-0 ${isCurrentApp ? 'border-indigo-300 text-indigo-600 shadow-sm' : 'border-slate-100 text-slate-500'}">
                        <i data-lucide="${app.icon}" class="w-4 h-4 ${rotationClass}"></i>
                    </div>
                    <span class="text-sm ${isCurrentApp ? 'font-bold text-indigo-700' : 'font-medium text-slate-700'}">${appTitle}</span>
                </a>`;
        }).join('');
        return `
            <div class="border-b border-slate-100">
                <button onclick="toggleMobileCat('${cat.id}')" aria-expanded="${isOpen}" class="w-full flex items-center justify-between gap-3 text-left px-6 py-4 text-xs font-bold uppercase tracking-widest transition-colors focus:outline-none ${isOpen || activeCategory === cat.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}">
                    <span>${catLabel}</span>
                    <i data-lucide="chevron-down" class="w-4 h-4 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}"></i>
                </button>
                <div class="${isOpen ? '' : 'hidden'} bg-slate-50">
                    ${appsHTML || `<div class="px-6 py-3 text-sm text-slate-400">—</div>`}
                </div>
            </div>`;
    }).join('');
    applyUiLinkTarget(desktopNav);
    applyUiLinkTarget(mobileNav);
    if (window.lucide) lucide.createIcons();
}
window._mobileOpenCat = null;
window.toggleMobileCat = function (catId) {
    window._mobileOpenCat = (window._mobileOpenCat === catId) ? null : catId;
    if (window._mobileOpenCat && typeof renderCards === 'function') {
        window.setCategory(catId); 
    } else {
        renderNav();
    }
};
window.setCategory = function (catId) {
    activeCategory = catId;
    if (window.location.hash.replace('#', '') !== catId) {
        window.history.pushState(null, null, catId === 'all' ? ' ' : `#${catId}`);
    }
    renderNav();
    if (typeof renderCards === 'function') {
        renderCards();
    }
};
function setupHelpButton() {
    const fileNameFull = window.location.pathname.split('/').pop();
    if (!fileNameFull) return;
    const fileName = fileNameFull.toLowerCase();
    if (fileName === 'help.html' || fileName === 'index.html' || fileName === '') return;
    const langToggle = document.getElementById('langToggleWrap') || document.getElementById('langToggle');
    if (!langToggle) return;
    if (document.getElementById('dynamic-help-btn')) return;
    const helpId = fileNameFull.replace('.html', '').toLowerCase().replace(/_/g, '-');
    const helpBtn = document.createElement('a');
    helpBtn.id = 'dynamic-help-btn';
    helpBtn.href = `${window.SITE_ROOT}info/help.html#${helpId}`;
    helpBtn.className = "mr-3 p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded transition-colors flex items-center justify-center";
    helpBtn.title = "Help & Documentation";
    helpBtn.target = "_blank";
    helpBtn.innerHTML = '<i data-lucide="circle-help" class="w-[18px] h-[18px]"></i>';
    langToggle.parentNode.insertBefore(helpBtn, langToggle);
}
document.addEventListener('DOMContentLoaded', () => {
    const yearElement = document.getElementById('current-year');
    if (yearElement) yearElement.textContent = new Date().getFullYear();
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    if (mobileMenuToggle) mobileMenuToggle.addEventListener('click', window.toggleMobileMenu);
    autoDetectLanguage();
    if (window.lucide) lucide.createIcons();
});