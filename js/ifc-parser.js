class IfcParser {
    constructor() {
        this.entities = new Map(); 
        this.objects = new Map();  
        this.relDefines = [];
        this.relAggregates = []; 
        this.relContained = [];  
        this.projectRoot = null;
    }
    parse(text, progressCallback) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                try {
                    const lines = text.split(/\r?\n/);
                    const totalLines = lines.length;
                    const lineRegex = /^#(\d+)\s*=\s*([A-Z0-9_]+)\s*\((.*)\)\s*;?$/;
                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i].trim();
                        if (!line || line.startsWith('ISO') || line.startsWith('HEADER') || line.startsWith('END')) continue;
                        const match = line.match(lineRegex);
                        if (match) {
                            const id = parseInt(match[1]);
                            const type = match[2].toUpperCase();
                            const rawArgs = match[3];
                            this.entities.set(id, { type, rawArgs });
                            if (type === 'IFCRELDEFINESBYPROPERTIES') {
                                this.relDefines.push({ id, rawArgs });
                            } else if (type === 'IFCRELAGGREGATES') {
                                this.relAggregates.push({ id, rawArgs });
                            } else if (type === 'IFCRELCONTAINEDINSPATIALSTRUCTURE') {
                                this.relContained.push({ id, rawArgs });
                            }
                        }
                        if (i % 5000 === 0 && progressCallback) {
                            progressCallback(Math.round((i / totalLines) * 40));
                        }
                    }
                    this.buildObjectGraph(progressCallback);
                    resolve(this);
                } catch (e) {
                    reject(e);
                }
            }, 10);
        });
    }
    parseArgs(raw) {
        const args = [];
        let current = '';
        let depth = 0;
        let inString = false;
        for (let i = 0; i < raw.length; i++) {
            const char = raw[i];
            if (char === "'" && raw[i - 1] !== '\\') {
                inString = !inString;
                current += char;
            } else if (inString) {
                current += char;
            } else if (char === '(') {
                depth++;
                current += char;
            } else if (char === ')') {
                depth--;
                current += char;
            } else if (char === ',' && depth === 0) {
                args.push(this.cleanArg(current));
                current = '';
            } else {
                current += char;
            }
        }
        args.push(this.cleanArg(current));
        return args;
    }
    cleanArg(arg) {
        arg = arg.trim();
        if (arg === '$') return null;
        if (arg.startsWith("'") && arg.endsWith("'")) return arg.slice(1, -1);
        return arg;
    }
    buildObjectGraph(progressCallback) {
        for (const [id, entity] of this.entities) {
            if (entity.rawArgs.startsWith("'") && entity.rawArgs.length > 20) {
                const args = this.parseArgs(entity.rawArgs);
                const guid = args[0];
                if (guid && guid.length === 22 && !entity.type.includes('OWNER') && !entity.type.includes('REL')) {
                    this.objects.set(guid, {
                        id: id,
                        guid: guid,
                        type: entity.type,
                        name: args[2] || 'Unnamed',
                        psets: {},
                        children: []
                    });
                    if (entity.type === 'IFCPROJECT') this.projectRoot = this.objects.get(guid);
                }
            }
        }
        if (progressCallback) progressCallback(60);
        const idToObject = new Map();
        for (const obj of this.objects.values()) {
            idToObject.set(obj.id, obj);
        }
        for (const rel of this.relDefines) {
            try {
                const args = this.parseArgs(rel.rawArgs);
                const relatedRefs = args[4].replace(/[()]/g, '').split(',');
                const psetRef = args[5];
                if (!psetRef.startsWith('#')) continue;
                const psetId = parseInt(psetRef.replace('#', ''));
                const psetEntity = this.entities.get(psetId);
                if (psetEntity) {
                    const pset = this.resolvePset(psetEntity);
                    relatedRefs.forEach(ref => {
                        const objId = parseInt(ref.replace('#', ''));
                        const obj = idToObject.get(objId);
                        if (obj) obj.psets[pset.name] = pset.props;
                    });
                }
            } catch (e) { console.warn("Error parsing Pset relation", rel); }
        }
        if (progressCallback) progressCallback(80);
        const processRelation = (relList, parentIndex, childIndex) => {
            for (const rel of relList) {
                try {
                    const args = this.parseArgs(rel.rawArgs);
                    const parentRef = args[parentIndex];
                    const childRefs = args[childIndex];
                    if (!parentRef || !childRefs) continue;
                    const parentId = parseInt(parentRef.replace('#', ''));
                    const parentObj = idToObject.get(parentId);
                    if (parentObj) {
                        const childrenIds = childRefs.replace(/[()]/g, '').split(',');
                        childrenIds.forEach(cRef => {
                            if (!cRef.startsWith('#')) return;
                            const cId = parseInt(cRef.replace('#', ''));
                            const childObj = idToObject.get(cId);
                            if (childObj) {
                                parentObj.children.push(childObj);
                                childObj.hasParent = true;
                            }
                        });
                    }
                } catch (e) { console.warn("Tree build error", rel); }
            }
        };
        processRelation(this.relAggregates, 4, 5);
        processRelation(this.relContained, 5, 4);
        if (progressCallback) progressCallback(100);
    }
    resolvePset(entity) {
        const args = this.parseArgs(entity.rawArgs);
        const psetName = args[2] || 'Unknown Pset';
        const propsMap = {};
        if (args[4] && args[4].startsWith('(')) {
            const propRefs = args[4].replace(/[()]/g, '').split(',');
            propRefs.forEach(ref => {
                if (!ref.startsWith('#')) return;
                const propId = parseInt(ref.replace('#', ''));
                const propEntity = this.entities.get(propId);
                if (propEntity && propEntity.type === 'IFCPROPERTYSINGLEVALUE') {
                    const pArgs = this.parseArgs(propEntity.rawArgs);
                    const pName = pArgs[0];
                    let pValue = pArgs[2];
                    if (pValue && pValue.includes('(')) {
                        const match = pValue.match(/\((.*?)\)/);
                        if (match) pValue = match[1];
                    }
                    if (pValue && pValue.startsWith("'")) pValue = pValue.slice(1, -1);
                    propsMap[pName] = pValue;
                }
            });
        }
        return { name: psetName, props: propsMap };
    }
}
const dom = {
    fileA: document.getElementById('file-a'),
    fileB: document.getElementById('file-b'),
    btnCompare: document.getElementById('btn-compare'),
    dropA: document.getElementById('drop-zone-a'),
    dropB: document.getElementById('drop-zone-b'),
    labelA: document.getElementById('label-a'),
    labelB: document.getElementById('label-b'),
    overlay: document.getElementById('processing-overlay'),
    progressText: document.getElementById('progress-text'),
    contentArea: document.getElementById('content-area'),
    diffList: document.getElementById('diff-list'),
    summaryPanel: document.getElementById('summary-panel'),
    countAdded: document.getElementById('count-added'),
    countRemoved: document.getElementById('count-removed'),
    countModified: document.getElementById('count-modified'),
    filterBtns: document.querySelectorAll('.filter-btn'),
    tabBtns: document.querySelectorAll('.tab-btn'),
    viewUpload: document.getElementById('view-upload'),
    viewDiff: document.getElementById('view-diff'),
    viewTreeStructure: document.getElementById('view-tree-structure'),
    viewProperties: document.getElementById('view-properties'),
    viewQuantities: document.getElementById('view-quantities'),
    viewViewer3d: document.getElementById('view-viewer-3d'),
    treeRootA: document.getElementById('tree-root-a'),
    treeRootB: document.getElementById('tree-root-b'),
    treeFilenameA: document.getElementById('tree-filename-a'),
    treeFilenameB: document.getElementById('tree-filename-b'),
    propFilenameA: document.getElementById('prop-filename-a'),
    propFilenameB: document.getElementById('prop-filename-b'),
    propEmpty: document.getElementById('prop-empty'),
    propContent: document.getElementById('prop-content'),
    propTitle: document.getElementById('prop-title'),
    propSubtitle: document.getElementById('prop-subtitle'),
    propBadges: document.getElementById('prop-badges'),
    propListA: document.getElementById('prop-list-a'),
    propListB: document.getElementById('prop-list-b'),
    propCompareBody: document.getElementById('prop-compare-body'),
    propPopupContent: document.getElementById('prop-popup-content'),
    btnTreeExpand: document.getElementById('btn-tree-expand'),
    btnTreeCollapse: document.getElementById('btn-tree-collapse'),
};
let parserA = null;
let parserB = null;
let diffResults = [];
let globalDiffMap = new Map(); 
let selectedGuid = null;
let isCompared = false; 
window.globalParserA = null;
window.globalParserB = null;
window.globalDiffMap = null;
function setupDropZone(dropZone, input, label, fileVarSetter, modelLetter) {
    dropZone.addEventListener('click', () => input.click());
    input.addEventListener('change', (e) => handleFile(e.target.files[0], label, fileVarSetter, modelLetter, dropZone));
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('active'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('active'));
    dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.classList.remove('active'); handleFile(e.dataTransfer.files[0], label, fileVarSetter, modelLetter, dropZone); });
}
let fileA = null, fileB = null;
setupDropZone(dom.dropA, dom.fileA, dom.labelA, (f) => { fileA = f; checkReady(); }, 'A');
setupDropZone(dom.dropB, dom.fileB, dom.labelB, (f) => { fileB = f; checkReady(); }, 'B');
async function handleFile(file, labelEl, setter, modelLetter, dropZone) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.ifc')) return alert('Please upload a valid .ifc file');
    setter(file);
    dropZone.classList.remove('flex-grow', 'h-full', 'min-h-[140px]', 'flex-col', 'justify-center', 'py-4');
    dropZone.classList.add('h-12', 'min-h-[48px]', 'flex-row', 'justify-start', 'py-2');
    labelEl.classList.remove('flex-col', 'space-y-2', 'items-center', 'justify-center', 'text-center');
    labelEl.classList.add('flex-row', 'gap-3', 'justify-start', 'items-center', 'w-full');
    labelEl.innerHTML = `
        <i data-lucide="file-check-2" class="text-indigo-600 shrink-0 w-5 h-5"></i>
        <span class="text-slate-800 font-bold w-full text-left truncate text-[13px]" title="${file.name}">${file.name}</span>
    `;
    if (window.lucide) window.lucide.createIcons();
    const infoContainer = document.getElementById(`info-${modelLetter.toLowerCase()}`);
    if (infoContainer) {
        infoContainer.innerHTML = `<div class="text-slate-500 italic flex items-center gap-2 px-2 py-4"><i data-lucide="loader-circle" class="animate-spin w-4 h-4"></i> Reading metadata...</div>`;
        infoContainer.classList.remove('hidden');
        try {
            const slice = file.slice(0, 5 * 1024 * 1024);
            const text = await slice.text();
            const info = extractIfcInfo(text);
            info.size = file.size < 1024 * 1024 ? (file.size / 1024).toFixed(2) + ' KB' : (file.size / (1024 * 1024)).toFixed(2) + ' MB';
            if (modelLetter === 'A') window.metadataA = info;
            else window.metadataB = info;
            renderMetadata();
        } catch (e) {
            console.error(`Error reading metadata for file ${modelLetter}:`, e);
            infoContainer.innerHTML = `<div class="text-red-500 italic flex items-center gap-2 px-2 py-4"><i data-lucide="triangle-alert" class="w-4 h-4"></i> Error reading metadata.</div>`;
        }
    }
}
function renderMetadata() {
    const renderPanel = (info, otherInfo, elementId) => {
        if (!info) return;
        const container = document.getElementById(elementId);
        if (!container) return;
        const compare = (key) => {
            const val = info[key] || '-';
            if (otherInfo && info[key] !== otherInfo[key]) {
                return `<div class="col-span-3 text-red-500 font-semibold truncate" title="${val}">${val}</div>`;
            }
            return `<div class="col-span-3 text-slate-800 font-semibold truncate" title="${val}">${val}</div>`;
        };
        const compareXYZ = () => {
            const valX = info['coordX'] || '-';
            const valY = info['coordY'] || '-';
            const valZ = info['coordZ'] || '-';
            const val = `${valX} / ${valY} / ${valZ}`;
            if (otherInfo && (info['coordX'] !== otherInfo['coordX'] || info['coordY'] !== otherInfo['coordY'] || info['coordZ'] !== otherInfo['coordZ'])) {
                return `<div class="col-span-3 text-red-500 font-semibold truncate" title="${val}">${val}</div>`;
            }
            return `<div class="col-span-3 text-slate-800 font-semibold truncate" title="${val}">${val}</div>`;
        };
        container.innerHTML = `
            <p class="font-semibold text-sm text-slate-800 mb-3 border-b border-slate-200/60 pb-1">Model Information</p>
            <div class="grid grid-cols-4 gap-x-4 gap-y-2 text-[12px] flex-grow content-start">
                <div class="text-slate-500 font-medium">Date:</div>
                ${compare('date')}
                <div class="text-slate-500 font-medium">File Size:</div>
                ${compare('size')}
                <div class="text-slate-500 font-medium">Schema:</div>
                ${compare('schema')}
                <div class="text-slate-500 font-medium">Application:</div>
                ${compare('application')}
                <div class="text-slate-500 font-medium">Person:</div>
                ${compare('person')}
                <div class="text-slate-500 font-medium">Units:</div>
                ${compare('units')}
                <div class="text-slate-500 font-medium">lat. / lon. / elev.:</div>
                ${compareXYZ()}
            </div>
        `;
    };
    renderPanel(window.metadataA, window.metadataB, 'info-a');
    renderPanel(window.metadataB, window.metadataA, 'info-b');
}
function extractIfcInfo(text) {
    const info = { date: '', size: '', schema: '', organization: '', application: '', person: '', coordX: '', coordY: '', coordZ: '', units: '', coordinates: '' };
    const headerMatch = text.match(/HEADER;(.*?)ENDSEC;/s);
    if (headerMatch) {
        const headerText = headerMatch[1];
        const schemaMatch = headerText.match(/FILE_SCHEMA\s*\(\s*\(\s*'([^']+)'\s*\)\s*\)/i);
        if (schemaMatch) info.schema = schemaMatch[1];
        const fileNameMatch = headerText.match(/FILE_NAME\s*\((.*)\)\s*;/i);
        if (fileNameMatch) {
            const args = parseArgsSimpler(fileNameMatch[1]);
            if (args.length >= 7) {
                let rawDate = cleanString(args[1]);
                if (rawDate) {
                    const dMatch = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
                    info.date = dMatch ? `${dMatch[1]}.${dMatch[2]}.${dMatch[3]} - ${dMatch[4]}:${dMatch[5]}` : rawDate;
                }
                info.person = extractList(args[2]).join(', ');
                info.organization = extractList(args[3]).join(', ');
                info.application = cleanString(args[5]);
            }
        }
    }
    const appMatch = text.match(/IFCAPPLICATION\s*\(([^)]+)\)\s*;/i);
    if (appMatch) {
        const args = parseArgsSimpler(appMatch[1]);
        if (args.length > 2 && args[2] !== '$') info.application = cleanString(args[2]);
        else if (args.length > 3) info.application = cleanString(args[3]);
    }
    const personMatch = text.match(/IFCPERSON\s*\(([^;]+)\)\s*;/i);
    if (personMatch) {
        const pArgs = parseArgsSimpler(personMatch[1]);
        if (pArgs.length >= 3) {
            const familyName = cleanString(pArgs[1]);
            const givenName = cleanString(pArgs[2]);
            const parts = [];
            if (givenName) parts.push(givenName);
            if (familyName) parts.push(familyName);
            if (parts.length > 0) info.person = parts.join(' ');
        }
    }
    const siteMatch = text.match(/IFCSITE\s*\(([^;]+)\)\s*;/i);
    if (siteMatch) {
        const siteArgs = parseArgsSimpler(siteMatch[1]);
        if (siteArgs.length > 5 && siteArgs[5].startsWith('#')) {
            const placeId = siteArgs[5].substring(1);
            const placeMatch = text.match(new RegExp(`#${placeId}\\s*=\\s*IFCLOCALPLACEMENT\\s*\\([^,]+,\\s*#(\\d+)\\s*\\)\\s*;`, "i"));
            let axisIdMatch = null;
            if (placeMatch) {
                axisIdMatch = placeMatch[1];
            } else {
                const placeMatch2 = text.match(new RegExp(`#${placeId}\\s*=\\s*IFCLOCALPLACEMENT\\s*\\([\\$#0-9A-Z]*\\s*,\\s*#(\\d+)\\s*\\)\\s*;`, "i"));
                if (placeMatch2) axisIdMatch = placeMatch2[1];
            }
            if (axisIdMatch) {
                const axisMatch = text.match(new RegExp(`#${axisIdMatch}\\s*=\\s*IFCAXIS2PLACEMENT3D\\s*\\(\\s*#(\\d+)\\s*(?:,|\\))`, "i"));
                if (axisMatch) {
                    const pointMatch = text.match(new RegExp(`#${axisMatch[1]}\\s*=\\s*IFCCARTESIANPOINT\\s*\\(\\s*\\(([^)]+)\\)\\s*\\)\\s*;`, "i"));
                    if (pointMatch) {
                        const coords = pointMatch[1].split(',').map(s => (parseFloat(s) * 0.01).toFixed(3));
                        if (coords.length >= 2) {
                            info.coordX = coords[0];
                            info.coordY = coords[1];
                        }
                        if (coords.length >= 3) {
                            info.coordZ = coords[2];
                        }
                    }
                }
            }
        }
    }
    if (info.coordX || info.coordY || info.coordZ) {
        info.coordinates = `X: ${info.coordX || '0'} Y: ${info.coordY || '0'} Z: ${info.coordZ || '0'}`;
    }
    const lengthUnitMatch = text.match(/IFCSIUNIT\s*\([^;]*\.LENGTHUNIT\.[^;]*\)\s*;/i);
    if (lengthUnitMatch) {
        const uArgs = parseArgsSimpler(lengthUnitMatch[0].match(/\((.*)\)/)[1]);
        if (uArgs.length >= 4) {
            let prefix = uArgs[2].replace(/\./g, '');
            let name = uArgs[3].replace(/\./g, '');
            if (prefix && prefix !== '$') {
                info.units = prefix.toLowerCase() + name.toLowerCase();
            } else {
                info.units = name.toLowerCase();
            }
            if (info.units === 'metre') info.units = 'Meters';
            else if (info.units === 'millimetre') info.units = 'Millimeters';
            else info.units = info.units.charAt(0).toUpperCase() + info.units.slice(1) + 's';
        }
    }
    return info;
}
function parseArgsSimpler(raw) {
    const args = [];
    let current = '';
    let depth = 0;
    let inString = false;
    for (let i = 0; i < raw.length; i++) {
        const char = raw[i];
        if (char === "'" && raw[i - 1] !== '\\') {
            inString = !inString;
            current += char;
        } else if (inString) {
            current += char;
        } else if (char === '(') {
            depth++;
            current += char;
        } else if (char === ')') {
            depth--;
            current += char;
        } else if (char === ',' && depth === 0) {
            args.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    args.push(current.trim());
    return args;
}
function cleanString(str) {
    if (!str || str === '$') return '';
    if (str.startsWith("'") && str.endsWith("'")) return str.slice(1, -1);
    return str;
}
function extractList(str) {
    if (!str) return [];
    if (str.startsWith('(') && str.endsWith(')')) {
        let inner = str.slice(1, -1);
        let items = [];
        let inString = false;
        let current = '';
        for (let i = 0; i < inner.length; i++) {
            if (inner[i] === "'") inString = !inString;
            if (inner[i] === ',' && !inString) {
                items.push(cleanString(current.trim()));
                current = '';
            } else {
                current += inner[i];
            }
        }
        items.push(cleanString(current.trim()));
        return items;
    }
    return [cleanString(str)];
}
function checkReady() { dom.btnCompare.disabled = !(fileA && fileB); }
const sidebarToggleBtn = document.getElementById('sidebar-toggle');
const sidebar = document.getElementById('main-sidebar');
function setSidebarState(collapsed, animate = true) {
    if (!sidebar) return;
    const toggleWrapper = document.getElementById('sidebar-toggle-icon-wrapper');
    const sidebarTexts = document.querySelectorAll('.sidebar-text');
    if (!animate) {
        sidebar.style.transition = 'none';
        if (toggleWrapper) toggleWrapper.style.transition = 'none';
        sidebarTexts.forEach(t => t.style.transition = 'none');
    }
    if (collapsed) {
        sidebar.classList.replace('w-64', 'w-[72px]');
        if (toggleWrapper) toggleWrapper.innerHTML = '<i data-lucide="chevron-right" class="w-5 h-5"></i>';
        sidebarTexts.forEach(t => t.classList.replace('opacity-100', 'opacity-0'));
    } else {
        sidebar.classList.replace('w-[72px]', 'w-64');
        if (toggleWrapper) toggleWrapper.innerHTML = '<i data-lucide="chevron-left" class="w-5 h-5"></i>';
        sidebarTexts.forEach(t => t.classList.replace('opacity-0', 'opacity-100'));
    }
    if (window.lucide) window.lucide.createIcons();
    if (!animate) {
        void sidebar.offsetWidth; 
        setTimeout(() => {
            sidebar.style.transition = '';
            if (toggleWrapper) toggleWrapper.style.transition = '';
            sidebarTexts.forEach(t => t.style.transition = '');
        }, 50);
    }
    setTimeout(() => window.dispatchEvent(new Event('resize')), animate ? 310 : 10);
}
if (sidebarToggleBtn && sidebar) {
    const savedState = localStorage.getItem('ifc_sidebar_collapsed');
    if (savedState !== null) {
        setSidebarState(savedState === 'true', false);
    } else {
        setSidebarState(true, false);
    }
    sidebarToggleBtn.addEventListener('click', () => {
        const newState = sidebar.classList.contains('w-64');
        setSidebarState(newState, true);
        localStorage.setItem('ifc_sidebar_collapsed', newState);
    });
}
dom.btnCompare.addEventListener('click', async () => {
    if (isCompared) {
        window.location.reload();
        return;
    }
    dom.btnCompare.disabled = true;
    dom.btnCompare.innerHTML = `<i data-lucide="loader-circle" class="animate-spin mr-3 w-4 h-4"></i> Comparing...`;
    dom.overlay.classList.remove('hidden');
    dom.fileA.disabled = true;
    dom.fileB.disabled = true;
    [dom.dropA, dom.dropB].forEach(el => {
        el.classList.add('pointer-events-none');
        el.classList.remove('cursor-pointer', 'hover:bg-slate-50');
        el.style.borderStyle = 'solid';
    });
    try {
        dom.progressText.textContent = `Parsing ${fileA.name}...`;
        const textA = await fileA.text();
        parserA = new IfcParser();
        await parserA.parse(textA, (p) => dom.progressText.textContent = `Parsing A: ${p}%`);
        dom.progressText.textContent = `Parsing ${fileB.name}...`;
        const textB = await fileB.text();
        parserB = new IfcParser();
        await parserB.parse(textB, (p) => dom.progressText.textContent = `Parsing B: ${p}%`);
        window.globalParserA = parserA;
        window.globalParserB = parserB;
        dom.progressText.textContent = "Comparing Data...";
        await new Promise(r => setTimeout(r, 100));
        compareData(parserA.objects, parserB.objects);
        dom.progressText.textContent = "Building Trees...";
        renderTree(parserA, dom.treeRootA);
        renderTree(parserB, dom.treeRootB);
        document.getElementById('tab-diff').disabled = false;
        document.getElementById('tab-tree').disabled = false;
        document.getElementById('tab-props').disabled = false;
        document.getElementById('tab-quantities').disabled = false;
        document.getElementById('tab-viewer').disabled = false;
        isCompared = true;
        dom.btnCompare.disabled = false; 
        dom.btnCompare.innerHTML = `<i data-lucide="rotate-cw" class="mr-3 w-4 h-4"></i> Load new models`;
        dom.treeFilenameA.textContent = fileA.name;
        dom.treeFilenameA.title = fileA.name;
        dom.treeFilenameB.textContent = fileB.name;
        dom.treeFilenameB.title = fileB.name;
        dom.propFilenameA.textContent = fileA.name;
        dom.propFilenameA.title = fileA.name;
        dom.propFilenameB.textContent = fileB.name;
        dom.propFilenameB.title = fileB.name;
        const optA = document.getElementById('q-model-select').querySelector('option[value="A"]');
        if (optA) optA.textContent = fileA.name;
        const optB = document.getElementById('q-model-select').querySelector('option[value="B"]');
        if (optB) optB.textContent = fileB.name;
        dom.summaryPanel.classList.remove('hidden');
        document.getElementById('tab-diff').click();
    } catch (e) {
        console.error(e);
        alert("Error processing files. See console for details.");
        dom.btnCompare.disabled = false;
        dom.btnCompare.innerHTML = `<i data-lucide="play" class="mr-3 w-4 h-4"></i> Compare Models`;
        dom.fileA.disabled = false;
        dom.fileB.disabled = false;
        [dom.dropA, dom.dropB].forEach(el => {
            el.classList.remove('pointer-events-none');
            el.classList.add('cursor-pointer', 'hover:bg-slate-50');
            el.style.borderStyle = '';
        });
    } finally {
        dom.overlay.classList.add('hidden');
    }
});
function compareData(mapA, mapB) {
    const allGuids = new Set([...mapA.keys(), ...mapB.keys()]);
    diffResults = [];
    globalDiffMap = new Map(); 
    let added = 0, removed = 0, modified = 0;
    allGuids.forEach(guid => {
        const objA = mapA.get(guid);
        const objB = mapB.get(guid);
        if (!objA && objB) {
            added++;
            diffResults.push({ type: 'added', guid, obj: objB });
            globalDiffMap.set(guid, 'added');
        } else if (objA && !objB) {
            removed++;
            diffResults.push({ type: 'removed', guid, obj: objA });
            globalDiffMap.set(guid, 'removed');
        } else {
            const changes = getPropertyDiff(objA, objB);
            if (changes.length > 0) {
                modified++;
                diffResults.push({ type: 'modified', guid, obj: objB, changes });
                globalDiffMap.set(guid, 'modified');
            }
        }
    });
    window.globalDiffMap = globalDiffMap;
    actualCounts = { added, removed, modified };
    dom.countAdded.innerText = added;
    dom.countRemoved.innerText = removed;
    dom.countModified.innerText = modified;
    updateCountDisplay();
    updateFilterButtonStyles();
    renderList(diffResults);
}
function getPropertyDiff(objA, objB) {
    const changes = [];
    if (objA.name !== objB.name) changes.push({ category: 'Attribute', name: 'Name', oldVal: objA.name, newVal: objB.name });
    const allPsets = new Set([...Object.keys(objA.psets), ...Object.keys(objB.psets)]);
    allPsets.forEach(psetName => {
        const propsA = objA.psets[psetName];
        const propsB = objB.psets[psetName];
        if (!propsA && propsB) changes.push({ category: psetName, name: '(Set)', oldVal: 'Missing', newVal: 'Added' });
        else if (propsA && !propsB) changes.push({ category: psetName, name: '(Set)', oldVal: 'Existing', newVal: 'Removed' });
        else {
            const allProps = new Set([...Object.keys(propsA || {}), ...Object.keys(propsB || {})]);
            allProps.forEach(propName => {
                const valA = propsA[propName], valB = propsB[propName];
                if (valA !== valB) changes.push({ category: psetName, name: propName, oldVal: valA, newVal: valB });
            });
        }
    });
    return changes;
}
function renderList(items) {
    dom.diffList.innerHTML = '';
    if (items.length === 0) {
        dom.diffList.innerHTML = `<div class="text-center py-10 text-slate-400">No matching changes.</div>`;
        return;
    }
    const groups = [
        { type: 'added', label: 'Added', icon: 'circle-plus', headerBg: 'bg-green-100 border border-green-200', headerText: 'text-green-800', countBg: 'bg-green-100 text-green-700' },
        { type: 'removed', label: 'Removed', icon: 'circle-minus', headerBg: 'bg-red-100 border border-red-200', headerText: 'text-red-800', countBg: 'bg-red-100 text-red-700' },
        { type: 'modified', label: 'Modified', icon: 'square-pen', headerBg: 'bg-yellow-100 border border-yellow-200', headerText: 'text-yellow-800', countBg: 'bg-yellow-100 text-yellow-700' }
    ];
    groups.forEach(group => {
        const groupItems = items.filter(i => i.type === group.type);
        if (groupItems.length === 0) return;
        const header = document.createElement('div');
        header.className = `flex items-center justify-between px-4 py-2 rounded-t mb-0 mt-4 first:mt-0 ${group.headerBg} select-none cursor-pointer`;
        header.innerHTML = `
                    <div class="flex items-center gap-2 font-bold text-sm ${group.headerText}">
                        <i data-lucide="${group.icon}" class="w-4 h-4"></i>
                        ${group.label}
                    </div>
                    <div class="flex items-center gap-3">
                        <span class="text-xs font-bold px-2 py-0.5 rounded-full ${group.countBg}">${groupItems.length}</span>
                        <i data-lucide="chevron-down" class="${group.headerText} opacity-60 transition-transform duration-300 group-toggle-icon w-4 h-4"></i>
                    </div>
                `;
        const groupContainer = document.createElement('div');
        groupContainer.className = 'space-y-0 mb-0 mt-0 group-items-container';
        header.addEventListener('click', () => {
            const icon = header.querySelector('.group-toggle-icon');
            if (groupContainer.classList.toggle('hidden')) {
                icon.style.transform = 'rotate(-90deg)';
            } else {
                icon.style.transform = '';
            }
        });
        dom.diffList.appendChild(header);
        dom.diffList.appendChild(groupContainer);
        const renderItems = groupItems.slice(0, 200);
        renderItems.forEach(item => {
            const el = document.createElement('div');
            el.className = 'overflow-hidden transition-all';
            let iconName = item.type === 'added' ? 'plus' : item.type === 'removed' ? 'minus' : 'pencil';
            let iconColor = item.type === 'added' ? 'text-green-600' : item.type === 'removed' ? 'text-red-600' : 'text-yellow-600';
            let bg = item.type === 'added' ? 'bg-green-50' : item.type === 'removed' ? 'bg-red-50' : 'bg-yellow-50';
            let border = item.type === 'added' ? 'border border-green-200' : item.type === 'removed' ? 'border border-red-200' : 'border border-yellow-200';
            let sourceText = item.type === 'added' ? 'Source: File (B)' : item.type === 'removed' ? 'Source: File (A)' : 'Source: Modified (In Both)';
            const objA = item.type === 'added' ? null : (item.type === 'removed' ? item.obj : parserA.objects.get(item.guid));
            const objB = item.type === 'removed' ? null : (item.type === 'added' ? item.obj : parserB.objects.get(item.guid));
            const tableHtml = generateComparisonTableHTML(objA, objB, 10);
            el.innerHTML = `
                        <div class="px-4 py-3 ${bg} flex justify-between items-center cursor-pointer hover:opacity-90 transition border ${border}" onclick="toggleCard(this)">
                            <div class="flex items-center gap-3">
                                <i data-lucide="${iconName}" class="${iconColor} w-6 h-6"></i>
                                <div>
                                    <h4 class="font-bold text-slate-800 text-sm">${item.obj.name || 'Unnamed'}</h4>
                                    <div class="text-xs text-slate-500 font-mono">${item.obj.type}</div>
                                </div>
                            </div>
                            <div class="flex items-center gap-3">
                                <i data-lucide="chevron-down" class="text-slate-400 transition-transform duration-300 w-4 h-4"></i>
                            </div>
                        </div>
                        <div class="card-expanded-content bg-white">
                            <div class="p-4 border-t border-slate-100">
                                <div class="flex justify-between items-center mb-4">
                                    <span class="text-xs font-bold text-slate-500 uppercase tracking-wide bg-slate-100 px-2 py-1 rounded">${sourceText}</span>
                                    <div class="flex gap-2">
                                        <button onclick="jumpToTree('${item.guid}', event)" class="text-xs bg-slate-100 text-slate-800 border border-slate-300 px-3 py-1 rounded hover:bg-slate-200 transition flex items-center gap-2">
                                            <i data-lucide="crosshair" class="w-4 h-4"></i> Locate in Tree
                                        </button>
                                        <button onclick="jumpToProperties('${item.guid}', event)" class="text-xs bg-purple-50 text-purple-600 border border-purple-200 px-3 py-1 rounded hover:bg-purple-100 transition flex items-center gap-2">
                                            <i data-lucide="list-checks" class="w-4 h-4"></i> Display properties
                                        </button>
                                    </div>
                                </div>
                                <div class="text-sm border border-slate-200 rounded overflow-hidden">
                                    ${tableHtml}
                                </div>
                            </div>
                        </div>
                    `;
            groupContainer.appendChild(el);
        });
    });
}
function toggleCard(headerEl) {
    const card = headerEl.parentElement;
    card.classList.toggle('card-expanded');
}
function jumpToTree(guid, event) {
    if (event) event.stopPropagation();
    document.getElementById('tab-tree').click();
    selectNode(guid);
}
function jumpToProperties(guid, event) {
    if (event) event.stopPropagation();
    document.getElementById('tab-props').click();
    selectNode(guid);
}
function jumpTo3D(guid, event) {
    if (event) event.stopPropagation();
    document.getElementById('tab-viewer').click();
    if (window.viewerManager && !window.viewerManager.ifcModel && fileB) {
        window.viewerManager.loadModels(fileA, fileB);
    }
    selectNode(guid);
    if (window.viewerManager) window.viewerManager.highlight(guid);
}
function generateComparisonTableHTML(objA, objB, limit = Infinity) {
    const allPsets = new Set([
        ...(objA ? Object.keys(objA.psets) : []),
        ...(objB ? Object.keys(objB.psets) : [])
    ]);
    let rowStrings = [];
    if (objA && objB && objA.name !== objB.name) {
        rowStrings.push(`<tr class="bg-yellow-50">
                    <td class="px-4 py-2 border-b border-slate-100 font-medium text-slate-600">Attribute</td>
                    <td class="px-4 py-2 border-b border-slate-100">Name</td>
                    <td class="px-4 py-2 border-b border-slate-100"><span class="text-red-600 line-through text-xs mr-1">${objA.name}</span></td>
                    <td class="px-4 py-2 border-b border-slate-100"><span class="text-green-600 font-semibold">${objB.name}</span></td>
                 </tr>`);
    }
    allPsets.forEach(psetName => {
        const propsA = objA ? objA.psets[psetName] || {} : {};
        const propsB = objB ? objB.psets[psetName] || {} : {};
        const allProps = new Set([...Object.keys(propsA), ...Object.keys(propsB)]);
        allProps.forEach(prop => {
            const valA = propsA[prop];
            const valB = propsB[prop];
            if (valA !== valB) {
                let rowClass = 'bg-yellow-50'; 
                let valACell = valA === undefined ? '<span class="italic text-slate-400">null</span>' : `<span class="text-red-600 line-through text-xs mr-1">${valA}</span>`;
                let valBCell = valB === undefined ? '<span class="italic text-slate-400">null</span>' : `<span class="text-green-600 font-semibold">${valB}</span>`;
                if (valA === undefined) {
                    rowClass = 'bg-green-50';
                    valBCell = `<span class="text-green-700 font-bold">${valB}</span>`;
                } else if (valB === undefined) {
                    rowClass = 'bg-red-50';
                    valACell = `<span class="text-red-700 font-bold line-through">${valA}</span>`;
                }
                rowStrings.push(`
                            <tr class="${rowClass}">
                                <td class="font-medium text-slate-600 px-4 py-2 border-b border-slate-100">${psetName}</td>
                                <td class="px-4 py-2 border-b border-slate-100">${prop}</td>
                                <td class="px-4 py-2 border-b border-slate-100">${valACell}</td>
                                <td class="px-4 py-2 border-b border-slate-100">${valBCell}</td>
                            </tr>
                        `);
            }
        });
    });
    if (rowStrings.length === 0) {
        return `<div class="p-3 text-center text-slate-400 italic">No property differences found.</div>`;
    }
    let displayRows = rowStrings;
    let hiddenCount = 0;
    if (rowStrings.length > limit) {
        displayRows = rowStrings.slice(0, limit);
        hiddenCount = rowStrings.length - limit;
    }
    let rowsHtml = displayRows.join('');
    if (hiddenCount > 0) {
        rowsHtml += `
                    <tr>
                        <td colspan="4" class="text-center py-2 bg-slate-50 text-slate-500 text-xs font-medium border-t border-slate-200">
                            + ${hiddenCount} more changes hidden
                        </td>
                    </tr>
                `;
    }
    return `
                <table class="w-full text-left prop-table border-collapse">
                    <thead>
                        <tr>
                            <th class="w-1/4">Property Set</th>
                            <th class="w-1/4">Name</th>
                            <th class="w-1/4">Original Value</th>
                            <th class="w-1/4">New Value</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white">
                        ${rowsHtml}
                    </tbody>
                </table>
            `;
}
function renderTree(parser, container) {
    container.innerHTML = '';
    let root = parser.projectRoot;
    if (!root) {
        const orphans = Array.from(parser.objects.values()).filter(o => !o.hasParent && (o.type === 'IFCPROJECT' || o.type === 'IFCSITE' || o.type === 'IFCBUILDING'));
        if (orphans.length > 0) root = orphans[0];
    }
    if (!root) {
        container.innerHTML = '<div class="text-slate-400 italic">No structure found.</div>';
        return;
    }
    container.appendChild(buildTreeNode(root));
}
function buildTreeNode(node) {
    const el = document.createElement('div');
    el.className = 'tree-node my-1';
    const hasChildren = node.children && node.children.length > 0;
    const iconClass = getNodeIcon(node.type, hasChildren);
    const status = globalDiffMap.get(node.guid);
    let statusClass = '';
    if (status === 'added') statusClass = 'node-added';
    else if (status === 'removed') statusClass = 'node-removed';
    else if (status === 'modified') statusClass = 'node-modified';
    const clickAttr = `onclick="selectNode('${node.guid}', event.ctrlKey)"`;
    const nodeId = `node-${node.guid}`;
    if (hasChildren) {
        const details = document.createElement('details');
        details.setAttribute('data-guid', node.guid);
        details.addEventListener('toggle', function (e) {
            if (this._syncing) return;
            const isOpen = this.open;
            const guid = this.getAttribute('data-guid');
            const others = document.querySelectorAll(`details[data-guid="${guid}"]`);
            others.forEach(other => {
                if (other !== this && other.open !== isOpen) {
                    other._syncing = true;
                    other.open = isOpen;
                    other._syncing = false;
                }
            });
        });
        if (['IFCPROJECT', 'IFCSITE', 'IFCBUILDING', 'IFCBUILDINGSTOREY'].includes(node.type)) {
            details.open = true;
        }
        const summary = document.createElement('summary');
        summary.className = `flex items-center text-slate-700 p-1 rounded select-none ${statusClass}`;
        summary.innerHTML = `
                    <span class="w-4 text-slate-400 text-xs mr-1"><i data-lucide="chevron-right" class="transition-transform group-open:rotate-90 w-4 h-4"></i></span>
                    <span class="tree-icon text-slate-800"><i data-lucide="${iconClass}" class="${iconClass === 'circle' ? 'w-2.5 h-2.5' : 'w-4 h-4'}"></i></span>
                    <span class="font-medium mr-2 flex-1" ${clickAttr} id="${nodeId}">${node.name || 'Unnamed'}</span>
                    <span class="text-xs text-slate-500 font-mono opacity-70">${node.type}</span>
                `;
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'tree-line ml-4 border-0 border-slate-200 pl-4';
        const sortedChildren = node.children.sort((a, b) => {
            const isSpatialA = a.type.includes('BUILDING') || a.type.includes('SITE');
            const isSpatialB = b.type.includes('BUILDING') || b.type.includes('SITE');
            if (isSpatialA && !isSpatialB) return -1;
            if (!isSpatialA && isSpatialB) return 1;
            return (a.name || '').localeCompare(b.name || '');
        });
        sortedChildren.forEach(child => {
            childrenContainer.appendChild(buildTreeNode(child));
        });
        details.appendChild(summary);
        details.appendChild(childrenContainer);
        el.appendChild(details);
    } else {
        el.className = `flex items-center text-slate-600 p-1 pl-6 hover:opacity-80 cursor-pointer ${statusClass}`;
        el.setAttribute('onclick', `selectNode('${node.guid}', event.ctrlKey)`);
        el.id = nodeId;
        el.innerHTML = `
                    <span class="tree-icon text-slate-400"><i data-lucide="${iconClass}" class="${iconClass === 'circle' ? 'w-2.5 h-2.5' : 'w-4 h-4'}"></i></span>
                    <span class="mr-2 font-medium">${node.name || 'Unnamed'}</span>
                    <span class="text-xs text-slate-500 font-mono opacity-70">${node.type}</span>
                `;
    }
    return el;
}
function getNodeIcon(type, hasChildren) {
    if (type === 'IFCPROJECT') return 'folder-open';
    if (type === 'IFCSITE') return 'map-pin';
    if (type === 'IFCBUILDING') return 'building-2';
    if (type === 'IFCBUILDINGSTOREY') return 'layers';
    if (type === 'IFCWALL' || type === 'IFCWALLSTANDARDCASE') return hasChildren ? 'folder' : 'circle';
    if (type === 'IFCSLAB') return hasChildren ? 'folder' : 'circle';
    if (type === 'IFCDOOR') return hasChildren ? 'folder' : 'circle';
    if (type === 'IFCWINDOW') return hasChildren ? 'folder' : 'circle';
    if (type === 'IFCCOLUMN') return hasChildren ? 'folder' : 'circle';
    if (type === 'IFCBEAM') return hasChildren ? 'folder' : 'circle';
    if (type === 'IFCSTAIR') return hasChildren ? 'folder' : 'circle';
    if (type === 'IFCROOF') return hasChildren ? 'folder' : 'circle';
    if (type === 'IFCFURNISHINGELEMENT') return hasChildren ? 'folder' : 'circle';
    return hasChildren ? 'folder' : 'circle';
}
window.selectNode = function (guid, multiSelect = false) {
    if (window.event) window.event.stopPropagation();
    if (window.viewerManager && window.viewerManager.dimensionMode) {
        return;
    }
    if (!window.selectedGuids) window.selectedGuids = [];
    if (multiSelect) {
        const index = window.selectedGuids.indexOf(guid);
        if (index > -1) {
            window.selectedGuids.splice(index, 1);
        } else {
            window.selectedGuids.push(guid);
        }
    } else {
        window.selectedGuids = [guid];
    }
    selectedGuid = window.selectedGuids.length > 0 ? window.selectedGuids[window.selectedGuids.length - 1] : null;
    document.querySelectorAll('.node-selected').forEach(el => el.classList.remove('node-selected'));
    window.selectedGuids.forEach(g => {
        const nodeEls = document.querySelectorAll(`[id="node-${g}"]`);
        nodeEls.forEach(el => {
            el.classList.add('node-selected');
            if (g === selectedGuid) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
    });
    document.querySelectorAll('.q-row-selected').forEach(el => el.classList.remove('q-row-selected'));
    window.selectedGuids.forEach(g => {
        const qRows = document.querySelectorAll(`tr[data-guid="${g}"]`);
        qRows.forEach(el => {
            el.classList.add('q-row-selected');
            if (g === selectedGuid && !document.getElementById('view-quantities').classList.contains('hidden')) {
                el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
    });
    if (selectedGuid) {
        renderProperties(selectedGuid);
    } else {
        dom.propEmpty.classList.remove('hidden');
        dom.propContent.classList.add('hidden');
    }
    if (window.viewerManager && !dom.viewViewer3d.classList.contains('hidden')) {
        window.viewerManager.highlight(window.selectedGuids);
    }
};
function renderProperties(guid) {
    const objA = parserA.objects.get(guid);
    const objB = parserB.objects.get(guid);
    if (!objA && !objB) return;
    const primary = objB || objA;
    dom.propEmpty.classList.add('hidden');
    dom.propContent.classList.remove('hidden');
    dom.propTitle.innerText = primary.name || 'Unnamed Element';
    dom.propSubtitle.innerText = `${primary.type} • ${guid}`;
    dom.propBadges.innerHTML = '';
    const status = globalDiffMap.get(guid);
    if (status) {
        const colors = status === 'added' ? 'bg-green-100 text-green-800' : status === 'removed' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800';
        dom.propBadges.innerHTML = `<span class="px-2 py-1 rounded text-xs font-bold uppercase ${colors}">${status}</span>`;
    } else {
        dom.propBadges.innerHTML = `<span class="px-2 py-1 rounded text-xs font-bold uppercase bg-slate-100 text-slate-600">Unchanged</span>`;
    }
    const headerA = dom.propFilenameA.parentElement;
    const headerB = dom.propFilenameB.parentElement;
    headerA.classList.remove('bg-accent', 'border-accent');
    headerA.classList.add('bg-slate-200', 'border-slate-300');
    headerA.firstElementChild.classList.remove('text-white');
    headerA.firstElementChild.classList.add('text-slate-800');
    dom.propFilenameA.classList.remove('text-white', 'opacity-90');
    dom.propFilenameA.classList.add('text-slate-600');
    headerB.classList.remove('bg-accent', 'border-accent');
    headerB.classList.add('bg-slate-200', 'border-slate-300');
    headerB.firstElementChild.classList.remove('text-white');
    headerB.firstElementChild.classList.add('text-slate-800');
    dom.propFilenameB.classList.remove('text-white', 'opacity-90');
    dom.propFilenameB.classList.add('text-slate-600');
    if (objA) {
        headerA.classList.remove('bg-slate-200', 'border-slate-300');
        headerA.classList.add('bg-accent', 'border-accent');
        headerA.firstElementChild.classList.remove('text-slate-800');
        headerA.firstElementChild.classList.add('text-white');
        dom.propFilenameA.classList.remove('text-slate-600');
        dom.propFilenameA.classList.add('text-white', 'opacity-90');
    }
    if (objB) {
        headerB.classList.remove('bg-slate-200', 'border-slate-300');
        headerB.classList.add('bg-accent', 'border-accent');
        headerB.firstElementChild.classList.remove('text-slate-800');
        headerB.firstElementChild.classList.add('text-white');
        dom.propFilenameB.classList.remove('text-slate-600');
        dom.propFilenameB.classList.add('text-white', 'opacity-90');
    }
    renderSimplePropList(objA, dom.propListA, objB);
    renderSimplePropList(objB, dom.propListB, objA);
    renderComparisonTable(objA, objB);
    if (dom.propPopupContent) {
        let sourceFile = "";
        if (objB && fileB) sourceFile = fileB.name;
        else if (objA && fileA) sourceFile = fileA.name;
        const propertiesHtml = generateAllPropertiesHTML(primary);
        dom.propPopupContent.innerHTML = `
                    <div class="mb-1 text-xs font-semibold text-accent border-b border-blue-100 pb-1 truncate" title="${sourceFile}">${sourceFile}</div>
                    <div class="mb-2 font-bold text-slate-800">${primary.name || 'Unnamed'}</div>
                    <div class="mb-2 text-xs text-slate-500 font-mono">${primary.type}</div>
                    ${propertiesHtml}
                `;
    }
}
function renderSimplePropList(obj, container, otherObj) {
    container.innerHTML = '';
    if (!obj) {
        container.innerHTML = '<div class="p-4 text-slate-400 text-sm italic">Element does not exist in this file.</div>';
        return;
    }
    const table = document.createElement('table');
    table.className = 'w-full text-left text-sm table-fixed';
    const otherPsets = otherObj ? otherObj.psets : null;
    const nameDiffers = otherObj && obj.name !== otherObj.name;
    let html = `<tbody class="divide-y divide-slate-100">`;
    html += `<tr class="bg-slate-50/50"><td class="px-4 py-2 font-medium text-slate-500">GUID</td><td class="px-4 py-2 font-mono text-xs">${obj.guid}</td></tr>`;
    const nameRowClass = nameDiffers ? 'bg-yellow-50' : '';
    const nameValClass = nameDiffers ? 'text-yellow-800' : '';
    html += `<tr class="${nameRowClass}"><td class="px-4 py-2 font-medium text-slate-500">Name</td><td class="px-4 py-2 ${nameValClass}">${obj.name || '-'}</td></tr>`;
    const allPsetNames = new Set([
        ...Object.keys(obj.psets),
        ...(otherPsets ? Object.keys(otherPsets) : [])
    ]);
    for (const pset of allPsetNames) {
        const ownProps = obj.psets[pset] || null;
        const otherProps = otherPsets ? (otherPsets[pset] || null) : null;
        const psetAdded = ownProps && !otherProps && otherObj;
        const psetRemoved = !ownProps && otherProps && otherObj;
        if (!ownProps) {
            html += `<tr class="bg-red-50/40"><td colspan="2" class="px-4 py-1 text-xs font-bold text-red-700 uppercase tracking-wide">${pset} <span class="font-normal normal-case italic ml-1 opacity-70">(not in this file)</span></td></tr>`;
            continue;
        }
        const psetHeaderClass = psetAdded ? 'bg-green-50 text-green-800 hover:bg-green-100' : 'bg-slate-200 text-slate-600 hover:bg-slate-200';
        const psetLabel = `${pset}${psetAdded ? ' <span class="font-normal normal-case italic ml-1 opacity-70">(new)</span>' : ''}`;
        const psetId = `pset-${obj.guid}-${pset.replace(/\s+/g, '_')}`;
        html += `<tr class="prop-pset-header ${psetHeaderClass} transition-colors" data-pset-id="${psetId}">`;
        html += `<td colspan="2" class="px-4 py-1.5 text-xs font-bold uppercase tracking-wide">`;
        html += `${psetLabel}`;
        html += `</td></tr>`;
        const allProps = new Set([
            ...Object.keys(ownProps),
            ...(otherProps ? Object.keys(otherProps) : [])
        ]);
        for (const key of allProps) {
            const val = ownProps[key];
            const otherVal = otherProps ? otherProps[key] : undefined;
            if (val === undefined) {
                continue;
            }
            let rowClass = '';
            let valClass = 'text-slate-800';
            if (!otherObj) {
            } else if (otherVal === undefined) {
                rowClass = 'bg-green-50';
                valClass = 'text-green-700';
            } else if (val !== otherVal) {
                rowClass = 'bg-yellow-50';
                valClass = 'text-yellow-800';
            }
            html += `<tr class="prop-pset-row ${rowClass}" data-pset-id="${psetId}"><td class="px-4 py-1 text-slate-600 pl-6">${key}</td><td class="px-4 py-1 ${valClass}">${val}</td></tr>`;
        }
    }
    html += `</tbody>`;
    table.innerHTML = html;
    container.appendChild(table);
    const headers = table.querySelectorAll('.prop-pset-header');
    headers.forEach(header => {
        header.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const psetId = header.dataset.psetId;
            const isCollapsed = header.classList.contains('collapsed');
            const allHeaders = document.querySelectorAll(`.prop-pset-header[data-pset-id="${psetId}"]`);
            const allRows = document.querySelectorAll(`.prop-pset-row[data-pset-id="${psetId}"]`);
            allHeaders.forEach(h => h.classList.toggle('collapsed', !isCollapsed));
            allRows.forEach(r => r.classList.toggle('prop-row-hidden', !isCollapsed));
        });
    });
}
function renderComparisonTable(objA, objB) {
    const tableHtml = generateComparisonTableHTML(objA, objB);
    const tbody = dom.propCompareBody;
    tbody.innerHTML = '';
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = tableHtml;
    const rows = tempDiv.querySelectorAll('tbody tr');
    if (rows.length > 0) {
        rows.forEach(row => tbody.appendChild(row));
    } else {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-slate-400">No property differences found.</td></tr>`;
    }
}
dom.tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        if (btn.disabled) return;
        dom.tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const target = btn.dataset.tab;
        dom.viewUpload.classList.add('hidden');
        dom.viewDiff.classList.add('hidden');
        dom.viewTreeStructure.classList.add('hidden');
        dom.viewProperties.classList.add('hidden');
        dom.viewQuantities.classList.add('hidden');
        dom.viewViewer3d.classList.add('hidden');
        document.getElementById('model-browser').classList.add('hidden');
        const qBrowser = document.getElementById('quantity-browser');
        if (qBrowser) qBrowser.classList.add('hidden');
        const qTableContainer = document.getElementById('q-table-container');
        if (qTableContainer && target !== 'viewer-3d') {
            document.getElementById('view-quantities').appendChild(qTableContainer);
        }
        if (target === 'upload') dom.viewUpload.classList.remove('hidden');
        if (target === 'diff') dom.viewDiff.classList.remove('hidden');
        if (target === 'tree-structure') {
            dom.viewTreeStructure.classList.remove('hidden');
            if (selectedGuid) {
                setTimeout(() => {
                    const nodeEls = document.querySelectorAll(`[id="node-${selectedGuid}"]`);
                    nodeEls.forEach(el => {
                        let p = el.parentElement;
                        while (p && p.tagName !== 'MAIN') {
                            if (p.tagName === 'DETAILS' && !p.open) p.open = true;
                            p = p.parentElement;
                        }
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    });
                }, 100);
            }
        }
        if (target === 'properties') dom.viewProperties.classList.remove('hidden');
        if (target === 'quantities') {
            dom.viewQuantities.classList.remove('hidden');
            if (qBrowser) {
                qBrowser.classList.remove('hidden');
                qBrowser.classList.remove('browser-minimized'); 
            }
            if (qDom.classSelect.options.length <= 1) populateQuantityClasses();
            const qTableContainer = document.getElementById('q-table-container');
            if (qTableContainer) {
                document.getElementById('view-quantities').appendChild(qTableContainer);
            }
        }
        if (target === 'viewer-3d') {
            dom.viewViewer3d.classList.remove('hidden');
            document.getElementById('model-browser').classList.remove('hidden');
            const bottomPanel = document.getElementById('viewer-bottom-panel');
            if (bottomPanel && !bottomPanel.classList.contains('hidden')) {
                if (qBrowser) qBrowser.classList.remove('hidden');
                const qTableContainer = document.getElementById('q-table-container');
                if (qTableContainer) {
                    document.getElementById('bottom-panel-content').appendChild(qTableContainer);
                }
            }
            if (window.viewerManager && !window.viewerManager.modelB && fileB) {
                window.viewerManager.loadModels(fileA, fileB);
            }
            if (selectedGuid && window.viewerManager) {
                window.viewerManager.highlight(selectedGuid);
            }
            if (window.updateInvalidElements3D) window.updateInvalidElements3D();
            setTimeout(() => {
                window.dispatchEvent(new Event('resize'));
            }, 100);
        }
    });
});
window.toggleQuantities3D = function (btn) {
    const bottomPanel = document.getElementById('viewer-bottom-panel');
    const qBrowser = document.getElementById('quantity-browser');
    const qTableContainer = document.getElementById('q-table-container');
    const bottomContent = document.getElementById('bottom-panel-content');
    if (!bottomPanel || !qBrowser || !qTableContainer || !bottomContent) return;
    if (bottomPanel.classList.contains('hidden')) {
        bottomPanel.classList.remove('hidden');
        qBrowser.classList.remove('hidden');
        qBrowser.classList.remove('browser-minimized'); 
        bottomContent.appendChild(qTableContainer);
        if (btn) btn.classList.add('active');
        const modelBrowser = document.getElementById('model-browser');
        if (modelBrowser && !modelBrowser.classList.contains('hidden')) {
            modelBrowser.classList.add('browser-minimized');
        }
        if (qDom.classSelect.options.length <= 1) populateQuantityClasses();
    } else {
        bottomPanel.classList.add('hidden');
        qBrowser.classList.add('hidden');
        if (btn) btn.classList.remove('active');
        const modelBrowser = document.getElementById('model-browser');
        if (modelBrowser) modelBrowser.classList.remove('browser-minimized');
    }
    if (window.updateInvalidElements3D) window.updateInvalidElements3D();
    setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
    }, 100);
};
document.addEventListener('DOMContentLoaded', () => {
    const allBrowsers = () => document.querySelectorAll('.model-browser');
    document.querySelectorAll('.model-browser .browser-header').forEach(header => {
        header.addEventListener('click', () => {
            const clicked = header.closest('.model-browser');
            if (!clicked) return;
            const isMinimized = clicked.classList.contains('browser-minimized');
            if (isMinimized) {
                clicked.classList.remove('browser-minimized');
                allBrowsers().forEach(b => {
                    if (b !== clicked && !b.classList.contains('hidden')) {
                        b.classList.add('browser-minimized');
                    }
                });
            } else {
                clicked.classList.add('browser-minimized');
            }
        });
    });
});
let isResizingBottom = false;
document.addEventListener('DOMContentLoaded', () => {
    const resizer = document.getElementById('viewer-bottom-resizer');
    const bottomPanel = document.getElementById('viewer-bottom-panel');
    const threeContainer = document.getElementById('three-container');
    if (resizer && bottomPanel) {
        resizer.addEventListener('mousedown', (e) => {
            isResizingBottom = true;
            document.body.style.cursor = 'ns-resize';
            e.preventDefault();
        });
        document.addEventListener('mousemove', (e) => {
            if (!isResizingBottom) return;
            const viewerAreaRect = document.getElementById('view-viewer-3d').getBoundingClientRect();
            const maxHeight = viewerAreaRect.height * 0.8;
            const minHeight = 100;
            let newHeight = viewerAreaRect.bottom - e.clientY;
            if (newHeight > maxHeight) newHeight = maxHeight;
            if (newHeight < minHeight) newHeight = minHeight;
            bottomPanel.style.height = `${newHeight}px`;
            window.dispatchEvent(new Event('resize'));
        });
        document.addEventListener('mouseup', () => {
            if (isResizingBottom) {
                isResizingBottom = false;
                document.body.style.cursor = '';
                window.dispatchEvent(new Event('resize'));
            }
        });
    }
});
let activeFilters = new Set(['added', 'removed', 'modified']); 
window.activeFilters = activeFilters; 
let actualCounts = { added: 0, removed: 0, modified: 0 }; 
function applyFilter() {
    let filtered = [];
    if (activeFilters.size > 0) {
        filtered = diffResults.filter(item => activeFilters.has(item.type));
    }
    renderList(filtered);
    if (window.viewerManager && window.viewerManager.currentMode === 'overlay') {
        window.viewerManager.setMode('overlay');
    }
}
function updateFilterButtonStyles() {
    dom.filterBtns.forEach(btn => {
        const filterType = btn.dataset.filter;
        const isActive = activeFilters.has(filterType);
        btn.classList.remove('bg-green-100', 'border-green-200', 'text-green-800', 'font-medium');
        btn.classList.remove('bg-red-100', 'border-red-200', 'text-red-800', 'font-medium');
        btn.classList.remove('bg-yellow-100', 'border-yellow-200', 'text-yellow-800', 'font-medium');
        if (isActive) {
            if (filterType === 'added') {
                btn.classList.add('bg-green-100', 'border-green-200', 'text-green-800', 'font-medium');
            } else if (filterType === 'removed') {
                btn.classList.add('bg-red-100', 'border-red-200', 'text-red-800', 'font-medium');
            } else if (filterType === 'modified') {
                btn.classList.add('bg-yellow-100', 'border-yellow-200', 'text-yellow-800', 'font-medium');
            }
            btn.classList.remove('bg-white', 'border-slate-200', 'text-slate-600');
        } else {
            btn.classList.add('bg-white', 'border-slate-200', 'text-slate-600');
        }
    });
}
dom.filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const filterType = btn.dataset.filter;
        if (activeFilters.has(filterType)) {
            activeFilters.delete(filterType);
        } else {
            activeFilters.add(filterType);
        }
        updateFilterButtonStyles();
        applyFilter();
    });
});
const qDom = {
    modelSelect: document.getElementById('q-model-select'),
    classSelect: document.getElementById('q-class-select'),
    tableContainer: document.getElementById('q-table-container'),
    exportBtn: document.getElementById('q-btn-export'),
    glossaryInput: document.getElementById('q-glossary-input'),
    glossaryLabel: document.getElementById('q-glossary-label')
};
window.validationRules = null;
if (qDom.glossaryInput) {
    qDom.glossaryInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        qDom.glossaryLabel.textContent = 'Loading...';
        qDom.glossaryLabel.classList.remove('text-red-600');
        try {
            const fileNameLower = file.name.toLowerCase();
            const rules = {};
            if (fileNameLower.endsWith('.xlsx') || fileNameLower.endsWith('.xls')) {
                const data = await file.arrayBuffer();
                const workbook = XLSX.read(data);
                workbook.SheetNames.forEach(sheetName => {
                    const sheet = workbook.Sheets[sheetName];
                    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
                    if (rows.length < 3) return; 
                    const psetsRow = rows[0];
                    const ifcAttrRow = rows[2];
                    const classRules = {};
                    for (let col = 0; col < psetsRow.length; col++) {
                        const pset = String(psetsRow[col] || '').trim();
                        const ifcAttr = String(ifcAttrRow[col] || '').trim();
                        if (!pset || !ifcAttr) continue;
                        const psetUpper = pset.toUpperCase();
                        const attrUpper = ifcAttr.toUpperCase();
                        if (!classRules[psetUpper]) classRules[psetUpper] = {};
                        const allowedValues = [];
                        for (let r = 3; r < rows.length; r++) {
                            const val = rows[r][col];
                            if (val !== undefined && val !== null && String(val).trim() !== '') {
                                allowedValues.push(String(val).trim().toUpperCase());
                            }
                        }
                        classRules[psetUpper][attrUpper] = allowedValues;
                    }
                    if (Object.keys(classRules).length > 0) {
                        rules[sheetName.trim().toUpperCase()] = classRules;
                    }
                });
            } else if (fileNameLower.endsWith('.ids')) {
                const text = await file.text();
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(text, "text/xml");
                const specs = Array.from(xmlDoc.getElementsByTagName("*")).filter(el => el.localName === "specification");
                for (let i = 0; i < specs.length; i++) {
                    const spec = specs[i];
                    const applicabilityNodes = Array.from(spec.children).filter(el => el.localName === "applicability");
                    if (applicabilityNodes.length === 0) continue;
                    const entityNodes = Array.from(applicabilityNodes[0].getElementsByTagName("*")).filter(el => el.localName === "entity");
                    if (entityNodes.length === 0) continue;
                    const nameNode = Array.from(entityNodes[0].getElementsByTagName("*")).find(el => el.localName === "name");
                    const simpleValueNode = nameNode ? Array.from(nameNode.getElementsByTagName("*")).find(el => el.localName === "simpleValue") : null;
                    const className = simpleValueNode?.textContent;
                    if (!className) continue;
                    const classUpper = className.trim().toUpperCase();
                    const requirementsNodes = Array.from(spec.children).filter(el => el.localName === "requirements");
                    if (requirementsNodes.length === 0) continue;
                    const propertyNodes = Array.from(requirementsNodes[0].getElementsByTagName("*")).filter(el => el.localName === "property");
                    for (let j = 0; j < propertyNodes.length; j++) {
                        const propNode = propertyNodes[j];
                        const psetNode = Array.from(propNode.getElementsByTagName("*")).find(el => el.localName === "propertySet");
                        const psetSimpleNode = psetNode ? Array.from(psetNode.getElementsByTagName("*")).find(el => el.localName === "simpleValue") : null;
                        const psetMatch = psetSimpleNode?.textContent;
                        const propNameNode = Array.from(propNode.getElementsByTagName("*")).find(el => el.localName === "name");
                        const propNameSimpleNode = propNameNode ? Array.from(propNameNode.getElementsByTagName("*")).find(el => el.localName === "simpleValue") : null;
                        const propNameMatch = propNameSimpleNode?.textContent;
                        if (!psetMatch || !propNameMatch) continue;
                        const psetUpper = psetMatch.trim().toUpperCase();
                        const attrUpper = propNameMatch.trim().toUpperCase();
                        if (!rules[classUpper]) rules[classUpper] = {};
                        if (!rules[classUpper][psetUpper]) rules[classUpper][psetUpper] = {};
                        const valueNode = Array.from(propNode.getElementsByTagName("*")).find(el => el.localName === "value");
                        let allowedValues = [];
                        if (valueNode) {
                            const simpleValues = Array.from(valueNode.getElementsByTagName("*")).filter(el => el.localName === "simpleValue");
                            simpleValues.forEach(node => {
                                if (node.textContent) {
                                    let content = node.textContent.trim().toUpperCase();
                                    if (content === "TRUE") content = ".T.";
                                    if (content === "FALSE") content = ".F.";
                                    allowedValues.push(content);
                                }
                            });
                            const enumValues = Array.from(valueNode.getElementsByTagName("*")).filter(el => el.localName === "enumeration");
                            enumValues.forEach(node => {
                                let valAttr = node.getAttribute("value");
                                if (valAttr) {
                                    valAttr = valAttr.trim().toUpperCase();
                                    if (valAttr === "TRUE") valAttr = ".T.";
                                    if (valAttr === "FALSE") valAttr = ".F.";
                                    allowedValues.push(valAttr);
                                }
                            });
                        }
                        if (allowedValues.length === 0) {
                            allowedValues.push("NOT_EMPTY");
                        }
                        rules[classUpper][psetUpper][attrUpper] = allowedValues;
                    }
                }
            } else {
                throw new Error("Unsupported file type");
            }
            window.validationRules = rules;
            qDom.glossaryLabel.textContent = file.name;
            qDom.glossaryLabel.title = "Glossary loaded successfully";
            if (window.renderGlossaryProgress) window.renderGlossaryProgress();
            if (qDom.classSelect.value) {
                updateQuantityTableBody();
            }
        } catch (err) {
            console.error('Failed to parse validation rules:', err);
            qDom.glossaryLabel.textContent = 'Error loading rules';
            qDom.glossaryLabel.classList.add('text-red-600');
        }
    });
    window.renderGlossaryProgress = function () {
        const progressContainer = document.getElementById('q-glossary-progress');
        if (!progressContainer) return;
        if (!window.validationRules || Object.keys(window.validationRules).length === 0) {
            progressContainer.classList.add('hidden');
            progressContainer.innerHTML = '';
            return;
        }
        const model = qDom.modelSelect.value === 'A' ? parserA : parserB;
        if (!model) {
            progressContainer.classList.add('hidden');
            return;
        }
        progressContainer.innerHTML = '<div class="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Validation Conformance</div>';
        Object.keys(window.validationRules).forEach(className => {
            const rules = window.validationRules[className];
            const elements = Array.from(model.objects.values()).filter(obj => obj.type.toUpperCase() === className);
            if (elements.length === 0) return; 
            const existingProps = new Set();
            elements.forEach(obj => {
                for (const [pset, props] of Object.entries(obj.psets)) {
                    for (const key of Object.keys(props)) {
                        existingProps.add(`${pset.toUpperCase()}.${key.toUpperCase()}`);
                    }
                }
            });
            let validCount = 0;
            elements.forEach(obj => {
                let isElementValid = true;
                for (const [psetUpper, attributes] of Object.entries(rules)) {
                    const actualPsetKey = Object.keys(obj.psets).find(key => key.toUpperCase() === psetUpper);
                    const psetProps = actualPsetKey ? obj.psets[actualPsetKey] : null;
                    for (const [attrUpper, allowedValues] of Object.entries(attributes)) {
                        if (allowedValues.length === 0) continue; 
                        if (!existingProps.has(`${psetUpper}.${attrUpper}`)) continue;
                        let val = undefined;
                        if (psetProps) {
                            const actualAttrKey = Object.keys(psetProps).find(key => key.toUpperCase() === attrUpper);
                            if (actualAttrKey) val = psetProps[actualAttrKey];
                        }
                        const strVal = String(val ?? '').trim().toUpperCase();
                        let isValueValid = false;
                        for (let expectedVal of allowedValues) {
                            if (expectedVal === "NOT_EMPTY") {
                                if (strVal && strVal !== 'UNDEFINED' && strVal !== 'NULL') {
                                    isValueValid = true;
                                    break;
                                }
                            } else if (expectedVal === "*" || expectedVal === "ANY") {
                                if (strVal && strVal !== 'UNDEFINED' && strVal !== 'NULL') {
                                    isValueValid = true;
                                    break;
                                }
                            } else if (expectedVal === "N/A") {
                                isValueValid = true;
                                break;
                            } else if (expectedVal === "YES" && strVal === ".T.") {
                                isValueValid = true;
                                break;
                            } else if (expectedVal === "NO" && strVal === ".F.") {
                                isValueValid = true;
                                break;
                            } else if (expectedVal.startsWith(">=") || expectedVal.startsWith("<=") || expectedVal.startsWith(">") || expectedVal.startsWith("<")) {
                                const numVal = parseFloat(strVal);
                                if (!isNaN(numVal)) {
                                    if (expectedVal.startsWith(">=")) {
                                        const threshold = parseFloat(expectedVal.substring(2));
                                        if (numVal >= threshold) { isValueValid = true; break; }
                                    } else if (expectedVal.startsWith("<=")) {
                                        const threshold = parseFloat(expectedVal.substring(2));
                                        if (numVal <= threshold) { isValueValid = true; break; }
                                    } else if (expectedVal.startsWith(">")) {
                                        const threshold = parseFloat(expectedVal.substring(1));
                                        if (numVal > threshold) { isValueValid = true; break; }
                                    } else if (expectedVal.startsWith("<")) {
                                        const threshold = parseFloat(expectedVal.substring(1));
                                        if (numVal < threshold) { isValueValid = true; break; }
                                    }
                                }
                            } else if (expectedVal.includes("-")) {
                                const parts = expectedVal.split("-");
                                if (parts.length === 2) {
                                    const min = parseFloat(parts[0]);
                                    const max = parseFloat(parts[1]);
                                    const numVal = parseFloat(strVal);
                                    if (!isNaN(min) && !isNaN(max) && !isNaN(numVal)) {
                                        if (numVal >= min && numVal <= max) {
                                            isValueValid = true;
                                            break;
                                        }
                                    }
                                }
                            } else if (strVal === expectedVal) {
                                isValueValid = true;
                                break;
                            }
                        }
                        if (!isValueValid) {
                            isElementValid = false;
                            break;
                        }
                    }
                    if (!isElementValid) break;
                }
                if (isElementValid) validCount++;
            });
            const total = elements.length;
            const percentage = Math.round((validCount / total) * 100);
            const barHTML = `
                <div class="mb-2 last:mb-0">
                    <div class="flex justify-between text-xs mb-1">
                        <span class="font-medium text-slate-700">${className}</span>
                        <span class="text-slate-500"><span class="${percentage === 100 ? 'text-green-600 font-bold' : percentage < 50 ? 'text-red-600 font-bold' : 'text-yellow-600 font-bold'}">${percentage}%</span> <span class="opacity-70 ml-1">(${validCount} elements out of ${total})</span></span>
                    </div>
                    <div class="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div class="h-1.5 rounded-full ${percentage === 100 ? 'bg-green-500' : percentage < 50 ? 'bg-red-500' : 'bg-yellow-500'}" style="width: ${percentage}%"></div>
                    </div>
                </div>
            `;
            progressContainer.insertAdjacentHTML('beforeend', barHTML);
        });
        progressContainer.classList.remove('hidden');
    };
}
const quantityState = {
    objects: [],
    columns: [],
    filters: {},
    sort: { colId: 'Name', dir: 'asc' },
    activePsets: null
};
qDom.modelSelect.addEventListener('change', () => {
    populateQuantityClasses();
    qDom.tableContainer.innerHTML = '<div class="p-10 text-center text-slate-400 italic flex flex-col items-center justify-center h-full"><i data-lucide="table-2" class="text-4xl mb-4 text-slate-200 w-10 h-10"></i><p>Select a Class.</p></div>';
    const btn = document.getElementById('q-pset-btn');
    const list = document.getElementById('q-pset-list');
    btn.disabled = true;
    btn.querySelector('span').textContent = 'All Property Sets';
    list.innerHTML = '';
    quantityState.activePsets = null;
    qDom.exportBtn.classList.add('hidden');
});
qDom.classSelect.addEventListener('change', () => {
    populateQuantityPsets();
    renderQuantityTable();
});
document.addEventListener('click', (e) => {
    const psetMenu = document.getElementById('q-pset-menu');
    const psetBtn = document.getElementById('q-pset-btn');
    if (psetMenu && !psetMenu.classList.contains('hidden') && !psetMenu.contains(e.target) && !psetBtn.contains(e.target)) {
        psetMenu.classList.add('hidden');
    }
});
function populateQuantityClasses() {
    const model = qDom.modelSelect.value === 'A' ? parserA : parserB;
    if (!model) return;
    const classes = new Set();
    model.objects.forEach(obj => classes.add(obj.type));
    qDom.classSelect.innerHTML = '<option value="">Select Class...</option>';
    Array.from(classes).sort().forEach(cls => {
        const opt = document.createElement('option');
        opt.value = cls;
        opt.textContent = cls;
        qDom.classSelect.appendChild(opt);
    });
    qDom.classSelect.disabled = false;
}
function populateQuantityPsets() {
    const model = qDom.modelSelect.value === 'A' ? parserA : parserB;
    const className = qDom.classSelect.value;
    const list = document.getElementById('q-pset-list');
    const btn = document.getElementById('q-pset-btn');
    if (!model || !className) {
        btn.disabled = true;
        btn.querySelector('span').textContent = 'All Property Sets';
        list.innerHTML = '';
        return;
    }
    const psets = new Set();
    model.objects.forEach(obj => {
        if (obj.type === className) {
            Object.keys(obj.psets).forEach(p => psets.add(p));
        }
    });
    let html = `
                <label class="flex items-center space-x-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                    <input type="checkbox" value="(Select All)" checked class="rounded accent-black focus:ring-black" onchange="window.handlePsetSelectAll(this)">
                    <span class="truncate font-medium text-slate-600">(Select All)</span>
                </label>`;
    Array.from(psets).sort().forEach(pset => {
        html += `
                    <label class="flex items-center space-x-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                        <input type="checkbox" value="${pset}" checked class="pset-checkbox rounded accent-black focus:ring-black">
                        <span class="truncate" title="${pset}">${pset}</span>
                    </label>`;
    });
    list.innerHTML = html;
    btn.disabled = false;
    btn.querySelector('span').textContent = 'All Property Sets';
    quantityState.activePsets = null;
    const search = document.getElementById('q-pset-search');
    if (search) {
        search.value = '';
        search.oninput = (e) => {
            const term = e.target.value.toLowerCase();
            list.querySelectorAll('label:not(:first-child)').forEach(lbl => {
                lbl.style.display = lbl.textContent.toLowerCase().includes(term) ? 'flex' : 'none';
            });
        };
    }
}
window.handlePsetSelectAll = function (cb) {
    document.querySelectorAll('#q-pset-list .pset-checkbox').forEach(c => {
        if (c.parentElement.style.display !== 'none') c.checked = cb.checked;
    });
};
window.applyPsetFilter = function () {
    const checkboxes = document.querySelectorAll('#q-pset-list .pset-checkbox');
    const selected = new Set();
    let allChecked = true;
    checkboxes.forEach(cb => {
        if (cb.checked) selected.add(cb.value);
        else allChecked = false;
    });
    const btn = document.getElementById('q-pset-btn');
    const menu = document.getElementById('q-pset-menu');
    if (allChecked || selected.size === 0) {
        btn.querySelector('span').textContent = 'All Property Sets';
        quantityState.activePsets = null; 
    } else {
        btn.querySelector('span').textContent = `${selected.size} Selected`;
        quantityState.activePsets = selected;
    }
    menu.classList.add('hidden');
    renderQuantityTable();
};
function renderQuantityTable(rebuildData = true) {
    if (rebuildData) {
        const model = qDom.modelSelect.value === 'A' ? parserA : parserB;
        const className = qDom.classSelect.value;
        const activePsets = quantityState.activePsets;
        if (!model || !className) return;
        const objects = [];
        model.objects.forEach(obj => {
            if (obj.type === className) {
                objects.push(obj);
            }
        });
        if (objects.length === 0) {
            qDom.tableContainer.innerHTML = '<div class="p-8 text-center text-slate-400">No elements found for this class.</div>';
            qDom.exportBtn.classList.add('hidden');
            return;
        }
        const columns = [
            { id: 'No', label: 'No.', accessor: (o, i) => i + 1, width: '50px', cellClass: 'text-slate-400' },
            { id: 'GlobalId', label: 'GlobalId', accessor: (o) => o.guid },
            { id: 'Name', label: 'Name', accessor: (o) => o.name || '-' }
        ];
        const propKeys = new Set();
        objects.forEach(obj => {
            for (const [psetName, props] of Object.entries(obj.psets)) {
                if (activePsets && !activePsets.has(psetName)) continue;
                for (const key of Object.keys(props)) {
                    const compositeKey = `${psetName}.${key}`;
                    if (!propKeys.has(compositeKey)) {
                        propKeys.add(compositeKey);
                        columns.push({
                            id: compositeKey,
                            label: key,
                            subLabel: psetName,
                            accessor: (o) => o.psets[psetName]?.[key] ?? ''
                        });
                    }
                }
            }
        });
        const fixedCols = columns.slice(0, 3);
        const dynamicCols = columns.slice(3).sort((a, b) => {
            if (a.subLabel !== b.subLabel) return a.subLabel.localeCompare(b.subLabel);
            return a.label.localeCompare(b.label);
        });
        let lastPset = null;
        let isAlt = false;
        dynamicCols.forEach(col => {
            if (col.subLabel !== lastPset) {
                lastPset = col.subLabel;
                isAlt = !isAlt;
            }
            col.headerClass = isAlt ? 'bg-slate-200' : 'bg-slate-100';
            col.cellClass = isAlt ? 'bg-slate-50' : 'bg-white';
        });
        fixedCols.forEach(col => {
            col.headerClass = 'bg-slate-100';
            col.cellClass = (col.cellClass || '') + ' bg-white';
        });
        quantityState.objects = objects;
        quantityState.columns = [...fixedCols, ...dynamicCols];
        quantityState.filters = {};
        quantityState.sort = { colId: 'Name', dir: 'asc' };
    }
    let headerHtml = `
                <table class="w-full text-left border-collapse text-sm table-fixed">
                    <thead class="sticky top-0 z-1 shadow-sm">
                        <tr>
            `;
    quantityState.columns.forEach(col => {
        const isNoCol = col.id === 'No';
        const isFilterActive = quantityState.filters[col.id] !== undefined;
        let widthStyle = '';
        if (col.currentWidth) {
            widthStyle = `width: ${col.currentWidth}px; min-width: ${col.currentWidth}px; max-width: ${col.currentWidth}px;`;
        } else if (col.width) {
            widthStyle = `width: ${col.width}; min-width: ${col.width};`;
        } else {
            widthStyle = `width: 150px; min-width: 150px;`;
        }
        headerHtml += `
                    <th class="p-2 border-b border-slate-300 font-semibold text-slate-700 align-top ${col.headerClass} relative group/th" style="${widthStyle}">
                        <div class="flex justify-between items-start gap-2 overflow-hidden">
                            <div class="flex flex-col overflow-hidden cursor-pointer hover:text-blue-600 group flex-1" onclick="window.handleQuantitySort('${col.id}')">
                                    <span class="truncate" title="${col.label}">${col.label}</span>
                                    ${col.subLabel ? `<span class="text-[10px] text-slate-500 font-normal truncate" title="${col.subLabel}">${col.subLabel}</span>` : ''}
                            </div>
                            <div class="flex items-center gap-1 shrink-0">
                                <i data-lucide="chevrons-up-down" class="text-slate-300 hover:text-blue-400 cursor-pointer w-4 h-4" id="sort-icon-${col.id}" onclick="window.handleQuantitySort('${col.id}')"></i>
                                ${!isNoCol ? `<button class="p-1 hover:bg-slate-200 rounded filter-trigger transition-colors" onclick="window.toggleFilterMenu('${col.id}', this, event)"><i data-lucide="filter" class="text-xs ${isFilterActive ? 'text-accent' : 'text-slate-300'} w-4 h-4"></i></button>` : ''}
                            </div>
                        </div>
                        <div class="resize-handle" onmousedown="window.initResizeColumn(event, '${col.id}')"></div>
                    </th>
                `;
    });
    headerHtml += `</tr></thead><tbody id="q-table-body" class="divide-y divide-slate-100"></tbody></table>`;
    qDom.tableContainer.innerHTML = headerHtml;
    qDom.exportBtn.classList.remove('hidden');
    updateQuantityTableBody();
}
window.initResizeColumn = function (e, colId) {
    e.preventDefault();
    e.stopPropagation();
    const th = e.target.closest('th');
    const startX = e.clientX;
    const startWidth = th.offsetWidth;
    const onMouseMove = (moveEvent) => {
        const currentX = moveEvent.clientX;
        const diffX = currentX - startX;
        const newWidth = Math.max(50, startWidth + diffX);
        th.style.width = `${newWidth}px`;
        th.style.minWidth = `${newWidth}px`;
        th.style.maxWidth = `${newWidth}px`;
        const col = quantityState.columns.find(c => c.id === colId);
        if (col) col.currentWidth = newWidth;
    };
    const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
};
window.handleQuantitySort = function (colId) {
    if (quantityState.sort.colId === colId) {
        quantityState.sort.dir = quantityState.sort.dir === 'asc' ? 'desc' : 'asc';
    } else {
        quantityState.sort.colId = colId;
        quantityState.sort.dir = 'asc';
    }
    document.querySelectorAll('[id^="sort-icon-"]').forEach(icon => {
        const newI = document.createElement('i');
        newI.id = icon.id;
        newI.className = 'text-slate-400 group-hover:text-blue-400 w-4 h-4 cursor-pointer';
        newI.setAttribute('onclick', icon.getAttribute('onclick') || `window.handleQuantitySort('${icon.id.replace('sort-icon-', '')}')`);
        newI.setAttribute('data-lucide', 'chevrons-up-down');
        icon.replaceWith(newI);
    });
    const activeIcon = document.getElementById(`sort-icon-${colId}`);
    if (activeIcon) {
        activeIcon.className = `text-blue-600 w-4 h-4 cursor-pointer`;
        activeIcon.setAttribute('data-lucide', quantityState.sort.dir === 'asc' ? 'chevron-up' : 'chevron-down');
    }
    if (window.renderIcons) window.renderIcons();
    updateQuantityTableBody();
};
window.toggleFilterMenu = function (colId, btn, event) {
    event.stopPropagation();
    let menu = document.getElementById('q-filter-menu');
    if (!menu) {
        menu = document.createElement('div');
        menu.id = 'q-filter-menu';
        menu.className = 'fixed bg-white border border-slate-200 shadow-xl rounded-lg z-50 hidden flex flex-col w-64 max-h-[400px] text-sm';
        document.body.appendChild(menu);
        document.addEventListener('click', (e) => {
            if (!menu.contains(e.target) && !e.target.closest('.filter-trigger')) {
                menu.classList.add('hidden');
            }
        });
    }
    if (menu.dataset.activeCol === colId && !menu.classList.contains('hidden')) {
        menu.classList.add('hidden');
        return;
    }
    menu.dataset.activeCol = colId;
    menu.classList.remove('hidden');
    const rect = btn.getBoundingClientRect();
    menu.style.top = `${rect.bottom + 5}px`;
    menu.style.left = `${rect.left}px`;
    if (rect.left + 256 > window.innerWidth) menu.style.left = `${rect.right - 256}px`;
    const col = quantityState.columns.find(c => c.id === colId);
    const uniqueValues = new Set();
    quantityState.objects.forEach(obj => uniqueValues.add(String(col.accessor(obj))));
    const sortedValues = Array.from(uniqueValues).sort();
    const currentFilter = quantityState.filters[colId];
    let html = `
                <div class="p-2 border-b border-slate-100 bg-slate-50 rounded-t-lg">
                    <div class="font-semibold text-slate-700 mb-2 truncate">Filter: ${col.label}</div>
                    <input type="text" id="q-filter-search" class="w-full px-2 py-1 border border-slate-300 rounded text-xs focus:outline-none focus:border-blue-500" placeholder="Search...">
                </div>
                <div class="overflow-y-auto p-2 flex-1 space-y-1" id="q-filter-list">
                    <label class="flex items-center space-x-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                        <input type="checkbox" value="(Select All)" ${!currentFilter ? 'checked' : ''} class="rounded accent-black focus:ring-black" onchange="window.handleFilterSelectAll(this)">
                        <span class="truncate font-medium text-slate-600">(Select All)</span>
                    </label>`;
    sortedValues.forEach(val => {
        const isChecked = !currentFilter || currentFilter.has(val);
        html += `<label class="flex items-center space-x-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                        <input type="checkbox" value="${val.replace(/"/g, '&quot;')}" ${isChecked ? 'checked' : ''} class="val-checkbox rounded accent-black focus:ring-black">
                        <span class="truncate" title="${val}">${val || '(Empty)'}</span>
                    </label>`;
    });
    html += `</div><div class="p-2 border-t border-slate-100 bg-slate-50 rounded-b-lg flex justify-between">
                    <button class="px-3 py-1 text-xs font-medium text-slate-600 hover:text-slate-800" onclick="document.getElementById('q-filter-menu').classList.add('hidden')">Cancel</button>
                    <button class="px-3 py-1 text-xs font-medium text-white bg-accent hover:bg-accent rounded" onclick="window.applyQuantityFilter('${colId}')">Apply</button>
                </div>`;
    menu.innerHTML = html;
    menu.querySelector('#q-filter-search').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        menu.querySelectorAll('#q-filter-list label:not(:first-child)').forEach(lbl => {
            lbl.style.display = lbl.textContent.toLowerCase().includes(term) ? 'flex' : 'none';
        });
    });
};
window.handleFilterSelectAll = function (cb) {
    document.querySelectorAll('#q-filter-list .val-checkbox').forEach(c => {
        if (c.parentElement.style.display !== 'none') c.checked = cb.checked;
    });
};
window.applyQuantityFilter = function (colId) {
    const checkboxes = document.querySelectorAll('#q-filter-list .val-checkbox');
    const selected = new Set();
    let allChecked = true;
    checkboxes.forEach(cb => {
        if (cb.checked) selected.add(cb.value);
        else allChecked = false;
    });
    if (allChecked) delete quantityState.filters[colId];
    else quantityState.filters[colId] = selected;
    document.getElementById('q-filter-menu').classList.add('hidden');
    renderQuantityTable(false); 
};
function updateQuantityTableBody() {
    const tbody = document.getElementById('q-table-body');
    if (!tbody) return;
    let data = quantityState.objects.filter(obj => {
        return quantityState.columns.every(col => {
            if (col.id === 'No') return true;
            const filterSet = quantityState.filters[col.id];
            if (!filterSet) return true;
            return filterSet.has(String(col.accessor(obj)));
        });
    });
    const { colId, dir } = quantityState.sort;
    if (colId && colId !== 'No') {
        const column = quantityState.columns.find(c => c.id === colId);
        if (column) {
            data.sort((a, b) => {
                const valA = String(column.accessor(a));
                const valB = String(column.accessor(b));
                const numA = parseFloat(valA);
                const numB = parseFloat(valB);
                if (!isNaN(numA) && !isNaN(numB)) {
                    return dir === 'asc' ? numA - numB : numB - numA;
                }
                return dir === 'asc' ? valA.localeCompare(valB, undefined, { numeric: true }) : valB.localeCompare(valA, undefined, { numeric: true });
            });
        }
    }
    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${quantityState.columns.length}" class="p-4 text-center text-slate-400 italic">No matching results</td></tr>`;
        return;
    }
    const currentClass = qDom.classSelect.value ? qDom.classSelect.value.toUpperCase() : null;
    const glossaryRules = window.validationRules && currentClass ? window.validationRules[currentClass] : null;
    quantityState.invalidGuids = [];
    const rows = data.map((obj, index) => {
        let isInvalid = false;
        let tds = quantityState.columns.map(col => {
            let val = col.accessor(obj, index);
            let cellClass = col.cellClass || '';
            let titleText = val;
            let displayVal = val;
            if (glossaryRules && col.subLabel && col.label) {
                const psetUpper = col.subLabel.toUpperCase();
                const attrUpper = col.label.toUpperCase();
                if (glossaryRules[psetUpper] && glossaryRules[psetUpper][attrUpper] !== undefined) {
                    const allowedValues = glossaryRules[psetUpper][attrUpper];
                    if (allowedValues.length > 0) {
                        const strVal = String(val).trim().toUpperCase();
                        let isValueValid = false;
                        let matchedRule = "";
                        for (let expectedVal of allowedValues) {
                            if (expectedVal === "NOT_EMPTY") {
                                if (strVal && strVal !== 'UNDEFINED' && strVal !== 'NULL') { isValueValid = true; matchedRule = expectedVal; break; }
                            } else if (expectedVal === "*" || expectedVal === "ANY") {
                                if (strVal && strVal !== 'UNDEFINED' && strVal !== 'NULL') { isValueValid = true; matchedRule = expectedVal; break; }
                            } else if (expectedVal === "N/A") {
                                isValueValid = true; matchedRule = expectedVal; break;
                            } else if (expectedVal === "YES" && strVal === ".T.") {
                                isValueValid = true; matchedRule = expectedVal; break;
                            } else if (expectedVal === "NO" && strVal === ".F.") {
                                isValueValid = true; matchedRule = expectedVal; break;
                            } else if (expectedVal.startsWith(">=") || expectedVal.startsWith("<=") || expectedVal.startsWith(">") || expectedVal.startsWith("<")) {
                                const numVal = parseFloat(strVal);
                                if (!isNaN(numVal)) {
                                    if (expectedVal.startsWith(">=") && numVal >= parseFloat(expectedVal.substring(2))) { isValueValid = true; matchedRule = expectedVal; break; }
                                    else if (expectedVal.startsWith("<=") && numVal <= parseFloat(expectedVal.substring(2))) { isValueValid = true; matchedRule = expectedVal; break; }
                                    else if (expectedVal.startsWith(">") && numVal > parseFloat(expectedVal.substring(1))) { isValueValid = true; matchedRule = expectedVal; break; }
                                    else if (expectedVal.startsWith("<") && numVal < parseFloat(expectedVal.substring(1))) { isValueValid = true; matchedRule = expectedVal; break; }
                                }
                            } else if (expectedVal.includes("-")) {
                                const parts = expectedVal.split("-");
                                if (parts.length === 2) {
                                    const min = parseFloat(parts[0]);
                                    const max = parseFloat(parts[1]);
                                    const numVal = parseFloat(strVal);
                                    if (!isNaN(min) && !isNaN(max) && !isNaN(numVal) && numVal >= min && numVal <= max) {
                                        isValueValid = true; matchedRule = expectedVal; break;
                                    }
                                }
                            } else if (strVal === expectedVal) {
                                isValueValid = true;
                                matchedRule = expectedVal;
                                break;
                            }
                        }
                        if (!isValueValid) {
                            cellClass += ' !bg-red-100 !text-red-800 font-bold';
                            displayVal = `⚠️ ${val || '(Empty)'}`;
                            isInvalid = true;
                            const isNotEmptyRule = allowedValues.includes("NOT_EMPTY") || allowedValues.includes("*");
                            const isNaRule = allowedValues.includes("N/A");
                            if (isNotEmptyRule && allowedValues.length === 1) {
                                titleText = `Invalid value: ${val || '(Empty)'} (Required: Not Empty)`;
                            } else if (isNaRule && allowedValues.length === 1) {
                                titleText = `Invalid value: ${val || '(Empty)'} (Required: N/A)`;
                            } else {
                                titleText = `Invalid value: ${val || '(Empty)'} (Allowed: ${allowedValues.join(', ')})`;
                            }
                        }
                    }
                }
            }
            return `<td class="p-2 truncate border-b border-slate-100 ${cellClass}" title="${titleText}">${displayVal}</td>`;
        }).join('');
        if (isInvalid) quantityState.invalidGuids.push(obj.guid);
        const isSelected = obj.guid === selectedGuid ? ' q-row-selected' : '';
        return `<tr class="hover:bg-slate-50 transition-colors cursor-pointer${isSelected}" data-guid="${obj.guid}" onclick="selectNode('${obj.guid}', event.ctrlKey)">${tds}</tr>`;
    }).join('');
    tbody.innerHTML = rows;
    if (window.updateInvalidElements3D) window.updateInvalidElements3D();
}
window.updateInvalidElements3D = function () {
    if (!window.viewerManager) return;
    const bottomPanel = document.getElementById('viewer-bottom-panel');
    const qBrowser = document.getElementById('quantity-browser');
    const isActive = bottomPanel && !bottomPanel.classList.contains('hidden') &&
        qBrowser && !qBrowser.classList.contains('hidden');
    if (!isActive) {
        window.viewerManager.clearInvalidHighlight();
        return;
    }
    window.viewerManager.highlightInvalid(quantityState.invalidGuids || []);
};
qDom.exportBtn.onclick = () => {
    let data = quantityState.objects.filter(obj => {
        return quantityState.columns.every(col => {
            if (col.id === 'No') return true;
            const filterSet = quantityState.filters[col.id];
            if (!filterSet) return true;
            return filterSet.has(String(col.accessor(obj)));
        });
    });
    const { colId, dir } = quantityState.sort;
    if (colId && colId !== 'No') {
        const column = quantityState.columns.find(c => c.id === colId);
        if (column) {
            data.sort((a, b) => {
                const valA = String(column.accessor(a));
                const valB = String(column.accessor(b));
                const numA = parseFloat(valA);
                const numB = parseFloat(valB);
                if (!isNaN(numA) && !isNaN(numB)) return dir === 'asc' ? numA - numB : numB - numA;
                return dir === 'asc' ? valA.localeCompare(valB, undefined, { numeric: true }) : valB.localeCompare(valA, undefined, { numeric: true });
            });
        }
    }
    const headers = quantityState.columns.map(c => c.label);
    const rows = data.map((obj, index) => {
        return quantityState.columns.map(col => col.accessor(obj, index));
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, "Quantities");
    XLSX.writeFile(wb, `IFC_Quantities_${qDom.classSelect.value}.xlsx`);
};
function updateCountDisplay() {
    dom.countAdded.textContent = actualCounts.added;
    dom.countRemoved.textContent = actualCounts.removed;
    dom.countModified.textContent = actualCounts.modified;
}
function generateAllPropertiesHTML(obj) {
    if (!obj) return '<div class="text-slate-400 italic">No data</div>';
    let html = '<div class="space-y-2">';
    html += '<div class="bg-slate-50 p-2 rounded border border-slate-100">';
    html += `<div class="font-bold text-slate-700 text-xs mb-1">Attributes</div>`;
    html += `<div class="grid grid-cols-2 gap-1 text-xs">`;
    html += `<div class="text-slate-500">Name</div><div class="truncate" title="${obj.name}">${obj.name}</div>`;
    html += `<div class="text-slate-500">GlobalId</div><div class="font-mono text-[10px]">${obj.guid}</div>`;
    html += `</div></div>`;
    for (const [psetName, props] of Object.entries(obj.psets)) {
        html += '<details class="bg-slate-50 p-2 rounded border border-slate-100 group" open>';
        html += `<summary class="bg-slate-200 font-bold text-slate-800 text-xs mb-1 border-b border-slate-200 pb-1 pt-1 cursor-pointer list-none flex items-center select-none px-2 rounded">`;
        html += `<i data-lucide="chevron-right" class="text-[10px] text-slate-400 mr-2 transition-transform group-open:rotate-90 w-3 h-3"></i>`;
        html += `${psetName}</summary>`;
        html += `<div class="grid grid-cols-2 gap-x-2 gap-y-1 text-xs mt-1">`;
        for (const [key, val] of Object.entries(props)) {
            html += `<div class="text-slate-500 truncate" title="${key}">${key}</div><div class="truncate text-slate-800" title="${val}">${val}</div>`;
        }
        html += `</div></details>`;
    }
    html += '</div>';
    return html;
};
dom.btnTreeExpand.addEventListener('click', () => {
    const allDetails = document.querySelectorAll('#tree-container-a details, #tree-container-b details');
    allDetails.forEach(d => d.open = true);
});
dom.btnTreeCollapse.addEventListener('click', () => {
    const allDetails = document.querySelectorAll('#tree-container-a details, #tree-container-b details');
    allDetails.forEach(d => d.open = false);
});