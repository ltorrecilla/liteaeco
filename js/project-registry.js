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
// liteAECO - (project-registry.js)
// ========

(function () {
    window.liteAECO = window.liteAECO || {};
    if (window.liteAECO.projects) return;

    var DB_NAME = "liteaeco-shared";
    var STORE = "projects";
    var dbPromise = null;

    function openDB() {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise(function (resolve) {
            if (!("indexedDB" in window)) return resolve(null);
            var req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = function (e) {
                var db = e.target.result;
                if (!db.objectStoreNames.contains(STORE)) {
                    db.createObjectStore(STORE, { keyPath: "guid" });
                }
            };
            req.onsuccess = function () { resolve(req.result); };
            req.onerror = function () { resolve(null); };
        });
        return dbPromise;
    }

    function tx(mode, fn) {
        return openDB().then(function (db) {
            if (!db) return null;
            return new Promise(function (resolve) {
                var t = db.transaction(STORE, mode);
                var store = t.objectStore(STORE);
                var out = fn(store);
                t.oncomplete = function () { resolve(out && out.__result !== undefined ? out.__result : out); };
                t.onerror = function () { resolve(null); };
            });
        });
    }

    window.liteAECO.projects = {
        save: function (meta, toolId) {
            meta = meta || {};
            if (!meta.guid) {
                var hasContent = meta.number || meta.title || meta.client || meta.address || meta.type;
                if (!hasContent) return Promise.resolve(null);
                meta.guid = (crypto.randomUUID ? crypto.randomUUID() :
                    "g-" + Date.now() + "-" + Math.random().toString(36).slice(2));
            }
            var self = this;
            return this.get(meta.guid).then(function (existing) {
                var tools = (existing && existing.tools) || [];
                if (toolId && tools.indexOf(toolId) === -1) tools.push(toolId);
                var record = {
                    schemaVersion: 1,
                    guid: meta.guid,
                    number: meta.number || "",
                    title: meta.title || "",
                    client: meta.client || "",
                    address: meta.address || "",
                    type: meta.type || "",
                    startDate: meta.startDate || (existing && existing.startDate) || "",
                    folderName: meta.folderName || (existing && existing.folderName) || "",
                    tools: tools,
                    updatedAt: new Date().toISOString()
                };
                return tx("readwrite", function (store) { store.put(record); return record; });
            });
        },
        get: function (guid) {
            if (!guid) return Promise.resolve(null);
            return openDB().then(function (db) {
                if (!db) return null;
                return new Promise(function (resolve) {
                    var req = db.transaction(STORE, "readonly").objectStore(STORE).get(guid);
                    req.onsuccess = function () { resolve(req.result || null); };
                    req.onerror = function () { resolve(null); };
                });
            });
        },
        list: function () {
            return openDB().then(function (db) {
                if (!db) return [];
                return new Promise(function (resolve) {
                    var req = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
                    req.onsuccess = function () {
                        var all = req.result || [];
                        all.sort(function (a, b) { return (b.updatedAt || "").localeCompare(a.updatedAt || ""); });
                        resolve(all);
                    };
                    req.onerror = function () { resolve([]); };
                });
            });
        },
        remove: function (guid) {
            if (!guid) return Promise.resolve(null);
            return tx("readwrite", function (store) { store.delete(guid); });
        }
    };
})();
