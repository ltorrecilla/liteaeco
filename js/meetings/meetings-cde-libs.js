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
// liteAECO - (meetings-cde-libs.js)
// ========













(function (W) {
    "use strict";
    W.liteAECO = W.liteAECO || {};
    const M = W.liteAECO.meetings = W.liteAECO.meetings || {};
    M.CDE_LIBS_BUILD = 2;   
    M.LOAD_TIMEOUT_MS = 20000;

    const LIBS = [
        { src: "js/vendor/index-0.8.3.js", ready: () => !!(W.fflate && typeof W.fflate.unzipSync === "function") },
        { src: "js/liteaeco-bcf.js", ready: () => !!(W.liteAECO.bcf && typeof W.liteAECO.bcf.saveTopic === "function") }
    ];
    let loading = null;

    function root() { return typeof W.SITE_ROOT === "string" ? W.SITE_ROOT : "../"; }

    


    function inject(src) {
        return new Promise((resolve, reject) => {
            const doc = W.document;
            const old = doc.querySelector('script[data-mtg-lib="' + src + '"]');
            if (old && old.dataset.loaded === "1") { resolve(); return; }
            if (old) old.remove();   
            const s = doc.createElement("script");
            let timer = null;
            const fail = (why) => { clearTimeout(timer); s.remove(); reject(new Error(why + ": " + src)); };
            s.addEventListener("load", () => { clearTimeout(timer); s.dataset.loaded = "1"; resolve(); }, { once: true });
            s.addEventListener("error", () => fail("not loaded"), { once: true });
            timer = setTimeout(() => fail("timed out"), M.LOAD_TIMEOUT_MS || 20000);
            s.src = root() + src;
            s.dataset.mtgLib = src;
            doc.head.appendChild(s);
        });
    }

    M.cdeLibsReady = function () { return LIBS.every(l => l.ready()); };

    M.loadCdeLibs = function () {
        if (M.cdeLibsReady()) return Promise.resolve({ ok: true });
        if (loading) return loading;
        loading = LIBS.reduce((p, l) => p.then(() => (l.ready() ? null : inject(l.src))), Promise.resolve())
            .then(() => {
                if (!M.cdeLibsReady()) throw new Error("libraries loaded but not usable");
                return { ok: true };
            })
            .catch((e) => {
                loading = null;   
                console.warn("[meetings] CDE libraries not loaded:", e);
                return { ok: false, error: e };
            });
        return loading;
    };
})(typeof window !== "undefined" ? window : globalThis);
