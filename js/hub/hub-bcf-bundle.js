//#region js/webifc/coo_bcf_shared.js
var e = typeof window < "u" && window.liteAECO && window.liteAECO.bcf || null, t = e && e.STATUSES || [
	"Active",
	"In Progress",
	"In Review",
	"Done",
	"Closed"
], n = e && e.TYPES || [
	"Conflict",
	"Coordination",
	"Comment",
	"Design",
	"Defect",
	"Request",
	"Requirement",
	"Decision",
	"Task"
], r = e && e.PRIORITIES || [
	"Low",
	"Normal",
	"Major",
	"Critical"
], i = e && e.STAGES || [
	"Design",
	"Tender",
	"Construction",
	"Handover",
	"Operation"
], a = e && e.CLOSED || ["Done", "Closed"], o = [
	"ARC",
	"STR",
	"ELE",
	"HVAC",
	"SAN",
	"MEP",
	"VOID",
	"FUR",
	"INT",
	"FAC",
	"FND",
	"LAN",
	"PRO",
	"LAB",
	"ICT",
	"SEC"
];
function s(e, t, n) {
	let r = (typeof window < "u" && window.BASE_PAGE || {})[e] || t;
	return n ? c(r, n) : r;
}
function c(e, t) {
	return String(e).replace(/\{(\w+)\}/g, (e, n) => t && t[n] != null ? String(t[n]) : e);
}
function l(e, t) {
	let n = (e) => typeof t == "function" ? t(e.guid) : null, r = new Set(a), i = (e) => r.has(e && e.status);
	function o(e) {
		let t = e && e.comments;
		return t ? typeof t.values == "function" ? [...t.values()] : [...t] : [];
	}
	function s({ search: t = "", status: r = "", sort: i = "created-desc" } = {}) {
		let a = String(t).trim().toLowerCase(), o = e();
		r && (o = o.filter((e) => e.status === r));
		let s = /^#?\d+$/.test(a) ? Number(a.replace("#", "")) : null;
		s === null ? a && (o = o.filter((e) => `${n(e) || ""} ${e.title} ${e.description || ""} ${e.assignedTo || ""} ${e.status} ${e.type || ""} ${[...e.labels || []].join(" ")}`.toLowerCase().includes(a))) : o = o.filter((e) => n(e) === s);
		let c = (e) => e ? new Date(e).getTime() : 0;
		return o.sort((e, t) => i === "due-asc" ? c(e.dueDate) - c(t.dueDate) : c(t.creationDate) - c(e.creationDate)), o;
	}
	function c(t) {
		let n = e(), r = {
			total: n.length,
			open: 0,
			inProgress: 0,
			closed: 0,
			overdue: 0
		}, a = t || Date.now();
		for (let e of n) i(e) ? r.closed++ : e.status === "In Progress" || e.status === "In Review" ? r.inProgress++ : r.open++, !i(e) && e.dueDate && new Date(e.dueDate).getTime() < a && r.overdue++;
		let o = n.map((e) => new Date(e.creationDate).getTime()).filter((e) => isFinite(e) && e > 0).sort((e, t) => e - t), s = n.filter(i).map((e) => new Date(e.modifiedDate || e.creationDate).getTime()).filter((e) => isFinite(e) && e > 0).sort((e, t) => e - t);
		if (!o.length) return {
			counts: r,
			timeline: []
		};
		let c = 864e5, l = Math.floor(o[0] / c) * c, u = Math.floor(a / c) * c, d = [], f = 0, p = 0;
		for (let e = l; e <= u; e += c) {
			for (; f < o.length && o[f] < e + c;) f++;
			for (; p < s.length && s[p] < e + c;) p++;
			d.push({
				t: e,
				created: f,
				closed: p
			});
		}
		return {
			counts: r,
			timeline: d
		};
	}
	return {
		isClosed: i,
		commentsOf: o,
		query: s,
		dashboard: c
	};
}
//#endregion
//#region js/hub/hub-bcf-core.js
var u = 4, d = 600, f = 6;
function p(e) {
	if (!e || !e.length) return null;
	let t = e[0] === 255 && e[1] === 216 ? "image/jpeg" : "image/png", n = "";
	for (let t = 0; t < e.length; t += 32768) n += String.fromCharCode.apply(null, e.subarray(t, t + 32768));
	return "data:" + t + ";base64," + btoa(n);
}
function m(e) {
	try {
		let t = atob(String(e).split(",")[1] || ""), n = new Uint8Array(t.length);
		for (let e = 0; e < t.length; e++) n[e] = t.charCodeAt(e);
		return n;
	} catch {
		return null;
	}
}
var h = (e) => String(e || "").split("/").pop();
function g(e = {}) {
	let t = e.win || window, n = t.liteAECO && t.liteAECO.bcf;
	if (!n || typeof n.saveTopic != "function") throw Error("liteAECO.bcf (js/liteaeco-bcf.js) missing or older than build 2");
	let r = e.io, i = e.app || "coordination", a = e.folder;
	if (!r || !a) throw Error("createFileCore: io and folder are required");
	let o = /* @__PURE__ */ new Map(), c = /* @__PURE__ */ new Map(), u = /* @__PURE__ */ new Map(), g = /* @__PURE__ */ new Set(), _ = /* @__PURE__ */ new Map(), v = !1, y = {}, b = /* @__PURE__ */ new Map(), x = null, S = null, C = null, w = () => {
		for (let e of g) try {
			e();
		} catch (e) {
			console.warn("[bcf-filecore] listener failed", e);
		}
	}, T = (t) => {
		typeof e.onNotice == "function" ? e.onNotice(t) : console.warn("[bcf-filecore] " + t);
	}, E = (e) => a + "/" + String(e).replace(/[^A-Za-z0-9-]/g, "") + ".bcf";
	function D(e, t) {
		let r = n.topic(e, t), i = /* @__PURE__ */ new Map();
		for (let e of r.comments) i.set(e.guid, {
			guid: e.guid,
			comment: e.text,
			author: e.author,
			date: e.date,
			viewpoint: e.viewpoint,
			__topic: t
		});
		return {
			guid: t,
			index: r.index || null,
			title: r.title,
			status: r.status,
			type: r.type,
			priority: r.priority,
			stage: r.stage,
			assignedTo: r.assignedTo,
			dueDate: r.dueDate || null,
			description: r.description,
			labels: new Set(r.labels),
			creationDate: r.creationDate,
			creationAuthor: r.creationAuthor,
			modifiedDate: r.modifiedDate || null,
			modifiedAuthor: r.modifiedAuthor || null,
			comments: i,
			viewpoints: new Set(r.viewpoints.map((e) => e.guid)),
			extras: r.extras || null
		};
	}
	function O(e, t, r) {
		let i = n.read(t), a = n.topics(i);
		r && b.set(e, {
			size: r.size,
			lastModified: r.lastModified,
			entries: a.map((t) => {
				let r = n.topic(i, t);
				return {
					guid: t,
					index: r.index,
					creationDate: r.creationDate,
					rel: e
				};
			})
		});
		for (let s of a) {
			let l = a.length > 1 ? (() => {
				let e = n.read(t);
				return n.only(e, s), e;
			})() : i;
			o.set(s, {
				rel: e,
				pack: l,
				known: new Set(n.topic(l, s).comments.map((e) => e.guid)),
				stamp: r || null
			}), c.set(s, D(l, s)), _.delete(s);
		}
		return a;
	}
	async function k() {
		try {
			v = !!await r.canUpload(a);
		} catch {
			v = !1;
		}
		return v;
	}
	async function A() {
		let e = [];
		try {
			e = await r.list(a) || [];
		} catch (e) {
			console.warn("[bcf-filecore] issues folder not listed", e);
		}
		return e.filter((e) => /\.bcf(zip)?$/i.test(e.name || e.path || ""));
	}
	async function j(e, t) {
		let n = 0;
		await Promise.all(Array.from({ length: Math.min(f, e.length) }, async () => {
			for (; n < e.length;) {
				let r = e[n++];
				try {
					await t(r);
				} catch (e) {
					console.warn("[bcf-filecore] issue file skipped: " + r.path, e);
				}
			}
		}));
	}
	async function M() {
		return await k(), await j(await A(), async (e) => {
			let t = await r.read(e.path);
			t && O(e.path, t, {
				size: e.size,
				lastModified: e.lastModified
			});
		}), await L(), w(), c.size;
	}
	async function N() {
		await k();
		let e = await A(), t = new Set(e.map((e) => e.path)), n = 0;
		await j(e, async (e) => {
			let t = [...o.entries()].find(([, t]) => t.rel === e.path)?.[0] || h(e.path).replace(/\.bcf(zip)?$/i, ""), i = o.get(t);
			if (i && i.stamp && i.stamp.size === e.size && i.stamp.lastModified === e.lastModified || u.has(t)) return;
			let a = await r.read(e.path);
			a && (O(e.path, a, {
				size: e.size,
				lastModified: e.lastModified
			}), n++);
		});
		for (let [e, r] of [...o]) t.has(r.rel) || u.has(e) || (o.delete(e), c.delete(e), _.delete(e), b.delete(r.rel), n++);
		return await L(), n && w(), n;
	}
	function P() {
		return v ? !0 : (T(s("bcfRefused", "Not saved: no upload right on the issues folder.")), !1);
	}
	function F(e, t) {
		let n = u.get(e) || /* @__PURE__ */ new Set();
		for (let e of t) n.add(e);
		u.set(e, n), clearTimeout(x), x = setTimeout(() => {
			B();
		}, d);
	}
	let I = () => {
		let t = e.numberFolders || [];
		return t.indexOf(a) < 0 ? [a, ...t] : t;
	};
	async function ee() {
		return n.collectNumbers(r, I(), b);
	}
	async function L() {
		let e;
		try {
			e = n.numbering(await ee());
		} catch (e) {
			return console.warn("[bcf-filecore] numbering failed", e), null;
		}
		if (y = e.numbers, v) {
			let t = 0;
			for (let r of e.changes) {
				let e = o.get(r.guid);
				e && (n.setFields(e.pack, r.guid, { index: r.number }, null, null), c.set(r.guid, D(e.pack, r.guid)), F(r.guid, ["index"]), t++);
			}
			t && w();
		}
		return e;
	}
	let R = (e) => e && (y[e] || c.get(e)?.index) || null;
	async function z(e, t) {
		let a = o.get(e);
		if (!a) return !1;
		let s = await n.saveTopic(r, {
			rel: a.rel,
			guid: e,
			local: a.pack,
			dirty: t,
			app: i,
			known: a.known
		}), l = n.topic(s.pack, e);
		l.index && (y = Object.assign({}, y, { [e]: l.index }), b.set(a.rel, {
			size: -1,
			lastModified: -1,
			entries: [{
				guid: e,
				index: l.index,
				creationDate: l.creationDate,
				rel: a.rel
			}]
		}));
		let u = null;
		if (typeof r.stat == "function") try {
			u = await r.stat(a.rel);
		} catch {
			u = null;
		}
		return o.set(e, {
			rel: a.rel,
			pack: s.pack,
			known: new Set(s.comments),
			stamp: u
		}), c.set(e, D(s.pack, e)), _.delete(e), !0;
	}
	async function B() {
		if (clearTimeout(x), S && await S, !u.size) return 0;
		S = (async () => {
			let e = 0;
			for (let t of [...u.keys()]) {
				let n = u.get(t);
				u.delete(t);
				try {
					await z(t, n) && e++;
				} catch (e) {
					let r = u.get(t) || /* @__PURE__ */ new Set();
					for (let e of n) r.add(e);
					u.set(t, r), T(s("bcfSaveFailed", "Issue not saved to the project folder:") + " " + (e && e.message || e));
				}
			}
			return w(), e;
		})();
		try {
			return await S;
		} finally {
			S = null;
		}
	}
	let V = new Set(n.FIELDS || [
		"title",
		"status",
		"type",
		"priority",
		"stage",
		"assignedTo",
		"dueDate",
		"description",
		"labels"
	]);
	function H(t, r) {
		let i = o.get(t);
		if (!i) return !1;
		if (!P()) return w(), !1;
		let a = {};
		for (let [e, t] of Object.entries(r || {})) V.has(e) && (a[e] = e === "labels" ? [...t || []] : t);
		return Object.keys(a).length ? (n.setFields(i.pack, t, a, e.author || "unknown", /* @__PURE__ */ new Date()), c.set(t, D(i.pack, t)), F(t, Object.keys(a)), w(), !0) : !1;
	}
	async function U(t, r, i = null) {
		let a = o.get(t), s = String(r || "").trim();
		if (!a || !s && !i || !P()) return null;
		let l = i ? m(i) : null, u = n.addComment(a.pack, t, {
			text: s || "(photo)",
			author: e.author || "unknown",
			date: /* @__PURE__ */ new Date(),
			photo: l
		});
		return c.set(t, D(a.pack, t)), F(t, ["__comments"]), w(), c.get(t).comments.get(u) || null;
	}
	async function W(t = {}) {
		if (!P()) return null;
		let r = 1;
		try {
			r = n.numbering(await ee()).next;
		} catch (e) {
			console.warn("[bcf-filecore] numbering failed", e);
		}
		let a = n.create({
			index: r,
			title: t.title || "Untitled",
			author: e.author || "unknown",
			status: t.status || "Active",
			type: t.type || "",
			priority: t.priority,
			stage: t.stage,
			assignedTo: t.assignedTo,
			dueDate: t.dueDate,
			description: t.description,
			labels: t.labels ? [...t.labels] : []
		}), s = a.guid, l = (t.models || []).map((e) => typeof e == "string" ? {
			path: e,
			fileName: h(e)
		} : e);
		return n.setHeader(a, s, l), n.setExtras(a, s, {
			v: 1,
			app: i,
			topic: s,
			savedAt: (/* @__PURE__ */ new Date()).toISOString(),
			savedBy: e.author || "",
			federation: t.federation || null,
			models: l,
			marker: null,
			context: null
		}), o.set(s, {
			rel: E(s),
			pack: a,
			known: /* @__PURE__ */ new Set(),
			stamp: null
		}), c.set(s, D(a, s)), F(s, ["__new", "index"]), y = Object.assign({}, y, { [s]: r }), w(), await B(), c.get(s);
	}
	let G = null, K = null;
	function q() {
		return !G && !K && typeof e.federations == "function" && (K = Promise.resolve(e.federations()).then((e) => {
			G = e || [], K = null, w();
		}, () => {
			G = [], K = null;
		})), G || [];
	}
	let J = () => v && typeof e.isAdmin == "function" && !!e.isAdmin();
	function Y(t, r) {
		let i = o.get(t);
		if (!i || !J()) return !1;
		let a = r ? (G || []).find((e) => e.path === r) : null;
		if (r && !a) return !1;
		let s = Object.assign({}, n.topic(i.pack, t).extras || {}, {
			federation: a ? {
				path: a.path,
				id: a.id || null,
				name: a.name || ""
			} : null,
			models: a ? a.models : [],
			savedAt: (/* @__PURE__ */ new Date()).toISOString(),
			savedBy: e.author || ""
		});
		return n.setExtras(i.pack, t, s), n.setHeader(i.pack, t, s.models), c.set(t, D(i.pack, t)), F(t, ["__federation"]), w(), !0;
	}
	async function X(e) {
		if (!P()) return {
			imported: [],
			sampled: 0,
			matched: 0,
			refused: !0
		};
		let t = new Uint8Array(await e.arrayBuffer()), a = n.read(t), s = [];
		for (let e of n.topics(a)) {
			let a = n.read(t);
			n.only(a, e);
			let l = o.get(e)?.rel || E(e), u = await n.saveTopic(r, {
				rel: l,
				guid: e,
				local: a,
				dirty: /* @__PURE__ */ new Set(["__new"]),
				app: i,
				known: o.get(e)?.known
			});
			o.set(e, {
				rel: l,
				pack: u.pack,
				known: new Set(u.comments),
				stamp: null
			}), c.set(e, D(u.pack, e)), _.delete(e), s.push(e);
		}
		return await L(), w(), {
			imported: s,
			sampled: 0,
			matched: 0,
			modelsLoaded: 0
		};
	}
	function Z(e) {
		let t = null;
		for (let r of e || [...o.keys()]) {
			let e = o.get(r);
			if (!e) continue;
			let i = n.read(n.write(e.pack));
			if (!t) t = i;
			else for (let [e, n] of Object.entries(i.files)) e !== "bcf.version" && (t.files[e] = n);
		}
		return t ? n.write(t) : null;
	}
	function te() {
		let e = Z();
		if (!e) return null;
		let n = /* @__PURE__ */ new Date(), r = n.getFullYear() + String(n.getMonth() + 1).padStart(2, "0") + String(n.getDate()).padStart(2, "0");
		try {
			let n = URL.createObjectURL(new Blob([e], { type: "application/octet-stream" })), a = t.document.createElement("a");
			a.href = n, a.download = `${i}_issues_${r}.bcf`, t.document.body.appendChild(a), a.click(), a.remove(), setTimeout(() => URL.revokeObjectURL(n), 5e3);
		} catch (e) {
			console.warn("[bcf-filecore] export download failed", e);
		}
		return e;
	}
	let ne = () => [...c.values()], Q = l(ne, R), re = { get(e) {
		if (_.has(e)) return _.get(e);
		let t = o.get(e), r = t ? p(n.snapshot(t.pack, e)) : null;
		return _.set(e, r), r;
	} };
	function ie(e) {
		if (!e || !e.viewpoint || !e.__topic) return null;
		let t = o.get(e.__topic);
		return t ? p(n.snapshot(t.pack, e.__topic, e.viewpoint)) : null;
	}
	function ae(e) {
		let t = c.get(e)?.extras;
		return t ? t.context ? t.context : t.models && t.models.length ? { models: t.models.map((e) => ({
			fileName: e.fileName || h(e.path),
			tag: e.discipline || ""
		})) } : null : null;
	}
	let oe = {
		BUILD: 4,
		app: i,
		folder: a,
		get author() {
			return e.author || "";
		},
		bcf: { list: c },
		snapshots: re,
		access: {
			get canWrite() {
				return v;
			},
			localOnly: () => [],
			publishLocal: async () => 0,
			offerPublish: async () => 0
		},
		ready: () => C,
		refresh: N,
		flush: B,
		pending: () => [...u.keys()],
		onChange(e) {
			return g.add(e), () => g.delete(e);
		},
		topics: ne,
		query: Q.query,
		dashboard: Q.dashboard,
		isClosed: Q.isClosed,
		commentsOf: Q.commentsOf,
		updateTopic: H,
		addComment: U,
		createTopic: W,
		commentImage: ie,
		importBcfFile: X,
		exportBcfFile: te,
		exportBytes: Z,
		removeTopics() {},
		markerOf: (e) => c.get(e)?.extras?.marker || null,
		contextOf: ae,
		federationOf: (e) => c.get(e)?.extras?.federation || null,
		modelCheck: () => null,
		contacts: () => typeof e.contacts == "function" ? e.contacts() : null,
		meAliases: () => (typeof e.me == "function" ? e.me() : [e.author]).filter(Boolean),
		linkFor(e) {
			let t = c.get(e)?.extras || {};
			return {
				federation: t.federation || null,
				models: (t.models || []).map((e) => e.path || e.fileName).filter(Boolean),
				topic: e
			};
		},
		fileOf: (e) => o.get(e)?.rel || null,
		federations: q,
		canReassign: typeof e.federations == "function" ? J : void 0,
		setFederation: Y,
		numberOf: R,
		renumber: () => L()
	};
	return C = M().catch((e) => (console.warn("[bcf-filecore] load failed", e), 0)), oe;
}
//#endregion
//#region js/webifc/coo_bcf_filters.js
var _ = "__none", v = "__me", y = 864e5, b = [
	"overdue",
	"week",
	"twoweeks",
	"later",
	_
], x = [
	{
		id: "status",
		label: () => s("issStatus", "Status")
	},
	{
		id: "priority",
		label: () => s("issPriority", "Priority")
	},
	{
		id: "assignee",
		label: () => s("issFAssigned", "Assigned to")
	},
	{
		id: "creator",
		label: () => s("issFCreator", "Created by")
	},
	{
		id: "labels",
		label: () => s("issLabels", "Labels")
	},
	{
		id: "type",
		label: () => s("issType", "Type")
	},
	{
		id: "stage",
		label: () => s("issStage", "Stage")
	},
	{
		id: "due",
		label: () => s("issFDueField", "Due")
	}
], S = x.map((e) => e.id);
function C() {
	let e = {
		openOnly: !1,
		mine: !1
	};
	for (let t of S) e[t] = [];
	return e;
}
function w(e) {
	let t = C();
	if (!e || typeof e != "object") return t;
	for (let n of S) Array.isArray(e[n]) && (t[n] = [...new Set(e[n].map(String))]);
	return t.openOnly = !!e.openOnly, t.mine = !!e.mine, t;
}
function T(e) {
	let t = +!!e.openOnly + +!!e.mine;
	for (let n of S) t += (e[n] || []).length;
	return t;
}
function E(e, t) {
	if (!e.dueDate) return _;
	let n = new Date(e.dueDate).getTime() - (t || Date.now());
	return isFinite(n) ? n < 0 ? "overdue" : n < 7 * y ? "week" : n < 14 * y ? "twoweeks" : "later" : _;
}
function D(e, t, n) {
	switch (t) {
		case "status": return [e.status || "__none"];
		case "priority": return [e.priority || "__none"];
		case "type": return [e.type || "__none"];
		case "stage": return [e.stage || "__none"];
		case "assignee": return [e.assignedTo || "__none"];
		case "creator": return [e.creationAuthor || "__none"];
		case "labels": {
			let t = [...e.labels || []];
			return t.length ? t : [_];
		}
		case "due": return n.isClosed && n.isClosed(e) ? ["__closed"] : [E(e, n.now)];
		default: return [];
	}
}
var O = (e) => String(e ?? "").trim().toLowerCase();
function k(e, t) {
	if (!e || e === "__none") return !1;
	let n = O(e);
	return (t.me || []).some((e) => e && O(e) === n);
}
function A(e, t, n, r) {
	if (t.openOnly && n.isClosed && n.isClosed(e) || t.mine && !k(e.assignedTo, n)) return !1;
	for (let i of S) {
		if (i === r) continue;
		let a = t[i];
		if (!a || !a.length) continue;
		let o = D(e, i, n);
		if (!a.some((e) => e === "__me" ? o.some((e) => k(e, n)) : o.includes(e))) return !1;
	}
	return !0;
}
function j(e) {
	return e === "assignee" ? s("issUnassigned", "Unassigned") : e === "labels" ? s("issUnlabelled", "Unlabelled") : e === "due" ? s("issDueNone", "No due date") : e === "creator" ? s("issFUnknown", "Unknown") : s("issUnset", "Unset");
}
function M(e, t, n) {
	return t === "__none" ? j(e) : t === "__me" ? s("issFMe", "Me") : e === "due" ? {
		overdue: s("issCardOverdue", "Overdue"),
		week: s("issDueWeekShort", "This week"),
		twoweeks: s("issDue2WeeksShort", "2 weeks"),
		later: s("issDueLater", "Later")
	}[t] || t : (e === "assignee" || e === "creator") && typeof n.personName == "function" && n.personName(t) || t;
}
function N(e, a, o, c) {
	let l = e.filter((e) => A(e, o, c, a)), u = /* @__PURE__ */ new Map();
	for (let e of l) for (let t of new Set(D(e, a, c))) t !== "__closed" && u.set(t, (u.get(t) || 0) + 1);
	for (let e of o[a] || []) !u.has(e) && e !== "__me" && u.set(e, 0);
	let d = {
		status: t,
		priority: [...r].reverse(),
		type: n,
		stage: i,
		due: b
	}[a], f = [...u.keys()];
	d ? f.sort((e, t) => (d.indexOf(e) + 1 || 999) - (d.indexOf(t) + 1 || 999) || String(e).localeCompare(String(t))) : f.sort((e, t) => (e === "__none") - (t === "__none") || String(M(a, e, c)).localeCompare(String(M(a, t, c)), void 0, { numeric: !0 })), f.includes("__none") && (f = f.filter((e) => e !== _).concat([_]));
	let p = f.map((e) => ({
		value: e,
		label: M(a, e, c),
		count: u.get(e) || 0
	}));
	if (a === "assignee" || a === "creator") {
		let e = l.filter((e) => D(e, a, c).some((e) => k(e, c))).length;
		(c.me || []).length && p.unshift({
			value: v,
			label: s("issFMe", "Me"),
			count: e
		});
	}
	return p;
}
function P(e, t) {
	let n = [];
	e.openOnly && n.push({
		field: "openOnly",
		value: "1",
		text: s("issFOpenOnly", "Open only")
	}), e.mine && n.push({
		field: "mine",
		value: "1",
		text: s("issFMine", "Assigned to me")
	});
	for (let r of x) for (let i of e[r.id] || []) n.push({
		field: r.id,
		value: i,
		text: r.label() + ": " + M(r.id, i, t)
	});
	return n;
}
function F(e, t) {
	t ||= typeof window < "u" ? window : null;
	let n = "liteaeco_issue_filters_" + (e || "default"), r = C();
	try {
		r = w(JSON.parse(t.localStorage.getItem(n) || "null"));
	} catch {}
	let i = /* @__PURE__ */ new Set(), a = () => {
		try {
			t.localStorage.setItem(n, JSON.stringify(r));
		} catch {}
		for (let e of i) try {
			e(r);
		} catch (e) {
			console.warn("[bcf-filters] listener failed", e);
		}
		try {
			t.dispatchEvent(new t.CustomEvent("coo-bcf-filters-changed", { detail: { key: n } }));
		} catch {}
	};
	return t && t.addEventListener && t.addEventListener("coo-bcf-filters-changed", (e) => {
		if (e.detail && e.detail.key === n) try {
			let e = w(JSON.parse(t.localStorage.getItem(n) || "null"));
			if (JSON.stringify(e) !== JSON.stringify(r)) {
				r = e;
				for (let e of i) e(r);
			}
		} catch {}
	}), {
		key: n,
		get: () => r,
		set(e) {
			r = w(e), a();
		},
		toggle(e, t, n) {
			let i = w(r);
			if (e === "openOnly" || e === "mine") i[e] = n === void 0 ? !i[e] : !!n;
			else if (S.includes(e)) {
				let r = i[e].includes(t);
				i[e] = (n === void 0 ? !r : n) ? r ? i[e] : i[e].concat([t]) : i[e].filter((e) => e !== t);
			}
			r = i, a();
		},
		clear() {
			r = C(), a();
		},
		subscribe(e) {
			return i.add(e), () => i.delete(e);
		}
	};
}
var I = (e) => String(e ?? "").replace(/[&<>"']/g, (e) => ({
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	"\"": "&quot;",
	"'": "&#39;"
})[e]);
function ee(e, { store: t, getTopics: n, ctx: r, compact: i = !1 }) {
	let a = null, o = () => Object.assign({ now: Date.now() }, typeof r == "function" ? r() : r), c = (e) => `inline-flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-semibold whitespace-nowrap ${e ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"}`;
	function l(e, t, r) {
		let i = N(n(), e, t, r);
		return i.length ? i.map((n) => `<label class="flex items-center gap-2 px-1.5 py-0.5 rounded hover:bg-slate-50 cursor-pointer ${n.count || (t[e] || []).includes(n.value) ? "" : "opacity-50"}">
        <input type="checkbox" data-fv-field="${I(e)}" data-fv-value="${I(n.value)}" ${(t[e] || []).includes(n.value) ? "checked" : ""} class="accent-indigo-600 shrink-0">
        <span class="flex-1 truncate text-[11px]">${I(n.label)}</span>
        <span class="text-[10px] text-slate-400 tabular-nums">${n.count}</span></label>`).join("") : `<p class="px-2 py-1 text-[11px] text-slate-400 italic">${I(s("issFNoValues", "No values"))}</p>`;
	}
	function u() {
		let n = t.get(), r = o(), u = `
      <button type="button" data-fv-toggle="openOnly" class="${c(n.openOnly)}">${I(s("issFOpenOnly", "Open only"))}</button>
      ${(r.me || []).length ? `<button type="button" data-fv-toggle="mine" class="${c(n.mine)}">${I(s("issFMine", "Assigned to me"))}</button>` : ""}`;
		if (i) {
			let t = T(n);
			e.innerHTML = `<div class="relative flex items-center gap-1 flex-wrap">
        <button type="button" data-fv-open="__all" class="${c(t > 0)}">${I(s("issFilters", "Filters"))}${t ? ` <span data-fv-badge class="px-1 rounded-full bg-indigo-600 text-white text-[9px]">${t}</span>` : ""} <span class="text-slate-400">▾</span></button>
        ${u}
        ${t ? `<button type="button" data-fv-clear class="text-[11px] text-slate-500 underline">${I(s("issClearAll", "clear all"))}</button>` : ""}
        <div data-fv-pop="__all" class="${a === "__all" ? "" : "hidden "}absolute z-40 left-0 top-full mt-1 w-72 max-h-[60vh] overflow-y-auto bg-white border border-slate-200 rounded shadow-lg p-2 space-y-2">
          ${x.map((e) => `<div><p class="px-1 text-[10px] font-bold uppercase text-slate-500">${I(e.label())}</p>${l(e.id, n, r)}</div>`).join("")}
        </div></div>`;
			return;
		}
		e.innerHTML = `<div class="flex items-center gap-1 flex-wrap">
      ${x.map((e) => {
			let t = (n[e.id] || []).length;
			return `<div class="relative">
          <button type="button" data-fv-open="${e.id}" class="${c(t > 0)}">${I(e.label())}${t ? ` <span class="px-1 rounded-full bg-indigo-600 text-white text-[9px]">${t}</span>` : ""} <span class="text-slate-400">▾</span></button>
          <div data-fv-pop="${e.id}" class="${a === e.id ? "" : "hidden "}absolute z-40 left-0 top-full mt-1 w-60 max-h-72 overflow-y-auto bg-white border border-slate-200 rounded shadow-lg p-1.5">${l(e.id, n, r)}</div>
        </div>`;
		}).join("")}
      <span class="mx-1 h-4 border-l border-slate-200"></span>
      ${u}
    </div>`;
	}
	e.addEventListener("click", (e) => {
		let n = e.target.closest("[data-fv-open]");
		if (n) {
			e.stopPropagation(), a = a === n.dataset.fvOpen ? null : n.dataset.fvOpen, u();
			return;
		}
		let r = e.target.closest("[data-fv-toggle]");
		if (r) {
			t.toggle(r.dataset.fvToggle);
			return;
		}
		if (e.target.closest("[data-fv-clear]")) {
			t.clear();
			return;
		}
		e.target.closest("[data-fv-pop]") && e.stopPropagation();
	}), e.addEventListener("change", (e) => {
		let n = e.target.closest("[data-fv-field]");
		n && t.toggle(n.dataset.fvField, n.dataset.fvValue, n.checked);
	});
	let d = e.ownerDocument;
	return d.addEventListener("click", (t) => {
		a && !e.contains(t.target) && (a = null, u());
	}), d.addEventListener("keydown", (e) => {
		e.key === "Escape" && a && (a = null, u());
	}), t.subscribe(() => u()), u(), {
		render: u,
		close: () => {
			a = null, u();
		}
	};
}
//#endregion
//#region js/webifc/coo_bcf_detail.js
function L(e) {
	return String(e ?? "").replace(/[&<>"']/g, (e) => ({
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		"\"": "&quot;",
		"'": "&#39;"
	})[e]);
}
function R(e) {
	if (!e) return "";
	let t = e instanceof Date ? e : new Date(e);
	return isNaN(t) ? "" : t.toISOString().slice(0, 10);
}
function z(e) {
	if (!e) return "-";
	let t = e instanceof Date ? e : new Date(e);
	return isNaN(t) ? "-" : t.toLocaleDateString();
}
function B(e) {
	let t = String(e || "").toLowerCase();
	return t === "closed" ? "bg-slate-200 text-slate-600" : t === "done" ? "bg-emerald-100 text-emerald-700" : t === "in review" ? "bg-violet-100 text-violet-700" : t === "in progress" ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-700";
}
function V(e, t) {
	return `<div class="grid grid-cols-[84px_minmax(0,1fr)] items-center gap-2">
    <span class="text-[10px] font-semibold text-slate-500 uppercase">${e}</span>${t}</div>`;
}
function H(e) {
	return new Promise((t) => {
		let n = new Image();
		n.onload = () => {
			let e = Math.min(1, 1600 / Math.max(n.width, n.height)), r = document.createElement("canvas");
			r.width = Math.round(n.width * e), r.height = Math.round(n.height * e), r.getContext("2d").drawImage(n, 0, 0, r.width, r.height), t(r.toDataURL("image/jpeg", .8));
		}, n.onerror = () => t(null), n.src = URL.createObjectURL(e);
	});
}
function U(e) {
	let t = new Set(o);
	try {
		let e = window.__cooDisciplines?.() || window.liteAECO?.disciplines?.models?.() || [];
		for (let n of e) n?.code && t.add(String(n.code).toUpperCase());
		for (let e of window.__cooModels?.list?.() || []) e.tag && t.add(String(e.tag).toUpperCase());
	} catch {}
	for (let n of e.topics()) for (let e of n.labels || []) t.add(e);
	return [...t].sort();
}
function W(e, t, n, r, i) {
	return {
		html: `<div class="relative">
    <button data-ldd-btn="${t}" type="button"
      class="w-full flex items-center justify-between gap-1 px-2 py-1 border border-slate-200 rounded bg-white hover:border-slate-400 text-left">
      <span class="truncate" data-ldd-label>${n.size ? L([...n].join(", ")) : L(s("issDisciplinesPh", "Disciplines..."))}</span>
      <span class="text-slate-400 shrink-0">▾</span>
    </button>
    <div data-ldd-pop="${t}"
      class="hidden absolute z-30 mt-1 left-0 w-full max-h-44 overflow-y-auto bg-white border border-slate-200 rounded shadow-lg p-1.5 space-y-0.5">
    </div>
  </div>`,
		wire: (a) => {
			let o = a.querySelector(`[data-ldd-btn="${t}"]`), c = a.querySelector(`[data-ldd-pop="${t}"]`);
			if (!o || !c) return;
			let l = () => {
				let t = U(e);
				o.querySelector("[data-ldd-label]").textContent = n.size ? [...n].join(", ") : s("issDisciplinesPh", "Disciplines..."), c.innerHTML = t.map((e, t) => `<label class="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-slate-50 cursor-pointer">
          <input type="checkbox" data-ldd-idx="${t}" ${n.has(e) ? "checked" : ""} class="accent-indigo-600 shrink-0">
          <span class="truncate text-[11px]">${L(e)}</span></label>`).join(""), c.__opts = t;
			};
			o.addEventListener("click", (e) => {
				e.stopPropagation(), c.classList.toggle("hidden"), l();
			});
			let u = !1;
			c.addEventListener("change", (e) => {
				let t = e.target.closest("[data-ldd-idx]");
				if (!t) return;
				e.stopPropagation();
				let i = (c.__opts || [])[Number(t.dataset.lddIdx)];
				i && (t.checked ? n.add(i) : n.delete(i), u = !0, l(), r?.());
			}), document.addEventListener("click", (e) => {
				if (!c.contains(e.target) && !o.contains(e.target)) {
					let e = !c.classList.contains("hidden");
					c.classList.add("hidden"), e && u && (u = !1, i?.());
				}
			}), l();
		}
	};
}
function G(e = [], t = null) {
	let n = (t && typeof t.contacts == "function" ? t.contacts() : null) || window.__cooProject?.listContacts?.() || [], r = new Set([...e].map((e) => String(e).toUpperCase())), i = (e) => +!(e.disciplines || e.teams || []).some((e) => r.has(String(e).toUpperCase()));
	return n.slice().sort((e, t) => i(e) - i(t) || e.name.localeCompare(t.name)).map((e) => ({
		value: e.mail || e.name,
		label: (e.name || e.mail) + (e.company ? " - " + e.company : "")
	}));
}
function K(e, t, n = null) {
	return `<datalist id="${e}">${G(t, n).map((e) => `<option value="${L(e.value)}">${L(e.label)}</option>`).join("")}</datalist>`;
}
function q(e, t) {
	let n = e.contextOf?.(t);
	if (!n) return "";
	let r = e.modelCheck ? e.modelCheck(t) : {
		missing: [],
		changed: []
	}, i = [], a = (e) => e.tag ? `[${L(e.tag)}] ` : "", o = (e) => e.map((e) => a(e) + L(e.fileName)).join(", ");
	if (r === null) {
		let r = e.federationOf?.(t);
		r && (r.name || r.path) && i.push(`<p class="text-slate-600"><b>${L(s("issCtxFederation", "Federation:"))}</b> ${L(r.name || String(r.path).split("/").pop())}</p>`), n.models?.length && i.push(`<p class="text-slate-600"><b>${L(s("issCtxModels", "Models:"))}</b> ${o(n.models)}</p>`);
	} else r.missing.length && i.push(`<p class="text-amber-800"><b>${L(s("issCtxNotLoaded", "Not loaded now:"))}</b> ${o(r.missing)}. ${L(s("issCtxNotLoadedTail", "The view was raised with these models visible."))}</p>`), r.changed.length && i.push(`<p class="text-amber-800"><b>${L(s("issCtxChanged", "Changed since:"))}</b> ${o(r.changed)} ${L(s("issCtxChangedTail", "(different file size or date)."))}</p>`);
	if (n.clash?.pairKey) {
		let e = typeof window.__clsStoreGet == "function" ? window.__clsStoreGet() : window.__clsStore;
		if (e) {
			let t = e.getSet?.(n.clash.pairKey)?.clashes?.has?.(n.clash.clashKey);
			i.push(t ? `<p class="text-slate-600">${L(s("issCtxClashLinked", "Linked to a clash: \"Go to viewpoint\" also restores the clash view (colours and context)."))}</p>` : `<p class="text-amber-800"><b>${L(s("issCtxClashMissing", "Linked clash not found"))}</b> ${L(s("issCtxClashMissingTail", "(resolved by a re-run, or the pair was never run in this session)."))}</p>`);
		} else i.push(`<p class="text-slate-600">${L(s("issCtxClashRaised", "Raised from a clash."))}</p>`);
	}
	return n.planes?.length && i.push(`<p class="text-slate-600">${L(c(s("issCtxPlanes", "{n} section plane(s) stored with this issue."), { n: n.planes.length }))}</p>`), !i.length && n.models?.length && i.push(`<p class="text-slate-500">${L(c(s("issCtxAllLoaded", "Raised with {n} model(s) visible, all loaded."), { n: n.models.length }))}</p>`), i.length ? `<div data-ctx-banner class="mx-3 mt-2 p-2 rounded border border-amber-200 bg-amber-50/60 text-[10px] leading-relaxed space-y-0.5">${i.join("")}</div>` : "";
}
function J(e, a, o = {}) {
	let l = o.actions || {}, u = null, d = null, f = (e) => a.querySelector(e);
	function p() {
		let e = document.activeElement, t = e && a.contains(e) ? e.dataset?.e ? "[data-e=\"" + e.dataset.e + "\"]" : e.hasAttribute?.("data-reply") ? "[data-reply]" : null : null, n = a.parentElement;
		for (; n && n !== document.body && !(n.scrollHeight > n.clientHeight && /(auto|scroll)/.test(getComputedStyle(n).overflowY));) n = n.parentElement;
		return {
			guid: d,
			key: t,
			typing: !!t && (e.tagName === "TEXTAREA" || e.tagName === "INPUT" && e.type !== "date"),
			value: t ? e.value : null,
			start: t ? e.selectionStart : null,
			end: t ? e.selectionEnd : null,
			reply: f("[data-reply]")?.value || "",
			scroller: n && n !== document.body ? n : null,
			scrollTop: n && n !== document.body ? n.scrollTop : 0
		};
	}
	function m(e) {
		if (!e || e.guid !== d) return;
		let t = f("[data-reply]");
		if (t && e.reply && !t.value && (t.value = e.reply), e.key) {
			let t = f(e.key);
			if (t) {
				e.typing && e.value != null && (t.value = e.value);
				try {
					t.focus({ preventScroll: !0 });
				} catch {
					t.focus();
				}
				if (e.typing && e.start != null) try {
					t.setSelectionRange(e.start, e.end);
				} catch {}
			}
		}
		e.scroller && (e.scroller.scrollTop = e.scrollTop);
	}
	function h(t) {
		if (typeof e.canReassign != "function") return "";
		let n = e.federationOf ? e.federationOf(t) : null, r = n ? n.name || String(n.path || "").split("/").pop().replace(/\.ltf$/i, "") : s("issNoFederation", "No federation");
		if (!e.canReassign()) return V(L(s("issFederation", "Federation")), `<span data-fed-name class="text-slate-600 truncate">${L(r)}</span>`);
		let i = (e.federations ? e.federations() : []).map((e) => ({
			value: e.path,
			label: e.name
		}));
		return n && n.path && !i.some((e) => e.value === n.path) && i.unshift({
			value: n.path,
			label: r
		}), V(L(s("issFederation", "Federation")), `<select data-fed class="w-full bg-white px-2 py-1 border border-slate-200 rounded" title="${L(s("issFederationHint", "Admins: move the issue to another federation"))}">
        <option value="" ${n ? "" : "selected"}>${L(s("issNoFederation", "No federation"))}</option>
        ${i.map((e) => `<option value="${L(e.value)}" ${n && n.path === e.value ? "selected" : ""}>${L(e.label)}</option>`).join("")}</select>`);
	}
	document.addEventListener("languageLoaded", () => {
		a.isConnected && d && g();
	});
	function g(_ = d) {
		let v = p();
		d = _;
		let y = d ? e.bcf.list.get(d) : null;
		if (!y) {
			a.innerHTML = `<p class="text-slate-400 italic text-center py-8 text-xs">${L(s("issSelect", "Select an issue."))}</p>`;
			return;
		}
		let b = e.snapshots.get(y.guid), x = e.commentsOf(y), S = new Set(y.labels || []), C = W(e, "edit-" + (o.key || "d"), S, () => e.updateTopic(y.guid, { labels: [...S] }), () => g()), w = e.markerOf(y.guid), T = (e) => typeof l[e] == "function";
		if (a.innerHTML = `${q(e, y.guid)}
    <div class="p-3 space-y-2 text-xs">
      ${typeof e.numberOf == "function" && e.numberOf(y.guid) ? `<p data-number class="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide">${L(c(s("issNumber", "No. {n}"), { n: e.numberOf(y.guid) }))}</p>` : ""}
      <input data-e="title" value="${L(y.title)}"
        class="w-full px-2 py-1.5 border border-transparent hover:border-slate-200 focus:border-indigo-300 rounded font-bold text-slate-800 text-sm focus:outline-none"/>
      ${b ? `<img data-snap src="${b}" title="${L(T("goTo") ? s("issSnapGoTo", "Click: go to viewpoint") : s("issSnapTitle", "Screenshot"))}"
             class="w-full rounded border border-slate-200 ${T("goTo") ? "cursor-pointer" : ""}"/>` : `<div class="w-full h-24 rounded border border-dashed border-slate-200 flex items-center justify-center text-slate-300 text-[10px]">${L(s("issNoSnap", "no screenshot"))}</div>`}
      <div class="flex gap-2">
        ${typeof o.onOpen3d == "function" ? `<button data-open3d class="flex-1 px-2 py-1 rounded border border-indigo-300 text-indigo-700 hover:bg-indigo-50 text-[10px] font-semibold">${L(s("issOpen3d", "Open in 3D"))}</button>` : ""}
        ${T("goTo") ? `<button data-goto class="flex-1 px-2 py-1 rounded border border-slate-300 text-slate-600 hover:bg-slate-50 text-[10px] font-semibold">${L(s("issGoTo", "Go to viewpoint"))}</button>` : ""}
        ${T("resnap") ? `<button data-resnap class="flex-1 px-2 py-1 rounded border border-slate-300 text-slate-600 hover:bg-slate-50 text-[10px] font-semibold">${L(s("issResnap", "Update screenshot"))}</button>` : ""}
      </div>
      ${V(L(s("issStatus", "Status")), `<select data-e="status" class="w-full bg-white px-2 py-1 border border-slate-200 rounded">
        ${t.map((e) => `<option ${e === y.status ? "selected" : ""}>${e}</option>`).join("")}</select>`)}
      ${V(L(s("issAssignedTo", "Assigned to")), `<input data-e="assignedTo" list="bcf-contacts-${L(o.key || "d")}" value="${L(y.assignedTo || "")}" placeholder="-"
        class="w-full px-2 py-1 border border-slate-200 rounded"/>${K("bcf-contacts-" + (o.key || "d"), [...y.labels || []], e)}`)}
      ${V(L(s("issType", "Type")), `<select data-e="type" class="w-full bg-white px-2 py-1 border border-slate-200 rounded">
        ${n.map((e) => `<option ${e === y.type ? "selected" : ""}>${e}</option>`).join("")}</select>`)}
      ${V(L(s("issPriority", "Priority")), `<select data-e="priority" class="w-full bg-white px-2 py-1 border border-slate-200 rounded">
        <option value="" ${y.priority ? "" : "selected"}></option>
        ${r.map((e) => `<option ${e === y.priority ? "selected" : ""}>${e}</option>`).join("")}</select>`)}
      ${V(L(s("issStage", "Stage")), `<select data-e="stage" class="w-full bg-white px-2 py-1 border border-slate-200 rounded">
        <option value="" ${y.stage ? "" : "selected"}></option>
        ${i.map((e) => `<option ${e === y.stage ? "selected" : ""}>${e}</option>`).join("")}</select>`)}
      ${V(L(s("issLabels", "Labels")), C.html)}
      ${h(y.guid)}
      ${T("markerMove") || T("markerGoto") || T("markerDel") ? V(L(s("issMarker", "Marker")), w ? `<div class="flex gap-1">
              ${T("markerGoto") ? `<button data-marker-goto class="flex-1 px-2 py-1 rounded border border-slate-300 text-slate-600 hover:bg-slate-50 text-[10px] font-semibold">${L(s("issMarkerShow", "Show"))}</button>` : ""}
              ${T("markerMove") ? `<button data-marker-move class="flex-1 px-2 py-1 rounded border border-slate-300 text-slate-600 hover:bg-slate-50 text-[10px] font-semibold">${L(s("issMarkerMove", "Move"))}</button>` : ""}
              ${T("markerDel") ? "<button data-marker-del class=\"px-2 py-1 rounded border border-red-200 text-red-500 hover:bg-red-50 text-[10px] font-semibold\">×</button>" : ""}
            </div>` : T("markerMove") ? `<button data-marker-move class="w-full px-2 py-1 rounded border border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-50 text-[10px] font-semibold">${L(s("issMarkerPlace", "Place marker"))}</button>` : `<span class="text-slate-400">${L(s("issMarkerNone", "none"))}</span>`) : w ? V(L(s("issMarker", "Marker")), `<span class="text-slate-600">${L(s("issMarkerPlaced", "placed (see 3D)"))}</span>`) : ""}
      ${V(L(s("issStartDate", "Start date")), `<span class="text-slate-600">${z(y.creationDate)}</span>`)}
      ${V(L(s("issDueDate", "Due date")), `<input data-e="dueDate" type="date" value="${R(y.dueDate)}"
        class="w-full px-2 py-1 border border-slate-200 rounded"/>`)}
      <textarea data-e="description" rows="3" placeholder="${L(s("issDescription", "Description"))}"
        class="w-full px-2 py-1.5 border border-slate-200 rounded resize-none">${L(y.description || "")}</textarea>
      <div class="border-t border-slate-100 pt-2">
        <p class="text-[10px] font-semibold text-slate-500 uppercase mb-1">${L(c(s("issConversation", "Conversation ({n})"), { n: x.length }))}</p>
        <div class="space-y-1.5 mb-2">
          ${x.map((t) => {
			let n = t.author && t.author === e.author, r = e.commentImage(t);
			return `<div class="text-[11px] rounded-lg px-2 py-1.5 ${n ? "bg-indigo-50 ml-4" : "bg-slate-50 mr-4"}">
                <div class="flex items-baseline justify-between gap-2">
                  <span class="font-semibold ${n ? "text-indigo-600" : "text-slate-600"} truncate">${L(t.author || s("issUnknownAuthor", "unknown"))}</span>
                  <span class="text-slate-400 text-[9px] shrink-0">${t.date ? z(t.date) : ""}</span>
                </div>
                ${t.comment && t.comment !== "(photo)" ? `<div class="text-slate-700 whitespace-pre-wrap break-words">${L(t.comment)}</div>` : ""}
                ${r ? `<img src="${r}" data-cimg class="mt-1 rounded border border-slate-200 max-h-40 cursor-pointer" title="${L(s("issPhotoOpen", "Click to open full size"))}"/>` : ""}
              </div>`;
		}).join("") || `<p class="text-slate-300 italic text-[10px]">${L(s("issNoComments", "No comments yet. Start the conversation."))}</p>`}
        </div>
        <div data-attach-preview class="hidden mb-1 relative">
          <img class="rounded border border-slate-200 max-h-24"/>
          <button data-attach-clear class="absolute top-1 right-1 w-4 h-4 rounded-full bg-slate-700 text-white text-[9px] leading-none">×</button>
        </div>
        <div class="flex items-center gap-1">
          <input data-reply placeholder="${L(c(s("issReplyAs", "Reply as {who}..."), { who: e.author || "user" }))}" spellcheck="false"
            class="flex-1 min-w-0 px-2 py-1.5 border border-slate-200 rounded text-[11px] focus:outline-none focus:border-indigo-300"/>
          <button data-attach title="${L(s("issAttach", "Attach a photo (site picture, detail, sketch)"))}"
            class="px-2 py-1.5 rounded border border-slate-300 text-slate-500 hover:bg-slate-50"><i data-lucide="image" class="w-3.5 h-3.5"></i></button>
          <button data-send class="px-2.5 py-1.5 rounded bg-slate-700 text-white text-[10px] font-semibold hover:bg-slate-800">${L(s("issSend", "Send"))}</button>
        </div>
        <input data-attach-file type="file" accept="image/*" class="hidden"/>
      </div>
    </div>`, C.wire(a), u) {
			let e = f("[data-attach-preview]");
			e && (e.querySelector("img").src = u, e.classList.remove("hidden"));
		}
		window.lucide?.createIcons?.(), m(v);
	}
	return a.addEventListener("click", async (t) => {
		if (!d) return;
		if (t.target.closest("[data-open3d]")) {
			o.onOpen3d?.(d);
			return;
		}
		if (t.target.closest("[data-goto]") || t.target.closest("[data-snap]")) {
			l.goTo?.(d);
			return;
		}
		if (t.target.closest("[data-resnap]")) {
			l.resnap?.(d);
			return;
		}
		if (t.target.closest("[data-send]")) {
			let t = f("[data-reply]");
			(t?.value.trim() || u) && (await e.addComment(d, t?.value || "", u), t && (t.value = ""), u = null);
			return;
		}
		if (t.target.closest("[data-attach]")) {
			f("[data-attach-file]")?.click();
			return;
		}
		if (t.target.closest("[data-attach-clear]")) {
			u = null, f("[data-attach-preview]")?.classList.add("hidden");
			return;
		}
		let n = t.target.closest("[data-cimg]");
		if (n) {
			window.open(n.src, "_blank");
			return;
		}
		if (t.target.closest("[data-marker-move]")) {
			l.markerMove?.(d);
			return;
		}
		if (t.target.closest("[data-marker-del]")) {
			l.markerDel?.(d);
			return;
		}
		if (t.target.closest("[data-marker-goto]")) {
			l.markerGoto?.(d);
			return;
		}
	}), a.addEventListener("keydown", (e) => {
		e.key === "Enter" && e.target.closest("[data-reply]") && (e.preventDefault(), f("[data-send]")?.click());
	}), a.addEventListener("change", async (t) => {
		let n = t.target.closest("[data-attach-file]");
		if (n && n.files?.[0]) {
			u = await H(n.files[0]), n.value = "";
			let e = f("[data-attach-preview]");
			e && u && (e.querySelector("img").src = u, e.classList.remove("hidden"));
			return;
		}
		let r = t.target.closest("[data-fed]");
		if (r && d) {
			let t = d, n = r.value;
			setTimeout(() => e.setFederation?.(t, n || null), 0);
			return;
		}
		let i = t.target.closest("[data-e]");
		if (!i || !d) return;
		let a = i.dataset.e, o = a === "labels" ? i.value.split(",").map((e) => e.trim()).filter(Boolean) : i.value, s = d;
		setTimeout(() => e.updateTopic(s, { [a]: o }), 0);
	}), {
		render: g,
		get guid() {
			return d;
		},
		set guid(e) {
			d = e;
		},
		hasOpenPopup: () => !!a.querySelector("[data-ldd-pop]:not(.hidden)")
	};
}
//#endregion
//#region js/webifc/coo_bcf_board.js
function Y(e, n = {}) {
	if (!e || e.dataset.bcfBoard) return null;
	let r = n.core || window.__cooBcf;
	if (!r) return setTimeout(() => Y(e, n), 500), null;
	e.dataset.bcfBoard = "1";
	let i = () => n.access || window.__cooBcfCde || null, a = n.no3d !== !0, o = (e) => typeof r.numberOf == "function" ? r.numberOf(e.guid) : null, u = () => n.scope || i()?.scope || null, d = (e) => {
		let t = u();
		return !t || t.test(e);
	}, f = () => r.topics().filter(d), p = (e) => String(e ?? "").trim().toLowerCase();
	function m() {
		if (typeof n.me == "function") return (n.me() || []).filter(Boolean);
		if (typeof r.meAliases == "function") return (r.meAliases() || []).filter(Boolean);
		let e = window.__cdeCtx;
		return e ? [
			e.author,
			e.me && e.me.memberId,
			e.me && e.me.name,
			e.me && e.me.mail
		].filter(Boolean) : [r.author].filter(Boolean);
	}
	function h(e) {
		let t = (typeof r.contacts == "function" ? r.contacts() : null) || window.__cooProject?.listContacts?.() || [], n = p(e), i = t.find((e) => p(e.mail) === n || p(e.name) === n || e.id && p(e.id) === n);
		return i ? i.name || i.mail : e;
	}
	let g = () => ({
		isClosed: (e) => r.isClosed(e),
		me: m(),
		personName: h,
		now: Date.now()
	}), v = n.filterStore || F(n.filterKey || (() => {
		try {
			return "viewer:" + (new URLSearchParams(window.location.search).get("project") || "local");
		} catch {
			return "viewer:local";
		}
	})(), window), y = () => {
		let e = v.get(), t = g();
		return f().filter((n) => A(n, e, t));
	}, b = null, x = l(y, (e) => typeof r.numberOf == "function" ? r.numberOf(e) : null), S = (e) => typeof r.onChange == "function" ? r.onChange(e) : window.addEventListener("coo-bcf-changed", e), C = "", w = "created", T = -1, E = null, D = null, O = "liteaeco_issues_dash_open", k = !1;
	try {
		k = localStorage.getItem(O) === "1";
	} catch {}
	let j = n.hubStyle || null, M = j ? "bg-white rounded border border-slate-200" : "bg-white rounded border border-slate-200 shadow-sm", N = j ? "px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-[12px] font-bold uppercase tracking-widest transition flex items-center gap-1.5" : "px-3 py-1.5 rounded bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed", I = j ? "px-3 py-1.5 bg-white border border-slate-200 hover:border-indigo-200 hover:text-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 text-[12px] font-bold uppercase tracking-widest transition flex items-center gap-1.5" : "px-3 py-1.5 rounded border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed", R = (e) => j ? `<i data-lucide="${e}" class="w-3.5 h-3.5 pointer-events-none"></i>` : "", V = L(n.title || s("issBoardTitle", "Issue Management")), H = j ? `<div>
        <div class="mb-3 flex items-center justify-between gap-3">
          <div class="flex items-center gap-2 min-w-0">
            <i data-lucide="${L(j.icon || "layers")}" class="w-4 h-4 text-slate-500 shrink-0"></i>
            <span class="text-sm font-bold text-slate-500 uppercase tracking-widest">${V}</span>
            ${j.folder ? `<span class="font-mono text-[11px] text-slate-400 truncate">/${L(j.folder)}</span>` : ""}
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button data-publish-local class="hidden ${I}"></button>
            <button data-import class="${I}">${R("upload")}<span>${L(s("issImport", "Import .bcf"))}</span></button>
            <button data-export class="${I}">${R("download")}<span>${L(s("issExport", "Export .bcf"))}</span></button>
            ${typeof n.onNew == "function" ? `<button data-new class="${N}">${R("plus")}<span>${L(s("issNew", "New issue"))}</span></button>` : ""}
          </div>
        </div>
        ${j.hint ? `<p class="text-[11px] text-slate-500">${L(j.hint)}</p>` : ""}
      </div>` : `<div class="flex items-center justify-between">
        <h2 class="text-base font-bold text-slate-800">${V}</h2>
        <div class="flex items-center gap-2">
          ${typeof n.onNew == "function" ? `<button data-new class="${N}">${L(s("issNew", "New issue"))}</button>` : ""}
          <button data-publish-local class="hidden px-3 py-1.5 rounded border border-indigo-300 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"></button>
          <button data-import class="${I}">${L(s("issImport", "Import .bcf"))}</button>
          <button data-export class="${I}">${L(s("issExport", "Export .bcf"))}</button>
        </div>
      </div>`;
	e.innerHTML = `
  <div class="flex-1 min-h-0 overflow-y-auto w-full">
    <div class="${j ? "w-full" : n.wide ? "max-w-7xl mx-auto py-1" : "max-w-5xl mx-auto p-6"} space-y-4">
      ${H}

      <div data-bcf-noright class="hidden px-3 py-2 rounded border border-amber-200 bg-amber-50 text-[11px] text-amber-800"></div>
      <div data-cards class="grid grid-cols-2 md:grid-cols-5 gap-3"></div>

      <div class="${M} p-4">
        <div class="flex items-center justify-between mb-2">
          <p class="text-xs font-bold text-slate-600">${L(s("issProgress", "Resolution progress"))}</p>
          <p data-progress-label class="text-xs font-semibold text-slate-500"></p>
        </div>
        <div class="w-full h-4 rounded-full bg-slate-100 overflow-hidden">
          <div data-progress-bar class="h-full bg-emerald-500 transition-all duration-500" style="width:0%"></div>
        </div>
        <p class="text-[10px] text-slate-400 mt-1">${L(s("issProgressHint", "100% = all issues, filled = closed"))}</p>
      </div>

      <!-- dashboard (collapsed by default, remembered): click any bar to filter the table below -->
      <details data-dash class="group ${M}"${k ? " open" : ""}>
        <summary class="cursor-pointer select-none list-none flex items-center gap-2 px-4 py-2.5">
          <span class="text-slate-400 text-[10px] transition-transform group-open:rotate-90">&#9654;</span>
          <span class="${j ? "text-sm font-bold text-slate-500 uppercase tracking-widest" : "text-xs font-bold text-slate-600"}">${L(s("issDashboard", "Dashboard"))}</span>
        </summary>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 pt-1">
        <div class="${M} p-4">
          <p class="text-xs font-bold text-slate-600 mb-2">${L(s("issChartDisc", "Issues by discipline"))} <span class="font-normal text-slate-400">${L(s("issChartDiscHint", "(open / in progress / closed)"))}</span></p>
          <div data-chart-disc class="space-y-1.5"></div>
        </div>
        <div class="${M} p-4">
          <p class="text-xs font-bold text-slate-600 mb-2">${L(s("issChartDue", "Open issues by due date"))}</p>
          <div data-chart-due class="space-y-1.5"></div>
        </div>
        <div class="${M} p-4">
          <p class="text-xs font-bold text-slate-600 mb-2">${L(s("issChartPrio", "Open issues by priority"))}</p>
          <div data-chart-prio class="space-y-1.5"></div>
        </div>
        <div class="${M} p-4">
          <p class="text-xs font-bold text-slate-600 mb-2">${L(s("issChartAssignee", "Open issues by assignee"))} <span class="font-normal text-slate-400">${L(s("issChartAssigneeHint", "(top 8)"))}</span></p>
          <div data-chart-assignee class="space-y-1.5"></div>
        </div>
        <div class="${M} p-4 md:col-span-2">
          <p class="text-xs font-bold text-slate-600 mb-2">${L(s("issChartTimeline", "Created vs closed over time"))}</p>
          <div data-chart-timeline></div>
        </div>
      </div>
      </details>
      <div data-active-filters class="hidden flex items-center gap-2 flex-wrap text-[11px]"></div>

      <div>
        <div class="${M} min-w-0">
          <div class="flex items-center gap-2 p-3 border-b border-slate-100">
            <input data-search placeholder="${L(s("issSearch", "Search issues..."))}" spellcheck="false"
              class="flex-1 min-w-0 text-xs px-2 py-1.5 border border-slate-200 rounded focus:outline-none focus:border-indigo-300"/>
            <select data-scope class="hidden bg-white text-xs px-2 py-1.5 border border-slate-200 rounded max-w-[14rem]"></select>
          </div>
          <div data-filterbar class="px-3 py-2 border-b border-slate-100"></div>
          <div data-table class="overflow-x-auto"></div>
        </div>
      </div>
    </div>
  </div>
  <!-- issue panel: slides in from the right over the page (like the 3D dock),
       below the top navigation bar; the table keeps its size, nothing moves -->
  <div data-drawer data-open="0" role="dialog" aria-hidden="true"
    class="fixed right-0 z-[60] w-full max-w-[420px] bg-white border-l border-slate-200 shadow-2xl flex flex-col translate-x-full transition-transform duration-200 ease-out">
    <div class="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 shrink-0">
      <span data-drawer-title class="text-sm font-semibold text-slate-800 truncate">${L(s("issDrawerTitle", "Issue"))}</span>
      <button data-drawer-close class="shrink-0 p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100" title="${L(s("issClose", "Close (Esc)"))}" aria-label="${L(s("issClose", "Close (Esc)"))}">
        <i data-lucide="x" class="w-4 h-4 pointer-events-none"></i>
      </button>
    </div>
    <div data-drawer-body class="flex-1 min-h-0 overflow-y-auto"></div>
  </div>`;
	let U = (t) => e.querySelector(t);
	Q(), window.lucide?.createIcons?.();
	function W(e, t, n) {
		return `<div class="${M} p-3">
      <p class="text-[10px] font-semibold text-slate-400 uppercase">${e}</p>
      <p class="text-xl font-bold ${n}">${t}</p></div>`;
	}
	document.addEventListener("languageLoaded", () => {
		e.isConnected && G();
	});
	function G() {
		oe();
		let { counts: e } = x.dashboard();
		U("[data-cards]").innerHTML = W(L(s("issCardTotal", "Total")), e.total, "text-slate-800") + W(L(s("issCardOpen", "Open")), e.open, "text-amber-600") + W(L(s("issCardInProgress", "In progress")), e.inProgress, "text-sky-600") + W(L(s("issCardClosed", "Closed")), e.closed, "text-emerald-600") + W(L(s("issCardOverdue", "Overdue")), e.overdue, e.overdue ? "text-red-600" : "text-slate-300");
		let n = e.total ? Math.round(e.closed / e.total * 100) : 0;
		U("[data-progress-bar]").style.width = n + "%", U("[data-progress-label]").textContent = e.total ? c(s("issProgressLabel", "{closed} of {total} closed ({pct}%)"), {
			closed: e.closed,
			total: e.total,
			pct: n
		}) : s("issNone", "No issues yet");
		let i = Date.now(), l = y(), u = (e) => !r.isClosed(e), d = 864e5;
		q(l, u, (e) => {
			if (!e.dueDate) return "none";
			let t = new Date(e.dueDate).getTime() - i;
			return t < 0 ? "overdue" : t < 7 * d ? "week" : t < 14 * d ? "twoweeks" : "later";
		});
		let f = x.query({ search: C });
		te(), b?.render(), j && queueMicrotask(() => window.lucide?.createIcons?.());
		let p = {
			Critical: 0,
			Major: 1,
			Normal: 2,
			Low: 3
		}, m = (e) => ({
			no: o(e) || Infinity,
			title: String(e.title || "").toLowerCase(),
			status: t.indexOf(e.status),
			priority: p[e.priority] ?? 9,
			assigned: String(e.assignedTo || "").toLowerCase(),
			created: e.creationDate ? new Date(e.creationDate).getTime() : 0,
			due: e.dueDate ? new Date(e.dueDate).getTime() : Infinity
		})[w];
		f.sort((e, t) => {
			let n = m(e), r = m(t);
			return n < r ? -T : n > r ? T : 0;
		});
		let h = (e, t, n = "") => `<th class="px-3 py-2 ${n}"><button data-sort="${e}" class="uppercase tracking-wide hover:text-slate-700 ${w === e ? "text-slate-700" : ""}">${t}${w === e ? T > 0 ? " ▲" : " ▼" : ""}</button></th>`;
		U("[data-table]").innerHTML = f.length ? `<table class="w-full text-xs">
        <thead>
          <tr class="text-left text-[10px] uppercase text-slate-400 border-b border-slate-100">
            ${h("no", L(s("issColNo", "No.")), "w-14")}${h("title", L(s("issColTitle", "Title")))}${h("status", L(s("issStatus", "Status")))}${h("priority", L(s("issPriority", "Priority")))}
            <th class="px-3 py-2">${L(s("issLabels", "Labels"))}</th>${h("assigned", L(s("issColAssigned", "Assigned")))}
            ${h("created", L(s("issColCreated", "Created")))}${h("due", L(s("issColDue", "Due")))}<th class="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
        ${f.map((e) => {
			let n = !r.isClosed(e) && e.dueDate && new Date(e.dueDate).getTime() < i, c = e.guid === E;
			return `<tr data-row="${L(e.guid)}" class="border-b border-slate-50 cursor-pointer ${c ? "bg-indigo-50/60" : "hover:bg-slate-50"}">
              <td class="px-3 py-2 text-slate-500 font-semibold tabular-nums">${o(e) || "-"}</td>
              <td class="px-3 py-2 font-semibold text-slate-700 max-w-[260px]"><div class="truncate">${L(e.title)}</div>
                <div class="text-[10px] font-normal text-slate-400 truncate">${L(e.description || "")}</div></td>
              <td class="px-3 py-2">
                <select data-row-status class="text-[10px] font-bold rounded px-1 py-0.5 border-0 ${B(e.status)} cursor-pointer disabled:cursor-not-allowed" title="${L(s("issChangeStatus", "Change status"))}"${le() ? "" : " disabled"}>
                  ${t.map((t) => `<option ${t === e.status ? "selected" : ""}>${t}</option>`).join("")}
                </select></td>
              <td class="px-3 py-2 text-slate-500">${L(e.priority || "-")}</td>
              <td class="px-3 py-2">${[...e.labels || []].map((e) => `<span class="inline-block px-1 mr-0.5 rounded bg-slate-100 text-slate-500 text-[9px] font-bold">${L(e)}</span>`).join("") || "<span class=\"text-slate-300\">-</span>"}</td>
              <td class="px-3 py-2 text-slate-500 max-w-[140px] truncate">${L(e.assignedTo || "-")}</td>
              <td class="px-3 py-2 text-slate-500">${z(e.creationDate)}</td>
              <td class="px-3 py-2 ${n ? "text-red-600 font-bold" : "text-slate-500"}">${z(e.dueDate)}</td>
              <td class="px-3 py-2 text-right whitespace-nowrap">${a ? `
                <button data-open3d="${L(e.guid)}"
                  class="${j ? "px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold uppercase tracking-widest transition inline-flex items-center gap-1" : "px-2 py-1 rounded border border-slate-300 text-[10px] font-semibold text-indigo-600 hover:bg-indigo-50"}">${j ? "<i data-lucide=\"box\" class=\"w-3 h-3 pointer-events-none\"></i>" : ""}${L(s("issOpen3d", "Open in 3D"))}</button>` : ""}
              </td>
            </tr>`;
		}).join("")}
        </tbody></table>` : `<p class="text-slate-400 italic text-center py-6 text-xs">${L(s("issNoMatch", "No issues match."))}</p>`, ie();
	}
	function K(e, t, n, r, i, a, o) {
		let c = t.reduce((e, t) => e + t.n, 0), l = (e) => n ? Math.round(e / n * 100) : 0;
		return `<button ${r}="${L(i)}" class="w-full text-left group ${a ? "ring-1 ring-indigo-300 rounded" : ""}" title="${L(s("issBarFilter", "Click to filter the list"))}">
      <div class="flex items-center gap-2">
        <span class="w-28 shrink-0 text-[11px] ${a ? "text-indigo-700 font-bold" : "text-slate-600"} truncate">${L(e)}</span>
        <div class="flex-1 h-3.5 rounded bg-slate-100 overflow-hidden flex">
          ${t.map((e) => e.n ? `<div class="${e.cls} h-full" style="width:${l(e.n)}%" title="${L(e.title)}: ${e.n}"></div>` : "").join("")}
        </div>
        <span class="w-10 text-right text-[11px] font-semibold text-slate-600 tabular-nums">${o ?? c}</span>
      </div></button>`;
	}
	function q(e, t, n) {
		let i = (e) => r.isClosed(e) ? "closed" : e.status === "In Progress" || e.status === "In Review" ? "prog" : "open", a = s("issCardOpen", "Open"), o = s("issSegProgress", "In progress / review"), c = s("issCardClosed", "Closed"), l = /* @__PURE__ */ new Map();
		for (let t of e) {
			let e = t.labels && t.labels.size ? [...t.labels] : ["__none"];
			for (let n of e) {
				let e = l.get(n) || {
					open: 0,
					prog: 0,
					closed: 0
				};
				e[i(t)]++, l.set(n, e);
			}
		}
		let u = [...l.entries()].sort((e, t) => t[1].open + t[1].prog - (e[1].open + e[1].prog) || e[0].localeCompare(t[0])), d = Math.max(1, ...u.map(([, e]) => e.open + e.prog + e.closed));
		U("[data-chart-disc]").innerHTML = u.length ? u.map(([e, t]) => K(e === "__none" ? s("issUnlabelled", "Unlabelled") : e, [
			{
				n: t.open,
				cls: "bg-amber-400",
				title: a
			},
			{
				n: t.prog,
				cls: "bg-sky-400",
				title: o
			},
			{
				n: t.closed,
				cls: "bg-emerald-400",
				title: c
			}
		], d, "data-f-label", e, Z("labels", e), `${t.open + t.prog}/${t.open + t.prog + t.closed}`)).join("") : `<p class="text-slate-300 italic text-[11px]">${L(s("issNone", "No issues yet"))}.</p>`;
		let f = [
			[
				"overdue",
				s("issCardOverdue", "Overdue"),
				"bg-red-500"
			],
			[
				"week",
				s("issDueWeek", "Due this week"),
				"bg-amber-400"
			],
			[
				"twoweeks",
				s("issDue2Weeks", "Due in 2 weeks"),
				"bg-yellow-300"
			],
			[
				"later",
				s("issDueLater", "Later"),
				"bg-sky-300"
			],
			[
				"none",
				s("issDueNone", "No due date"),
				"bg-slate-300"
			]
		], p = Object.fromEntries(f.map(([e]) => [e, 0]));
		for (let r of e) t(r) && p[n(r)]++;
		let m = Math.max(1, ...Object.values(p));
		U("[data-chart-due]").innerHTML = f.map(([e, t, n]) => K(t, [{
			n: p[e],
			cls: n,
			title: t
		}], m, "data-f-due", e, Z("due", e === "none" ? _ : e))).join("");
		let g = [
			["Critical", "bg-red-500"],
			["Major", "bg-orange-400"],
			["Normal", "bg-sky-400"],
			["Low", "bg-slate-300"],
			["__none", "bg-slate-200"]
		], v = Object.fromEntries(g.map(([e]) => [e, 0]));
		for (let n of e) t(n) && v[n.priority && v[n.priority] !== void 0 ? n.priority : "__none"]++;
		let y = Math.max(1, ...Object.values(v));
		U("[data-chart-prio]").innerHTML = g.map(([e, t]) => K(e === "__none" ? s("issUnset", "Unset") : e, [{
			n: v[e],
			cls: t,
			title: e
		}], y, "data-f-prio", e, Z("priority", e))).join("");
		let b = /* @__PURE__ */ new Map();
		for (let n of e) if (t(n)) {
			let e = n.assignedTo || "__none";
			b.set(e, (b.get(e) || 0) + 1);
		}
		let S = [...b.entries()].filter(([e]) => e !== "__none").sort((e, t) => t[1] - e[1]).slice(0, 8);
		b.has("__none") && S.push(["__none", b.get("__none")]);
		let C = Math.max(1, ...S.map(([, e]) => e));
		U("[data-chart-assignee]").innerHTML = S.length ? S.map(([e, t]) => K(e === "__none" ? s("issUnassigned", "Unassigned") : h(e), [{
			n: t,
			cls: e === "__none" ? "bg-slate-300" : "bg-indigo-400",
			title: a
		}], C, "data-f-assignee", e, Z("assignee", e))).join("") : `<p class="text-slate-300 italic text-[11px]">${L(s("issNoOpen", "No open issues."))}</p>`;
		let { timeline: w } = x.dashboard();
		U("[data-chart-timeline]").innerHTML = X(w);
	}
	function X(e) {
		if (!e || e.length < 2) return `<p class="text-slate-300 italic text-[11px]">${L(s("issNoHistory", "Not enough history yet."))}</p>`;
		let t = Math.max(1, ...e.map((e) => e.created)), n = (t) => 24 + t / (e.length - 1) * 592, r = (e) => 100 - e / t * 72, i = (t) => e.map((e, i) => `${i ? "L" : "M"}${n(i).toFixed(1)},${r(e[t]).toFixed(1)}`).join(" "), a = new Date(e[0].t).toLocaleDateString(), o = new Date(e[e.length - 1].t).toLocaleDateString();
		return `<svg viewBox="0 0 640 120" class="w-full h-28">
      <line x1="24" y1="${r(0)}" x2="616" y2="${r(0)}" stroke="#e2e8f0"/>
      <line x1="24" y1="${r(t)}" x2="616" y2="${r(t)}" stroke="#f1f5f9" stroke-dasharray="3 3"/>
      <path d="${i("created")}" fill="none" stroke="#f59e0b" stroke-width="2"/>
      <path d="${i("closed")}" fill="none" stroke="#10b981" stroke-width="2"/>
      <text x="24" y="116" font-size="9" fill="#94a3b8">${L(a)}</text>
      <text x="616" y="116" font-size="9" fill="#94a3b8" text-anchor="end">${L(o)}</text>
      <text x="24" y="${r(t) - 3}" font-size="9" fill="#94a3b8">${t}</text>
      <g font-size="9"><rect x="490" y="6" width="8" height="8" fill="#f59e0b"/><text x="502" y="13" fill="#64748b">${L(s("issLegendCreated", "created"))}</text>
      <rect x="560" y="6" width="8" height="8" fill="#10b981"/><text x="572" y="13" fill="#64748b">${L(s("issLegendClosed", "closed"))}</text></g>
    </svg>`;
	}
	let Z = (e, t) => (v.get()[e] || []).includes(t);
	function te() {
		let e = U("[data-active-filters]"), t = P(v.get(), g()).map((e) => `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">${L(e.text)} <button data-f-remove="${L(e.field)}" data-f-value="${L(e.value)}" class="font-bold hover:text-indigo-900" title="${L(s("issClear", "Clear"))}">×</button></span>`);
		e.classList.toggle("hidden", !t.length), e.innerHTML = t.length ? `<span class="text-slate-500">${L(s("issFilteredBy", "Filtered by"))}</span> ` + t.join(" ") + ` <button data-f-clear class="text-slate-500 underline">${L(s("issClearAll", "clear all"))}</button>` : "";
	}
	function ne() {
		if (typeof n.top == "number") return n.top;
		try {
			return parseFloat(getComputedStyle(document.body).paddingTop) || 0;
		} catch {
			return 0;
		}
	}
	function Q() {
		let e = U("[data-drawer]"), t = ne();
		e.style.top = t + "px", e.style.height = `calc(100% - ${t}px)`;
	}
	function re(e) {
		let t = U("[data-drawer]");
		e && Q(), t.dataset.open = e ? "1" : "0", t.classList.toggle("translate-x-full", !e), t.classList.toggle("translate-x-0", e), t.setAttribute("aria-hidden", e ? "false" : "true"), t.inert = !e;
	}
	function ie() {
		let e = U("[data-drawer-body]");
		if (!E || !r.bcf.list.get(E)) {
			E = null, re(!1);
			return;
		}
		re(!0);
		let t = typeof r.numberOf == "function" ? r.numberOf(E) : null;
		if (U("[data-drawer-title]").textContent = t ? c(s("issDrawerTitleN", "Issue {n}"), { n: t }) : s("issDrawerTitle", "Issue"), !D || !e.contains(D.mount)) {
			e.innerHTML = "";
			let t = document.createElement("div");
			e.appendChild(t), D = J(r, t, {
				key: "board",
				onOpen3d: a ? (e) => ae(e) : void 0,
				actions: {}
			}), D.mount = t;
		}
		D.render(E);
	}
	function ae(e) {
		if (typeof n.onOpen3d == "function") {
			n.onOpen3d(e);
			return;
		}
		document.getElementById("nav-viewer")?.click(), setTimeout(() => {
			window.dispatchEvent(new CustomEvent("coo-bcf-open-topic", { detail: { guid: e } }));
		}, 150);
	}
	e.addEventListener("click", (e) => {
		if (e.target.closest("[data-drawer-close]")) {
			E = null, G();
			return;
		}
		if (e.target.closest("[data-drawer]")) return;
		let t = e.target.closest("[data-open3d]");
		if (t) {
			t.dataset.open3d && ae(t.dataset.open3d);
			return;
		}
		let a = e.target.closest("[data-sort]");
		if (a) {
			let e = a.dataset.sort;
			w === e ? T = -T : (w = e, T = e === "title" || e === "assigned" ? 1 : -1), G();
			return;
		}
		let o = e.target.closest("[data-f-label],[data-f-due],[data-f-prio],[data-f-assignee]");
		if (o) {
			let e = o.dataset, [t, n, r] = e.fLabel === void 0 ? e.fDue === void 0 ? e.fPrio === void 0 ? [
				"assignee",
				e.fAssignee,
				!0
			] : [
				"priority",
				e.fPrio,
				!0
			] : [
				"due",
				e.fDue === "none" ? _ : e.fDue,
				!0
			] : [
				"labels",
				e.fLabel,
				!1
			], i = !Z(t, n);
			v.toggle(t, n, i), i && r && !v.get().openOnly && v.toggle("openOnly", void 0, !0);
			return;
		}
		let l = e.target.closest("[data-f-remove]");
		if (l) {
			v.toggle(l.dataset.fRemove, l.dataset.fValue, !1);
			return;
		}
		if (e.target.closest("[data-f-clear]")) {
			v.clear();
			return;
		}
		let u = e.target.closest("[data-row]");
		if (u && !e.target.closest("select") && !e.target.closest("button")) {
			E = u.dataset.row === E ? null : u.dataset.row, G();
			return;
		}
		if (e.target.closest("[data-export]")) {
			r.exportBcfFile();
			return;
		}
		if (e.target.closest("[data-new]")) {
			Promise.resolve(n.onNew()).then((e) => {
				e && r.bcf.list.get(e) && (E = e, G());
			}).catch((e) => console.warn("[bcf-board] new issue failed", e));
			return;
		}
		if (e.target.closest("[data-publish-local]")) {
			i()?.publishLocal?.().then($);
			return;
		}
		if (e.target.closest("[data-import]")) {
			let e = document.createElement("input");
			e.type = "file", e.accept = ".bcf,.bcfzip", e.addEventListener("change", async () => {
				let t = e.files?.[0];
				if (t) try {
					let e = await r.importBcfFile(t);
					if (e?.refused) return;
					if (e?.sampled > 0 && e.matched / e.sampled < .25 && !confirm(c(s("issImportWeak", "This BCF references {sampled} element(s); only {matched} found in the loaded models.\nIt may belong to a different project.\n\nKeep the import?"), {
						sampled: e.sampled,
						matched: e.matched
					}))) {
						r.removeTopics(e.imported);
						return;
					}
					e?.imported?.length && r.markDirty?.(e.imported, ["__new"]);
				} catch (e) {
					alert(s("issImportFailed", "BCF import failed:") + " " + (e?.message || e));
				}
			}), e.click();
			return;
		}
	}), U("[data-search]").addEventListener("input", (e) => {
		C = e.target.value, G();
	}), U("[data-dash]").addEventListener("toggle", (e) => {
		try {
			localStorage.setItem(O, e.target.open ? "1" : "0");
		} catch {}
	}), b = ee(U("[data-filterbar]"), {
		store: v,
		getTopics: f,
		ctx: g
	}), v.subscribe(() => G());
	function oe() {
		let e = U("[data-scope]"), t = u();
		if (!e || (e.classList.toggle("hidden", !t), !t)) return;
		let n = t.get();
		e.innerHTML = t.options().map((e) => `<option value="${L(e.id)}"${e.id === n ? " selected" : ""}>${L(e.label)}</option>`).join("");
	}
	U("[data-scope]").addEventListener("change", (e) => {
		let t = u();
		t && (t.set(e.target.value), t.event || G());
	});
	let se = null, ce = () => {
		let e = u();
		e && e.event && se !== e.event && (se = e.event, window.addEventListener(e.event, () => G()));
	};
	ce(), window.addEventListener("coo-bcf-project", () => {
		ce(), G();
	}), e.addEventListener("change", (e) => {
		let t = e.target.closest("[data-row-status]");
		if (!t) return;
		let n = e.target.closest("[data-row]");
		n && r.updateTopic(n.dataset.row, { status: t.value });
	}), document.addEventListener("keydown", (t) => {
		t.key === "Escape" && E && !e.classList.contains("hidden") && (E = null, G());
	}), S(() => {
		D?.hasOpenPopup?.() || (G(), $());
	});
	function $() {
		let e = i(), t = !le(), n = s("bcfNoUploadRight", "You can see the issues of this project but not add or change them: no upload right on the issues folder."), r = U("[data-bcf-noright]");
		r && (r.classList.toggle("hidden", !t), r.textContent = t ? n : "");
		for (let e of [U("[data-import]"), U("[data-new]")]) e && (e.disabled = t, t ? e.title = n : e.removeAttribute("title"));
		let a = U("[data-publish-local]"), o = e && e.canWrite && typeof e.localOnly == "function" ? e.localOnly().length : 0;
		a && (a.classList.toggle("hidden", !o), a.textContent = o ? `${s("bcfLocalOnly", "Publish local issues")} (${o})` : "");
	}
	function le() {
		let e = i();
		return !e || e.canWrite !== !1;
	}
	window.addEventListener("coo-bcf-access", () => {
		$(), G();
	}), window.addEventListener("coo-bcf-project", $), G(), $();
	let ue = () => {
		G(), $(), i()?.offerPublish?.()?.then?.($);
	};
	return e.__bcfBoardRender = ue, {
		render: G,
		show: ue,
		applyAccess: $,
		open: (e) => e && r.bcf.list.get(e) ? (E = e, G(), !0) : !1
	};
}
//#endregion
//#region js/hub/hub-bcf.js
var X = 1;
//#endregion
export { u as BCF_FILECORE_BUILD, X as BCF_HUB_BUILD, r as BCF_PRIORITIES, i as BCF_STAGES, t as BCF_STATUSES, n as BCF_TYPES, g as createFileCore, J as createTopicDetail, Y as initBcfBoard, s as t };
