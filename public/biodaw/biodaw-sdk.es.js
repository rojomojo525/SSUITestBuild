class Nt {
  constructor() {
    this.listeners = {};
  }
  on(i, t) {
    this.listeners[i] || (this.listeners[i] = []), this.listeners[i].push(t);
  }
  off(i, t) {
    this.listeners[i] && (this.listeners[i] = this.listeners[i].filter((d) => d !== t));
  }
  emit(i, t = null) {
    if (console.log(`[EventBus] 📢 EMIT: ${i}`, t), !this.listeners[i]) {
      console.warn(`[EventBus] ⚠️ No listeners attached for: ${i}`);
      return;
    }
    this.listeners[i].forEach((d) => {
      try {
        d(t);
      } catch (o) {
        console.error(`[EventBus] ❌ CRITICAL ERROR in listener for ${i}:`, o), console.error(o.stack);
      }
    });
  }
}
const at = new Nt(), ht = {
  PROJECT_LOADED: "PROJECT_LOADED",
  PROJECT_DIRTY: "PROJECT_DIRTY",
  PROJECT_CLEARED: "PROJECT_CLEARED",
  TRACK_ADDED: "TRACK_ADDED",
  TRACK_REMOVED: "TRACK_REMOVED",
  CLIP_ADDED: "CLIP_ADDED",
  CLIP_MOVED: "CLIP_MOVED",
  CLIP_REMOVED: "CLIP_REMOVED",
  TRANSPORT_PLAY: "TRANSPORT_PLAY",
  TRANSPORT_STOP: "TRANSPORT_STOP",
  // ... your other events ...
  AUDIO_IMPORT_REQUESTED: "AUDIO_IMPORT_REQUESTED",
  TRACK_VOLUME_CHANGED: "TRACK_VOLUME_CHANGED",
  TRACK_PAN_CHANGED: "TRACK_PAN_CHANGED",
  CV_IMPORT_REQUESTED: "CV_IMPORT_REQUESTED",
  // --- NEW: DSP Effect Events ---
  EFFECT_MOUNTED: "EFFECT_MOUNTED",
  EFFECT_PARAM_CHANGED: "EFFECT_PARAM_CHANGED",
  EFFECT_REMOVED: "EFFECT_REMOVED",
  HEADLESS_API_READY: "HEADLESS_API_READY"
};
class Lt {
  constructor() {
    this.reset();
  }
  // --- LIFECYCLE MANAGERS ---
  // --- LIFECYCLE MANAGERS ---
  reset() {
    this.name = "", this.tempo = 120, this.tempoMap = [{ ppq: 0, time: 0, bpm: this.tempo }], this.isLooping = !1, this.loopStart = 0, this.loopEnd = 4, this.uiState = {}, this.tracks = [], this._cppTrackIdCounter = 0, this._clipIdCounter = 1, this._noteIdCounter = 1, this._effectIdCounter = 1, this.isDirty = !1, at.emit(ht.PROJECT_CLEARED);
  }
  loadState(i, t) {
    this.reset(), this.name = i, this.tempo = t.tempo || 120, this.tempoMap = t.tempoMap || [{ ppq: 0, time: 0, bpm: this.tempo }], this.isLooping = !!t.isLooping, this.loopStart = t.loopStart || 0, this.loopEnd = t.loopEnd || 4, this.uiState = t.uiState || {}, this.tracks = t.tracks || [];
    let d = -1, o = 0, r = 0, s = 0;
    this.tracks.forEach((n) => {
      n.cppTrackId > d && (d = n.cppTrackId), (n.effects || []).forEach((c) => {
        const p = parseInt(c.instanceId.replace("fx-", "")) || 0;
        p > s && (s = p);
      }), (n.clips || []).forEach((c) => {
        c.id > o && (o = c.id), (c.notes || []).forEach((p) => {
          const w = parseInt(p.id.replace("note-", "")) || 0;
          w > r && (r = w);
        });
      });
    }), this._cppTrackIdCounter = d + 1, this._clipIdCounter = o + 1, this._noteIdCounter = r + 1, this._effectIdCounter = s + 1, this.isDirty = !1, at.emit(ht.PROJECT_LOADED, this.getState());
  }
  // Returns a deep copy so the UI cannot accidentally mutate the actual data
  getState() {
    return JSON.parse(JSON.stringify({
      name: this.name,
      tempo: this.tempo,
      tempoMap: this.tempoMap,
      // --- NEW: Officially export it! ---
      isLooping: this.isLooping,
      loopStart: this.loopStart,
      loopEnd: this.loopEnd,
      uiState: this.uiState,
      tracks: this.tracks
    }));
  }
  // --- SAFE MUTATORS ---
  addTrack(i, t, d = [48, 84]) {
    const o = this._cppTrackIdCounter++, r = {
      id: `track-${o}`,
      // UI ID
      cppTrackId: o,
      // Stable WASM ID
      name: i,
      type: t,
      midiOutId: t === "midi" ? "fluidsynth" : "none",
      yDomain: d,
      displayOrder: this.tracks.length,
      armed: !1,
      clips: [],
      effects: []
    };
    return this.tracks.push(r), this.markDirty(), at.emit(ht.TRACK_ADDED, r), r;
  }
  removeTrack(i) {
    const t = this.tracks.findIndex((o) => o.id === i);
    if (t === -1) return null;
    const d = this.tracks.splice(t, 1)[0];
    return this.tracks.forEach((o, r) => o.displayOrder = r), this.markDirty(), at.emit(ht.TRACK_REMOVED, d), d;
  }
  addClip(i, t, d, o = null, r = [], s = null, n = []) {
    const c = this.tracks.find((g) => g.id === i);
    if (!c) return null;
    const p = r.map((g) => ({
      id: `note-${this._noteIdCounter++}`,
      pitch: g.pitch,
      start: g.start,
      length: g.length,
      velocity: g.velocity || 100
    })), w = {
      id: this._clipIdCounter++,
      // Stable WASM ID
      type: c.type,
      start: t,
      length: d,
      sourceOffset: 0,
      assetPath: o,
      notes: p,
      controls: n
    };
    return c.clips.push(w), this.markDirty(), at.emit(ht.CLIP_ADDED, { track: c, clip: w, bufferData: s }), w;
  }
  markDirty() {
    this.isDirty || (this.isDirty = !0, at.emit(ht.PROJECT_DIRTY, !0));
  }
  // --- NEW: Add this right below markDirty() ---
  clearDirty() {
    this.isDirty && (this.isDirty = !1, at.emit(ht.PROJECT_DIRTY, !1));
  }
}
const G = new Lt(), E = {
  isBooted: !1,
  wasmInstance: null,
  fluidSynthReady: !1,
  assetBaseUrl: "/app",
  async boot(u = "balanced") {
    if (this.isBooted) return !0;
    console.log("[EngineCore] Booting Encapsulated WASM Engine...");
    try {
      const i = this.assetBaseUrl.replace(/\/$/, ""), t = `${i}/BioDAW.js`;
      await this.loadEngineScript(t);
      const d = window.createBioDAWEngine;
      window.createBioDAWEngine = void 0;
      const o = await d({
        mainScriptUrlOrBlob: t,
        locateFile: (r) => r.endsWith(".wasm") ? `${i}/BioDAW.wasm` : `${i}/${r}`,
        print: (r) => console.log(`[C++] ${r}`),
        printErr: (r) => console.error(`[C++] ${r}`)
      });
      return this.wasmInstance = o, await new Promise((r) => {
        window.onBioDAWAudioGraphReady = () => {
          window.onBioDAWAudioGraphReady = void 0, r();
        }, this.wasmInstance.ccall(
          "StartBioDAW",
          null,
          ["string"],
          [u]
          // "interactive", "balanced", or "playback"
        );
      }), this.wasmInstance.ccall("biodaw_init_pd", null, [], []), this.wasmInstance.ccall, await this.initFileSystem(), this.isBooted = !0, at.emit("ENGINE_BOOT_COMPLETE", {}), console.log("[EngineCore] ✅ Engine Boot Sequence Complete!"), !0;
    } catch (i) {
      throw console.error("[EngineCore] ❌ Boot Sequence Failed:", i), i;
    }
  },
  // Helper to load the classic script securely and asynchronously
  loadEngineScript(u) {
    return new Promise((i, t) => {
      if (document.querySelector(`script[src="${u}"]`)) return i();
      const d = document.createElement("script");
      d.src = u, d.onload = () => i(), d.onerror = () => t(new Error(`Failed to load Wasm script from ${u}`)), document.head.appendChild(d);
    });
  },
  get() {
    return this.wasmInstance || console.warn("EngineCore.get() called before boot!"), this.wasmInstance;
  },
  getSampleRate() {
    return this.wasmInstance.ccall("get_sample_rate", "number", [], []);
  },
  async initFileSystem() {
    return new Promise((u, i) => {
      const t = this.wasmInstance;
      if (!t || !t.FS)
        return i(new Error("Wasm FS not ready. The AudioWorklet may have crashed."));
      const d = t.FS, o = t.IDBFS;
      try {
        d.mkdir("/projects");
      } catch {
      }
      try {
        d.mount(o, {}, "/projects");
      } catch {
      }
      d.syncfs(!0, (r) => {
        r ? (console.error("[EngineCore] Failed to sync IDBFS:", r), i(r)) : (console.log("[EngineCore] Persistent File System Mounted."), u());
      });
    });
  },
  // =========================================================================
  // VIRTUAL SYNTHESIZER (RACK) API
  // =========================================================================
  activeSoundPathces: [],
  async loadActiveSoundFontPathces() {
    const u = this.wasmInstance.ccall("biodaw_get_sf2_presets", "string", [], []);
    try {
      const i = JSON.parse(u);
      this.activeSoundFontPatches = {}, i.forEach((t) => {
        this.activeSoundFontPatches[t.bank] || (this.activeSoundFontPatches[t.bank] = []), this.activeSoundFontPatches[t.bank].push({ program: t.program, name: t.name });
      });
      for (let t in this.activeSoundFontPatches)
        this.activeSoundFontPatches[t].sort((d, o) => d.program - o.program);
      console.log(`[HeadlessAPI] Hydrated ${i.length} presets from SoundFont.`);
    } catch (i) {
      console.error("[HeadlessAPI] Failed to parse SoundFont presets:", i);
    }
  },
  getActiveSoundFontPatches() {
    return this.activeSoundFontPatches;
  },
  /**
   * Fetches a SoundFont, mounts it to VFS, and creates the Master Synth at Routing ID: 0
   */
  async loadSoundFont(u, i = "/default.sf2") {
    if (!this.wasmInstance) return !1;
    try {
      const d = await (await fetch(u)).arrayBuffer();
      return this.wasmInstance.FS.writeFile(i, new Uint8Array(d)), this.wasmInstance.ccall("biodaw_load_soundfont", "number", ["string"], [i]), this.fluidSynthReady = !0, !0;
    } catch (t) {
      return console.error("Failed to load SoundFont:", t), !1;
    }
  },
  addTrackInstrument(u, i = "") {
    this.wasmInstance && this.wasmInstance.ccall("biodaw_add_track_instrument", null, ["number", "string"], [u, i]);
  },
  clearTrackInstruments(u) {
    this.wasmInstance && this.wasmInstance.ccall("biodaw_clear_track_instruments", null, ["number"], [u]);
  },
  setSynthProgram(u, i, t, d) {
    !this.wasmInstance || !this.fluidSynthReady || this.wasmInstance._biodaw_synth_program_change(u, i, t, d);
  },
  playSynthNote(u, i, t, d = 100) {
    !this.wasmInstance || !this.fluidSynthReady || this.wasmInstance._biodaw_synth_note_on(u, i, t, d);
  },
  stopSynthNote(u, i, t) {
    !this.wasmInstance || !this.fluidSynthReady || this.wasmInstance._biodaw_synth_note_off(u, i, t);
  },
  setTrackMidiChannel(u, i) {
    this.wasmInstance && this.wasmInstance.ccall("biodaw_set_track_midi_channel", null, ["number", "number"], [u, i]);
  },
  setSynthParameter(u, i, t) {
    this.wasmInstance && this.wasmInstance.ccall("biodaw_set_synth_float", null, ["number", "string", "number"], [u, i, t]);
  },
  /**
   * Sends an entire MIDI clip (Notes + Expressive Controls) to the C++ Engine
   * for sample-accurate scheduling.
   */
  syncMidiClip(u, i, t, d, o, r = []) {
    if (!this.wasmInstance) return;
    const s = o.length, n = new Float32Array(s * 4);
    for (let b = 0; b < s; b++) {
      const l = o[b];
      n[b * 4 + 0] = l.start, n[b * 4 + 1] = l.length, n[b * 4 + 2] = l.pitch, n[b * 4 + 3] = l.velocity !== void 0 ? l.velocity : 100;
    }
    const c = this.wasmInstance._malloc(n.length * n.BYTES_PER_ELEMENT);
    this.wasmInstance.HEAPF32.set(n, c / 4);
    const p = r.length, w = new Float32Array(p * 4);
    for (let b = 0; b < p; b++) {
      const l = r[b];
      w[b * 4 + 0] = l.start;
      let y = 0, h = 0, m = l.value;
      l.type === "cc" ? (y = 0, h = l.controller) : l.type === "pitchbend" ? y = 1 : l.type === "channelpressure" ? y = 2 : l.type === "programchange" && (y = 3, h = l.bank || 0, m = l.program || 0), w[b * 4 + 1] = y, w[b * 4 + 2] = h, w[b * 4 + 3] = m;
    }
    const g = this.wasmInstance._malloc(w.length * w.BYTES_PER_ELEMENT);
    this.wasmInstance.HEAPF32.set(w, g / 4), this.wasmInstance.ccall(
      "biodaw_sync_midi_clip",
      null,
      ["number", "number", "number", "number", "number", "number", "number", "number"],
      [u, i, t, d, c, s, g, p]
    ), this.wasmInstance._free(c), this.wasmInstance._free(g);
  },
  removeMidiClip(u, i) {
    this.wasmInstance && this.wasmInstance.ccall("biodaw_remove_midi_clip", null, ["number", "number"], [u, i]);
  },
  panicAllNotesOff() {
    this.wasmInstance && this.wasmInstance.ccall("biodaw_panic_all_notes_off", null, [], []);
  },
  getDiagnostics() {
    return this.wasmInstance ? {
      cpu: this.wasmInstance._biodaw_get_cpu_load(),
      memUsed: this.wasmInstance._biodaw_get_mem_used(),
      // THE FIX: Safely ask C++ instead of touching restricted JS variables!
      memTotal: this.wasmInstance._biodaw_get_mem_total()
    } : { cpu: 0, memUsed: 0, memTotal: 0 };
  },
  setTrackOutputLane(u, i) {
    this.wasmInstance && this.wasmInstance.ccall("biodaw_set_track_output_lane", null, ["number", "number"], [u, i]);
  }
};
var At = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {};
function Ut(u) {
  return u && u.__esModule && Object.prototype.hasOwnProperty.call(u, "default") ? u.default : u;
}
function Ct(u) {
  throw new Error('Could not dynamically require "' + u + '". Please configure the dynamicRequireTargets or/and ignoreDynamicRequires option of @rollup/plugin-commonjs appropriately for this require call to work.');
}
var xt = { exports: {} };
var Ot;
function Wt() {
  return Ot || (Ot = 1, (function(u, i) {
    (function(t) {
      u.exports = t();
    })(function() {
      return (function t(d, o, r) {
        function s(p, w) {
          if (!o[p]) {
            if (!d[p]) {
              var g = typeof Ct == "function" && Ct;
              if (!w && g) return g(p, !0);
              if (n) return n(p, !0);
              var b = new Error("Cannot find module '" + p + "'");
              throw b.code = "MODULE_NOT_FOUND", b;
            }
            var l = o[p] = { exports: {} };
            d[p][0].call(l.exports, function(y) {
              var h = d[p][1][y];
              return s(h || y);
            }, l, l.exports, t, d, o, r);
          }
          return o[p].exports;
        }
        for (var n = typeof Ct == "function" && Ct, c = 0; c < r.length; c++) s(r[c]);
        return s;
      })({ 1: [function(t, d, o) {
        var r = t("./utils"), s = t("./support"), n = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
        o.encode = function(c) {
          for (var p, w, g, b, l, y, h, m = [], f = 0, k = c.length, A = k, P = r.getTypeOf(c) !== "string"; f < c.length; ) A = k - f, g = P ? (p = c[f++], w = f < k ? c[f++] : 0, f < k ? c[f++] : 0) : (p = c.charCodeAt(f++), w = f < k ? c.charCodeAt(f++) : 0, f < k ? c.charCodeAt(f++) : 0), b = p >> 2, l = (3 & p) << 4 | w >> 4, y = 1 < A ? (15 & w) << 2 | g >> 6 : 64, h = 2 < A ? 63 & g : 64, m.push(n.charAt(b) + n.charAt(l) + n.charAt(y) + n.charAt(h));
          return m.join("");
        }, o.decode = function(c) {
          var p, w, g, b, l, y, h = 0, m = 0, f = "data:";
          if (c.substr(0, f.length) === f) throw new Error("Invalid base64 input, it looks like a data url.");
          var k, A = 3 * (c = c.replace(/[^A-Za-z0-9+/=]/g, "")).length / 4;
          if (c.charAt(c.length - 1) === n.charAt(64) && A--, c.charAt(c.length - 2) === n.charAt(64) && A--, A % 1 != 0) throw new Error("Invalid base64 input, bad content length.");
          for (k = s.uint8array ? new Uint8Array(0 | A) : new Array(0 | A); h < c.length; ) p = n.indexOf(c.charAt(h++)) << 2 | (b = n.indexOf(c.charAt(h++))) >> 4, w = (15 & b) << 4 | (l = n.indexOf(c.charAt(h++))) >> 2, g = (3 & l) << 6 | (y = n.indexOf(c.charAt(h++))), k[m++] = p, l !== 64 && (k[m++] = w), y !== 64 && (k[m++] = g);
          return k;
        };
      }, { "./support": 30, "./utils": 32 }], 2: [function(t, d, o) {
        var r = t("./external"), s = t("./stream/DataWorker"), n = t("./stream/Crc32Probe"), c = t("./stream/DataLengthProbe");
        function p(w, g, b, l, y) {
          this.compressedSize = w, this.uncompressedSize = g, this.crc32 = b, this.compression = l, this.compressedContent = y;
        }
        p.prototype = { getContentWorker: function() {
          var w = new s(r.Promise.resolve(this.compressedContent)).pipe(this.compression.uncompressWorker()).pipe(new c("data_length")), g = this;
          return w.on("end", function() {
            if (this.streamInfo.data_length !== g.uncompressedSize) throw new Error("Bug : uncompressed data size mismatch");
          }), w;
        }, getCompressedWorker: function() {
          return new s(r.Promise.resolve(this.compressedContent)).withStreamInfo("compressedSize", this.compressedSize).withStreamInfo("uncompressedSize", this.uncompressedSize).withStreamInfo("crc32", this.crc32).withStreamInfo("compression", this.compression);
        } }, p.createWorkerFrom = function(w, g, b) {
          return w.pipe(new n()).pipe(new c("uncompressedSize")).pipe(g.compressWorker(b)).pipe(new c("compressedSize")).withStreamInfo("compression", g);
        }, d.exports = p;
      }, { "./external": 6, "./stream/Crc32Probe": 25, "./stream/DataLengthProbe": 26, "./stream/DataWorker": 27 }], 3: [function(t, d, o) {
        var r = t("./stream/GenericWorker");
        o.STORE = { magic: "\0\0", compressWorker: function() {
          return new r("STORE compression");
        }, uncompressWorker: function() {
          return new r("STORE decompression");
        } }, o.DEFLATE = t("./flate");
      }, { "./flate": 7, "./stream/GenericWorker": 28 }], 4: [function(t, d, o) {
        var r = t("./utils"), s = (function() {
          for (var n, c = [], p = 0; p < 256; p++) {
            n = p;
            for (var w = 0; w < 8; w++) n = 1 & n ? 3988292384 ^ n >>> 1 : n >>> 1;
            c[p] = n;
          }
          return c;
        })();
        d.exports = function(n, c) {
          return n !== void 0 && n.length ? r.getTypeOf(n) !== "string" ? (function(p, w, g, b) {
            var l = s, y = b + g;
            p ^= -1;
            for (var h = b; h < y; h++) p = p >>> 8 ^ l[255 & (p ^ w[h])];
            return -1 ^ p;
          })(0 | c, n, n.length, 0) : (function(p, w, g, b) {
            var l = s, y = b + g;
            p ^= -1;
            for (var h = b; h < y; h++) p = p >>> 8 ^ l[255 & (p ^ w.charCodeAt(h))];
            return -1 ^ p;
          })(0 | c, n, n.length, 0) : 0;
        };
      }, { "./utils": 32 }], 5: [function(t, d, o) {
        o.base64 = !1, o.binary = !1, o.dir = !1, o.createFolders = !0, o.date = null, o.compression = null, o.compressionOptions = null, o.comment = null, o.unixPermissions = null, o.dosPermissions = null;
      }, {}], 6: [function(t, d, o) {
        var r = null;
        r = typeof Promise < "u" ? Promise : t("lie"), d.exports = { Promise: r };
      }, { lie: 37 }], 7: [function(t, d, o) {
        var r = typeof Uint8Array < "u" && typeof Uint16Array < "u" && typeof Uint32Array < "u", s = t("pako"), n = t("./utils"), c = t("./stream/GenericWorker"), p = r ? "uint8array" : "array";
        function w(g, b) {
          c.call(this, "FlateWorker/" + g), this._pako = null, this._pakoAction = g, this._pakoOptions = b, this.meta = {};
        }
        o.magic = "\b\0", n.inherits(w, c), w.prototype.processChunk = function(g) {
          this.meta = g.meta, this._pako === null && this._createPako(), this._pako.push(n.transformTo(p, g.data), !1);
        }, w.prototype.flush = function() {
          c.prototype.flush.call(this), this._pako === null && this._createPako(), this._pako.push([], !0);
        }, w.prototype.cleanUp = function() {
          c.prototype.cleanUp.call(this), this._pako = null;
        }, w.prototype._createPako = function() {
          this._pako = new s[this._pakoAction]({ raw: !0, level: this._pakoOptions.level || -1 });
          var g = this;
          this._pako.onData = function(b) {
            g.push({ data: b, meta: g.meta });
          };
        }, o.compressWorker = function(g) {
          return new w("Deflate", g);
        }, o.uncompressWorker = function() {
          return new w("Inflate", {});
        };
      }, { "./stream/GenericWorker": 28, "./utils": 32, pako: 38 }], 8: [function(t, d, o) {
        function r(l, y) {
          var h, m = "";
          for (h = 0; h < y; h++) m += String.fromCharCode(255 & l), l >>>= 8;
          return m;
        }
        function s(l, y, h, m, f, k) {
          var A, P, I = l.file, j = l.compression, R = k !== p.utf8encode, W = n.transformTo("string", k(I.name)), O = n.transformTo("string", p.utf8encode(I.name)), Z = I.comment, Q = n.transformTo("string", k(Z)), S = n.transformTo("string", p.utf8encode(Z)), z = O.length !== I.name.length, a = S.length !== Z.length, M = "", et = "", U = "", rt = I.dir, $ = I.date, tt = { crc32: 0, compressedSize: 0, uncompressedSize: 0 };
          y && !h || (tt.crc32 = l.crc32, tt.compressedSize = l.compressedSize, tt.uncompressedSize = l.uncompressedSize);
          var F = 0;
          y && (F |= 8), R || !z && !a || (F |= 2048);
          var T = 0, X = 0;
          rt && (T |= 16), f === "UNIX" ? (X = 798, T |= (function(V, ct) {
            var ft = V;
            return V || (ft = ct ? 16893 : 33204), (65535 & ft) << 16;
          })(I.unixPermissions, rt)) : (X = 20, T |= (function(V) {
            return 63 & (V || 0);
          })(I.dosPermissions)), A = $.getUTCHours(), A <<= 6, A |= $.getUTCMinutes(), A <<= 5, A |= $.getUTCSeconds() / 2, P = $.getUTCFullYear() - 1980, P <<= 4, P |= $.getUTCMonth() + 1, P <<= 5, P |= $.getUTCDate(), z && (et = r(1, 1) + r(w(W), 4) + O, M += "up" + r(et.length, 2) + et), a && (U = r(1, 1) + r(w(Q), 4) + S, M += "uc" + r(U.length, 2) + U);
          var Y = "";
          return Y += `
\0`, Y += r(F, 2), Y += j.magic, Y += r(A, 2), Y += r(P, 2), Y += r(tt.crc32, 4), Y += r(tt.compressedSize, 4), Y += r(tt.uncompressedSize, 4), Y += r(W.length, 2), Y += r(M.length, 2), { fileRecord: g.LOCAL_FILE_HEADER + Y + W + M, dirRecord: g.CENTRAL_FILE_HEADER + r(X, 2) + Y + r(Q.length, 2) + "\0\0\0\0" + r(T, 4) + r(m, 4) + W + M + Q };
        }
        var n = t("../utils"), c = t("../stream/GenericWorker"), p = t("../utf8"), w = t("../crc32"), g = t("../signature");
        function b(l, y, h, m) {
          c.call(this, "ZipFileWorker"), this.bytesWritten = 0, this.zipComment = y, this.zipPlatform = h, this.encodeFileName = m, this.streamFiles = l, this.accumulate = !1, this.contentBuffer = [], this.dirRecords = [], this.currentSourceOffset = 0, this.entriesCount = 0, this.currentFile = null, this._sources = [];
        }
        n.inherits(b, c), b.prototype.push = function(l) {
          var y = l.meta.percent || 0, h = this.entriesCount, m = this._sources.length;
          this.accumulate ? this.contentBuffer.push(l) : (this.bytesWritten += l.data.length, c.prototype.push.call(this, { data: l.data, meta: { currentFile: this.currentFile, percent: h ? (y + 100 * (h - m - 1)) / h : 100 } }));
        }, b.prototype.openedSource = function(l) {
          this.currentSourceOffset = this.bytesWritten, this.currentFile = l.file.name;
          var y = this.streamFiles && !l.file.dir;
          if (y) {
            var h = s(l, y, !1, this.currentSourceOffset, this.zipPlatform, this.encodeFileName);
            this.push({ data: h.fileRecord, meta: { percent: 0 } });
          } else this.accumulate = !0;
        }, b.prototype.closedSource = function(l) {
          this.accumulate = !1;
          var y = this.streamFiles && !l.file.dir, h = s(l, y, !0, this.currentSourceOffset, this.zipPlatform, this.encodeFileName);
          if (this.dirRecords.push(h.dirRecord), y) this.push({ data: (function(m) {
            return g.DATA_DESCRIPTOR + r(m.crc32, 4) + r(m.compressedSize, 4) + r(m.uncompressedSize, 4);
          })(l), meta: { percent: 100 } });
          else for (this.push({ data: h.fileRecord, meta: { percent: 0 } }); this.contentBuffer.length; ) this.push(this.contentBuffer.shift());
          this.currentFile = null;
        }, b.prototype.flush = function() {
          for (var l = this.bytesWritten, y = 0; y < this.dirRecords.length; y++) this.push({ data: this.dirRecords[y], meta: { percent: 100 } });
          var h = this.bytesWritten - l, m = (function(f, k, A, P, I) {
            var j = n.transformTo("string", I(P));
            return g.CENTRAL_DIRECTORY_END + "\0\0\0\0" + r(f, 2) + r(f, 2) + r(k, 4) + r(A, 4) + r(j.length, 2) + j;
          })(this.dirRecords.length, h, l, this.zipComment, this.encodeFileName);
          this.push({ data: m, meta: { percent: 100 } });
        }, b.prototype.prepareNextSource = function() {
          this.previous = this._sources.shift(), this.openedSource(this.previous.streamInfo), this.isPaused ? this.previous.pause() : this.previous.resume();
        }, b.prototype.registerPrevious = function(l) {
          this._sources.push(l);
          var y = this;
          return l.on("data", function(h) {
            y.processChunk(h);
          }), l.on("end", function() {
            y.closedSource(y.previous.streamInfo), y._sources.length ? y.prepareNextSource() : y.end();
          }), l.on("error", function(h) {
            y.error(h);
          }), this;
        }, b.prototype.resume = function() {
          return !!c.prototype.resume.call(this) && (!this.previous && this._sources.length ? (this.prepareNextSource(), !0) : this.previous || this._sources.length || this.generatedError ? void 0 : (this.end(), !0));
        }, b.prototype.error = function(l) {
          var y = this._sources;
          if (!c.prototype.error.call(this, l)) return !1;
          for (var h = 0; h < y.length; h++) try {
            y[h].error(l);
          } catch {
          }
          return !0;
        }, b.prototype.lock = function() {
          c.prototype.lock.call(this);
          for (var l = this._sources, y = 0; y < l.length; y++) l[y].lock();
        }, d.exports = b;
      }, { "../crc32": 4, "../signature": 23, "../stream/GenericWorker": 28, "../utf8": 31, "../utils": 32 }], 9: [function(t, d, o) {
        var r = t("../compressions"), s = t("./ZipFileWorker");
        o.generateWorker = function(n, c, p) {
          var w = new s(c.streamFiles, p, c.platform, c.encodeFileName), g = 0;
          try {
            n.forEach(function(b, l) {
              g++;
              var y = (function(k, A) {
                var P = k || A, I = r[P];
                if (!I) throw new Error(P + " is not a valid compression method !");
                return I;
              })(l.options.compression, c.compression), h = l.options.compressionOptions || c.compressionOptions || {}, m = l.dir, f = l.date;
              l._compressWorker(y, h).withStreamInfo("file", { name: b, dir: m, date: f, comment: l.comment || "", unixPermissions: l.unixPermissions, dosPermissions: l.dosPermissions }).pipe(w);
            }), w.entriesCount = g;
          } catch (b) {
            w.error(b);
          }
          return w;
        };
      }, { "../compressions": 3, "./ZipFileWorker": 8 }], 10: [function(t, d, o) {
        function r() {
          if (!(this instanceof r)) return new r();
          if (arguments.length) throw new Error("The constructor with parameters has been removed in JSZip 3.0, please check the upgrade guide.");
          this.files = /* @__PURE__ */ Object.create(null), this.comment = null, this.root = "", this.clone = function() {
            var s = new r();
            for (var n in this) typeof this[n] != "function" && (s[n] = this[n]);
            return s;
          };
        }
        (r.prototype = t("./object")).loadAsync = t("./load"), r.support = t("./support"), r.defaults = t("./defaults"), r.version = "3.10.1", r.loadAsync = function(s, n) {
          return new r().loadAsync(s, n);
        }, r.external = t("./external"), d.exports = r;
      }, { "./defaults": 5, "./external": 6, "./load": 11, "./object": 15, "./support": 30 }], 11: [function(t, d, o) {
        var r = t("./utils"), s = t("./external"), n = t("./utf8"), c = t("./zipEntries"), p = t("./stream/Crc32Probe"), w = t("./nodejsUtils");
        function g(b) {
          return new s.Promise(function(l, y) {
            var h = b.decompressed.getContentWorker().pipe(new p());
            h.on("error", function(m) {
              y(m);
            }).on("end", function() {
              h.streamInfo.crc32 !== b.decompressed.crc32 ? y(new Error("Corrupted zip : CRC32 mismatch")) : l();
            }).resume();
          });
        }
        d.exports = function(b, l) {
          var y = this;
          return l = r.extend(l || {}, { base64: !1, checkCRC32: !1, optimizedBinaryString: !1, createFolders: !1, decodeFileName: n.utf8decode }), w.isNode && w.isStream(b) ? s.Promise.reject(new Error("JSZip can't accept a stream when loading a zip file.")) : r.prepareContent("the loaded zip file", b, !0, l.optimizedBinaryString, l.base64).then(function(h) {
            var m = new c(l);
            return m.load(h), m;
          }).then(function(h) {
            var m = [s.Promise.resolve(h)], f = h.files;
            if (l.checkCRC32) for (var k = 0; k < f.length; k++) m.push(g(f[k]));
            return s.Promise.all(m);
          }).then(function(h) {
            for (var m = h.shift(), f = m.files, k = 0; k < f.length; k++) {
              var A = f[k], P = A.fileNameStr, I = r.resolve(A.fileNameStr);
              y.file(I, A.decompressed, { binary: !0, optimizedBinaryString: !0, date: A.date, dir: A.dir, comment: A.fileCommentStr.length ? A.fileCommentStr : null, unixPermissions: A.unixPermissions, dosPermissions: A.dosPermissions, createFolders: l.createFolders }), A.dir || (y.file(I).unsafeOriginalName = P);
            }
            return m.zipComment.length && (y.comment = m.zipComment), y;
          });
        };
      }, { "./external": 6, "./nodejsUtils": 14, "./stream/Crc32Probe": 25, "./utf8": 31, "./utils": 32, "./zipEntries": 33 }], 12: [function(t, d, o) {
        var r = t("../utils"), s = t("../stream/GenericWorker");
        function n(c, p) {
          s.call(this, "Nodejs stream input adapter for " + c), this._upstreamEnded = !1, this._bindStream(p);
        }
        r.inherits(n, s), n.prototype._bindStream = function(c) {
          var p = this;
          (this._stream = c).pause(), c.on("data", function(w) {
            p.push({ data: w, meta: { percent: 0 } });
          }).on("error", function(w) {
            p.isPaused ? this.generatedError = w : p.error(w);
          }).on("end", function() {
            p.isPaused ? p._upstreamEnded = !0 : p.end();
          });
        }, n.prototype.pause = function() {
          return !!s.prototype.pause.call(this) && (this._stream.pause(), !0);
        }, n.prototype.resume = function() {
          return !!s.prototype.resume.call(this) && (this._upstreamEnded ? this.end() : this._stream.resume(), !0);
        }, d.exports = n;
      }, { "../stream/GenericWorker": 28, "../utils": 32 }], 13: [function(t, d, o) {
        var r = t("readable-stream").Readable;
        function s(n, c, p) {
          r.call(this, c), this._helper = n;
          var w = this;
          n.on("data", function(g, b) {
            w.push(g) || w._helper.pause(), p && p(b);
          }).on("error", function(g) {
            w.emit("error", g);
          }).on("end", function() {
            w.push(null);
          });
        }
        t("../utils").inherits(s, r), s.prototype._read = function() {
          this._helper.resume();
        }, d.exports = s;
      }, { "../utils": 32, "readable-stream": 16 }], 14: [function(t, d, o) {
        d.exports = { isNode: typeof Buffer < "u", newBufferFrom: function(r, s) {
          if (Buffer.from && Buffer.from !== Uint8Array.from) return Buffer.from(r, s);
          if (typeof r == "number") throw new Error('The "data" argument must not be a number');
          return new Buffer(r, s);
        }, allocBuffer: function(r) {
          if (Buffer.alloc) return Buffer.alloc(r);
          var s = new Buffer(r);
          return s.fill(0), s;
        }, isBuffer: function(r) {
          return Buffer.isBuffer(r);
        }, isStream: function(r) {
          return r && typeof r.on == "function" && typeof r.pause == "function" && typeof r.resume == "function";
        } };
      }, {}], 15: [function(t, d, o) {
        function r(I, j, R) {
          var W, O = n.getTypeOf(j), Z = n.extend(R || {}, w);
          Z.date = Z.date || /* @__PURE__ */ new Date(), Z.compression !== null && (Z.compression = Z.compression.toUpperCase()), typeof Z.unixPermissions == "string" && (Z.unixPermissions = parseInt(Z.unixPermissions, 8)), Z.unixPermissions && 16384 & Z.unixPermissions && (Z.dir = !0), Z.dosPermissions && 16 & Z.dosPermissions && (Z.dir = !0), Z.dir && (I = f(I)), Z.createFolders && (W = m(I)) && k.call(this, W, !0);
          var Q = O === "string" && Z.binary === !1 && Z.base64 === !1;
          R && R.binary !== void 0 || (Z.binary = !Q), (j instanceof g && j.uncompressedSize === 0 || Z.dir || !j || j.length === 0) && (Z.base64 = !1, Z.binary = !0, j = "", Z.compression = "STORE", O = "string");
          var S = null;
          S = j instanceof g || j instanceof c ? j : y.isNode && y.isStream(j) ? new h(I, j) : n.prepareContent(I, j, Z.binary, Z.optimizedBinaryString, Z.base64);
          var z = new b(I, S, Z);
          this.files[I] = z;
        }
        var s = t("./utf8"), n = t("./utils"), c = t("./stream/GenericWorker"), p = t("./stream/StreamHelper"), w = t("./defaults"), g = t("./compressedObject"), b = t("./zipObject"), l = t("./generate"), y = t("./nodejsUtils"), h = t("./nodejs/NodejsStreamInputAdapter"), m = function(I) {
          I.slice(-1) === "/" && (I = I.substring(0, I.length - 1));
          var j = I.lastIndexOf("/");
          return 0 < j ? I.substring(0, j) : "";
        }, f = function(I) {
          return I.slice(-1) !== "/" && (I += "/"), I;
        }, k = function(I, j) {
          return j = j !== void 0 ? j : w.createFolders, I = f(I), this.files[I] || r.call(this, I, null, { dir: !0, createFolders: j }), this.files[I];
        };
        function A(I) {
          return Object.prototype.toString.call(I) === "[object RegExp]";
        }
        var P = { load: function() {
          throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.");
        }, forEach: function(I) {
          var j, R, W;
          for (j in this.files) W = this.files[j], (R = j.slice(this.root.length, j.length)) && j.slice(0, this.root.length) === this.root && I(R, W);
        }, filter: function(I) {
          var j = [];
          return this.forEach(function(R, W) {
            I(R, W) && j.push(W);
          }), j;
        }, file: function(I, j, R) {
          if (arguments.length !== 1) return I = this.root + I, r.call(this, I, j, R), this;
          if (A(I)) {
            var W = I;
            return this.filter(function(Z, Q) {
              return !Q.dir && W.test(Z);
            });
          }
          var O = this.files[this.root + I];
          return O && !O.dir ? O : null;
        }, folder: function(I) {
          if (!I) return this;
          if (A(I)) return this.filter(function(O, Z) {
            return Z.dir && I.test(O);
          });
          var j = this.root + I, R = k.call(this, j), W = this.clone();
          return W.root = R.name, W;
        }, remove: function(I) {
          I = this.root + I;
          var j = this.files[I];
          if (j || (I.slice(-1) !== "/" && (I += "/"), j = this.files[I]), j && !j.dir) delete this.files[I];
          else for (var R = this.filter(function(O, Z) {
            return Z.name.slice(0, I.length) === I;
          }), W = 0; W < R.length; W++) delete this.files[R[W].name];
          return this;
        }, generate: function() {
          throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.");
        }, generateInternalStream: function(I) {
          var j, R = {};
          try {
            if ((R = n.extend(I || {}, { streamFiles: !1, compression: "STORE", compressionOptions: null, type: "", platform: "DOS", comment: null, mimeType: "application/zip", encodeFileName: s.utf8encode })).type = R.type.toLowerCase(), R.compression = R.compression.toUpperCase(), R.type === "binarystring" && (R.type = "string"), !R.type) throw new Error("No output type specified.");
            n.checkSupport(R.type), R.platform !== "darwin" && R.platform !== "freebsd" && R.platform !== "linux" && R.platform !== "sunos" || (R.platform = "UNIX"), R.platform === "win32" && (R.platform = "DOS");
            var W = R.comment || this.comment || "";
            j = l.generateWorker(this, R, W);
          } catch (O) {
            (j = new c("error")).error(O);
          }
          return new p(j, R.type || "string", R.mimeType);
        }, generateAsync: function(I, j) {
          return this.generateInternalStream(I).accumulate(j);
        }, generateNodeStream: function(I, j) {
          return (I = I || {}).type || (I.type = "nodebuffer"), this.generateInternalStream(I).toNodejsStream(j);
        } };
        d.exports = P;
      }, { "./compressedObject": 2, "./defaults": 5, "./generate": 9, "./nodejs/NodejsStreamInputAdapter": 12, "./nodejsUtils": 14, "./stream/GenericWorker": 28, "./stream/StreamHelper": 29, "./utf8": 31, "./utils": 32, "./zipObject": 35 }], 16: [function(t, d, o) {
        d.exports = t("stream");
      }, { stream: void 0 }], 17: [function(t, d, o) {
        var r = t("./DataReader");
        function s(n) {
          r.call(this, n);
          for (var c = 0; c < this.data.length; c++) n[c] = 255 & n[c];
        }
        t("../utils").inherits(s, r), s.prototype.byteAt = function(n) {
          return this.data[this.zero + n];
        }, s.prototype.lastIndexOfSignature = function(n) {
          for (var c = n.charCodeAt(0), p = n.charCodeAt(1), w = n.charCodeAt(2), g = n.charCodeAt(3), b = this.length - 4; 0 <= b; --b) if (this.data[b] === c && this.data[b + 1] === p && this.data[b + 2] === w && this.data[b + 3] === g) return b - this.zero;
          return -1;
        }, s.prototype.readAndCheckSignature = function(n) {
          var c = n.charCodeAt(0), p = n.charCodeAt(1), w = n.charCodeAt(2), g = n.charCodeAt(3), b = this.readData(4);
          return c === b[0] && p === b[1] && w === b[2] && g === b[3];
        }, s.prototype.readData = function(n) {
          if (this.checkOffset(n), n === 0) return [];
          var c = this.data.slice(this.zero + this.index, this.zero + this.index + n);
          return this.index += n, c;
        }, d.exports = s;
      }, { "../utils": 32, "./DataReader": 18 }], 18: [function(t, d, o) {
        var r = t("../utils");
        function s(n) {
          this.data = n, this.length = n.length, this.index = 0, this.zero = 0;
        }
        s.prototype = { checkOffset: function(n) {
          this.checkIndex(this.index + n);
        }, checkIndex: function(n) {
          if (this.length < this.zero + n || n < 0) throw new Error("End of data reached (data length = " + this.length + ", asked index = " + n + "). Corrupted zip ?");
        }, setIndex: function(n) {
          this.checkIndex(n), this.index = n;
        }, skip: function(n) {
          this.setIndex(this.index + n);
        }, byteAt: function() {
        }, readInt: function(n) {
          var c, p = 0;
          for (this.checkOffset(n), c = this.index + n - 1; c >= this.index; c--) p = (p << 8) + this.byteAt(c);
          return this.index += n, p;
        }, readString: function(n) {
          return r.transformTo("string", this.readData(n));
        }, readData: function() {
        }, lastIndexOfSignature: function() {
        }, readAndCheckSignature: function() {
        }, readDate: function() {
          var n = this.readInt(4);
          return new Date(Date.UTC(1980 + (n >> 25 & 127), (n >> 21 & 15) - 1, n >> 16 & 31, n >> 11 & 31, n >> 5 & 63, (31 & n) << 1));
        } }, d.exports = s;
      }, { "../utils": 32 }], 19: [function(t, d, o) {
        var r = t("./Uint8ArrayReader");
        function s(n) {
          r.call(this, n);
        }
        t("../utils").inherits(s, r), s.prototype.readData = function(n) {
          this.checkOffset(n);
          var c = this.data.slice(this.zero + this.index, this.zero + this.index + n);
          return this.index += n, c;
        }, d.exports = s;
      }, { "../utils": 32, "./Uint8ArrayReader": 21 }], 20: [function(t, d, o) {
        var r = t("./DataReader");
        function s(n) {
          r.call(this, n);
        }
        t("../utils").inherits(s, r), s.prototype.byteAt = function(n) {
          return this.data.charCodeAt(this.zero + n);
        }, s.prototype.lastIndexOfSignature = function(n) {
          return this.data.lastIndexOf(n) - this.zero;
        }, s.prototype.readAndCheckSignature = function(n) {
          return n === this.readData(4);
        }, s.prototype.readData = function(n) {
          this.checkOffset(n);
          var c = this.data.slice(this.zero + this.index, this.zero + this.index + n);
          return this.index += n, c;
        }, d.exports = s;
      }, { "../utils": 32, "./DataReader": 18 }], 21: [function(t, d, o) {
        var r = t("./ArrayReader");
        function s(n) {
          r.call(this, n);
        }
        t("../utils").inherits(s, r), s.prototype.readData = function(n) {
          if (this.checkOffset(n), n === 0) return new Uint8Array(0);
          var c = this.data.subarray(this.zero + this.index, this.zero + this.index + n);
          return this.index += n, c;
        }, d.exports = s;
      }, { "../utils": 32, "./ArrayReader": 17 }], 22: [function(t, d, o) {
        var r = t("../utils"), s = t("../support"), n = t("./ArrayReader"), c = t("./StringReader"), p = t("./NodeBufferReader"), w = t("./Uint8ArrayReader");
        d.exports = function(g) {
          var b = r.getTypeOf(g);
          return r.checkSupport(b), b !== "string" || s.uint8array ? b === "nodebuffer" ? new p(g) : s.uint8array ? new w(r.transformTo("uint8array", g)) : new n(r.transformTo("array", g)) : new c(g);
        };
      }, { "../support": 30, "../utils": 32, "./ArrayReader": 17, "./NodeBufferReader": 19, "./StringReader": 20, "./Uint8ArrayReader": 21 }], 23: [function(t, d, o) {
        o.LOCAL_FILE_HEADER = "PK", o.CENTRAL_FILE_HEADER = "PK", o.CENTRAL_DIRECTORY_END = "PK", o.ZIP64_CENTRAL_DIRECTORY_LOCATOR = "PK\x07", o.ZIP64_CENTRAL_DIRECTORY_END = "PK", o.DATA_DESCRIPTOR = "PK\x07\b";
      }, {}], 24: [function(t, d, o) {
        var r = t("./GenericWorker"), s = t("../utils");
        function n(c) {
          r.call(this, "ConvertWorker to " + c), this.destType = c;
        }
        s.inherits(n, r), n.prototype.processChunk = function(c) {
          this.push({ data: s.transformTo(this.destType, c.data), meta: c.meta });
        }, d.exports = n;
      }, { "../utils": 32, "./GenericWorker": 28 }], 25: [function(t, d, o) {
        var r = t("./GenericWorker"), s = t("../crc32");
        function n() {
          r.call(this, "Crc32Probe"), this.withStreamInfo("crc32", 0);
        }
        t("../utils").inherits(n, r), n.prototype.processChunk = function(c) {
          this.streamInfo.crc32 = s(c.data, this.streamInfo.crc32 || 0), this.push(c);
        }, d.exports = n;
      }, { "../crc32": 4, "../utils": 32, "./GenericWorker": 28 }], 26: [function(t, d, o) {
        var r = t("../utils"), s = t("./GenericWorker");
        function n(c) {
          s.call(this, "DataLengthProbe for " + c), this.propName = c, this.withStreamInfo(c, 0);
        }
        r.inherits(n, s), n.prototype.processChunk = function(c) {
          if (c) {
            var p = this.streamInfo[this.propName] || 0;
            this.streamInfo[this.propName] = p + c.data.length;
          }
          s.prototype.processChunk.call(this, c);
        }, d.exports = n;
      }, { "../utils": 32, "./GenericWorker": 28 }], 27: [function(t, d, o) {
        var r = t("../utils"), s = t("./GenericWorker");
        function n(c) {
          s.call(this, "DataWorker");
          var p = this;
          this.dataIsReady = !1, this.index = 0, this.max = 0, this.data = null, this.type = "", this._tickScheduled = !1, c.then(function(w) {
            p.dataIsReady = !0, p.data = w, p.max = w && w.length || 0, p.type = r.getTypeOf(w), p.isPaused || p._tickAndRepeat();
          }, function(w) {
            p.error(w);
          });
        }
        r.inherits(n, s), n.prototype.cleanUp = function() {
          s.prototype.cleanUp.call(this), this.data = null;
        }, n.prototype.resume = function() {
          return !!s.prototype.resume.call(this) && (!this._tickScheduled && this.dataIsReady && (this._tickScheduled = !0, r.delay(this._tickAndRepeat, [], this)), !0);
        }, n.prototype._tickAndRepeat = function() {
          this._tickScheduled = !1, this.isPaused || this.isFinished || (this._tick(), this.isFinished || (r.delay(this._tickAndRepeat, [], this), this._tickScheduled = !0));
        }, n.prototype._tick = function() {
          if (this.isPaused || this.isFinished) return !1;
          var c = null, p = Math.min(this.max, this.index + 16384);
          if (this.index >= this.max) return this.end();
          switch (this.type) {
            case "string":
              c = this.data.substring(this.index, p);
              break;
            case "uint8array":
              c = this.data.subarray(this.index, p);
              break;
            case "array":
            case "nodebuffer":
              c = this.data.slice(this.index, p);
          }
          return this.index = p, this.push({ data: c, meta: { percent: this.max ? this.index / this.max * 100 : 0 } });
        }, d.exports = n;
      }, { "../utils": 32, "./GenericWorker": 28 }], 28: [function(t, d, o) {
        function r(s) {
          this.name = s || "default", this.streamInfo = {}, this.generatedError = null, this.extraStreamInfo = {}, this.isPaused = !0, this.isFinished = !1, this.isLocked = !1, this._listeners = { data: [], end: [], error: [] }, this.previous = null;
        }
        r.prototype = { push: function(s) {
          this.emit("data", s);
        }, end: function() {
          if (this.isFinished) return !1;
          this.flush();
          try {
            this.emit("end"), this.cleanUp(), this.isFinished = !0;
          } catch (s) {
            this.emit("error", s);
          }
          return !0;
        }, error: function(s) {
          return !this.isFinished && (this.isPaused ? this.generatedError = s : (this.isFinished = !0, this.emit("error", s), this.previous && this.previous.error(s), this.cleanUp()), !0);
        }, on: function(s, n) {
          return this._listeners[s].push(n), this;
        }, cleanUp: function() {
          this.streamInfo = this.generatedError = this.extraStreamInfo = null, this._listeners = [];
        }, emit: function(s, n) {
          if (this._listeners[s]) for (var c = 0; c < this._listeners[s].length; c++) this._listeners[s][c].call(this, n);
        }, pipe: function(s) {
          return s.registerPrevious(this);
        }, registerPrevious: function(s) {
          if (this.isLocked) throw new Error("The stream '" + this + "' has already been used.");
          this.streamInfo = s.streamInfo, this.mergeStreamInfo(), this.previous = s;
          var n = this;
          return s.on("data", function(c) {
            n.processChunk(c);
          }), s.on("end", function() {
            n.end();
          }), s.on("error", function(c) {
            n.error(c);
          }), this;
        }, pause: function() {
          return !this.isPaused && !this.isFinished && (this.isPaused = !0, this.previous && this.previous.pause(), !0);
        }, resume: function() {
          if (!this.isPaused || this.isFinished) return !1;
          var s = this.isPaused = !1;
          return this.generatedError && (this.error(this.generatedError), s = !0), this.previous && this.previous.resume(), !s;
        }, flush: function() {
        }, processChunk: function(s) {
          this.push(s);
        }, withStreamInfo: function(s, n) {
          return this.extraStreamInfo[s] = n, this.mergeStreamInfo(), this;
        }, mergeStreamInfo: function() {
          for (var s in this.extraStreamInfo) Object.prototype.hasOwnProperty.call(this.extraStreamInfo, s) && (this.streamInfo[s] = this.extraStreamInfo[s]);
        }, lock: function() {
          if (this.isLocked) throw new Error("The stream '" + this + "' has already been used.");
          this.isLocked = !0, this.previous && this.previous.lock();
        }, toString: function() {
          var s = "Worker " + this.name;
          return this.previous ? this.previous + " -> " + s : s;
        } }, d.exports = r;
      }, {}], 29: [function(t, d, o) {
        var r = t("../utils"), s = t("./ConvertWorker"), n = t("./GenericWorker"), c = t("../base64"), p = t("../support"), w = t("../external"), g = null;
        if (p.nodestream) try {
          g = t("../nodejs/NodejsStreamOutputAdapter");
        } catch {
        }
        function b(y, h) {
          return new w.Promise(function(m, f) {
            var k = [], A = y._internalType, P = y._outputType, I = y._mimeType;
            y.on("data", function(j, R) {
              k.push(j), h && h(R);
            }).on("error", function(j) {
              k = [], f(j);
            }).on("end", function() {
              try {
                var j = (function(R, W, O) {
                  switch (R) {
                    case "blob":
                      return r.newBlob(r.transformTo("arraybuffer", W), O);
                    case "base64":
                      return c.encode(W);
                    default:
                      return r.transformTo(R, W);
                  }
                })(P, (function(R, W) {
                  var O, Z = 0, Q = null, S = 0;
                  for (O = 0; O < W.length; O++) S += W[O].length;
                  switch (R) {
                    case "string":
                      return W.join("");
                    case "array":
                      return Array.prototype.concat.apply([], W);
                    case "uint8array":
                      for (Q = new Uint8Array(S), O = 0; O < W.length; O++) Q.set(W[O], Z), Z += W[O].length;
                      return Q;
                    case "nodebuffer":
                      return Buffer.concat(W);
                    default:
                      throw new Error("concat : unsupported type '" + R + "'");
                  }
                })(A, k), I);
                m(j);
              } catch (R) {
                f(R);
              }
              k = [];
            }).resume();
          });
        }
        function l(y, h, m) {
          var f = h;
          switch (h) {
            case "blob":
            case "arraybuffer":
              f = "uint8array";
              break;
            case "base64":
              f = "string";
          }
          try {
            this._internalType = f, this._outputType = h, this._mimeType = m, r.checkSupport(f), this._worker = y.pipe(new s(f)), y.lock();
          } catch (k) {
            this._worker = new n("error"), this._worker.error(k);
          }
        }
        l.prototype = { accumulate: function(y) {
          return b(this, y);
        }, on: function(y, h) {
          var m = this;
          return y === "data" ? this._worker.on(y, function(f) {
            h.call(m, f.data, f.meta);
          }) : this._worker.on(y, function() {
            r.delay(h, arguments, m);
          }), this;
        }, resume: function() {
          return r.delay(this._worker.resume, [], this._worker), this;
        }, pause: function() {
          return this._worker.pause(), this;
        }, toNodejsStream: function(y) {
          if (r.checkSupport("nodestream"), this._outputType !== "nodebuffer") throw new Error(this._outputType + " is not supported by this method");
          return new g(this, { objectMode: this._outputType !== "nodebuffer" }, y);
        } }, d.exports = l;
      }, { "../base64": 1, "../external": 6, "../nodejs/NodejsStreamOutputAdapter": 13, "../support": 30, "../utils": 32, "./ConvertWorker": 24, "./GenericWorker": 28 }], 30: [function(t, d, o) {
        if (o.base64 = !0, o.array = !0, o.string = !0, o.arraybuffer = typeof ArrayBuffer < "u" && typeof Uint8Array < "u", o.nodebuffer = typeof Buffer < "u", o.uint8array = typeof Uint8Array < "u", typeof ArrayBuffer > "u") o.blob = !1;
        else {
          var r = new ArrayBuffer(0);
          try {
            o.blob = new Blob([r], { type: "application/zip" }).size === 0;
          } catch {
            try {
              var s = new (self.BlobBuilder || self.WebKitBlobBuilder || self.MozBlobBuilder || self.MSBlobBuilder)();
              s.append(r), o.blob = s.getBlob("application/zip").size === 0;
            } catch {
              o.blob = !1;
            }
          }
        }
        try {
          o.nodestream = !!t("readable-stream").Readable;
        } catch {
          o.nodestream = !1;
        }
      }, { "readable-stream": 16 }], 31: [function(t, d, o) {
        for (var r = t("./utils"), s = t("./support"), n = t("./nodejsUtils"), c = t("./stream/GenericWorker"), p = new Array(256), w = 0; w < 256; w++) p[w] = 252 <= w ? 6 : 248 <= w ? 5 : 240 <= w ? 4 : 224 <= w ? 3 : 192 <= w ? 2 : 1;
        p[254] = p[254] = 1;
        function g() {
          c.call(this, "utf-8 decode"), this.leftOver = null;
        }
        function b() {
          c.call(this, "utf-8 encode");
        }
        o.utf8encode = function(l) {
          return s.nodebuffer ? n.newBufferFrom(l, "utf-8") : (function(y) {
            var h, m, f, k, A, P = y.length, I = 0;
            for (k = 0; k < P; k++) (64512 & (m = y.charCodeAt(k))) == 55296 && k + 1 < P && (64512 & (f = y.charCodeAt(k + 1))) == 56320 && (m = 65536 + (m - 55296 << 10) + (f - 56320), k++), I += m < 128 ? 1 : m < 2048 ? 2 : m < 65536 ? 3 : 4;
            for (h = s.uint8array ? new Uint8Array(I) : new Array(I), k = A = 0; A < I; k++) (64512 & (m = y.charCodeAt(k))) == 55296 && k + 1 < P && (64512 & (f = y.charCodeAt(k + 1))) == 56320 && (m = 65536 + (m - 55296 << 10) + (f - 56320), k++), m < 128 ? h[A++] = m : (m < 2048 ? h[A++] = 192 | m >>> 6 : (m < 65536 ? h[A++] = 224 | m >>> 12 : (h[A++] = 240 | m >>> 18, h[A++] = 128 | m >>> 12 & 63), h[A++] = 128 | m >>> 6 & 63), h[A++] = 128 | 63 & m);
            return h;
          })(l);
        }, o.utf8decode = function(l) {
          return s.nodebuffer ? r.transformTo("nodebuffer", l).toString("utf-8") : (function(y) {
            var h, m, f, k, A = y.length, P = new Array(2 * A);
            for (h = m = 0; h < A; ) if ((f = y[h++]) < 128) P[m++] = f;
            else if (4 < (k = p[f])) P[m++] = 65533, h += k - 1;
            else {
              for (f &= k === 2 ? 31 : k === 3 ? 15 : 7; 1 < k && h < A; ) f = f << 6 | 63 & y[h++], k--;
              1 < k ? P[m++] = 65533 : f < 65536 ? P[m++] = f : (f -= 65536, P[m++] = 55296 | f >> 10 & 1023, P[m++] = 56320 | 1023 & f);
            }
            return P.length !== m && (P.subarray ? P = P.subarray(0, m) : P.length = m), r.applyFromCharCode(P);
          })(l = r.transformTo(s.uint8array ? "uint8array" : "array", l));
        }, r.inherits(g, c), g.prototype.processChunk = function(l) {
          var y = r.transformTo(s.uint8array ? "uint8array" : "array", l.data);
          if (this.leftOver && this.leftOver.length) {
            if (s.uint8array) {
              var h = y;
              (y = new Uint8Array(h.length + this.leftOver.length)).set(this.leftOver, 0), y.set(h, this.leftOver.length);
            } else y = this.leftOver.concat(y);
            this.leftOver = null;
          }
          var m = (function(k, A) {
            var P;
            for ((A = A || k.length) > k.length && (A = k.length), P = A - 1; 0 <= P && (192 & k[P]) == 128; ) P--;
            return P < 0 || P === 0 ? A : P + p[k[P]] > A ? P : A;
          })(y), f = y;
          m !== y.length && (s.uint8array ? (f = y.subarray(0, m), this.leftOver = y.subarray(m, y.length)) : (f = y.slice(0, m), this.leftOver = y.slice(m, y.length))), this.push({ data: o.utf8decode(f), meta: l.meta });
        }, g.prototype.flush = function() {
          this.leftOver && this.leftOver.length && (this.push({ data: o.utf8decode(this.leftOver), meta: {} }), this.leftOver = null);
        }, o.Utf8DecodeWorker = g, r.inherits(b, c), b.prototype.processChunk = function(l) {
          this.push({ data: o.utf8encode(l.data), meta: l.meta });
        }, o.Utf8EncodeWorker = b;
      }, { "./nodejsUtils": 14, "./stream/GenericWorker": 28, "./support": 30, "./utils": 32 }], 32: [function(t, d, o) {
        var r = t("./support"), s = t("./base64"), n = t("./nodejsUtils"), c = t("./external");
        function p(h) {
          return h;
        }
        function w(h, m) {
          for (var f = 0; f < h.length; ++f) m[f] = 255 & h.charCodeAt(f);
          return m;
        }
        t("setimmediate"), o.newBlob = function(h, m) {
          o.checkSupport("blob");
          try {
            return new Blob([h], { type: m });
          } catch {
            try {
              var f = new (self.BlobBuilder || self.WebKitBlobBuilder || self.MozBlobBuilder || self.MSBlobBuilder)();
              return f.append(h), f.getBlob(m);
            } catch {
              throw new Error("Bug : can't construct the Blob.");
            }
          }
        };
        var g = { stringifyByChunk: function(h, m, f) {
          var k = [], A = 0, P = h.length;
          if (P <= f) return String.fromCharCode.apply(null, h);
          for (; A < P; ) m === "array" || m === "nodebuffer" ? k.push(String.fromCharCode.apply(null, h.slice(A, Math.min(A + f, P)))) : k.push(String.fromCharCode.apply(null, h.subarray(A, Math.min(A + f, P)))), A += f;
          return k.join("");
        }, stringifyByChar: function(h) {
          for (var m = "", f = 0; f < h.length; f++) m += String.fromCharCode(h[f]);
          return m;
        }, applyCanBeUsed: { uint8array: (function() {
          try {
            return r.uint8array && String.fromCharCode.apply(null, new Uint8Array(1)).length === 1;
          } catch {
            return !1;
          }
        })(), nodebuffer: (function() {
          try {
            return r.nodebuffer && String.fromCharCode.apply(null, n.allocBuffer(1)).length === 1;
          } catch {
            return !1;
          }
        })() } };
        function b(h) {
          var m = 65536, f = o.getTypeOf(h), k = !0;
          if (f === "uint8array" ? k = g.applyCanBeUsed.uint8array : f === "nodebuffer" && (k = g.applyCanBeUsed.nodebuffer), k) for (; 1 < m; ) try {
            return g.stringifyByChunk(h, f, m);
          } catch {
            m = Math.floor(m / 2);
          }
          return g.stringifyByChar(h);
        }
        function l(h, m) {
          for (var f = 0; f < h.length; f++) m[f] = h[f];
          return m;
        }
        o.applyFromCharCode = b;
        var y = {};
        y.string = { string: p, array: function(h) {
          return w(h, new Array(h.length));
        }, arraybuffer: function(h) {
          return y.string.uint8array(h).buffer;
        }, uint8array: function(h) {
          return w(h, new Uint8Array(h.length));
        }, nodebuffer: function(h) {
          return w(h, n.allocBuffer(h.length));
        } }, y.array = { string: b, array: p, arraybuffer: function(h) {
          return new Uint8Array(h).buffer;
        }, uint8array: function(h) {
          return new Uint8Array(h);
        }, nodebuffer: function(h) {
          return n.newBufferFrom(h);
        } }, y.arraybuffer = { string: function(h) {
          return b(new Uint8Array(h));
        }, array: function(h) {
          return l(new Uint8Array(h), new Array(h.byteLength));
        }, arraybuffer: p, uint8array: function(h) {
          return new Uint8Array(h);
        }, nodebuffer: function(h) {
          return n.newBufferFrom(new Uint8Array(h));
        } }, y.uint8array = { string: b, array: function(h) {
          return l(h, new Array(h.length));
        }, arraybuffer: function(h) {
          return h.buffer;
        }, uint8array: p, nodebuffer: function(h) {
          return n.newBufferFrom(h);
        } }, y.nodebuffer = { string: b, array: function(h) {
          return l(h, new Array(h.length));
        }, arraybuffer: function(h) {
          return y.nodebuffer.uint8array(h).buffer;
        }, uint8array: function(h) {
          return l(h, new Uint8Array(h.length));
        }, nodebuffer: p }, o.transformTo = function(h, m) {
          if (m = m || "", !h) return m;
          o.checkSupport(h);
          var f = o.getTypeOf(m);
          return y[f][h](m);
        }, o.resolve = function(h) {
          for (var m = h.split("/"), f = [], k = 0; k < m.length; k++) {
            var A = m[k];
            A === "." || A === "" && k !== 0 && k !== m.length - 1 || (A === ".." ? f.pop() : f.push(A));
          }
          return f.join("/");
        }, o.getTypeOf = function(h) {
          return typeof h == "string" ? "string" : Object.prototype.toString.call(h) === "[object Array]" ? "array" : r.nodebuffer && n.isBuffer(h) ? "nodebuffer" : r.uint8array && h instanceof Uint8Array ? "uint8array" : r.arraybuffer && h instanceof ArrayBuffer ? "arraybuffer" : void 0;
        }, o.checkSupport = function(h) {
          if (!r[h.toLowerCase()]) throw new Error(h + " is not supported by this platform");
        }, o.MAX_VALUE_16BITS = 65535, o.MAX_VALUE_32BITS = -1, o.pretty = function(h) {
          var m, f, k = "";
          for (f = 0; f < (h || "").length; f++) k += "\\x" + ((m = h.charCodeAt(f)) < 16 ? "0" : "") + m.toString(16).toUpperCase();
          return k;
        }, o.delay = function(h, m, f) {
          setImmediate(function() {
            h.apply(f || null, m || []);
          });
        }, o.inherits = function(h, m) {
          function f() {
          }
          f.prototype = m.prototype, h.prototype = new f();
        }, o.extend = function() {
          var h, m, f = {};
          for (h = 0; h < arguments.length; h++) for (m in arguments[h]) Object.prototype.hasOwnProperty.call(arguments[h], m) && f[m] === void 0 && (f[m] = arguments[h][m]);
          return f;
        }, o.prepareContent = function(h, m, f, k, A) {
          return c.Promise.resolve(m).then(function(P) {
            return r.blob && (P instanceof Blob || ["[object File]", "[object Blob]"].indexOf(Object.prototype.toString.call(P)) !== -1) && typeof FileReader < "u" ? new c.Promise(function(I, j) {
              var R = new FileReader();
              R.onload = function(W) {
                I(W.target.result);
              }, R.onerror = function(W) {
                j(W.target.error);
              }, R.readAsArrayBuffer(P);
            }) : P;
          }).then(function(P) {
            var I = o.getTypeOf(P);
            return I ? (I === "arraybuffer" ? P = o.transformTo("uint8array", P) : I === "string" && (A ? P = s.decode(P) : f && k !== !0 && (P = (function(j) {
              return w(j, r.uint8array ? new Uint8Array(j.length) : new Array(j.length));
            })(P))), P) : c.Promise.reject(new Error("Can't read the data of '" + h + "'. Is it in a supported JavaScript type (String, Blob, ArrayBuffer, etc) ?"));
          });
        };
      }, { "./base64": 1, "./external": 6, "./nodejsUtils": 14, "./support": 30, setimmediate: 54 }], 33: [function(t, d, o) {
        var r = t("./reader/readerFor"), s = t("./utils"), n = t("./signature"), c = t("./zipEntry"), p = t("./support");
        function w(g) {
          this.files = [], this.loadOptions = g;
        }
        w.prototype = { checkSignature: function(g) {
          if (!this.reader.readAndCheckSignature(g)) {
            this.reader.index -= 4;
            var b = this.reader.readString(4);
            throw new Error("Corrupted zip or bug: unexpected signature (" + s.pretty(b) + ", expected " + s.pretty(g) + ")");
          }
        }, isSignature: function(g, b) {
          var l = this.reader.index;
          this.reader.setIndex(g);
          var y = this.reader.readString(4) === b;
          return this.reader.setIndex(l), y;
        }, readBlockEndOfCentral: function() {
          this.diskNumber = this.reader.readInt(2), this.diskWithCentralDirStart = this.reader.readInt(2), this.centralDirRecordsOnThisDisk = this.reader.readInt(2), this.centralDirRecords = this.reader.readInt(2), this.centralDirSize = this.reader.readInt(4), this.centralDirOffset = this.reader.readInt(4), this.zipCommentLength = this.reader.readInt(2);
          var g = this.reader.readData(this.zipCommentLength), b = p.uint8array ? "uint8array" : "array", l = s.transformTo(b, g);
          this.zipComment = this.loadOptions.decodeFileName(l);
        }, readBlockZip64EndOfCentral: function() {
          this.zip64EndOfCentralSize = this.reader.readInt(8), this.reader.skip(4), this.diskNumber = this.reader.readInt(4), this.diskWithCentralDirStart = this.reader.readInt(4), this.centralDirRecordsOnThisDisk = this.reader.readInt(8), this.centralDirRecords = this.reader.readInt(8), this.centralDirSize = this.reader.readInt(8), this.centralDirOffset = this.reader.readInt(8), this.zip64ExtensibleData = {};
          for (var g, b, l, y = this.zip64EndOfCentralSize - 44; 0 < y; ) g = this.reader.readInt(2), b = this.reader.readInt(4), l = this.reader.readData(b), this.zip64ExtensibleData[g] = { id: g, length: b, value: l };
        }, readBlockZip64EndOfCentralLocator: function() {
          if (this.diskWithZip64CentralDirStart = this.reader.readInt(4), this.relativeOffsetEndOfZip64CentralDir = this.reader.readInt(8), this.disksCount = this.reader.readInt(4), 1 < this.disksCount) throw new Error("Multi-volumes zip are not supported");
        }, readLocalFiles: function() {
          var g, b;
          for (g = 0; g < this.files.length; g++) b = this.files[g], this.reader.setIndex(b.localHeaderOffset), this.checkSignature(n.LOCAL_FILE_HEADER), b.readLocalPart(this.reader), b.handleUTF8(), b.processAttributes();
        }, readCentralDir: function() {
          var g;
          for (this.reader.setIndex(this.centralDirOffset); this.reader.readAndCheckSignature(n.CENTRAL_FILE_HEADER); ) (g = new c({ zip64: this.zip64 }, this.loadOptions)).readCentralPart(this.reader), this.files.push(g);
          if (this.centralDirRecords !== this.files.length && this.centralDirRecords !== 0 && this.files.length === 0) throw new Error("Corrupted zip or bug: expected " + this.centralDirRecords + " records in central dir, got " + this.files.length);
        }, readEndOfCentral: function() {
          var g = this.reader.lastIndexOfSignature(n.CENTRAL_DIRECTORY_END);
          if (g < 0) throw this.isSignature(0, n.LOCAL_FILE_HEADER) ? new Error("Corrupted zip: can't find end of central directory") : new Error("Can't find end of central directory : is this a zip file ? If it is, see https://stuk.github.io/jszip/documentation/howto/read_zip.html");
          this.reader.setIndex(g);
          var b = g;
          if (this.checkSignature(n.CENTRAL_DIRECTORY_END), this.readBlockEndOfCentral(), this.diskNumber === s.MAX_VALUE_16BITS || this.diskWithCentralDirStart === s.MAX_VALUE_16BITS || this.centralDirRecordsOnThisDisk === s.MAX_VALUE_16BITS || this.centralDirRecords === s.MAX_VALUE_16BITS || this.centralDirSize === s.MAX_VALUE_32BITS || this.centralDirOffset === s.MAX_VALUE_32BITS) {
            if (this.zip64 = !0, (g = this.reader.lastIndexOfSignature(n.ZIP64_CENTRAL_DIRECTORY_LOCATOR)) < 0) throw new Error("Corrupted zip: can't find the ZIP64 end of central directory locator");
            if (this.reader.setIndex(g), this.checkSignature(n.ZIP64_CENTRAL_DIRECTORY_LOCATOR), this.readBlockZip64EndOfCentralLocator(), !this.isSignature(this.relativeOffsetEndOfZip64CentralDir, n.ZIP64_CENTRAL_DIRECTORY_END) && (this.relativeOffsetEndOfZip64CentralDir = this.reader.lastIndexOfSignature(n.ZIP64_CENTRAL_DIRECTORY_END), this.relativeOffsetEndOfZip64CentralDir < 0)) throw new Error("Corrupted zip: can't find the ZIP64 end of central directory");
            this.reader.setIndex(this.relativeOffsetEndOfZip64CentralDir), this.checkSignature(n.ZIP64_CENTRAL_DIRECTORY_END), this.readBlockZip64EndOfCentral();
          }
          var l = this.centralDirOffset + this.centralDirSize;
          this.zip64 && (l += 20, l += 12 + this.zip64EndOfCentralSize);
          var y = b - l;
          if (0 < y) this.isSignature(b, n.CENTRAL_FILE_HEADER) || (this.reader.zero = y);
          else if (y < 0) throw new Error("Corrupted zip: missing " + Math.abs(y) + " bytes.");
        }, prepareReader: function(g) {
          this.reader = r(g);
        }, load: function(g) {
          this.prepareReader(g), this.readEndOfCentral(), this.readCentralDir(), this.readLocalFiles();
        } }, d.exports = w;
      }, { "./reader/readerFor": 22, "./signature": 23, "./support": 30, "./utils": 32, "./zipEntry": 34 }], 34: [function(t, d, o) {
        var r = t("./reader/readerFor"), s = t("./utils"), n = t("./compressedObject"), c = t("./crc32"), p = t("./utf8"), w = t("./compressions"), g = t("./support");
        function b(l, y) {
          this.options = l, this.loadOptions = y;
        }
        b.prototype = { isEncrypted: function() {
          return (1 & this.bitFlag) == 1;
        }, useUTF8: function() {
          return (2048 & this.bitFlag) == 2048;
        }, readLocalPart: function(l) {
          var y, h;
          if (l.skip(22), this.fileNameLength = l.readInt(2), h = l.readInt(2), this.fileName = l.readData(this.fileNameLength), l.skip(h), this.compressedSize === -1 || this.uncompressedSize === -1) throw new Error("Bug or corrupted zip : didn't get enough information from the central directory (compressedSize === -1 || uncompressedSize === -1)");
          if ((y = (function(m) {
            for (var f in w) if (Object.prototype.hasOwnProperty.call(w, f) && w[f].magic === m) return w[f];
            return null;
          })(this.compressionMethod)) === null) throw new Error("Corrupted zip : compression " + s.pretty(this.compressionMethod) + " unknown (inner file : " + s.transformTo("string", this.fileName) + ")");
          this.decompressed = new n(this.compressedSize, this.uncompressedSize, this.crc32, y, l.readData(this.compressedSize));
        }, readCentralPart: function(l) {
          this.versionMadeBy = l.readInt(2), l.skip(2), this.bitFlag = l.readInt(2), this.compressionMethod = l.readString(2), this.date = l.readDate(), this.crc32 = l.readInt(4), this.compressedSize = l.readInt(4), this.uncompressedSize = l.readInt(4);
          var y = l.readInt(2);
          if (this.extraFieldsLength = l.readInt(2), this.fileCommentLength = l.readInt(2), this.diskNumberStart = l.readInt(2), this.internalFileAttributes = l.readInt(2), this.externalFileAttributes = l.readInt(4), this.localHeaderOffset = l.readInt(4), this.isEncrypted()) throw new Error("Encrypted zip are not supported");
          l.skip(y), this.readExtraFields(l), this.parseZIP64ExtraField(l), this.fileComment = l.readData(this.fileCommentLength);
        }, processAttributes: function() {
          this.unixPermissions = null, this.dosPermissions = null;
          var l = this.versionMadeBy >> 8;
          this.dir = !!(16 & this.externalFileAttributes), l == 0 && (this.dosPermissions = 63 & this.externalFileAttributes), l == 3 && (this.unixPermissions = this.externalFileAttributes >> 16 & 65535), this.dir || this.fileNameStr.slice(-1) !== "/" || (this.dir = !0);
        }, parseZIP64ExtraField: function() {
          if (this.extraFields[1]) {
            var l = r(this.extraFields[1].value);
            this.uncompressedSize === s.MAX_VALUE_32BITS && (this.uncompressedSize = l.readInt(8)), this.compressedSize === s.MAX_VALUE_32BITS && (this.compressedSize = l.readInt(8)), this.localHeaderOffset === s.MAX_VALUE_32BITS && (this.localHeaderOffset = l.readInt(8)), this.diskNumberStart === s.MAX_VALUE_32BITS && (this.diskNumberStart = l.readInt(4));
          }
        }, readExtraFields: function(l) {
          var y, h, m, f = l.index + this.extraFieldsLength;
          for (this.extraFields || (this.extraFields = {}); l.index + 4 < f; ) y = l.readInt(2), h = l.readInt(2), m = l.readData(h), this.extraFields[y] = { id: y, length: h, value: m };
          l.setIndex(f);
        }, handleUTF8: function() {
          var l = g.uint8array ? "uint8array" : "array";
          if (this.useUTF8()) this.fileNameStr = p.utf8decode(this.fileName), this.fileCommentStr = p.utf8decode(this.fileComment);
          else {
            var y = this.findExtraFieldUnicodePath();
            if (y !== null) this.fileNameStr = y;
            else {
              var h = s.transformTo(l, this.fileName);
              this.fileNameStr = this.loadOptions.decodeFileName(h);
            }
            var m = this.findExtraFieldUnicodeComment();
            if (m !== null) this.fileCommentStr = m;
            else {
              var f = s.transformTo(l, this.fileComment);
              this.fileCommentStr = this.loadOptions.decodeFileName(f);
            }
          }
        }, findExtraFieldUnicodePath: function() {
          var l = this.extraFields[28789];
          if (l) {
            var y = r(l.value);
            return y.readInt(1) !== 1 || c(this.fileName) !== y.readInt(4) ? null : p.utf8decode(y.readData(l.length - 5));
          }
          return null;
        }, findExtraFieldUnicodeComment: function() {
          var l = this.extraFields[25461];
          if (l) {
            var y = r(l.value);
            return y.readInt(1) !== 1 || c(this.fileComment) !== y.readInt(4) ? null : p.utf8decode(y.readData(l.length - 5));
          }
          return null;
        } }, d.exports = b;
      }, { "./compressedObject": 2, "./compressions": 3, "./crc32": 4, "./reader/readerFor": 22, "./support": 30, "./utf8": 31, "./utils": 32 }], 35: [function(t, d, o) {
        function r(y, h, m) {
          this.name = y, this.dir = m.dir, this.date = m.date, this.comment = m.comment, this.unixPermissions = m.unixPermissions, this.dosPermissions = m.dosPermissions, this._data = h, this._dataBinary = m.binary, this.options = { compression: m.compression, compressionOptions: m.compressionOptions };
        }
        var s = t("./stream/StreamHelper"), n = t("./stream/DataWorker"), c = t("./utf8"), p = t("./compressedObject"), w = t("./stream/GenericWorker");
        r.prototype = { internalStream: function(y) {
          var h = null, m = "string";
          try {
            if (!y) throw new Error("No output type specified.");
            var f = (m = y.toLowerCase()) === "string" || m === "text";
            m !== "binarystring" && m !== "text" || (m = "string"), h = this._decompressWorker();
            var k = !this._dataBinary;
            k && !f && (h = h.pipe(new c.Utf8EncodeWorker())), !k && f && (h = h.pipe(new c.Utf8DecodeWorker()));
          } catch (A) {
            (h = new w("error")).error(A);
          }
          return new s(h, m, "");
        }, async: function(y, h) {
          return this.internalStream(y).accumulate(h);
        }, nodeStream: function(y, h) {
          return this.internalStream(y || "nodebuffer").toNodejsStream(h);
        }, _compressWorker: function(y, h) {
          if (this._data instanceof p && this._data.compression.magic === y.magic) return this._data.getCompressedWorker();
          var m = this._decompressWorker();
          return this._dataBinary || (m = m.pipe(new c.Utf8EncodeWorker())), p.createWorkerFrom(m, y, h);
        }, _decompressWorker: function() {
          return this._data instanceof p ? this._data.getContentWorker() : this._data instanceof w ? this._data : new n(this._data);
        } };
        for (var g = ["asText", "asBinary", "asNodeBuffer", "asUint8Array", "asArrayBuffer"], b = function() {
          throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.");
        }, l = 0; l < g.length; l++) r.prototype[g[l]] = b;
        d.exports = r;
      }, { "./compressedObject": 2, "./stream/DataWorker": 27, "./stream/GenericWorker": 28, "./stream/StreamHelper": 29, "./utf8": 31 }], 36: [function(t, d, o) {
        (function(r) {
          var s, n, c = r.MutationObserver || r.WebKitMutationObserver;
          if (c) {
            var p = 0, w = new c(y), g = r.document.createTextNode("");
            w.observe(g, { characterData: !0 }), s = function() {
              g.data = p = ++p % 2;
            };
          } else if (r.setImmediate || r.MessageChannel === void 0) s = "document" in r && "onreadystatechange" in r.document.createElement("script") ? function() {
            var h = r.document.createElement("script");
            h.onreadystatechange = function() {
              y(), h.onreadystatechange = null, h.parentNode.removeChild(h), h = null;
            }, r.document.documentElement.appendChild(h);
          } : function() {
            setTimeout(y, 0);
          };
          else {
            var b = new r.MessageChannel();
            b.port1.onmessage = y, s = function() {
              b.port2.postMessage(0);
            };
          }
          var l = [];
          function y() {
            var h, m;
            n = !0;
            for (var f = l.length; f; ) {
              for (m = l, l = [], h = -1; ++h < f; ) m[h]();
              f = l.length;
            }
            n = !1;
          }
          d.exports = function(h) {
            l.push(h) !== 1 || n || s();
          };
        }).call(this, typeof At < "u" ? At : typeof self < "u" ? self : typeof window < "u" ? window : {});
      }, {}], 37: [function(t, d, o) {
        var r = t("immediate");
        function s() {
        }
        var n = {}, c = ["REJECTED"], p = ["FULFILLED"], w = ["PENDING"];
        function g(f) {
          if (typeof f != "function") throw new TypeError("resolver must be a function");
          this.state = w, this.queue = [], this.outcome = void 0, f !== s && h(this, f);
        }
        function b(f, k, A) {
          this.promise = f, typeof k == "function" && (this.onFulfilled = k, this.callFulfilled = this.otherCallFulfilled), typeof A == "function" && (this.onRejected = A, this.callRejected = this.otherCallRejected);
        }
        function l(f, k, A) {
          r(function() {
            var P;
            try {
              P = k(A);
            } catch (I) {
              return n.reject(f, I);
            }
            P === f ? n.reject(f, new TypeError("Cannot resolve promise with itself")) : n.resolve(f, P);
          });
        }
        function y(f) {
          var k = f && f.then;
          if (f && (typeof f == "object" || typeof f == "function") && typeof k == "function") return function() {
            k.apply(f, arguments);
          };
        }
        function h(f, k) {
          var A = !1;
          function P(R) {
            A || (A = !0, n.reject(f, R));
          }
          function I(R) {
            A || (A = !0, n.resolve(f, R));
          }
          var j = m(function() {
            k(I, P);
          });
          j.status === "error" && P(j.value);
        }
        function m(f, k) {
          var A = {};
          try {
            A.value = f(k), A.status = "success";
          } catch (P) {
            A.status = "error", A.value = P;
          }
          return A;
        }
        (d.exports = g).prototype.finally = function(f) {
          if (typeof f != "function") return this;
          var k = this.constructor;
          return this.then(function(A) {
            return k.resolve(f()).then(function() {
              return A;
            });
          }, function(A) {
            return k.resolve(f()).then(function() {
              throw A;
            });
          });
        }, g.prototype.catch = function(f) {
          return this.then(null, f);
        }, g.prototype.then = function(f, k) {
          if (typeof f != "function" && this.state === p || typeof k != "function" && this.state === c) return this;
          var A = new this.constructor(s);
          return this.state !== w ? l(A, this.state === p ? f : k, this.outcome) : this.queue.push(new b(A, f, k)), A;
        }, b.prototype.callFulfilled = function(f) {
          n.resolve(this.promise, f);
        }, b.prototype.otherCallFulfilled = function(f) {
          l(this.promise, this.onFulfilled, f);
        }, b.prototype.callRejected = function(f) {
          n.reject(this.promise, f);
        }, b.prototype.otherCallRejected = function(f) {
          l(this.promise, this.onRejected, f);
        }, n.resolve = function(f, k) {
          var A = m(y, k);
          if (A.status === "error") return n.reject(f, A.value);
          var P = A.value;
          if (P) h(f, P);
          else {
            f.state = p, f.outcome = k;
            for (var I = -1, j = f.queue.length; ++I < j; ) f.queue[I].callFulfilled(k);
          }
          return f;
        }, n.reject = function(f, k) {
          f.state = c, f.outcome = k;
          for (var A = -1, P = f.queue.length; ++A < P; ) f.queue[A].callRejected(k);
          return f;
        }, g.resolve = function(f) {
          return f instanceof this ? f : n.resolve(new this(s), f);
        }, g.reject = function(f) {
          var k = new this(s);
          return n.reject(k, f);
        }, g.all = function(f) {
          var k = this;
          if (Object.prototype.toString.call(f) !== "[object Array]") return this.reject(new TypeError("must be an array"));
          var A = f.length, P = !1;
          if (!A) return this.resolve([]);
          for (var I = new Array(A), j = 0, R = -1, W = new this(s); ++R < A; ) O(f[R], R);
          return W;
          function O(Z, Q) {
            k.resolve(Z).then(function(S) {
              I[Q] = S, ++j !== A || P || (P = !0, n.resolve(W, I));
            }, function(S) {
              P || (P = !0, n.reject(W, S));
            });
          }
        }, g.race = function(f) {
          var k = this;
          if (Object.prototype.toString.call(f) !== "[object Array]") return this.reject(new TypeError("must be an array"));
          var A = f.length, P = !1;
          if (!A) return this.resolve([]);
          for (var I = -1, j = new this(s); ++I < A; ) R = f[I], k.resolve(R).then(function(W) {
            P || (P = !0, n.resolve(j, W));
          }, function(W) {
            P || (P = !0, n.reject(j, W));
          });
          var R;
          return j;
        };
      }, { immediate: 36 }], 38: [function(t, d, o) {
        var r = {};
        (0, t("./lib/utils/common").assign)(r, t("./lib/deflate"), t("./lib/inflate"), t("./lib/zlib/constants")), d.exports = r;
      }, { "./lib/deflate": 39, "./lib/inflate": 40, "./lib/utils/common": 41, "./lib/zlib/constants": 44 }], 39: [function(t, d, o) {
        var r = t("./zlib/deflate"), s = t("./utils/common"), n = t("./utils/strings"), c = t("./zlib/messages"), p = t("./zlib/zstream"), w = Object.prototype.toString, g = 0, b = -1, l = 0, y = 8;
        function h(f) {
          if (!(this instanceof h)) return new h(f);
          this.options = s.assign({ level: b, method: y, chunkSize: 16384, windowBits: 15, memLevel: 8, strategy: l, to: "" }, f || {});
          var k = this.options;
          k.raw && 0 < k.windowBits ? k.windowBits = -k.windowBits : k.gzip && 0 < k.windowBits && k.windowBits < 16 && (k.windowBits += 16), this.err = 0, this.msg = "", this.ended = !1, this.chunks = [], this.strm = new p(), this.strm.avail_out = 0;
          var A = r.deflateInit2(this.strm, k.level, k.method, k.windowBits, k.memLevel, k.strategy);
          if (A !== g) throw new Error(c[A]);
          if (k.header && r.deflateSetHeader(this.strm, k.header), k.dictionary) {
            var P;
            if (P = typeof k.dictionary == "string" ? n.string2buf(k.dictionary) : w.call(k.dictionary) === "[object ArrayBuffer]" ? new Uint8Array(k.dictionary) : k.dictionary, (A = r.deflateSetDictionary(this.strm, P)) !== g) throw new Error(c[A]);
            this._dict_set = !0;
          }
        }
        function m(f, k) {
          var A = new h(k);
          if (A.push(f, !0), A.err) throw A.msg || c[A.err];
          return A.result;
        }
        h.prototype.push = function(f, k) {
          var A, P, I = this.strm, j = this.options.chunkSize;
          if (this.ended) return !1;
          P = k === ~~k ? k : k === !0 ? 4 : 0, typeof f == "string" ? I.input = n.string2buf(f) : w.call(f) === "[object ArrayBuffer]" ? I.input = new Uint8Array(f) : I.input = f, I.next_in = 0, I.avail_in = I.input.length;
          do {
            if (I.avail_out === 0 && (I.output = new s.Buf8(j), I.next_out = 0, I.avail_out = j), (A = r.deflate(I, P)) !== 1 && A !== g) return this.onEnd(A), !(this.ended = !0);
            I.avail_out !== 0 && (I.avail_in !== 0 || P !== 4 && P !== 2) || (this.options.to === "string" ? this.onData(n.buf2binstring(s.shrinkBuf(I.output, I.next_out))) : this.onData(s.shrinkBuf(I.output, I.next_out)));
          } while ((0 < I.avail_in || I.avail_out === 0) && A !== 1);
          return P === 4 ? (A = r.deflateEnd(this.strm), this.onEnd(A), this.ended = !0, A === g) : P !== 2 || (this.onEnd(g), !(I.avail_out = 0));
        }, h.prototype.onData = function(f) {
          this.chunks.push(f);
        }, h.prototype.onEnd = function(f) {
          f === g && (this.options.to === "string" ? this.result = this.chunks.join("") : this.result = s.flattenChunks(this.chunks)), this.chunks = [], this.err = f, this.msg = this.strm.msg;
        }, o.Deflate = h, o.deflate = m, o.deflateRaw = function(f, k) {
          return (k = k || {}).raw = !0, m(f, k);
        }, o.gzip = function(f, k) {
          return (k = k || {}).gzip = !0, m(f, k);
        };
      }, { "./utils/common": 41, "./utils/strings": 42, "./zlib/deflate": 46, "./zlib/messages": 51, "./zlib/zstream": 53 }], 40: [function(t, d, o) {
        var r = t("./zlib/inflate"), s = t("./utils/common"), n = t("./utils/strings"), c = t("./zlib/constants"), p = t("./zlib/messages"), w = t("./zlib/zstream"), g = t("./zlib/gzheader"), b = Object.prototype.toString;
        function l(h) {
          if (!(this instanceof l)) return new l(h);
          this.options = s.assign({ chunkSize: 16384, windowBits: 0, to: "" }, h || {});
          var m = this.options;
          m.raw && 0 <= m.windowBits && m.windowBits < 16 && (m.windowBits = -m.windowBits, m.windowBits === 0 && (m.windowBits = -15)), !(0 <= m.windowBits && m.windowBits < 16) || h && h.windowBits || (m.windowBits += 32), 15 < m.windowBits && m.windowBits < 48 && (15 & m.windowBits) == 0 && (m.windowBits |= 15), this.err = 0, this.msg = "", this.ended = !1, this.chunks = [], this.strm = new w(), this.strm.avail_out = 0;
          var f = r.inflateInit2(this.strm, m.windowBits);
          if (f !== c.Z_OK) throw new Error(p[f]);
          this.header = new g(), r.inflateGetHeader(this.strm, this.header);
        }
        function y(h, m) {
          var f = new l(m);
          if (f.push(h, !0), f.err) throw f.msg || p[f.err];
          return f.result;
        }
        l.prototype.push = function(h, m) {
          var f, k, A, P, I, j, R = this.strm, W = this.options.chunkSize, O = this.options.dictionary, Z = !1;
          if (this.ended) return !1;
          k = m === ~~m ? m : m === !0 ? c.Z_FINISH : c.Z_NO_FLUSH, typeof h == "string" ? R.input = n.binstring2buf(h) : b.call(h) === "[object ArrayBuffer]" ? R.input = new Uint8Array(h) : R.input = h, R.next_in = 0, R.avail_in = R.input.length;
          do {
            if (R.avail_out === 0 && (R.output = new s.Buf8(W), R.next_out = 0, R.avail_out = W), (f = r.inflate(R, c.Z_NO_FLUSH)) === c.Z_NEED_DICT && O && (j = typeof O == "string" ? n.string2buf(O) : b.call(O) === "[object ArrayBuffer]" ? new Uint8Array(O) : O, f = r.inflateSetDictionary(this.strm, j)), f === c.Z_BUF_ERROR && Z === !0 && (f = c.Z_OK, Z = !1), f !== c.Z_STREAM_END && f !== c.Z_OK) return this.onEnd(f), !(this.ended = !0);
            R.next_out && (R.avail_out !== 0 && f !== c.Z_STREAM_END && (R.avail_in !== 0 || k !== c.Z_FINISH && k !== c.Z_SYNC_FLUSH) || (this.options.to === "string" ? (A = n.utf8border(R.output, R.next_out), P = R.next_out - A, I = n.buf2string(R.output, A), R.next_out = P, R.avail_out = W - P, P && s.arraySet(R.output, R.output, A, P, 0), this.onData(I)) : this.onData(s.shrinkBuf(R.output, R.next_out)))), R.avail_in === 0 && R.avail_out === 0 && (Z = !0);
          } while ((0 < R.avail_in || R.avail_out === 0) && f !== c.Z_STREAM_END);
          return f === c.Z_STREAM_END && (k = c.Z_FINISH), k === c.Z_FINISH ? (f = r.inflateEnd(this.strm), this.onEnd(f), this.ended = !0, f === c.Z_OK) : k !== c.Z_SYNC_FLUSH || (this.onEnd(c.Z_OK), !(R.avail_out = 0));
        }, l.prototype.onData = function(h) {
          this.chunks.push(h);
        }, l.prototype.onEnd = function(h) {
          h === c.Z_OK && (this.options.to === "string" ? this.result = this.chunks.join("") : this.result = s.flattenChunks(this.chunks)), this.chunks = [], this.err = h, this.msg = this.strm.msg;
        }, o.Inflate = l, o.inflate = y, o.inflateRaw = function(h, m) {
          return (m = m || {}).raw = !0, y(h, m);
        }, o.ungzip = y;
      }, { "./utils/common": 41, "./utils/strings": 42, "./zlib/constants": 44, "./zlib/gzheader": 47, "./zlib/inflate": 49, "./zlib/messages": 51, "./zlib/zstream": 53 }], 41: [function(t, d, o) {
        var r = typeof Uint8Array < "u" && typeof Uint16Array < "u" && typeof Int32Array < "u";
        o.assign = function(c) {
          for (var p = Array.prototype.slice.call(arguments, 1); p.length; ) {
            var w = p.shift();
            if (w) {
              if (typeof w != "object") throw new TypeError(w + "must be non-object");
              for (var g in w) w.hasOwnProperty(g) && (c[g] = w[g]);
            }
          }
          return c;
        }, o.shrinkBuf = function(c, p) {
          return c.length === p ? c : c.subarray ? c.subarray(0, p) : (c.length = p, c);
        };
        var s = { arraySet: function(c, p, w, g, b) {
          if (p.subarray && c.subarray) c.set(p.subarray(w, w + g), b);
          else for (var l = 0; l < g; l++) c[b + l] = p[w + l];
        }, flattenChunks: function(c) {
          var p, w, g, b, l, y;
          for (p = g = 0, w = c.length; p < w; p++) g += c[p].length;
          for (y = new Uint8Array(g), p = b = 0, w = c.length; p < w; p++) l = c[p], y.set(l, b), b += l.length;
          return y;
        } }, n = { arraySet: function(c, p, w, g, b) {
          for (var l = 0; l < g; l++) c[b + l] = p[w + l];
        }, flattenChunks: function(c) {
          return [].concat.apply([], c);
        } };
        o.setTyped = function(c) {
          c ? (o.Buf8 = Uint8Array, o.Buf16 = Uint16Array, o.Buf32 = Int32Array, o.assign(o, s)) : (o.Buf8 = Array, o.Buf16 = Array, o.Buf32 = Array, o.assign(o, n));
        }, o.setTyped(r);
      }, {}], 42: [function(t, d, o) {
        var r = t("./common"), s = !0, n = !0;
        try {
          String.fromCharCode.apply(null, [0]);
        } catch {
          s = !1;
        }
        try {
          String.fromCharCode.apply(null, new Uint8Array(1));
        } catch {
          n = !1;
        }
        for (var c = new r.Buf8(256), p = 0; p < 256; p++) c[p] = 252 <= p ? 6 : 248 <= p ? 5 : 240 <= p ? 4 : 224 <= p ? 3 : 192 <= p ? 2 : 1;
        function w(g, b) {
          if (b < 65537 && (g.subarray && n || !g.subarray && s)) return String.fromCharCode.apply(null, r.shrinkBuf(g, b));
          for (var l = "", y = 0; y < b; y++) l += String.fromCharCode(g[y]);
          return l;
        }
        c[254] = c[254] = 1, o.string2buf = function(g) {
          var b, l, y, h, m, f = g.length, k = 0;
          for (h = 0; h < f; h++) (64512 & (l = g.charCodeAt(h))) == 55296 && h + 1 < f && (64512 & (y = g.charCodeAt(h + 1))) == 56320 && (l = 65536 + (l - 55296 << 10) + (y - 56320), h++), k += l < 128 ? 1 : l < 2048 ? 2 : l < 65536 ? 3 : 4;
          for (b = new r.Buf8(k), h = m = 0; m < k; h++) (64512 & (l = g.charCodeAt(h))) == 55296 && h + 1 < f && (64512 & (y = g.charCodeAt(h + 1))) == 56320 && (l = 65536 + (l - 55296 << 10) + (y - 56320), h++), l < 128 ? b[m++] = l : (l < 2048 ? b[m++] = 192 | l >>> 6 : (l < 65536 ? b[m++] = 224 | l >>> 12 : (b[m++] = 240 | l >>> 18, b[m++] = 128 | l >>> 12 & 63), b[m++] = 128 | l >>> 6 & 63), b[m++] = 128 | 63 & l);
          return b;
        }, o.buf2binstring = function(g) {
          return w(g, g.length);
        }, o.binstring2buf = function(g) {
          for (var b = new r.Buf8(g.length), l = 0, y = b.length; l < y; l++) b[l] = g.charCodeAt(l);
          return b;
        }, o.buf2string = function(g, b) {
          var l, y, h, m, f = b || g.length, k = new Array(2 * f);
          for (l = y = 0; l < f; ) if ((h = g[l++]) < 128) k[y++] = h;
          else if (4 < (m = c[h])) k[y++] = 65533, l += m - 1;
          else {
            for (h &= m === 2 ? 31 : m === 3 ? 15 : 7; 1 < m && l < f; ) h = h << 6 | 63 & g[l++], m--;
            1 < m ? k[y++] = 65533 : h < 65536 ? k[y++] = h : (h -= 65536, k[y++] = 55296 | h >> 10 & 1023, k[y++] = 56320 | 1023 & h);
          }
          return w(k, y);
        }, o.utf8border = function(g, b) {
          var l;
          for ((b = b || g.length) > g.length && (b = g.length), l = b - 1; 0 <= l && (192 & g[l]) == 128; ) l--;
          return l < 0 || l === 0 ? b : l + c[g[l]] > b ? l : b;
        };
      }, { "./common": 41 }], 43: [function(t, d, o) {
        d.exports = function(r, s, n, c) {
          for (var p = 65535 & r | 0, w = r >>> 16 & 65535 | 0, g = 0; n !== 0; ) {
            for (n -= g = 2e3 < n ? 2e3 : n; w = w + (p = p + s[c++] | 0) | 0, --g; ) ;
            p %= 65521, w %= 65521;
          }
          return p | w << 16 | 0;
        };
      }, {}], 44: [function(t, d, o) {
        d.exports = { Z_NO_FLUSH: 0, Z_PARTIAL_FLUSH: 1, Z_SYNC_FLUSH: 2, Z_FULL_FLUSH: 3, Z_FINISH: 4, Z_BLOCK: 5, Z_TREES: 6, Z_OK: 0, Z_STREAM_END: 1, Z_NEED_DICT: 2, Z_ERRNO: -1, Z_STREAM_ERROR: -2, Z_DATA_ERROR: -3, Z_BUF_ERROR: -5, Z_NO_COMPRESSION: 0, Z_BEST_SPEED: 1, Z_BEST_COMPRESSION: 9, Z_DEFAULT_COMPRESSION: -1, Z_FILTERED: 1, Z_HUFFMAN_ONLY: 2, Z_RLE: 3, Z_FIXED: 4, Z_DEFAULT_STRATEGY: 0, Z_BINARY: 0, Z_TEXT: 1, Z_UNKNOWN: 2, Z_DEFLATED: 8 };
      }, {}], 45: [function(t, d, o) {
        var r = (function() {
          for (var s, n = [], c = 0; c < 256; c++) {
            s = c;
            for (var p = 0; p < 8; p++) s = 1 & s ? 3988292384 ^ s >>> 1 : s >>> 1;
            n[c] = s;
          }
          return n;
        })();
        d.exports = function(s, n, c, p) {
          var w = r, g = p + c;
          s ^= -1;
          for (var b = p; b < g; b++) s = s >>> 8 ^ w[255 & (s ^ n[b])];
          return -1 ^ s;
        };
      }, {}], 46: [function(t, d, o) {
        var r, s = t("../utils/common"), n = t("./trees"), c = t("./adler32"), p = t("./crc32"), w = t("./messages"), g = 0, b = 4, l = 0, y = -2, h = -1, m = 4, f = 2, k = 8, A = 9, P = 286, I = 30, j = 19, R = 2 * P + 1, W = 15, O = 3, Z = 258, Q = Z + O + 1, S = 42, z = 113, a = 1, M = 2, et = 3, U = 4;
        function rt(e, B) {
          return e.msg = w[B], B;
        }
        function $(e) {
          return (e << 1) - (4 < e ? 9 : 0);
        }
        function tt(e) {
          for (var B = e.length; 0 <= --B; ) e[B] = 0;
        }
        function F(e) {
          var B = e.state, D = B.pending;
          D > e.avail_out && (D = e.avail_out), D !== 0 && (s.arraySet(e.output, B.pending_buf, B.pending_out, D, e.next_out), e.next_out += D, B.pending_out += D, e.total_out += D, e.avail_out -= D, B.pending -= D, B.pending === 0 && (B.pending_out = 0));
        }
        function T(e, B) {
          n._tr_flush_block(e, 0 <= e.block_start ? e.block_start : -1, e.strstart - e.block_start, B), e.block_start = e.strstart, F(e.strm);
        }
        function X(e, B) {
          e.pending_buf[e.pending++] = B;
        }
        function Y(e, B) {
          e.pending_buf[e.pending++] = B >>> 8 & 255, e.pending_buf[e.pending++] = 255 & B;
        }
        function V(e, B) {
          var D, v, _ = e.max_chain_length, C = e.strstart, N = e.prev_length, L = e.nice_match, x = e.strstart > e.w_size - Q ? e.strstart - (e.w_size - Q) : 0, H = e.window, K = e.w_mask, q = e.prev, J = e.strstart + Z, ot = H[C + N - 1], it = H[C + N];
          e.prev_length >= e.good_match && (_ >>= 2), L > e.lookahead && (L = e.lookahead);
          do
            if (H[(D = B) + N] === it && H[D + N - 1] === ot && H[D] === H[C] && H[++D] === H[C + 1]) {
              C += 2, D++;
              do
                ;
              while (H[++C] === H[++D] && H[++C] === H[++D] && H[++C] === H[++D] && H[++C] === H[++D] && H[++C] === H[++D] && H[++C] === H[++D] && H[++C] === H[++D] && H[++C] === H[++D] && C < J);
              if (v = Z - (J - C), C = J - Z, N < v) {
                if (e.match_start = B, L <= (N = v)) break;
                ot = H[C + N - 1], it = H[C + N];
              }
            }
          while ((B = q[B & K]) > x && --_ != 0);
          return N <= e.lookahead ? N : e.lookahead;
        }
        function ct(e) {
          var B, D, v, _, C, N, L, x, H, K, q = e.w_size;
          do {
            if (_ = e.window_size - e.lookahead - e.strstart, e.strstart >= q + (q - Q)) {
              for (s.arraySet(e.window, e.window, q, q, 0), e.match_start -= q, e.strstart -= q, e.block_start -= q, B = D = e.hash_size; v = e.head[--B], e.head[B] = q <= v ? v - q : 0, --D; ) ;
              for (B = D = q; v = e.prev[--B], e.prev[B] = q <= v ? v - q : 0, --D; ) ;
              _ += q;
            }
            if (e.strm.avail_in === 0) break;
            if (N = e.strm, L = e.window, x = e.strstart + e.lookahead, H = _, K = void 0, K = N.avail_in, H < K && (K = H), D = K === 0 ? 0 : (N.avail_in -= K, s.arraySet(L, N.input, N.next_in, K, x), N.state.wrap === 1 ? N.adler = c(N.adler, L, K, x) : N.state.wrap === 2 && (N.adler = p(N.adler, L, K, x)), N.next_in += K, N.total_in += K, K), e.lookahead += D, e.lookahead + e.insert >= O) for (C = e.strstart - e.insert, e.ins_h = e.window[C], e.ins_h = (e.ins_h << e.hash_shift ^ e.window[C + 1]) & e.hash_mask; e.insert && (e.ins_h = (e.ins_h << e.hash_shift ^ e.window[C + O - 1]) & e.hash_mask, e.prev[C & e.w_mask] = e.head[e.ins_h], e.head[e.ins_h] = C, C++, e.insert--, !(e.lookahead + e.insert < O)); ) ;
          } while (e.lookahead < Q && e.strm.avail_in !== 0);
        }
        function ft(e, B) {
          for (var D, v; ; ) {
            if (e.lookahead < Q) {
              if (ct(e), e.lookahead < Q && B === g) return a;
              if (e.lookahead === 0) break;
            }
            if (D = 0, e.lookahead >= O && (e.ins_h = (e.ins_h << e.hash_shift ^ e.window[e.strstart + O - 1]) & e.hash_mask, D = e.prev[e.strstart & e.w_mask] = e.head[e.ins_h], e.head[e.ins_h] = e.strstart), D !== 0 && e.strstart - D <= e.w_size - Q && (e.match_length = V(e, D)), e.match_length >= O) if (v = n._tr_tally(e, e.strstart - e.match_start, e.match_length - O), e.lookahead -= e.match_length, e.match_length <= e.max_lazy_match && e.lookahead >= O) {
              for (e.match_length--; e.strstart++, e.ins_h = (e.ins_h << e.hash_shift ^ e.window[e.strstart + O - 1]) & e.hash_mask, D = e.prev[e.strstart & e.w_mask] = e.head[e.ins_h], e.head[e.ins_h] = e.strstart, --e.match_length != 0; ) ;
              e.strstart++;
            } else e.strstart += e.match_length, e.match_length = 0, e.ins_h = e.window[e.strstart], e.ins_h = (e.ins_h << e.hash_shift ^ e.window[e.strstart + 1]) & e.hash_mask;
            else v = n._tr_tally(e, 0, e.window[e.strstart]), e.lookahead--, e.strstart++;
            if (v && (T(e, !1), e.strm.avail_out === 0)) return a;
          }
          return e.insert = e.strstart < O - 1 ? e.strstart : O - 1, B === b ? (T(e, !0), e.strm.avail_out === 0 ? et : U) : e.last_lit && (T(e, !1), e.strm.avail_out === 0) ? a : M;
        }
        function nt(e, B) {
          for (var D, v, _; ; ) {
            if (e.lookahead < Q) {
              if (ct(e), e.lookahead < Q && B === g) return a;
              if (e.lookahead === 0) break;
            }
            if (D = 0, e.lookahead >= O && (e.ins_h = (e.ins_h << e.hash_shift ^ e.window[e.strstart + O - 1]) & e.hash_mask, D = e.prev[e.strstart & e.w_mask] = e.head[e.ins_h], e.head[e.ins_h] = e.strstart), e.prev_length = e.match_length, e.prev_match = e.match_start, e.match_length = O - 1, D !== 0 && e.prev_length < e.max_lazy_match && e.strstart - D <= e.w_size - Q && (e.match_length = V(e, D), e.match_length <= 5 && (e.strategy === 1 || e.match_length === O && 4096 < e.strstart - e.match_start) && (e.match_length = O - 1)), e.prev_length >= O && e.match_length <= e.prev_length) {
              for (_ = e.strstart + e.lookahead - O, v = n._tr_tally(e, e.strstart - 1 - e.prev_match, e.prev_length - O), e.lookahead -= e.prev_length - 1, e.prev_length -= 2; ++e.strstart <= _ && (e.ins_h = (e.ins_h << e.hash_shift ^ e.window[e.strstart + O - 1]) & e.hash_mask, D = e.prev[e.strstart & e.w_mask] = e.head[e.ins_h], e.head[e.ins_h] = e.strstart), --e.prev_length != 0; ) ;
              if (e.match_available = 0, e.match_length = O - 1, e.strstart++, v && (T(e, !1), e.strm.avail_out === 0)) return a;
            } else if (e.match_available) {
              if ((v = n._tr_tally(e, 0, e.window[e.strstart - 1])) && T(e, !1), e.strstart++, e.lookahead--, e.strm.avail_out === 0) return a;
            } else e.match_available = 1, e.strstart++, e.lookahead--;
          }
          return e.match_available && (v = n._tr_tally(e, 0, e.window[e.strstart - 1]), e.match_available = 0), e.insert = e.strstart < O - 1 ? e.strstart : O - 1, B === b ? (T(e, !0), e.strm.avail_out === 0 ? et : U) : e.last_lit && (T(e, !1), e.strm.avail_out === 0) ? a : M;
        }
        function st(e, B, D, v, _) {
          this.good_length = e, this.max_lazy = B, this.nice_length = D, this.max_chain = v, this.func = _;
        }
        function dt() {
          this.strm = null, this.status = 0, this.pending_buf = null, this.pending_buf_size = 0, this.pending_out = 0, this.pending = 0, this.wrap = 0, this.gzhead = null, this.gzindex = 0, this.method = k, this.last_flush = -1, this.w_size = 0, this.w_bits = 0, this.w_mask = 0, this.window = null, this.window_size = 0, this.prev = null, this.head = null, this.ins_h = 0, this.hash_size = 0, this.hash_bits = 0, this.hash_mask = 0, this.hash_shift = 0, this.block_start = 0, this.match_length = 0, this.prev_match = 0, this.match_available = 0, this.strstart = 0, this.match_start = 0, this.lookahead = 0, this.prev_length = 0, this.max_chain_length = 0, this.max_lazy_match = 0, this.level = 0, this.strategy = 0, this.good_match = 0, this.nice_match = 0, this.dyn_ltree = new s.Buf16(2 * R), this.dyn_dtree = new s.Buf16(2 * (2 * I + 1)), this.bl_tree = new s.Buf16(2 * (2 * j + 1)), tt(this.dyn_ltree), tt(this.dyn_dtree), tt(this.bl_tree), this.l_desc = null, this.d_desc = null, this.bl_desc = null, this.bl_count = new s.Buf16(W + 1), this.heap = new s.Buf16(2 * P + 1), tt(this.heap), this.heap_len = 0, this.heap_max = 0, this.depth = new s.Buf16(2 * P + 1), tt(this.depth), this.l_buf = 0, this.lit_bufsize = 0, this.last_lit = 0, this.d_buf = 0, this.opt_len = 0, this.static_len = 0, this.matches = 0, this.insert = 0, this.bi_buf = 0, this.bi_valid = 0;
        }
        function lt(e) {
          var B;
          return e && e.state ? (e.total_in = e.total_out = 0, e.data_type = f, (B = e.state).pending = 0, B.pending_out = 0, B.wrap < 0 && (B.wrap = -B.wrap), B.status = B.wrap ? S : z, e.adler = B.wrap === 2 ? 0 : 1, B.last_flush = g, n._tr_init(B), l) : rt(e, y);
        }
        function gt(e) {
          var B = lt(e);
          return B === l && (function(D) {
            D.window_size = 2 * D.w_size, tt(D.head), D.max_lazy_match = r[D.level].max_lazy, D.good_match = r[D.level].good_length, D.nice_match = r[D.level].nice_length, D.max_chain_length = r[D.level].max_chain, D.strstart = 0, D.block_start = 0, D.lookahead = 0, D.insert = 0, D.match_length = D.prev_length = O - 1, D.match_available = 0, D.ins_h = 0;
          })(e.state), B;
        }
        function mt(e, B, D, v, _, C) {
          if (!e) return y;
          var N = 1;
          if (B === h && (B = 6), v < 0 ? (N = 0, v = -v) : 15 < v && (N = 2, v -= 16), _ < 1 || A < _ || D !== k || v < 8 || 15 < v || B < 0 || 9 < B || C < 0 || m < C) return rt(e, y);
          v === 8 && (v = 9);
          var L = new dt();
          return (e.state = L).strm = e, L.wrap = N, L.gzhead = null, L.w_bits = v, L.w_size = 1 << L.w_bits, L.w_mask = L.w_size - 1, L.hash_bits = _ + 7, L.hash_size = 1 << L.hash_bits, L.hash_mask = L.hash_size - 1, L.hash_shift = ~~((L.hash_bits + O - 1) / O), L.window = new s.Buf8(2 * L.w_size), L.head = new s.Buf16(L.hash_size), L.prev = new s.Buf16(L.w_size), L.lit_bufsize = 1 << _ + 6, L.pending_buf_size = 4 * L.lit_bufsize, L.pending_buf = new s.Buf8(L.pending_buf_size), L.d_buf = 1 * L.lit_bufsize, L.l_buf = 3 * L.lit_bufsize, L.level = B, L.strategy = C, L.method = D, gt(e);
        }
        r = [new st(0, 0, 0, 0, function(e, B) {
          var D = 65535;
          for (D > e.pending_buf_size - 5 && (D = e.pending_buf_size - 5); ; ) {
            if (e.lookahead <= 1) {
              if (ct(e), e.lookahead === 0 && B === g) return a;
              if (e.lookahead === 0) break;
            }
            e.strstart += e.lookahead, e.lookahead = 0;
            var v = e.block_start + D;
            if ((e.strstart === 0 || e.strstart >= v) && (e.lookahead = e.strstart - v, e.strstart = v, T(e, !1), e.strm.avail_out === 0) || e.strstart - e.block_start >= e.w_size - Q && (T(e, !1), e.strm.avail_out === 0)) return a;
          }
          return e.insert = 0, B === b ? (T(e, !0), e.strm.avail_out === 0 ? et : U) : (e.strstart > e.block_start && (T(e, !1), e.strm.avail_out), a);
        }), new st(4, 4, 8, 4, ft), new st(4, 5, 16, 8, ft), new st(4, 6, 32, 32, ft), new st(4, 4, 16, 16, nt), new st(8, 16, 32, 32, nt), new st(8, 16, 128, 128, nt), new st(8, 32, 128, 256, nt), new st(32, 128, 258, 1024, nt), new st(32, 258, 258, 4096, nt)], o.deflateInit = function(e, B) {
          return mt(e, B, k, 15, 8, 0);
        }, o.deflateInit2 = mt, o.deflateReset = gt, o.deflateResetKeep = lt, o.deflateSetHeader = function(e, B) {
          return e && e.state ? e.state.wrap !== 2 ? y : (e.state.gzhead = B, l) : y;
        }, o.deflate = function(e, B) {
          var D, v, _, C;
          if (!e || !e.state || 5 < B || B < 0) return e ? rt(e, y) : y;
          if (v = e.state, !e.output || !e.input && e.avail_in !== 0 || v.status === 666 && B !== b) return rt(e, e.avail_out === 0 ? -5 : y);
          if (v.strm = e, D = v.last_flush, v.last_flush = B, v.status === S) if (v.wrap === 2) e.adler = 0, X(v, 31), X(v, 139), X(v, 8), v.gzhead ? (X(v, (v.gzhead.text ? 1 : 0) + (v.gzhead.hcrc ? 2 : 0) + (v.gzhead.extra ? 4 : 0) + (v.gzhead.name ? 8 : 0) + (v.gzhead.comment ? 16 : 0)), X(v, 255 & v.gzhead.time), X(v, v.gzhead.time >> 8 & 255), X(v, v.gzhead.time >> 16 & 255), X(v, v.gzhead.time >> 24 & 255), X(v, v.level === 9 ? 2 : 2 <= v.strategy || v.level < 2 ? 4 : 0), X(v, 255 & v.gzhead.os), v.gzhead.extra && v.gzhead.extra.length && (X(v, 255 & v.gzhead.extra.length), X(v, v.gzhead.extra.length >> 8 & 255)), v.gzhead.hcrc && (e.adler = p(e.adler, v.pending_buf, v.pending, 0)), v.gzindex = 0, v.status = 69) : (X(v, 0), X(v, 0), X(v, 0), X(v, 0), X(v, 0), X(v, v.level === 9 ? 2 : 2 <= v.strategy || v.level < 2 ? 4 : 0), X(v, 3), v.status = z);
          else {
            var N = k + (v.w_bits - 8 << 4) << 8;
            N |= (2 <= v.strategy || v.level < 2 ? 0 : v.level < 6 ? 1 : v.level === 6 ? 2 : 3) << 6, v.strstart !== 0 && (N |= 32), N += 31 - N % 31, v.status = z, Y(v, N), v.strstart !== 0 && (Y(v, e.adler >>> 16), Y(v, 65535 & e.adler)), e.adler = 1;
          }
          if (v.status === 69) if (v.gzhead.extra) {
            for (_ = v.pending; v.gzindex < (65535 & v.gzhead.extra.length) && (v.pending !== v.pending_buf_size || (v.gzhead.hcrc && v.pending > _ && (e.adler = p(e.adler, v.pending_buf, v.pending - _, _)), F(e), _ = v.pending, v.pending !== v.pending_buf_size)); ) X(v, 255 & v.gzhead.extra[v.gzindex]), v.gzindex++;
            v.gzhead.hcrc && v.pending > _ && (e.adler = p(e.adler, v.pending_buf, v.pending - _, _)), v.gzindex === v.gzhead.extra.length && (v.gzindex = 0, v.status = 73);
          } else v.status = 73;
          if (v.status === 73) if (v.gzhead.name) {
            _ = v.pending;
            do {
              if (v.pending === v.pending_buf_size && (v.gzhead.hcrc && v.pending > _ && (e.adler = p(e.adler, v.pending_buf, v.pending - _, _)), F(e), _ = v.pending, v.pending === v.pending_buf_size)) {
                C = 1;
                break;
              }
              C = v.gzindex < v.gzhead.name.length ? 255 & v.gzhead.name.charCodeAt(v.gzindex++) : 0, X(v, C);
            } while (C !== 0);
            v.gzhead.hcrc && v.pending > _ && (e.adler = p(e.adler, v.pending_buf, v.pending - _, _)), C === 0 && (v.gzindex = 0, v.status = 91);
          } else v.status = 91;
          if (v.status === 91) if (v.gzhead.comment) {
            _ = v.pending;
            do {
              if (v.pending === v.pending_buf_size && (v.gzhead.hcrc && v.pending > _ && (e.adler = p(e.adler, v.pending_buf, v.pending - _, _)), F(e), _ = v.pending, v.pending === v.pending_buf_size)) {
                C = 1;
                break;
              }
              C = v.gzindex < v.gzhead.comment.length ? 255 & v.gzhead.comment.charCodeAt(v.gzindex++) : 0, X(v, C);
            } while (C !== 0);
            v.gzhead.hcrc && v.pending > _ && (e.adler = p(e.adler, v.pending_buf, v.pending - _, _)), C === 0 && (v.status = 103);
          } else v.status = 103;
          if (v.status === 103 && (v.gzhead.hcrc ? (v.pending + 2 > v.pending_buf_size && F(e), v.pending + 2 <= v.pending_buf_size && (X(v, 255 & e.adler), X(v, e.adler >> 8 & 255), e.adler = 0, v.status = z)) : v.status = z), v.pending !== 0) {
            if (F(e), e.avail_out === 0) return v.last_flush = -1, l;
          } else if (e.avail_in === 0 && $(B) <= $(D) && B !== b) return rt(e, -5);
          if (v.status === 666 && e.avail_in !== 0) return rt(e, -5);
          if (e.avail_in !== 0 || v.lookahead !== 0 || B !== g && v.status !== 666) {
            var L = v.strategy === 2 ? (function(x, H) {
              for (var K; ; ) {
                if (x.lookahead === 0 && (ct(x), x.lookahead === 0)) {
                  if (H === g) return a;
                  break;
                }
                if (x.match_length = 0, K = n._tr_tally(x, 0, x.window[x.strstart]), x.lookahead--, x.strstart++, K && (T(x, !1), x.strm.avail_out === 0)) return a;
              }
              return x.insert = 0, H === b ? (T(x, !0), x.strm.avail_out === 0 ? et : U) : x.last_lit && (T(x, !1), x.strm.avail_out === 0) ? a : M;
            })(v, B) : v.strategy === 3 ? (function(x, H) {
              for (var K, q, J, ot, it = x.window; ; ) {
                if (x.lookahead <= Z) {
                  if (ct(x), x.lookahead <= Z && H === g) return a;
                  if (x.lookahead === 0) break;
                }
                if (x.match_length = 0, x.lookahead >= O && 0 < x.strstart && (q = it[J = x.strstart - 1]) === it[++J] && q === it[++J] && q === it[++J]) {
                  ot = x.strstart + Z;
                  do
                    ;
                  while (q === it[++J] && q === it[++J] && q === it[++J] && q === it[++J] && q === it[++J] && q === it[++J] && q === it[++J] && q === it[++J] && J < ot);
                  x.match_length = Z - (ot - J), x.match_length > x.lookahead && (x.match_length = x.lookahead);
                }
                if (x.match_length >= O ? (K = n._tr_tally(x, 1, x.match_length - O), x.lookahead -= x.match_length, x.strstart += x.match_length, x.match_length = 0) : (K = n._tr_tally(x, 0, x.window[x.strstart]), x.lookahead--, x.strstart++), K && (T(x, !1), x.strm.avail_out === 0)) return a;
              }
              return x.insert = 0, H === b ? (T(x, !0), x.strm.avail_out === 0 ? et : U) : x.last_lit && (T(x, !1), x.strm.avail_out === 0) ? a : M;
            })(v, B) : r[v.level].func(v, B);
            if (L !== et && L !== U || (v.status = 666), L === a || L === et) return e.avail_out === 0 && (v.last_flush = -1), l;
            if (L === M && (B === 1 ? n._tr_align(v) : B !== 5 && (n._tr_stored_block(v, 0, 0, !1), B === 3 && (tt(v.head), v.lookahead === 0 && (v.strstart = 0, v.block_start = 0, v.insert = 0))), F(e), e.avail_out === 0)) return v.last_flush = -1, l;
          }
          return B !== b ? l : v.wrap <= 0 ? 1 : (v.wrap === 2 ? (X(v, 255 & e.adler), X(v, e.adler >> 8 & 255), X(v, e.adler >> 16 & 255), X(v, e.adler >> 24 & 255), X(v, 255 & e.total_in), X(v, e.total_in >> 8 & 255), X(v, e.total_in >> 16 & 255), X(v, e.total_in >> 24 & 255)) : (Y(v, e.adler >>> 16), Y(v, 65535 & e.adler)), F(e), 0 < v.wrap && (v.wrap = -v.wrap), v.pending !== 0 ? l : 1);
        }, o.deflateEnd = function(e) {
          var B;
          return e && e.state ? (B = e.state.status) !== S && B !== 69 && B !== 73 && B !== 91 && B !== 103 && B !== z && B !== 666 ? rt(e, y) : (e.state = null, B === z ? rt(e, -3) : l) : y;
        }, o.deflateSetDictionary = function(e, B) {
          var D, v, _, C, N, L, x, H, K = B.length;
          if (!e || !e.state || (C = (D = e.state).wrap) === 2 || C === 1 && D.status !== S || D.lookahead) return y;
          for (C === 1 && (e.adler = c(e.adler, B, K, 0)), D.wrap = 0, K >= D.w_size && (C === 0 && (tt(D.head), D.strstart = 0, D.block_start = 0, D.insert = 0), H = new s.Buf8(D.w_size), s.arraySet(H, B, K - D.w_size, D.w_size, 0), B = H, K = D.w_size), N = e.avail_in, L = e.next_in, x = e.input, e.avail_in = K, e.next_in = 0, e.input = B, ct(D); D.lookahead >= O; ) {
            for (v = D.strstart, _ = D.lookahead - (O - 1); D.ins_h = (D.ins_h << D.hash_shift ^ D.window[v + O - 1]) & D.hash_mask, D.prev[v & D.w_mask] = D.head[D.ins_h], D.head[D.ins_h] = v, v++, --_; ) ;
            D.strstart = v, D.lookahead = O - 1, ct(D);
          }
          return D.strstart += D.lookahead, D.block_start = D.strstart, D.insert = D.lookahead, D.lookahead = 0, D.match_length = D.prev_length = O - 1, D.match_available = 0, e.next_in = L, e.input = x, e.avail_in = N, D.wrap = C, l;
        }, o.deflateInfo = "pako deflate (from Nodeca project)";
      }, { "../utils/common": 41, "./adler32": 43, "./crc32": 45, "./messages": 51, "./trees": 52 }], 47: [function(t, d, o) {
        d.exports = function() {
          this.text = 0, this.time = 0, this.xflags = 0, this.os = 0, this.extra = null, this.extra_len = 0, this.name = "", this.comment = "", this.hcrc = 0, this.done = !1;
        };
      }, {}], 48: [function(t, d, o) {
        d.exports = function(r, s) {
          var n, c, p, w, g, b, l, y, h, m, f, k, A, P, I, j, R, W, O, Z, Q, S, z, a, M;
          n = r.state, c = r.next_in, a = r.input, p = c + (r.avail_in - 5), w = r.next_out, M = r.output, g = w - (s - r.avail_out), b = w + (r.avail_out - 257), l = n.dmax, y = n.wsize, h = n.whave, m = n.wnext, f = n.window, k = n.hold, A = n.bits, P = n.lencode, I = n.distcode, j = (1 << n.lenbits) - 1, R = (1 << n.distbits) - 1;
          t: do {
            A < 15 && (k += a[c++] << A, A += 8, k += a[c++] << A, A += 8), W = P[k & j];
            e: for (; ; ) {
              if (k >>>= O = W >>> 24, A -= O, (O = W >>> 16 & 255) === 0) M[w++] = 65535 & W;
              else {
                if (!(16 & O)) {
                  if ((64 & O) == 0) {
                    W = P[(65535 & W) + (k & (1 << O) - 1)];
                    continue e;
                  }
                  if (32 & O) {
                    n.mode = 12;
                    break t;
                  }
                  r.msg = "invalid literal/length code", n.mode = 30;
                  break t;
                }
                Z = 65535 & W, (O &= 15) && (A < O && (k += a[c++] << A, A += 8), Z += k & (1 << O) - 1, k >>>= O, A -= O), A < 15 && (k += a[c++] << A, A += 8, k += a[c++] << A, A += 8), W = I[k & R];
                r: for (; ; ) {
                  if (k >>>= O = W >>> 24, A -= O, !(16 & (O = W >>> 16 & 255))) {
                    if ((64 & O) == 0) {
                      W = I[(65535 & W) + (k & (1 << O) - 1)];
                      continue r;
                    }
                    r.msg = "invalid distance code", n.mode = 30;
                    break t;
                  }
                  if (Q = 65535 & W, A < (O &= 15) && (k += a[c++] << A, (A += 8) < O && (k += a[c++] << A, A += 8)), l < (Q += k & (1 << O) - 1)) {
                    r.msg = "invalid distance too far back", n.mode = 30;
                    break t;
                  }
                  if (k >>>= O, A -= O, (O = w - g) < Q) {
                    if (h < (O = Q - O) && n.sane) {
                      r.msg = "invalid distance too far back", n.mode = 30;
                      break t;
                    }
                    if (z = f, (S = 0) === m) {
                      if (S += y - O, O < Z) {
                        for (Z -= O; M[w++] = f[S++], --O; ) ;
                        S = w - Q, z = M;
                      }
                    } else if (m < O) {
                      if (S += y + m - O, (O -= m) < Z) {
                        for (Z -= O; M[w++] = f[S++], --O; ) ;
                        if (S = 0, m < Z) {
                          for (Z -= O = m; M[w++] = f[S++], --O; ) ;
                          S = w - Q, z = M;
                        }
                      }
                    } else if (S += m - O, O < Z) {
                      for (Z -= O; M[w++] = f[S++], --O; ) ;
                      S = w - Q, z = M;
                    }
                    for (; 2 < Z; ) M[w++] = z[S++], M[w++] = z[S++], M[w++] = z[S++], Z -= 3;
                    Z && (M[w++] = z[S++], 1 < Z && (M[w++] = z[S++]));
                  } else {
                    for (S = w - Q; M[w++] = M[S++], M[w++] = M[S++], M[w++] = M[S++], 2 < (Z -= 3); ) ;
                    Z && (M[w++] = M[S++], 1 < Z && (M[w++] = M[S++]));
                  }
                  break;
                }
              }
              break;
            }
          } while (c < p && w < b);
          c -= Z = A >> 3, k &= (1 << (A -= Z << 3)) - 1, r.next_in = c, r.next_out = w, r.avail_in = c < p ? p - c + 5 : 5 - (c - p), r.avail_out = w < b ? b - w + 257 : 257 - (w - b), n.hold = k, n.bits = A;
        };
      }, {}], 49: [function(t, d, o) {
        var r = t("../utils/common"), s = t("./adler32"), n = t("./crc32"), c = t("./inffast"), p = t("./inftrees"), w = 1, g = 2, b = 0, l = -2, y = 1, h = 852, m = 592;
        function f(S) {
          return (S >>> 24 & 255) + (S >>> 8 & 65280) + ((65280 & S) << 8) + ((255 & S) << 24);
        }
        function k() {
          this.mode = 0, this.last = !1, this.wrap = 0, this.havedict = !1, this.flags = 0, this.dmax = 0, this.check = 0, this.total = 0, this.head = null, this.wbits = 0, this.wsize = 0, this.whave = 0, this.wnext = 0, this.window = null, this.hold = 0, this.bits = 0, this.length = 0, this.offset = 0, this.extra = 0, this.lencode = null, this.distcode = null, this.lenbits = 0, this.distbits = 0, this.ncode = 0, this.nlen = 0, this.ndist = 0, this.have = 0, this.next = null, this.lens = new r.Buf16(320), this.work = new r.Buf16(288), this.lendyn = null, this.distdyn = null, this.sane = 0, this.back = 0, this.was = 0;
        }
        function A(S) {
          var z;
          return S && S.state ? (z = S.state, S.total_in = S.total_out = z.total = 0, S.msg = "", z.wrap && (S.adler = 1 & z.wrap), z.mode = y, z.last = 0, z.havedict = 0, z.dmax = 32768, z.head = null, z.hold = 0, z.bits = 0, z.lencode = z.lendyn = new r.Buf32(h), z.distcode = z.distdyn = new r.Buf32(m), z.sane = 1, z.back = -1, b) : l;
        }
        function P(S) {
          var z;
          return S && S.state ? ((z = S.state).wsize = 0, z.whave = 0, z.wnext = 0, A(S)) : l;
        }
        function I(S, z) {
          var a, M;
          return S && S.state ? (M = S.state, z < 0 ? (a = 0, z = -z) : (a = 1 + (z >> 4), z < 48 && (z &= 15)), z && (z < 8 || 15 < z) ? l : (M.window !== null && M.wbits !== z && (M.window = null), M.wrap = a, M.wbits = z, P(S))) : l;
        }
        function j(S, z) {
          var a, M;
          return S ? (M = new k(), (S.state = M).window = null, (a = I(S, z)) !== b && (S.state = null), a) : l;
        }
        var R, W, O = !0;
        function Z(S) {
          if (O) {
            var z;
            for (R = new r.Buf32(512), W = new r.Buf32(32), z = 0; z < 144; ) S.lens[z++] = 8;
            for (; z < 256; ) S.lens[z++] = 9;
            for (; z < 280; ) S.lens[z++] = 7;
            for (; z < 288; ) S.lens[z++] = 8;
            for (p(w, S.lens, 0, 288, R, 0, S.work, { bits: 9 }), z = 0; z < 32; ) S.lens[z++] = 5;
            p(g, S.lens, 0, 32, W, 0, S.work, { bits: 5 }), O = !1;
          }
          S.lencode = R, S.lenbits = 9, S.distcode = W, S.distbits = 5;
        }
        function Q(S, z, a, M) {
          var et, U = S.state;
          return U.window === null && (U.wsize = 1 << U.wbits, U.wnext = 0, U.whave = 0, U.window = new r.Buf8(U.wsize)), M >= U.wsize ? (r.arraySet(U.window, z, a - U.wsize, U.wsize, 0), U.wnext = 0, U.whave = U.wsize) : (M < (et = U.wsize - U.wnext) && (et = M), r.arraySet(U.window, z, a - M, et, U.wnext), (M -= et) ? (r.arraySet(U.window, z, a - M, M, 0), U.wnext = M, U.whave = U.wsize) : (U.wnext += et, U.wnext === U.wsize && (U.wnext = 0), U.whave < U.wsize && (U.whave += et))), 0;
        }
        o.inflateReset = P, o.inflateReset2 = I, o.inflateResetKeep = A, o.inflateInit = function(S) {
          return j(S, 15);
        }, o.inflateInit2 = j, o.inflate = function(S, z) {
          var a, M, et, U, rt, $, tt, F, T, X, Y, V, ct, ft, nt, st, dt, lt, gt, mt, e, B, D, v, _ = 0, C = new r.Buf8(4), N = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
          if (!S || !S.state || !S.output || !S.input && S.avail_in !== 0) return l;
          (a = S.state).mode === 12 && (a.mode = 13), rt = S.next_out, et = S.output, tt = S.avail_out, U = S.next_in, M = S.input, $ = S.avail_in, F = a.hold, T = a.bits, X = $, Y = tt, B = b;
          t: for (; ; ) switch (a.mode) {
            case y:
              if (a.wrap === 0) {
                a.mode = 13;
                break;
              }
              for (; T < 16; ) {
                if ($ === 0) break t;
                $--, F += M[U++] << T, T += 8;
              }
              if (2 & a.wrap && F === 35615) {
                C[a.check = 0] = 255 & F, C[1] = F >>> 8 & 255, a.check = n(a.check, C, 2, 0), T = F = 0, a.mode = 2;
                break;
              }
              if (a.flags = 0, a.head && (a.head.done = !1), !(1 & a.wrap) || (((255 & F) << 8) + (F >> 8)) % 31) {
                S.msg = "incorrect header check", a.mode = 30;
                break;
              }
              if ((15 & F) != 8) {
                S.msg = "unknown compression method", a.mode = 30;
                break;
              }
              if (T -= 4, e = 8 + (15 & (F >>>= 4)), a.wbits === 0) a.wbits = e;
              else if (e > a.wbits) {
                S.msg = "invalid window size", a.mode = 30;
                break;
              }
              a.dmax = 1 << e, S.adler = a.check = 1, a.mode = 512 & F ? 10 : 12, T = F = 0;
              break;
            case 2:
              for (; T < 16; ) {
                if ($ === 0) break t;
                $--, F += M[U++] << T, T += 8;
              }
              if (a.flags = F, (255 & a.flags) != 8) {
                S.msg = "unknown compression method", a.mode = 30;
                break;
              }
              if (57344 & a.flags) {
                S.msg = "unknown header flags set", a.mode = 30;
                break;
              }
              a.head && (a.head.text = F >> 8 & 1), 512 & a.flags && (C[0] = 255 & F, C[1] = F >>> 8 & 255, a.check = n(a.check, C, 2, 0)), T = F = 0, a.mode = 3;
            case 3:
              for (; T < 32; ) {
                if ($ === 0) break t;
                $--, F += M[U++] << T, T += 8;
              }
              a.head && (a.head.time = F), 512 & a.flags && (C[0] = 255 & F, C[1] = F >>> 8 & 255, C[2] = F >>> 16 & 255, C[3] = F >>> 24 & 255, a.check = n(a.check, C, 4, 0)), T = F = 0, a.mode = 4;
            case 4:
              for (; T < 16; ) {
                if ($ === 0) break t;
                $--, F += M[U++] << T, T += 8;
              }
              a.head && (a.head.xflags = 255 & F, a.head.os = F >> 8), 512 & a.flags && (C[0] = 255 & F, C[1] = F >>> 8 & 255, a.check = n(a.check, C, 2, 0)), T = F = 0, a.mode = 5;
            case 5:
              if (1024 & a.flags) {
                for (; T < 16; ) {
                  if ($ === 0) break t;
                  $--, F += M[U++] << T, T += 8;
                }
                a.length = F, a.head && (a.head.extra_len = F), 512 & a.flags && (C[0] = 255 & F, C[1] = F >>> 8 & 255, a.check = n(a.check, C, 2, 0)), T = F = 0;
              } else a.head && (a.head.extra = null);
              a.mode = 6;
            case 6:
              if (1024 & a.flags && ($ < (V = a.length) && (V = $), V && (a.head && (e = a.head.extra_len - a.length, a.head.extra || (a.head.extra = new Array(a.head.extra_len)), r.arraySet(a.head.extra, M, U, V, e)), 512 & a.flags && (a.check = n(a.check, M, V, U)), $ -= V, U += V, a.length -= V), a.length)) break t;
              a.length = 0, a.mode = 7;
            case 7:
              if (2048 & a.flags) {
                if ($ === 0) break t;
                for (V = 0; e = M[U + V++], a.head && e && a.length < 65536 && (a.head.name += String.fromCharCode(e)), e && V < $; ) ;
                if (512 & a.flags && (a.check = n(a.check, M, V, U)), $ -= V, U += V, e) break t;
              } else a.head && (a.head.name = null);
              a.length = 0, a.mode = 8;
            case 8:
              if (4096 & a.flags) {
                if ($ === 0) break t;
                for (V = 0; e = M[U + V++], a.head && e && a.length < 65536 && (a.head.comment += String.fromCharCode(e)), e && V < $; ) ;
                if (512 & a.flags && (a.check = n(a.check, M, V, U)), $ -= V, U += V, e) break t;
              } else a.head && (a.head.comment = null);
              a.mode = 9;
            case 9:
              if (512 & a.flags) {
                for (; T < 16; ) {
                  if ($ === 0) break t;
                  $--, F += M[U++] << T, T += 8;
                }
                if (F !== (65535 & a.check)) {
                  S.msg = "header crc mismatch", a.mode = 30;
                  break;
                }
                T = F = 0;
              }
              a.head && (a.head.hcrc = a.flags >> 9 & 1, a.head.done = !0), S.adler = a.check = 0, a.mode = 12;
              break;
            case 10:
              for (; T < 32; ) {
                if ($ === 0) break t;
                $--, F += M[U++] << T, T += 8;
              }
              S.adler = a.check = f(F), T = F = 0, a.mode = 11;
            case 11:
              if (a.havedict === 0) return S.next_out = rt, S.avail_out = tt, S.next_in = U, S.avail_in = $, a.hold = F, a.bits = T, 2;
              S.adler = a.check = 1, a.mode = 12;
            case 12:
              if (z === 5 || z === 6) break t;
            case 13:
              if (a.last) {
                F >>>= 7 & T, T -= 7 & T, a.mode = 27;
                break;
              }
              for (; T < 3; ) {
                if ($ === 0) break t;
                $--, F += M[U++] << T, T += 8;
              }
              switch (a.last = 1 & F, T -= 1, 3 & (F >>>= 1)) {
                case 0:
                  a.mode = 14;
                  break;
                case 1:
                  if (Z(a), a.mode = 20, z !== 6) break;
                  F >>>= 2, T -= 2;
                  break t;
                case 2:
                  a.mode = 17;
                  break;
                case 3:
                  S.msg = "invalid block type", a.mode = 30;
              }
              F >>>= 2, T -= 2;
              break;
            case 14:
              for (F >>>= 7 & T, T -= 7 & T; T < 32; ) {
                if ($ === 0) break t;
                $--, F += M[U++] << T, T += 8;
              }
              if ((65535 & F) != (F >>> 16 ^ 65535)) {
                S.msg = "invalid stored block lengths", a.mode = 30;
                break;
              }
              if (a.length = 65535 & F, T = F = 0, a.mode = 15, z === 6) break t;
            case 15:
              a.mode = 16;
            case 16:
              if (V = a.length) {
                if ($ < V && (V = $), tt < V && (V = tt), V === 0) break t;
                r.arraySet(et, M, U, V, rt), $ -= V, U += V, tt -= V, rt += V, a.length -= V;
                break;
              }
              a.mode = 12;
              break;
            case 17:
              for (; T < 14; ) {
                if ($ === 0) break t;
                $--, F += M[U++] << T, T += 8;
              }
              if (a.nlen = 257 + (31 & F), F >>>= 5, T -= 5, a.ndist = 1 + (31 & F), F >>>= 5, T -= 5, a.ncode = 4 + (15 & F), F >>>= 4, T -= 4, 286 < a.nlen || 30 < a.ndist) {
                S.msg = "too many length or distance symbols", a.mode = 30;
                break;
              }
              a.have = 0, a.mode = 18;
            case 18:
              for (; a.have < a.ncode; ) {
                for (; T < 3; ) {
                  if ($ === 0) break t;
                  $--, F += M[U++] << T, T += 8;
                }
                a.lens[N[a.have++]] = 7 & F, F >>>= 3, T -= 3;
              }
              for (; a.have < 19; ) a.lens[N[a.have++]] = 0;
              if (a.lencode = a.lendyn, a.lenbits = 7, D = { bits: a.lenbits }, B = p(0, a.lens, 0, 19, a.lencode, 0, a.work, D), a.lenbits = D.bits, B) {
                S.msg = "invalid code lengths set", a.mode = 30;
                break;
              }
              a.have = 0, a.mode = 19;
            case 19:
              for (; a.have < a.nlen + a.ndist; ) {
                for (; st = (_ = a.lencode[F & (1 << a.lenbits) - 1]) >>> 16 & 255, dt = 65535 & _, !((nt = _ >>> 24) <= T); ) {
                  if ($ === 0) break t;
                  $--, F += M[U++] << T, T += 8;
                }
                if (dt < 16) F >>>= nt, T -= nt, a.lens[a.have++] = dt;
                else {
                  if (dt === 16) {
                    for (v = nt + 2; T < v; ) {
                      if ($ === 0) break t;
                      $--, F += M[U++] << T, T += 8;
                    }
                    if (F >>>= nt, T -= nt, a.have === 0) {
                      S.msg = "invalid bit length repeat", a.mode = 30;
                      break;
                    }
                    e = a.lens[a.have - 1], V = 3 + (3 & F), F >>>= 2, T -= 2;
                  } else if (dt === 17) {
                    for (v = nt + 3; T < v; ) {
                      if ($ === 0) break t;
                      $--, F += M[U++] << T, T += 8;
                    }
                    T -= nt, e = 0, V = 3 + (7 & (F >>>= nt)), F >>>= 3, T -= 3;
                  } else {
                    for (v = nt + 7; T < v; ) {
                      if ($ === 0) break t;
                      $--, F += M[U++] << T, T += 8;
                    }
                    T -= nt, e = 0, V = 11 + (127 & (F >>>= nt)), F >>>= 7, T -= 7;
                  }
                  if (a.have + V > a.nlen + a.ndist) {
                    S.msg = "invalid bit length repeat", a.mode = 30;
                    break;
                  }
                  for (; V--; ) a.lens[a.have++] = e;
                }
              }
              if (a.mode === 30) break;
              if (a.lens[256] === 0) {
                S.msg = "invalid code -- missing end-of-block", a.mode = 30;
                break;
              }
              if (a.lenbits = 9, D = { bits: a.lenbits }, B = p(w, a.lens, 0, a.nlen, a.lencode, 0, a.work, D), a.lenbits = D.bits, B) {
                S.msg = "invalid literal/lengths set", a.mode = 30;
                break;
              }
              if (a.distbits = 6, a.distcode = a.distdyn, D = { bits: a.distbits }, B = p(g, a.lens, a.nlen, a.ndist, a.distcode, 0, a.work, D), a.distbits = D.bits, B) {
                S.msg = "invalid distances set", a.mode = 30;
                break;
              }
              if (a.mode = 20, z === 6) break t;
            case 20:
              a.mode = 21;
            case 21:
              if (6 <= $ && 258 <= tt) {
                S.next_out = rt, S.avail_out = tt, S.next_in = U, S.avail_in = $, a.hold = F, a.bits = T, c(S, Y), rt = S.next_out, et = S.output, tt = S.avail_out, U = S.next_in, M = S.input, $ = S.avail_in, F = a.hold, T = a.bits, a.mode === 12 && (a.back = -1);
                break;
              }
              for (a.back = 0; st = (_ = a.lencode[F & (1 << a.lenbits) - 1]) >>> 16 & 255, dt = 65535 & _, !((nt = _ >>> 24) <= T); ) {
                if ($ === 0) break t;
                $--, F += M[U++] << T, T += 8;
              }
              if (st && (240 & st) == 0) {
                for (lt = nt, gt = st, mt = dt; st = (_ = a.lencode[mt + ((F & (1 << lt + gt) - 1) >> lt)]) >>> 16 & 255, dt = 65535 & _, !(lt + (nt = _ >>> 24) <= T); ) {
                  if ($ === 0) break t;
                  $--, F += M[U++] << T, T += 8;
                }
                F >>>= lt, T -= lt, a.back += lt;
              }
              if (F >>>= nt, T -= nt, a.back += nt, a.length = dt, st === 0) {
                a.mode = 26;
                break;
              }
              if (32 & st) {
                a.back = -1, a.mode = 12;
                break;
              }
              if (64 & st) {
                S.msg = "invalid literal/length code", a.mode = 30;
                break;
              }
              a.extra = 15 & st, a.mode = 22;
            case 22:
              if (a.extra) {
                for (v = a.extra; T < v; ) {
                  if ($ === 0) break t;
                  $--, F += M[U++] << T, T += 8;
                }
                a.length += F & (1 << a.extra) - 1, F >>>= a.extra, T -= a.extra, a.back += a.extra;
              }
              a.was = a.length, a.mode = 23;
            case 23:
              for (; st = (_ = a.distcode[F & (1 << a.distbits) - 1]) >>> 16 & 255, dt = 65535 & _, !((nt = _ >>> 24) <= T); ) {
                if ($ === 0) break t;
                $--, F += M[U++] << T, T += 8;
              }
              if ((240 & st) == 0) {
                for (lt = nt, gt = st, mt = dt; st = (_ = a.distcode[mt + ((F & (1 << lt + gt) - 1) >> lt)]) >>> 16 & 255, dt = 65535 & _, !(lt + (nt = _ >>> 24) <= T); ) {
                  if ($ === 0) break t;
                  $--, F += M[U++] << T, T += 8;
                }
                F >>>= lt, T -= lt, a.back += lt;
              }
              if (F >>>= nt, T -= nt, a.back += nt, 64 & st) {
                S.msg = "invalid distance code", a.mode = 30;
                break;
              }
              a.offset = dt, a.extra = 15 & st, a.mode = 24;
            case 24:
              if (a.extra) {
                for (v = a.extra; T < v; ) {
                  if ($ === 0) break t;
                  $--, F += M[U++] << T, T += 8;
                }
                a.offset += F & (1 << a.extra) - 1, F >>>= a.extra, T -= a.extra, a.back += a.extra;
              }
              if (a.offset > a.dmax) {
                S.msg = "invalid distance too far back", a.mode = 30;
                break;
              }
              a.mode = 25;
            case 25:
              if (tt === 0) break t;
              if (V = Y - tt, a.offset > V) {
                if ((V = a.offset - V) > a.whave && a.sane) {
                  S.msg = "invalid distance too far back", a.mode = 30;
                  break;
                }
                ct = V > a.wnext ? (V -= a.wnext, a.wsize - V) : a.wnext - V, V > a.length && (V = a.length), ft = a.window;
              } else ft = et, ct = rt - a.offset, V = a.length;
              for (tt < V && (V = tt), tt -= V, a.length -= V; et[rt++] = ft[ct++], --V; ) ;
              a.length === 0 && (a.mode = 21);
              break;
            case 26:
              if (tt === 0) break t;
              et[rt++] = a.length, tt--, a.mode = 21;
              break;
            case 27:
              if (a.wrap) {
                for (; T < 32; ) {
                  if ($ === 0) break t;
                  $--, F |= M[U++] << T, T += 8;
                }
                if (Y -= tt, S.total_out += Y, a.total += Y, Y && (S.adler = a.check = a.flags ? n(a.check, et, Y, rt - Y) : s(a.check, et, Y, rt - Y)), Y = tt, (a.flags ? F : f(F)) !== a.check) {
                  S.msg = "incorrect data check", a.mode = 30;
                  break;
                }
                T = F = 0;
              }
              a.mode = 28;
            case 28:
              if (a.wrap && a.flags) {
                for (; T < 32; ) {
                  if ($ === 0) break t;
                  $--, F += M[U++] << T, T += 8;
                }
                if (F !== (4294967295 & a.total)) {
                  S.msg = "incorrect length check", a.mode = 30;
                  break;
                }
                T = F = 0;
              }
              a.mode = 29;
            case 29:
              B = 1;
              break t;
            case 30:
              B = -3;
              break t;
            case 31:
              return -4;
            default:
              return l;
          }
          return S.next_out = rt, S.avail_out = tt, S.next_in = U, S.avail_in = $, a.hold = F, a.bits = T, (a.wsize || Y !== S.avail_out && a.mode < 30 && (a.mode < 27 || z !== 4)) && Q(S, S.output, S.next_out, Y - S.avail_out) ? (a.mode = 31, -4) : (X -= S.avail_in, Y -= S.avail_out, S.total_in += X, S.total_out += Y, a.total += Y, a.wrap && Y && (S.adler = a.check = a.flags ? n(a.check, et, Y, S.next_out - Y) : s(a.check, et, Y, S.next_out - Y)), S.data_type = a.bits + (a.last ? 64 : 0) + (a.mode === 12 ? 128 : 0) + (a.mode === 20 || a.mode === 15 ? 256 : 0), (X == 0 && Y === 0 || z === 4) && B === b && (B = -5), B);
        }, o.inflateEnd = function(S) {
          if (!S || !S.state) return l;
          var z = S.state;
          return z.window && (z.window = null), S.state = null, b;
        }, o.inflateGetHeader = function(S, z) {
          var a;
          return S && S.state ? (2 & (a = S.state).wrap) == 0 ? l : ((a.head = z).done = !1, b) : l;
        }, o.inflateSetDictionary = function(S, z) {
          var a, M = z.length;
          return S && S.state ? (a = S.state).wrap !== 0 && a.mode !== 11 ? l : a.mode === 11 && s(1, z, M, 0) !== a.check ? -3 : Q(S, z, M, M) ? (a.mode = 31, -4) : (a.havedict = 1, b) : l;
        }, o.inflateInfo = "pako inflate (from Nodeca project)";
      }, { "../utils/common": 41, "./adler32": 43, "./crc32": 45, "./inffast": 48, "./inftrees": 50 }], 50: [function(t, d, o) {
        var r = t("../utils/common"), s = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258, 0, 0], n = [16, 16, 16, 16, 16, 16, 16, 16, 17, 17, 17, 17, 18, 18, 18, 18, 19, 19, 19, 19, 20, 20, 20, 20, 21, 21, 21, 21, 16, 72, 78], c = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577, 0, 0], p = [16, 16, 16, 16, 17, 17, 18, 18, 19, 19, 20, 20, 21, 21, 22, 22, 23, 23, 24, 24, 25, 25, 26, 26, 27, 27, 28, 28, 29, 29, 64, 64];
        d.exports = function(w, g, b, l, y, h, m, f) {
          var k, A, P, I, j, R, W, O, Z, Q = f.bits, S = 0, z = 0, a = 0, M = 0, et = 0, U = 0, rt = 0, $ = 0, tt = 0, F = 0, T = null, X = 0, Y = new r.Buf16(16), V = new r.Buf16(16), ct = null, ft = 0;
          for (S = 0; S <= 15; S++) Y[S] = 0;
          for (z = 0; z < l; z++) Y[g[b + z]]++;
          for (et = Q, M = 15; 1 <= M && Y[M] === 0; M--) ;
          if (M < et && (et = M), M === 0) return y[h++] = 20971520, y[h++] = 20971520, f.bits = 1, 0;
          for (a = 1; a < M && Y[a] === 0; a++) ;
          for (et < a && (et = a), S = $ = 1; S <= 15; S++) if ($ <<= 1, ($ -= Y[S]) < 0) return -1;
          if (0 < $ && (w === 0 || M !== 1)) return -1;
          for (V[1] = 0, S = 1; S < 15; S++) V[S + 1] = V[S] + Y[S];
          for (z = 0; z < l; z++) g[b + z] !== 0 && (m[V[g[b + z]]++] = z);
          if (R = w === 0 ? (T = ct = m, 19) : w === 1 ? (T = s, X -= 257, ct = n, ft -= 257, 256) : (T = c, ct = p, -1), S = a, j = h, rt = z = F = 0, P = -1, I = (tt = 1 << (U = et)) - 1, w === 1 && 852 < tt || w === 2 && 592 < tt) return 1;
          for (; ; ) {
            for (W = S - rt, Z = m[z] < R ? (O = 0, m[z]) : m[z] > R ? (O = ct[ft + m[z]], T[X + m[z]]) : (O = 96, 0), k = 1 << S - rt, a = A = 1 << U; y[j + (F >> rt) + (A -= k)] = W << 24 | O << 16 | Z | 0, A !== 0; ) ;
            for (k = 1 << S - 1; F & k; ) k >>= 1;
            if (k !== 0 ? (F &= k - 1, F += k) : F = 0, z++, --Y[S] == 0) {
              if (S === M) break;
              S = g[b + m[z]];
            }
            if (et < S && (F & I) !== P) {
              for (rt === 0 && (rt = et), j += a, $ = 1 << (U = S - rt); U + rt < M && !(($ -= Y[U + rt]) <= 0); ) U++, $ <<= 1;
              if (tt += 1 << U, w === 1 && 852 < tt || w === 2 && 592 < tt) return 1;
              y[P = F & I] = et << 24 | U << 16 | j - h | 0;
            }
          }
          return F !== 0 && (y[j + F] = S - rt << 24 | 64 << 16 | 0), f.bits = et, 0;
        };
      }, { "../utils/common": 41 }], 51: [function(t, d, o) {
        d.exports = { 2: "need dictionary", 1: "stream end", 0: "", "-1": "file error", "-2": "stream error", "-3": "data error", "-4": "insufficient memory", "-5": "buffer error", "-6": "incompatible version" };
      }, {}], 52: [function(t, d, o) {
        var r = t("../utils/common"), s = 0, n = 1;
        function c(_) {
          for (var C = _.length; 0 <= --C; ) _[C] = 0;
        }
        var p = 0, w = 29, g = 256, b = g + 1 + w, l = 30, y = 19, h = 2 * b + 1, m = 15, f = 16, k = 7, A = 256, P = 16, I = 17, j = 18, R = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0], W = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13], O = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 7], Z = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15], Q = new Array(2 * (b + 2));
        c(Q);
        var S = new Array(2 * l);
        c(S);
        var z = new Array(512);
        c(z);
        var a = new Array(256);
        c(a);
        var M = new Array(w);
        c(M);
        var et, U, rt, $ = new Array(l);
        function tt(_, C, N, L, x) {
          this.static_tree = _, this.extra_bits = C, this.extra_base = N, this.elems = L, this.max_length = x, this.has_stree = _ && _.length;
        }
        function F(_, C) {
          this.dyn_tree = _, this.max_code = 0, this.stat_desc = C;
        }
        function T(_) {
          return _ < 256 ? z[_] : z[256 + (_ >>> 7)];
        }
        function X(_, C) {
          _.pending_buf[_.pending++] = 255 & C, _.pending_buf[_.pending++] = C >>> 8 & 255;
        }
        function Y(_, C, N) {
          _.bi_valid > f - N ? (_.bi_buf |= C << _.bi_valid & 65535, X(_, _.bi_buf), _.bi_buf = C >> f - _.bi_valid, _.bi_valid += N - f) : (_.bi_buf |= C << _.bi_valid & 65535, _.bi_valid += N);
        }
        function V(_, C, N) {
          Y(_, N[2 * C], N[2 * C + 1]);
        }
        function ct(_, C) {
          for (var N = 0; N |= 1 & _, _ >>>= 1, N <<= 1, 0 < --C; ) ;
          return N >>> 1;
        }
        function ft(_, C, N) {
          var L, x, H = new Array(m + 1), K = 0;
          for (L = 1; L <= m; L++) H[L] = K = K + N[L - 1] << 1;
          for (x = 0; x <= C; x++) {
            var q = _[2 * x + 1];
            q !== 0 && (_[2 * x] = ct(H[q]++, q));
          }
        }
        function nt(_) {
          var C;
          for (C = 0; C < b; C++) _.dyn_ltree[2 * C] = 0;
          for (C = 0; C < l; C++) _.dyn_dtree[2 * C] = 0;
          for (C = 0; C < y; C++) _.bl_tree[2 * C] = 0;
          _.dyn_ltree[2 * A] = 1, _.opt_len = _.static_len = 0, _.last_lit = _.matches = 0;
        }
        function st(_) {
          8 < _.bi_valid ? X(_, _.bi_buf) : 0 < _.bi_valid && (_.pending_buf[_.pending++] = _.bi_buf), _.bi_buf = 0, _.bi_valid = 0;
        }
        function dt(_, C, N, L) {
          var x = 2 * C, H = 2 * N;
          return _[x] < _[H] || _[x] === _[H] && L[C] <= L[N];
        }
        function lt(_, C, N) {
          for (var L = _.heap[N], x = N << 1; x <= _.heap_len && (x < _.heap_len && dt(C, _.heap[x + 1], _.heap[x], _.depth) && x++, !dt(C, L, _.heap[x], _.depth)); ) _.heap[N] = _.heap[x], N = x, x <<= 1;
          _.heap[N] = L;
        }
        function gt(_, C, N) {
          var L, x, H, K, q = 0;
          if (_.last_lit !== 0) for (; L = _.pending_buf[_.d_buf + 2 * q] << 8 | _.pending_buf[_.d_buf + 2 * q + 1], x = _.pending_buf[_.l_buf + q], q++, L === 0 ? V(_, x, C) : (V(_, (H = a[x]) + g + 1, C), (K = R[H]) !== 0 && Y(_, x -= M[H], K), V(_, H = T(--L), N), (K = W[H]) !== 0 && Y(_, L -= $[H], K)), q < _.last_lit; ) ;
          V(_, A, C);
        }
        function mt(_, C) {
          var N, L, x, H = C.dyn_tree, K = C.stat_desc.static_tree, q = C.stat_desc.has_stree, J = C.stat_desc.elems, ot = -1;
          for (_.heap_len = 0, _.heap_max = h, N = 0; N < J; N++) H[2 * N] !== 0 ? (_.heap[++_.heap_len] = ot = N, _.depth[N] = 0) : H[2 * N + 1] = 0;
          for (; _.heap_len < 2; ) H[2 * (x = _.heap[++_.heap_len] = ot < 2 ? ++ot : 0)] = 1, _.depth[x] = 0, _.opt_len--, q && (_.static_len -= K[2 * x + 1]);
          for (C.max_code = ot, N = _.heap_len >> 1; 1 <= N; N--) lt(_, H, N);
          for (x = J; N = _.heap[1], _.heap[1] = _.heap[_.heap_len--], lt(_, H, 1), L = _.heap[1], _.heap[--_.heap_max] = N, _.heap[--_.heap_max] = L, H[2 * x] = H[2 * N] + H[2 * L], _.depth[x] = (_.depth[N] >= _.depth[L] ? _.depth[N] : _.depth[L]) + 1, H[2 * N + 1] = H[2 * L + 1] = x, _.heap[1] = x++, lt(_, H, 1), 2 <= _.heap_len; ) ;
          _.heap[--_.heap_max] = _.heap[1], (function(it, pt) {
            var bt, _t, vt, ut, St, Pt, wt = pt.dyn_tree, Ft = pt.max_code, Bt = pt.stat_desc.static_tree, Mt = pt.stat_desc.has_stree, jt = pt.stat_desc.extra_bits, Dt = pt.stat_desc.extra_base, kt = pt.stat_desc.max_length, Et = 0;
            for (ut = 0; ut <= m; ut++) it.bl_count[ut] = 0;
            for (wt[2 * it.heap[it.heap_max] + 1] = 0, bt = it.heap_max + 1; bt < h; bt++) kt < (ut = wt[2 * wt[2 * (_t = it.heap[bt]) + 1] + 1] + 1) && (ut = kt, Et++), wt[2 * _t + 1] = ut, Ft < _t || (it.bl_count[ut]++, St = 0, Dt <= _t && (St = jt[_t - Dt]), Pt = wt[2 * _t], it.opt_len += Pt * (ut + St), Mt && (it.static_len += Pt * (Bt[2 * _t + 1] + St)));
            if (Et !== 0) {
              do {
                for (ut = kt - 1; it.bl_count[ut] === 0; ) ut--;
                it.bl_count[ut]--, it.bl_count[ut + 1] += 2, it.bl_count[kt]--, Et -= 2;
              } while (0 < Et);
              for (ut = kt; ut !== 0; ut--) for (_t = it.bl_count[ut]; _t !== 0; ) Ft < (vt = it.heap[--bt]) || (wt[2 * vt + 1] !== ut && (it.opt_len += (ut - wt[2 * vt + 1]) * wt[2 * vt], wt[2 * vt + 1] = ut), _t--);
            }
          })(_, C), ft(H, ot, _.bl_count);
        }
        function e(_, C, N) {
          var L, x, H = -1, K = C[1], q = 0, J = 7, ot = 4;
          for (K === 0 && (J = 138, ot = 3), C[2 * (N + 1) + 1] = 65535, L = 0; L <= N; L++) x = K, K = C[2 * (L + 1) + 1], ++q < J && x === K || (q < ot ? _.bl_tree[2 * x] += q : x !== 0 ? (x !== H && _.bl_tree[2 * x]++, _.bl_tree[2 * P]++) : q <= 10 ? _.bl_tree[2 * I]++ : _.bl_tree[2 * j]++, H = x, ot = (q = 0) === K ? (J = 138, 3) : x === K ? (J = 6, 3) : (J = 7, 4));
        }
        function B(_, C, N) {
          var L, x, H = -1, K = C[1], q = 0, J = 7, ot = 4;
          for (K === 0 && (J = 138, ot = 3), L = 0; L <= N; L++) if (x = K, K = C[2 * (L + 1) + 1], !(++q < J && x === K)) {
            if (q < ot) for (; V(_, x, _.bl_tree), --q != 0; ) ;
            else x !== 0 ? (x !== H && (V(_, x, _.bl_tree), q--), V(_, P, _.bl_tree), Y(_, q - 3, 2)) : q <= 10 ? (V(_, I, _.bl_tree), Y(_, q - 3, 3)) : (V(_, j, _.bl_tree), Y(_, q - 11, 7));
            H = x, ot = (q = 0) === K ? (J = 138, 3) : x === K ? (J = 6, 3) : (J = 7, 4);
          }
        }
        c($);
        var D = !1;
        function v(_, C, N, L) {
          Y(_, (p << 1) + (L ? 1 : 0), 3), (function(x, H, K, q) {
            st(x), X(x, K), X(x, ~K), r.arraySet(x.pending_buf, x.window, H, K, x.pending), x.pending += K;
          })(_, C, N);
        }
        o._tr_init = function(_) {
          D || ((function() {
            var C, N, L, x, H, K = new Array(m + 1);
            for (x = L = 0; x < w - 1; x++) for (M[x] = L, C = 0; C < 1 << R[x]; C++) a[L++] = x;
            for (a[L - 1] = x, x = H = 0; x < 16; x++) for ($[x] = H, C = 0; C < 1 << W[x]; C++) z[H++] = x;
            for (H >>= 7; x < l; x++) for ($[x] = H << 7, C = 0; C < 1 << W[x] - 7; C++) z[256 + H++] = x;
            for (N = 0; N <= m; N++) K[N] = 0;
            for (C = 0; C <= 143; ) Q[2 * C + 1] = 8, C++, K[8]++;
            for (; C <= 255; ) Q[2 * C + 1] = 9, C++, K[9]++;
            for (; C <= 279; ) Q[2 * C + 1] = 7, C++, K[7]++;
            for (; C <= 287; ) Q[2 * C + 1] = 8, C++, K[8]++;
            for (ft(Q, b + 1, K), C = 0; C < l; C++) S[2 * C + 1] = 5, S[2 * C] = ct(C, 5);
            et = new tt(Q, R, g + 1, b, m), U = new tt(S, W, 0, l, m), rt = new tt(new Array(0), O, 0, y, k);
          })(), D = !0), _.l_desc = new F(_.dyn_ltree, et), _.d_desc = new F(_.dyn_dtree, U), _.bl_desc = new F(_.bl_tree, rt), _.bi_buf = 0, _.bi_valid = 0, nt(_);
        }, o._tr_stored_block = v, o._tr_flush_block = function(_, C, N, L) {
          var x, H, K = 0;
          0 < _.level ? (_.strm.data_type === 2 && (_.strm.data_type = (function(q) {
            var J, ot = 4093624447;
            for (J = 0; J <= 31; J++, ot >>>= 1) if (1 & ot && q.dyn_ltree[2 * J] !== 0) return s;
            if (q.dyn_ltree[18] !== 0 || q.dyn_ltree[20] !== 0 || q.dyn_ltree[26] !== 0) return n;
            for (J = 32; J < g; J++) if (q.dyn_ltree[2 * J] !== 0) return n;
            return s;
          })(_)), mt(_, _.l_desc), mt(_, _.d_desc), K = (function(q) {
            var J;
            for (e(q, q.dyn_ltree, q.l_desc.max_code), e(q, q.dyn_dtree, q.d_desc.max_code), mt(q, q.bl_desc), J = y - 1; 3 <= J && q.bl_tree[2 * Z[J] + 1] === 0; J--) ;
            return q.opt_len += 3 * (J + 1) + 5 + 5 + 4, J;
          })(_), x = _.opt_len + 3 + 7 >>> 3, (H = _.static_len + 3 + 7 >>> 3) <= x && (x = H)) : x = H = N + 5, N + 4 <= x && C !== -1 ? v(_, C, N, L) : _.strategy === 4 || H === x ? (Y(_, 2 + (L ? 1 : 0), 3), gt(_, Q, S)) : (Y(_, 4 + (L ? 1 : 0), 3), (function(q, J, ot, it) {
            var pt;
            for (Y(q, J - 257, 5), Y(q, ot - 1, 5), Y(q, it - 4, 4), pt = 0; pt < it; pt++) Y(q, q.bl_tree[2 * Z[pt] + 1], 3);
            B(q, q.dyn_ltree, J - 1), B(q, q.dyn_dtree, ot - 1);
          })(_, _.l_desc.max_code + 1, _.d_desc.max_code + 1, K + 1), gt(_, _.dyn_ltree, _.dyn_dtree)), nt(_), L && st(_);
        }, o._tr_tally = function(_, C, N) {
          return _.pending_buf[_.d_buf + 2 * _.last_lit] = C >>> 8 & 255, _.pending_buf[_.d_buf + 2 * _.last_lit + 1] = 255 & C, _.pending_buf[_.l_buf + _.last_lit] = 255 & N, _.last_lit++, C === 0 ? _.dyn_ltree[2 * N]++ : (_.matches++, C--, _.dyn_ltree[2 * (a[N] + g + 1)]++, _.dyn_dtree[2 * T(C)]++), _.last_lit === _.lit_bufsize - 1;
        }, o._tr_align = function(_) {
          Y(_, 2, 3), V(_, A, Q), (function(C) {
            C.bi_valid === 16 ? (X(C, C.bi_buf), C.bi_buf = 0, C.bi_valid = 0) : 8 <= C.bi_valid && (C.pending_buf[C.pending++] = 255 & C.bi_buf, C.bi_buf >>= 8, C.bi_valid -= 8);
          })(_);
        };
      }, { "../utils/common": 41 }], 53: [function(t, d, o) {
        d.exports = function() {
          this.input = null, this.next_in = 0, this.avail_in = 0, this.total_in = 0, this.output = null, this.next_out = 0, this.avail_out = 0, this.total_out = 0, this.msg = "", this.state = null, this.data_type = 2, this.adler = 0;
        };
      }, {}], 54: [function(t, d, o) {
        (function(r) {
          (function(s, n) {
            if (!s.setImmediate) {
              var c, p, w, g, b = 1, l = {}, y = !1, h = s.document, m = Object.getPrototypeOf && Object.getPrototypeOf(s);
              m = m && m.setTimeout ? m : s, c = {}.toString.call(s.process) === "[object process]" ? function(P) {
                process.nextTick(function() {
                  k(P);
                });
              } : (function() {
                if (s.postMessage && !s.importScripts) {
                  var P = !0, I = s.onmessage;
                  return s.onmessage = function() {
                    P = !1;
                  }, s.postMessage("", "*"), s.onmessage = I, P;
                }
              })() ? (g = "setImmediate$" + Math.random() + "$", s.addEventListener ? s.addEventListener("message", A, !1) : s.attachEvent("onmessage", A), function(P) {
                s.postMessage(g + P, "*");
              }) : s.MessageChannel ? ((w = new MessageChannel()).port1.onmessage = function(P) {
                k(P.data);
              }, function(P) {
                w.port2.postMessage(P);
              }) : h && "onreadystatechange" in h.createElement("script") ? (p = h.documentElement, function(P) {
                var I = h.createElement("script");
                I.onreadystatechange = function() {
                  k(P), I.onreadystatechange = null, p.removeChild(I), I = null;
                }, p.appendChild(I);
              }) : function(P) {
                setTimeout(k, 0, P);
              }, m.setImmediate = function(P) {
                typeof P != "function" && (P = new Function("" + P));
                for (var I = new Array(arguments.length - 1), j = 0; j < I.length; j++) I[j] = arguments[j + 1];
                var R = { callback: P, args: I };
                return l[b] = R, c(b), b++;
              }, m.clearImmediate = f;
            }
            function f(P) {
              delete l[P];
            }
            function k(P) {
              if (y) setTimeout(k, 0, P);
              else {
                var I = l[P];
                if (I) {
                  y = !0;
                  try {
                    (function(j) {
                      var R = j.callback, W = j.args;
                      switch (W.length) {
                        case 0:
                          R();
                          break;
                        case 1:
                          R(W[0]);
                          break;
                        case 2:
                          R(W[0], W[1]);
                          break;
                        case 3:
                          R(W[0], W[1], W[2]);
                          break;
                        default:
                          R.apply(n, W);
                      }
                    })(I);
                  } finally {
                    f(P), y = !1;
                  }
                }
              }
            }
            function A(P) {
              P.source === s && typeof P.data == "string" && P.data.indexOf(g) === 0 && k(+P.data.slice(g.length));
            }
          })(typeof self > "u" ? r === void 0 ? this : r : self);
        }).call(this, typeof At < "u" ? At : typeof self < "u" ? self : typeof window < "u" ? window : {});
      }, {}] }, {}, [10])(10);
    });
  })(xt)), xt.exports;
}
var $t = Wt();
const Tt = /* @__PURE__ */ Ut($t), Ht = "/api/user";
let Rt = async () => null;
const Zt = {
  // the new session id we need for all calls
  sessionId: "",
  // Now accepts an async provider
  setTokenProvider(u) {
    Rt = u;
  },
  // Centralized fetch wrapper
  async fetchWithAuth(u, i = {}) {
    const t = await Rt(), d = i.headers || {};
    if (t)
      d.Authorization = `Bearer ${t}`;
    else
      throw console.error("[MediMuseAPI] CRITICAL: No token provided by Keycloak!"), new Error("Missing Auth Token");
    const o = {
      ...i,
      headers: d,
      credentials: "include"
      // Allow session cookies to pass through
    }, r = await fetch(`${Ht}${u}`, o);
    if (r.status === 401 || r.status === 403)
      throw console.error(`[MediMuseAPI] Server rejected token for ${u}. Status: ${r.status}`), new Error(`Unauthorized access to ${u}`);
    return r;
  },
  // --- 1. CORE SESSION & UPLOAD --- //
  async newSession() {
    const u = await this.fetchWithAuth(`/session/${this.sessionId}/newSession`, { method: "GET" });
    if (!u.ok) throw new Error(`HTTP error ${u.status}`);
    return u;
  },
  async createSession() {
    const u = await this.fetchWithAuth("/createSession", { method: "GET" });
    if (!u.ok) throw new Error(`HTTP error ${u.status}`);
    const i = await u.json(), t = i.name;
    if (!t)
      throw console.error("[MediMuseAPI] createSession: response missing sessionId", i), new Error("createSession: sessionId not present in response");
    return this.sessionId = String(t), i;
  },
  async getSessionState() {
    const u = await this.fetchWithAuth(`/session/${this.sessionId}`);
    if (!u.ok) throw new Error("Failed to get session state");
    return await u.json();
  },
  async uploadFile(u) {
    const i = new FormData();
    if (u.name.endsWith(".medimuse")) {
      const d = new File([u], u.name, { type: "application/vnd.medimuse.model" });
      i.append("file", d);
    } else
      i.append("file", u);
    const t = await this.fetchWithAuth(`/session/${this.sessionId}/uploadFile`, {
      method: "POST",
      body: i
    });
    if (!t.ok) throw new Error("Failed to upload file");
    return await t.json();
  },
  // --- 2. CONFIGURATION & GENERATION --- //
  async updateTargetStates(u) {
    const i = await this.fetchWithAuth(`/session/${this.sessionId}/targetStates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(u)
    });
    if (!i.ok) throw new Error("Failed to update target states");
    return await i.json();
  },
  // --- NEW: Add this right below updateTargetStates ---
  async updatePluginGroup(u) {
    const i = await this.fetchWithAuth(`/session/${this.sessionId}/plugingroup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(u)
    });
    if (!i.ok) throw new Error("Failed to update plugin group");
    return await i.json();
  },
  async launchGeneration(u) {
    const i = await this.fetchWithAuth(`/job/${this.sessionId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(u)
    });
    if (!i.ok) throw new Error("Failed to start generation job");
    return await i.json();
  },
  async checkJobProgress(u) {
    const i = await this.fetchWithAuth(`/job/${u}/status`);
    if (!i.ok) throw new Error("Failed to check job progress");
    return await i.json();
  },
  // NEW: The internal polling loop
  async generateAndPoll(u, i) {
    let t = await this.launchGeneration(u);
    const d = t.jobId;
    if (!d || d < 0)
      throw new Error("Server failed to assign a valid Job ID.");
    let o = 0;
    const r = 120;
    for (; o < r; ) {
      await new Promise((n) => setTimeout(n, 2e3)), t = await this.getSessionState();
      const s = t.sessionState;
      if (i && i(s, t), s === "COMPLETE" || s === "READY_FOR_DOWNLOAD")
        return t;
      if (s === "PROCESS_FAILED_ERROR" || t.errorStatus !== "NO_ERROR")
        throw new Error(t.errorStatusMessage || "Generation job failed on the server.");
      o++;
    }
    throw new Error("Generation timed out. The server took too long to respond.");
  },
  // --- 2. DATASETS & MODELS --- //
  async getPublicFolders() {
    const u = await this.fetchWithAuth("/session/publicFolders");
    if (!u.ok) throw new Error("Failed to fetch public folders");
    return await u.json();
  },
  async loadPublicFolder(u) {
    const i = await this.fetchWithAuth(`/session/${this.sessionId}/loadPublicFolder`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ publicFolders: u })
    });
    if (!i.ok) throw new Error("Failed to load public folder");
    return await i.json();
  },
  async getSavedModels() {
    const u = await this.fetchWithAuth("/session/medimuseModels");
    if (!u.ok) throw new Error("Failed to fetch saved models");
    return await u.json();
  },
  async loadSavedModel(u) {
    const i = await this.fetchWithAuth(`/session/${this.sessionId}/loadMedimuseModel`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ savedModel: u })
    });
    if (!i.ok) throw new Error("Failed to load saved model");
    return await i.json();
  },
  async getMapleTreeViewModel() {
    const u = await this.fetchWithAuth(`/session/${this.sessionId}/getMapleTreeViewModel`);
    if (!u.ok) throw new Error("Failed to fetch Maple Tree View Model");
    return await u.json();
  },
  async getTrackData(u) {
    const i = await this.fetchWithAuth(`/session/${this.sessionId}/trackData/${u}`);
    if (!i.ok) throw new Error(`Failed to fetch track data for ${u}`);
    return await i.json();
  },
  // --- NEW: Fetch Track Statistics ---
  async getTrackStatistics(u, i) {
    const t = await this.fetchWithAuth(`/session/${this.sessionId}/trackStatistics/${u}/${i}`);
    if (!t.ok) throw new Error(`Failed to fetch stats for track ${u}, dimension ${i}`);
    return await t.json();
  },
  // --- Download the .medimuse file ---
  async downloadCurrentModel() {
    const u = await this.fetchWithAuth(`/session/${this.sessionId}/downloadModel`);
    if (!u.ok)
      throw new Error(`Failed to download model: HTTP ${u.status}`);
    let i = "model.medimuse";
    const t = u.headers.get("Content-Disposition");
    if (t && t.indexOf("attachment") !== -1) {
      const o = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(t);
      o != null && o[1] && (i = o[1].replace(/['"]/g, ""));
    }
    return { blob: await u.blob(), filename: i };
  },
  // --- SECURE PLUGIN PIPELINE ---
  async getPremiumPlugins() {
    const u = await this.fetchWithAuth("/plugins/registry.json");
    if (!u.ok) throw new Error("Failed to fetch premium plugins.");
    return await u.json();
  },
  async getPluginManifest(u) {
    const i = await this.fetchWithAuth(`/plugins/${u}/manifest.json`);
    if (!i.ok) throw new Error(`Failed to fetch manifest for ${u}.`);
    return await i.json();
  },
  async downloadPluginFile(u, i) {
    const t = await this.fetchWithAuth(`/plugins/${u}/download?file=${i}`);
    if (!t.ok) throw new Error(`Failed to download secure patch: ${i}`);
    return await t.text();
  },
  // ==========================================
  // BIOMETRIC MATH & SIGNAL PROCESSING
  // ==========================================
  upsampleBiometricToCV(u, i, t = 0, d = 48e3) {
    const o = u.length, r = Math.floor(i * d), s = new Float32Array(r);
    if (o === 0) return { bufferData: s, numFrames: r, numChannels: 1 };
    const n = u.map((c) => Array.isArray(c) ? c[t] || 0 : c);
    for (let c = 0; c < r; c++) {
      const p = c / r * (o - 1), w = Math.floor(p), g = Math.min(w + 1, o - 1), b = p - w, l = n[w], y = n[g];
      s[c] = l + (y - l) * b;
    }
    return { bufferData: s, numFrames: r, numChannels: 1 };
  },
  buildTempoMapFromBiometrics(u, i) {
    if (!u || u.length === 0) return [{ ppq: 0, time: 0, bpm: 120 }];
    let t = 0, d = 0, o = 1 / i;
    const r = [{ ppq: 0, time: 0, bpm: u[0] }];
    for (let s = 1; s < u.length; s++) {
      let n = u[s - 1], c = u[s], w = n / 60 * o;
      t += w, d += o, r.push({ ppq: t, time: d, bpm: c });
    }
    return r;
  }
  // UPDATED: Now accepts the form configuration
}, qt = {
  MediMuse: Zt,
  // --- NEW: Expose the Event Constants ---
  EVENTS: ht,
  // --- NEW: Wrapper for the Event Bus ---
  on(u, i) {
    at.on(u, i);
  },
  // --- NEW: Safe getter for the Project Data ---
  // Returns a deep copy so external UIs can't accidentally break the MVC model!
  getProjectData() {
    return G.getState();
  },
  assetBaseUrl: "/app",
  setAssetBaseUrl(u) {
    this.assetBaseUrl = u.replace(/\/$/, ""), E.assetBaseUrl = this.assetBaseUrl, console.log(`[BioDAW SDK] Asset Base URL set to: ${this.assetBaseUrl}`);
  },
  // ==========================================
  // 1. MASTER BOOT SEQUENCE
  // ==========================================
  async boot() {
    await this.init(), await E.boot();
    const u = localStorage.getItem("biodaw_preferred_audio_out");
    return u && u !== "default" && (console.log(`[HeadlessAPI] Applying saved audio routing: ${u}`), await this.setAudioOutput(u)), await this.startMidiScheduler(), await E.loadSoundFont(`${this.assetBaseUrl}/default.sf2`), await E.loadActiveSoundFontPathces(), this.activeSoundFontPatches = E.getActiveSoundFontPatches(), this.fluidSynthReady = !0, await this.hydratePdStandardLibrary(), console.log("[HeadlessAPI] Engine and Data Layer fully booted."), !0;
  },
  async init() {
    return at.on(ht.TRACK_ADDED, async (u) => {
      if (E.get()) {
        let i = u.type === "midi" ? 1 : u.type === "cv" ? 2 : 0;
        E.get()._biodaw_add_track(u.cppTrackId, i);
      }
      u.type === "midi" && (u.midiChannel === void 0 && (u.midiChannel = G.tracks.indexOf(u) % 16), E.setTrackMidiChannel(u.cppTrackId, u.midiChannel), u.midiOutId === "fluidsynth" && this.fluidSynthReady && (E.addTrackInstrument(u.cppTrackId, ""), this.setTrackInstrument(G.tracks.indexOf(u), u.bank || 0, u.program || 0)));
    }), at.on(ht.TRACK_REMOVED, (u) => {
      (u.type === "audio" || u.type === "cv") && u.clips.forEach((i) => {
        if (i.assetPath && this.audioMemoryPool.has(i.assetPath)) {
          const t = this.audioMemoryPool.get(i.assetPath);
          t.refCount--, t.refCount <= 0 && this.audioMemoryPool.delete(i.assetPath);
        }
      }), E.get() && (E.get()._clear_track_audio(u.cppTrackId), E.get()._biodaw_remove_track(u.cppTrackId));
    }), at.on(ht.CLIP_ADDED, ({ track: u, clip: i, bufferData: t }) => {
      if (i.type === "midi" && u.midiOutId === "fluidsynth" && E.get()) {
        E.syncMidiClip(u.cppTrackId, i.id, i.start, i.length, i.notes || [], i.controls || []);
        return;
      }
      if ((i.type === "audio" || i.type === "cv") && i.assetPath && E.get()) {
        let d, o, r;
        if (this.audioMemoryPool.has(i.assetPath)) {
          const p = this.audioMemoryPool.get(i.assetPath);
          d = p.dataPtr, o = p.numSamples, r = p.numChannels, p.refCount++;
        } else if (t) {
          o = t.numFrames || t.length, r = t.numChannels || 1;
          const p = t.length * t.BYTES_PER_ELEMENT;
          d = E.get()._malloc(p), E.get().HEAPF32.set(t, d / 4), this.audioMemoryPool.set(i.assetPath, { dataPtr: d, numSamples: o, numChannels: r, refCount: 1 }), this.waveformCache.set(i.assetPath, this.extractWaveformPeaks(t, r));
        } else return;
        const s = this.ppqToAbsoluteSeconds(i.start), n = Math.floor(s * this.getSampleRate()), c = Math.floor((i.sourceOffset || 0) * this.getSampleRate());
        E.get()._add_audio_channel(i.id, u.cppTrackId, d, o, n, o, c, r), at.emit("WAVEFORMS_HYDRATED", {});
      }
    }), at.on(ht.PROJECT_LOADED, async (u) => {
      if (E.get()) {
        u.tracks.forEach((i) => {
          let t = i.type === "midi" ? 1 : i.type === "cv" ? 2 : 0;
          if (E.get()._biodaw_add_track(i.cppTrackId, t), E.get()._set_track_volume(i.cppTrackId, i.volume !== void 0 ? i.volume : 1), E.get()._set_track_pan(i.cppTrackId, i.pan !== void 0 ? i.pan : 0), E.get().ccall("biodaw_set_track_output_lane", null, ["number", "number"], [i.cppTrackId, i.outputLane !== void 0 ? i.outputLane : -1]), i.type === "midi" && (E.setTrackMidiChannel(i.cppTrackId, i.midiChannel || 0), i.midiOutId === "fluidsynth" && (E.addTrackInstrument(i.cppTrackId, ""), this.setTrackInstrument(u.tracks.indexOf(i), i.bank || 0, i.program || 0))), i.type === "cv") {
            const d = i.normalizeCV !== !1, o = i.yDomain || [-1, 1];
            E.get().ccall(
              "set_track_normalization",
              null,
              ["number", "boolean", "number", "number"],
              [i.cppTrackId, d, o[0], o[1]]
            );
          }
        });
        for (let i = 0; i < u.tracks.length; i++) {
          const t = u.tracks[i];
          if (t.type === "midi") {
            for (let d = 0; d < t.clips.length; d++) {
              const o = t.clips[d];
              E.syncMidiClip(t.cppTrackId, o.id, o.start, o.length, o.notes || [], o.controls || []);
            }
            continue;
          }
          if (!(t.type !== "audio" && t.type !== "cv"))
            for (let d = 0; d < t.clips.length; d++) {
              const o = t.clips[d];
              if (o.assetPath) {
                if (this.audioMemoryPool.has(o.assetPath))
                  this.audioMemoryPool.get(o.assetPath).refCount++;
                else
                  try {
                    const p = E.get().FS.readFile(o.assetPath);
                    let w, g, b;
                    if (o.assetPath.endsWith(".cv"))
                      w = new Float32Array(p.buffer, p.byteOffset, p.byteLength / 4), g = 1, b = w.length;
                    else {
                      const h = p.buffer.slice(p.byteOffset, p.byteOffset + p.byteLength), m = await this.decodeAndProcessAudio(h);
                      w = m.bufferData, b = m.numFrames, g = m.numChannels;
                    }
                    const l = w.length * w.BYTES_PER_ELEMENT, y = E.get()._malloc(l);
                    E.get().HEAPF32.set(w, y / 4), this.audioMemoryPool.set(o.assetPath, { dataPtr: y, numSamples: b, numChannels: g, refCount: 1 }), this.waveformCache.set(o.assetPath, this.extractWaveformPeaks(w, g));
                  } catch (p) {
                    console.warn("Rehydrate fail", p);
                    continue;
                  }
                const r = this.ppqToAbsoluteSeconds(o.start), s = Math.floor(r * this.getSampleRate()), n = Math.floor((o.sourceOffset || 0) * this.getSampleRate());
                let c = this.audioMemoryPool.get(o.assetPath).numChannels;
                E.get()._add_audio_channel(o.id, t.cppTrackId, this.audioMemoryPool.get(o.assetPath).dataPtr, this.audioMemoryPool.get(o.assetPath).numSamples, s, this.audioMemoryPool.get(o.assetPath).numSamples, n, c);
              }
            }
        }
        await this.hydrateProjectEffects(), typeof window.hydrateInitialTracks == "function" && window.hydrateInitialTracks(), at.emit("WAVEFORMS_HYDRATED", {});
      }
    }), at.emit(ht.HEADLESS_API_READY, {}), !0;
  },
  // ==========================================
  // 0. MEMORY POOLS & DSP HELPERS
  // ==========================================
  audioMemoryPool: /* @__PURE__ */ new Map(),
  // Maps assetPath -> { dataPtr, numSamples, numChannels, refCount }
  waveformCache: /* @__PURE__ */ new Map(),
  // Maps assetPath -> Array of [min, max] visual peaks
  extractWaveformPeaks(u, i, t = 1e3) {
    const d = [], o = u.length / i, r = Math.max(1, Math.floor(o / t));
    for (let s = 0; s < t; s++) {
      let n = 1 / 0, c = -1 / 0;
      const p = s * r, w = Math.min(p + r, o);
      for (let g = p; g < w; g++) {
        const b = u[g * i];
        b < n && (n = b), b > c && (c = b);
      }
      n === 1 / 0 && (n = 0), c === -1 / 0 && (c = 0), d.push([n, c]);
    }
    return d;
  },
  async decodeAndProcessAudio(u) {
    const i = window.OfflineAudioContext ? new window.OfflineAudioContext(2, 1, this.getSampleRate()) : new window.AudioContext({ sampleRate: this.getSampleRate() }), t = await new Promise((c, p) => i.decodeAudioData(u.slice(0), c, p)), d = t.numberOfChannels >= 2 ? 2 : 1, o = t.length;
    let r = 0;
    for (let c = 0; c < d; c++) {
      const p = t.getChannelData(c);
      for (let w = 0; w < o; w++) {
        const g = Math.abs(p[w]);
        g > r && (r = g);
      }
    }
    const s = r > 0 ? 0.7 / r : 1;
    let n;
    if (d === 2) {
      const c = t.getChannelData(0), p = t.getChannelData(1);
      n = new Float32Array(o * 2);
      for (let w = 0; w < o; w++)
        n[w * 2] = c[w] * s, n[w * 2 + 1] = p[w] * s;
    } else {
      const c = t.getChannelData(0);
      n = new Float32Array(o);
      for (let p = 0; p < o; p++)
        n[p] = c[p] * s;
    }
    return { bufferData: n, numFrames: o, numChannels: d };
  },
  async routeBiometricTempo(u, i, t) {
    const d = t.map((s) => Array.isArray(s) ? s[0] || 60 : s);
    if (d.length === 0) return;
    const o = i.frequency || 1, r = this.MediMuse.buildTempoMapFromBiometrics(d, o);
    G.tempoMap = r, G.tempo = d[0], G.markDirty(), E.get() && (E.get()._set_tempo(d[0]), typeof E.get()._clear_tempo_map == "function" && (E.get()._clear_tempo_map(), r.forEach((s) => {
      E.get()._add_tempo_node(s.ppq, s.time, s.bpm);
    }), console.log(`[HeadlessAPI] C++ Master Spacetime Map synced (${r.length} nodes)`))), G.tracks.forEach((s) => {
      s.clips && s.clips.forEach((n) => {
        this.syncClipBounds(n.id);
      });
    });
  },
  // ==========================================
  // 2. TRANSPORT CONTROLS
  // ==========================================
  isPlaying() {
    return E.get() ? E.get()._is_playing() : !1;
  },
  togglePlayback() {
    window.sharedAudioCtx && window.sharedAudioCtx.state === "suspended" && window.sharedAudioCtx.resume(), E.get() && E.get()._toggle_playback();
    const u = this.isPlaying();
    return at.emit(u ? ht.TRANSPORT_PLAY : ht.TRANSPORT_STOP, {}), u;
  },
  stop() {
    this.isPlaying() && E.get() && (E.get()._toggle_playback(), at.emit(ht.TRANSPORT_STOP, {}));
  },
  // ==========================================
  // 3. TRACK & ROUTING CONTROLS
  // ==========================================
  async addTrack(u, i = "audio", t = null) {
    if (typeof G.addTrack == "function")
      return G.addTrack(u, i, t);
    console.error("[HeadlessAPI] ProjectModel is missing the addTrack function!"), E.panicAllNotesOff();
  },
  // ==========================================
  // 4. DSP EFFECT CONTROLS
  // ==========================================
  setEffectParameter(u, i, t, d) {
    const o = G.tracks.find((n) => n.id === u);
    if (!o) return;
    const r = o.effects.find((n) => n.instanceId === i);
    if (!r) return;
    r.parameters[t] = d;
    const s = o.effects.indexOf(r);
    console.log(`[API -> C++] Setting Effect Param: Track ${o.cppTrackId}, FX Slot ${s}, Param '${t}' = ${d}`), E.get() && E.get().ccall(
      "biodaw_set_effect_float",
      null,
      ["number", "number", "string", "number"],
      [o.cppTrackId, s, t, d]
    ), at.emit(ht.EFFECT_PARAM_CHANGED, { trackId: u, instanceId: i, paramName: t, value: d });
  },
  toggleEffectEditor(u, i, t) {
    const d = G.tracks.find((r) => r.id === u);
    if (!d) return;
    const o = d.effects.findIndex((r) => r.instanceId === i);
    o !== -1 && E.get() && E.get().ccall(
      "biodaw_toggle_effect_ui_by_index",
      null,
      ["number", "number", "number"],
      [d.cppTrackId, o, t ? 1 : 0]
    );
  },
  removeEffect(u, i) {
    const t = G.tracks.find((r) => r.id === u);
    if (!t) return;
    const d = t.effects.findIndex((r) => r.instanceId === i);
    if (d === -1) return;
    const o = t.effects[d];
    E.get() && (E.get().ccall("biodaw_remove_effect", null, ["number", "number"], [t.cppTrackId, d]), o.vfsPath && E.get().FS.analyzePath(o.vfsPath).exists && (E.get().FS.unlink(o.vfsPath), console.log(`[HeadlessAPI] 🗑️ Deleted patch file: ${o.vfsPath}`)), o.vfsManifestPath && E.get().FS.analyzePath(o.vfsManifestPath).exists && (E.get().FS.unlink(o.vfsManifestPath), console.log(`[HeadlessAPI] 🗑️ Deleted manifest file: ${o.vfsManifestPath}`))), t.effects.splice(d, 1), G.markDirty(), at.emit(ht.EFFECT_REMOVED, { trackId: u, instanceId: i });
  },
  async addEffect(u, i, t = !1) {
    const d = G.tracks.find((s) => s.id === u);
    if (!d) return;
    const r = {
      instanceId: `fx-${G._effectIdCounter++}`,
      effectId: i,
      // We temporarily leave 'type' undefined, the manifest will fill it in!
      isPremium: t,
      parameters: {}
    };
    return d.effects.push(r), await this._mountEffectToWasm(d, r), r;
  },
  // ==========================================
  // 5. HYDRATION (Loading Saved Projects)
  // ==========================================
  async hydrateProjectEffects() {
    console.log("[HeadlessAPI] Hydrating DSP effects from data model...");
    for (let u = 0; u < G.tracks.length; u++) {
      const i = G.tracks[u];
      if (i.effects && i.effects.length > 0)
        for (let t = 0; t < i.effects.length; t++) {
          const d = i.effects[t];
          await this._mountEffectToWasm(i, d);
        }
    }
  },
  // --- 1. The VFS Hydration Function (EngineCore Architecture) ---
  async hydratePdStandardLibrary() {
    console.log("[Bootloader] 📥 Fetching Pure Data standard library...");
    const u = E.get(), i = u.FS, t = u.ccall || u.Module.ccall;
    try {
      const d = await fetch(`${this.assetBaseUrl}/effects/pd_extra.zip`);
      if (!d.ok) throw new Error("Failed to download ZIP: HTTP " + d.status);
      const o = d.headers.get("content-type");
      if (o && o.includes("text/html"))
        throw new Error(`Server returned HTML! Path is wrong: ${d.url}`);
      const r = await d.blob(), s = await Tt.loadAsync(r), n = "/system/pd_extra", c = (l) => {
        const y = l.split("/").filter((m) => m.length > 0);
        let h = "";
        for (const m of y) {
          h += "/" + m;
          try {
            i.mkdir(h);
          } catch {
          }
        }
      };
      c(n);
      const p = [], w = [n];
      s.forEach((l, y) => {
        const h = `${n}/${l}`;
        if (y.dir)
          c(h), w.push(h.replace(/\/$/, ""));
        else {
          const m = h.lastIndexOf("/");
          m > -1 && c(h.substring(0, m)), p.push(
            y.async("uint8array").then((f) => {
              i.writeFile(h, f);
            })
          );
        }
      }), await Promise.all(p);
      const g = [...new Set(w)];
      console.log(`[Bootloader] ✅ Unzipped library and registered ${g.length} paths.`), g.forEach((l) => {
        t("biodaw_add_search_path", null, ["string"], [l]);
      });
      const b = i.readdir(n);
      console.log(`🕵️ [Verification] Contents of ${n}:`, b);
    } catch (d) {
      console.error("[Bootloader] ❌ Failed to load Pd extras:", d);
    }
  },
  // Internal helper to handle the VFS writing and C++ binding for plugins
  async _mountEffectToWasm(u, i) {
    const t = i.effectId, d = i.isPremium;
    try {
      let o;
      const r = G.name || "Untitled_Project";
      if (E.get() && E.get().FS) {
        try {
          E.get().FS.mkdir(`/projects/${r}`);
        } catch {
        }
        try {
          E.get().FS.mkdir(`/projects/${r}/plugins`);
        } catch {
        }
      }
      const s = `${i.instanceId}_${t}_manifest.json`, n = `/projects/${r}/plugins/${s}`;
      if (i.vfsManifestPath = n, E.get() && E.get().FS && E.get().FS.analyzePath(n).exists) {
        console.log(`[HeadlessAPI] 💾 Loading instanced manifest: ${n}`);
        const w = E.get().FS.readFile(n, { encoding: "utf8" });
        o = JSON.parse(w);
      } else
        console.log(`[HeadlessAPI] 🌐 Fetching factory manifest for: ${i.instanceId}`), d && this.MediMuse ? o = await this.MediMuse.getPluginManifest(t) : o = await (await fetch(`${this.assetBaseUrl}/effects/${t}/manifest.json?t=${Date.now()}`)).json(), E.get() && E.get().FS && E.get().FS.writeFile(n, JSON.stringify(o, null, 2));
      i.type || (i.type = o.type || "pd", G.markDirty());
      const c = String(i.type).toLowerCase();
      let p = -1;
      if (c === "pd") {
        const w = o.patchFile || o.patch_file;
        if (!w) throw new Error(`Manifest for ${t} is missing the patchFile declaration!`);
        const g = `${i.instanceId}_${t}_${w}`, b = `/projects/${r}/plugins/${g}`;
        if (i.vfsPath = b, G.markDirty(), E.get().FS.analyzePath(b).exists)
          console.log(`[HeadlessAPI] 💾 Loading instanced patch from project: ${b}`);
        else {
          console.log(`[HeadlessAPI] 🌐 Fetching factory patch for instance: ${i.instanceId}`);
          let l = d && this.MediMuse ? await this.MediMuse.downloadPluginFile(t, w) : await (await fetch(`${this.assetBaseUrl}/effects/${t}/${w}?t=${Date.now()}`)).text();
          if (l.trim().startsWith("<!DOCTYPE html>"))
            throw new Error(`Server returned a 404 page instead of the PD patch: ${w}`);
          E.get() && E.get().FS && E.get().FS.writeFile(b, l);
        }
        E.get() && E.get().FS && (p = E.get().ccall("biodaw_add_pd_effect", "number", ["number", "string"], [u.cppTrackId, b]));
      } else c === "native" && E.get() && (p = E.get().ccall("biodaw_add_native_effect", "number", ["number", "string"], [u.cppTrackId, o.cppClassName]));
      o.properties && E.get() && o.properties.forEach((w) => {
        const g = i.parameters[w.name] !== void 0 ? i.parameters[w.name] : w.default;
        E.get().ccall(
          "biodaw_register_effect_float",
          null,
          ["number", "number", "string", "number"],
          [u.cppTrackId, p, w.name, g]
        );
      }), at.emit(ht.EFFECT_MOUNTED, { trackId: u.id, effectInstance: i, manifest: o });
    } catch (o) {
      console.error(`[HeadlessAPI] Failed to mount effect '${t}':`, o);
    }
  },
  // ==========================================
  // 6. PROJECT MANAGEMENT & VFS
  // ==========================================
  getProjectList() {
    if (!E.get() || !E.get().FS) return [];
    try {
      return E.get().FS.readdir("/projects").filter((i) => {
        if (i === "." || i === "..") return !1;
        const t = E.get().FS.stat(`/projects/${i}`);
        return E.get().FS.isDir(t.mode);
      });
    } catch {
      return [];
    }
  },
  async saveProject(u, i = {}) {
    if (!E.get() || !E.get().FS) throw new Error("FS not ready");
    if (!u || u === "") throw new Error("Project name missing");
    G.name = u, G.uiState = i;
    try {
      E.get().FS.mkdir(`/projects/${u}`);
    } catch {
    }
    try {
      E.get().FS.mkdir(`/projects/${u}/audio`);
    } catch {
    }
    try {
      E.get().FS.mkdir(`/projects/${u}/midi`);
    } catch {
    }
    try {
      E.get().FS.mkdir(`/projects/${u}/plugins`);
    } catch {
    }
    const t = JSON.stringify(G, null, 2), d = `/projects/${u}/project.json`;
    return E.get().FS.writeFile(d, t), console.log(`[HeadlessAPI] Project written to RAM: ${d}`), new Promise((o, r) => {
      E.get().FS.syncfs(!1, (s) => {
        if (s) return r(s);
        G.clearDirty(), o();
      });
    });
  },
  async loadProject(u) {
    if (!E.get() || !E.get().FS) throw new Error("FS not ready");
    this.teardownCurrentProject();
    const i = `/projects/${u}/project.json`, t = E.get().FS.readFile(i, { encoding: "utf8" }), d = JSON.parse(t);
    G.loadState(u, d);
  },
  deleteProject(u) {
    if (!E.get() || !E.get().FS) return Promise.reject("FS not ready");
    const i = (t) => {
      E.get().FS.analyzePath(t).exists && (E.get().FS.readdir(t).forEach((o) => {
        if (o === "." || o === "..") return;
        const r = t + "/" + o;
        E.get().FS.isDir(E.get().FS.stat(r).mode) ? i(r) : E.get().FS.unlink(r);
      }), E.get().FS.rmdir(t));
    };
    return i(`/projects/${u}`), new Promise((t, d) => {
      E.get().FS.syncfs(!1, (o) => {
        o ? d(o) : t();
      });
    });
  },
  teardownCurrentProject() {
    console.log("[HeadlessAPI] Tearing down engine state..."), this.stop(), E.get() && (E.get()._set_looping(!1), E.get()._set_loop_points(0, 4), typeof E.get()._clear_tempo_map == "function" && E.get()._clear_tempo_map(), E.get()._set_tempo(120)), G.tracks.forEach((u) => {
      E.get() && (E.get()._clear_track_audio(u.cppTrackId), E.get()._biodaw_remove_track(u.cppTrackId));
    }), this.audioMemoryPool && this.audioMemoryPool.clear(), this.waveformCache && this.waveformCache.clear(), G.reset();
  },
  // ... inside HeadlessAPI ...
  async renameProject(u, i, t = {}) {
    if (!E.get() || !E.get().FS) throw new Error("FS not ready");
    const d = `/projects/${u}`, o = `/projects/${i}`;
    if (!E.get().FS.analyzePath(d).exists)
      throw new Error("Original project not found.");
    if (E.get().FS.analyzePath(o).exists)
      throw new Error("A project with the new name already exists.");
    E.get().FS.rename(d, o), G.name === u ? (G.name = i, G.tracks.forEach((r) => {
      (r.type === "audio" || r.type === "cv") && r.clips.forEach((s) => {
        s.assetPath && (s.assetPath = s.assetPath.replace(`/projects/${u}/`, `/projects/${i}/`));
      }), r.effects && r.effects.forEach((s) => {
        s.vfsPath && (s.vfsPath = s.vfsPath.replace(`/projects/${u}/`, `/projects/${i}/`)), s.vfsManifestPath && (s.vfsManifestPath = s.vfsManifestPath.replace(`/projects/${u}/`, `/projects/${i}/`));
      });
    }), await this.saveProject(i, t)) : await new Promise((r, s) => {
      E.get().FS.syncfs(!1, (n) => n ? s(n) : r());
    });
  },
  // ==========================================
  // 7. IMPORT & EXPORT (ZIP PACKAGING)
  // ==========================================
  async exportProjectToZip(u) {
    if (!E.get() || !E.get().FS) throw new Error("Wasm FS not available");
    const i = E.get().FS, t = `/projects/${u}`;
    await new Promise((r, s) => {
      i.syncfs(!1, (n) => n ? s(n) : r());
    });
    try {
      i.stat(t);
    } catch {
      throw new Error(`Project not found: ${t}`);
    }
    const d = new Tt();
    function o(r, s) {
      const n = i.readdir(r);
      for (const c of n) {
        if (c === "." || c === "..") continue;
        const p = `${r}/${c}`, w = i.stat(p);
        if (i.isDir(w.mode)) {
          const g = s.folder(c);
          o(p, g);
        } else {
          const g = i.readFile(p);
          s.file(c, g);
        }
      }
    }
    return o(t, d.folder(u)), await d.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  },
  async importProjectFromZip(u) {
    if (!E.get() || !E.get().FS) throw new Error("Wasm FS not available");
    const i = E.get().FS, t = await Tt.loadAsync(u);
    let d = null;
    for (const r of Object.keys(t.files)) {
      const s = r.split("/");
      if (s.length > 0 && s[0] !== "") {
        d = s[0];
        break;
      }
    }
    if (!d) throw new Error("Invalid project zip structure.");
    const o = [];
    t.forEach((r, s) => {
      if (s.dir)
        try {
          i.mkdir(`/projects/${r.replace(/\/$/, "")}`);
        } catch {
        }
      else
        o.push(async () => {
          const n = await s.async("uint8array"), c = r.split("/");
          let p = "/projects";
          for (let w = 0; w < c.length - 1; w++) {
            p += `/${c[w]}`;
            try {
              i.mkdir(p);
            } catch {
            }
          }
          i.writeFile(`/projects/${r}`, n);
        });
    });
    for (const r of o)
      await r();
    return await new Promise((r, s) => {
      i.syncfs(!1, (n) => n ? s(n) : r());
    }), d;
  },
  // ==========================================
  // 8. DATA IMPORTERS
  // ==========================================
  async importAudioFile(u, i, t) {
    (!G.name || G.name === "") && (G.name = "Untitled_Project");
    let d, o;
    if (i)
      d = await i.arrayBuffer(), o = i.name;
    else if (t)
      d = await (await fetch(t)).arrayBuffer(), o = t.split("/").pop() || `sample-${Date.now()}.wav`;
    else return;
    const r = await this.decodeAndProcessAudio(d), s = r.bufferData;
    s.numFrames = r.numFrames, s.numChannels = r.numChannels;
    const n = G.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    if (E.get() && E.get().FS) {
      try {
        E.get().FS.mkdir(`/projects/${n}`);
      } catch {
      }
      try {
        E.get().FS.mkdir(`/projects/${n}/audio`);
      } catch {
      }
    }
    const c = o.replace(/[^a-zA-Z0-9.\-_]/g, "_"), p = `/projects/${n}/audio/${c}`;
    if (E.get().FS.writeFile(p, new Uint8Array(d)), E.get().FS.syncfs(!1, () => {
    }), !this.audioMemoryPool.has(p)) {
      const g = s.length * s.BYTES_PER_ELEMENT, b = E.get()._malloc(g);
      E.get().HEAPF32.set(s, b / 4), this.audioMemoryPool.set(p, {
        dataPtr: b,
        numSamples: r.numFrames,
        // Strict Frame Count!
        numChannels: r.numChannels,
        // Strict Channel Count!
        refCount: 0
        // CLIP_ADDED will immediately increment this to 1
      }), this.waveformCache.set(p, this.extractWaveformPeaks(s, r.numChannels));
    }
    const w = r.numFrames / this.getSampleRate() * (G.tempo / 60);
    G.addClip(u, 0, w, p, [], null);
  },
  async importCvTrack(u, i, t) {
    (!G.name || G.name === "") && (G.name = "Untitled_Project");
    const d = G.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    if (E.get() && E.get().FS) {
      try {
        E.get().FS.mkdir(`/projects/${d}`);
      } catch {
      }
      try {
        E.get().FS.mkdir(`/projects/${d}/audio`);
      } catch {
      }
    }
    const o = i.frequency || 256, r = t.length / o;
    let s = i.dimensions || 1;
    t.length > 0 && Array.isArray(t[0]) && (s = t[0].length);
    const n = ["X", "Y", "Z", "W"];
    for (let c = 0; c < s; c++) {
      const p = `CV: ${i.name}${s > 1 ? ` [${n[c] || c}]` : ""}`;
      let w = -1, g = 1;
      try {
        const k = await this.MediMuse.getTrackStatistics(u, c), A = k.maximum - k.minimum || 1;
        w = k.minimum - A * 0.05, g = k.maximum + A * 0.05;
      } catch (k) {
        console.warn(`[API] Failed to fetch stats for ${p}, using defaults.`, k);
      }
      const b = G.addTrack(p, "cv", [w, g]);
      E.get() && E.get().ccall(
        "set_track_normalization",
        null,
        ["number", "boolean", "number", "number"],
        [b.cppTrackId, !0, w, g]
      );
      const l = this.MediMuse.upsampleBiometricToCV(t, r, c), y = l.bufferData;
      y.numFrames = l.numFrames, y.numChannels = 1;
      const h = `cv_${u.replace(/[^a-zA-Z0-9]/g, "")}_dim${c}.cv`, m = `/projects/${d}/audio/${h}`;
      if (E.get() && E.get().FS && (E.get().FS.writeFile(m, new Uint8Array(y.buffer)), E.get().FS.syncfs(!1, () => {
      })), !this.audioMemoryPool.has(m)) {
        const k = y.length * y.BYTES_PER_ELEMENT, A = E.get()._malloc(k);
        E.get().HEAPF32.set(y, A / 4), this.audioMemoryPool.set(m, {
          dataPtr: A,
          numSamples: l.numFrames,
          numChannels: 1,
          refCount: 0
        }), this.waveformCache.set(m, this.extractWaveformPeaks(y, 1));
      }
      const f = r * (G.tempo / 60);
      G.addClip(b.id, 0, f, m, [], null);
    }
  },
  setTrackVolume(u, i) {
    const t = G.tracks.find((d) => d.id === u);
    t && (t.volume = i, G.markDirty(), E.get() && typeof E.get()._set_track_volume == "function" && E.get()._set_track_volume(t.cppTrackId, i), at.emit(ht.TRACK_VOLUME_CHANGED, { trackId: u, volume: i }));
  },
  setTrackPan(u, i) {
    const t = G.tracks.find((d) => d.id === u);
    t && (t.pan = i, G.markDirty(), E.get() && typeof E.get()._set_track_pan == "function" && E.get()._set_track_pan(t.cppTrackId, i), at.emit(ht.TRACK_PAN_CHANGED, { trackId: u, pan: i }));
  },
  async setTrackMidiOut(u, i) {
    const t = G.tracks.find((d) => d.id === u);
    !t || t.type !== "midi" || (t.midiOutId = i, G.markDirty(), i === "fluidsynth" ? (E.addTrackInstrument(t.cppTrackId, ""), this.setTrackInstrument(G.tracks.indexOf(t), t.bank || 0, t.program || 0)) : E.clearTrackInstruments(t.cppTrackId));
  },
  toggleTrackNormalization(u) {
    const i = G.tracks.find((t) => t.id === u);
    if (i && (i.normalizeCV = !i.normalizeCV, G.markDirty(), E.get())) {
      const t = i.yDomain || [-1, 1];
      E.get().ccall(
        "set_track_normalization",
        null,
        ["number", "boolean", "number", "number"],
        [i.cppTrackId, i.normalizeCV, t[0], t[1]]
      );
    }
  },
  // ... inside 2. TRANSPORT CONTROLS ...
  getPlaybackPosition() {
    return E.get() ? E.get()._get_transport_ppq() : 0;
  },
  rewind() {
    E.get() && (this.stop(), typeof E.get()._seek_transport == "function" ? E.get()._seek_transport(0, 0) : typeof E.get()._seek == "function" && E.get()._seek(0, 0), E.panicAllNotesOff());
  },
  seek(u) {
    if (!E.get()) return;
    const i = this.ppqToAbsoluteSeconds(u);
    E.get().ccall(
      "seek_transport",
      null,
      ["number", "number"],
      [u, i]
    ), console.log(`[HeadlessAPI] Playhead seeked to ${u.toFixed(2)} PPQ`);
  },
  setLooping(u) {
    G.isLooping = u, G.markDirty(), E.get() && E.get()._set_looping(u);
  },
  setLoopPoints(u, i) {
    if (u >= i) throw new Error("Loop End must be greater than Loop Start!");
    G.loopStart = u, G.loopEnd = i, G.markDirty(), E.get() && E.get()._set_loop_points(u, i);
  },
  setTempo(u) {
    if (u <= 0 || isNaN(u)) return;
    const i = this.getPlaybackPosition(), t = [];
    if (G.tracks.forEach((d) => {
      (d.type === "audio" || d.type === "cv") && d.clips.forEach((o) => {
        t.push({
          clip: o,
          absStart: this.ppqToAbsoluteSeconds(o.start),
          absLength: this.ppqToAbsoluteSeconds(o.start + o.length) - this.ppqToAbsoluteSeconds(o.start),
          absOffset: this.ppqToAbsoluteSeconds(o.sourceOffset || 0)
        });
      });
    }), G.tempo = u, G.tempoMap = [{ ppq: 0, time: 0, bpm: u }], G.markDirty(), E.get()) {
      if (E.get()._set_tempo(u), typeof this.ppqToAbsoluteSeconds == "function") {
        const d = this.ppqToAbsoluteSeconds(i);
        typeof E.get()._seek_transport == "function" ? E.get()._seek_transport(i, d) : typeof E.get()._seek == "function" && E.get()._seek(i, d);
      }
      t.forEach((d) => {
        d.clip.start = this.absoluteSecondsToPpq(d.absStart), d.clip.length = this.absoluteSecondsToPpq(d.absStart + d.absLength) - d.clip.start, d.clip.sourceOffset && (d.clip.sourceOffset = this.absoluteSecondsToPpq(d.absOffset));
      }), G.tracks.forEach((d) => {
        d.clips && d.clips.forEach((o) => {
          this.syncClipBounds(o.id);
        });
      });
    }
  },
  // Move the C++ clip sync logic here so D3 doesn't have to do math
  syncClipBounds(u) {
    if (!E.get()) return;
    let i = null, t = null;
    for (const c of G.tracks)
      if (i = c.clips.find((p) => p.id === u), i) {
        t = c;
        break;
      }
    if (!i || !t) return;
    if (i.type === "midi") {
      E.syncMidiClip(t.cppTrackId, i.id, i.start, i.length, i.notes || [], i.controls || []);
      return;
    }
    if (i.type !== "audio" && i.type !== "cv") return;
    const d = this.ppqToAbsoluteSeconds(i.start), o = this.ppqToAbsoluteSeconds(i.start + i.length), r = Math.floor(d * this.getSampleRate()), s = Math.floor((i.sourceOffset || 0) * this.getSampleRate()), n = Math.floor((o - d) * this.getSampleRate());
    E.get()._update_channel_bounds(i.id, r, n, s);
  },
  projectExists(u) {
    if (!E.get() || !E.get()) return !1;
    try {
      return E.get().analyzePath(`/projects/${u}`).exists;
    } catch {
      return !1;
    }
  },
  // --- NEW: FLUIDSYNTH SDK STATE ---
  // ==========================================
  // FLUIDSYNTH SDK STATE & WRAPPERS
  // ==========================================
  fluidSynthReady: !1,
  // We use a standard General MIDI map for the UI dropdowns now!
  activeSoundFontPatches: {
    0: [
      { program: 0, name: "Acoustic Grand Piano" },
      { program: 4, name: "Electric Piano" },
      { program: 16, name: "Drawbar Organ" },
      { program: 24, name: "Acoustic Guitar" },
      { program: 33, name: "Electric Bass" },
      { program: 48, name: "String Ensemble" },
      { program: 56, name: "Trumpet" },
      { program: 73, name: "Flute" },
      { program: 80, name: "Synth Square Wave" },
      { program: 81, name: "Synth Sawtooth Wave" },
      { program: 89, name: "Warm Pad" }
      // Add more standard GM patches here if you like!
    ],
    128: [
      { program: 0, name: "Standard Drum Kit" }
    ]
  },
  setTrackInstrument(u, i, t) {
    const d = G.tracks[u];
    E.setSynthProgram(d.cppTrackId, d.midiChannel || 0, i, t);
  },
  playSynthNote(u, i, t) {
    const d = G.tracks[u];
    E.playSynthNote(d.cppTrackId, d.midiChannel || 0, i, t);
  },
  stopSynthNote(u, i) {
    const t = G.tracks[u];
    E.stopSynthNote(t.cppTrackId, t.midiChannel || 0, i);
  },
  // --- NEW EXPOSED API FUNCTION ---
  setTrackMidiChannel(u, i) {
    const t = G.tracks.find((d) => d.id === u);
    !t || t.type !== "midi" || (t.midiChannel = i, G.markDirty(), E.setTrackMidiChannel(t.cppTrackId, i), t.midiOutId === "fluidsynth" && E.setSynthProgram(t.cppTrackId, i, t.program || 0));
  },
  closeAllSynths() {
    E.panicAllNotesOff();
  },
  // ==========================================
  // HARDWARE MIDI & SCHEDULING ENGINE
  // ==========================================
  midiAccess: null,
  midiTimer: null,
  lastRenderedPpq: 0,
  activeHardwareNotes: [],
  // async initMIDIEngine() {
  //     try {
  //         this.midiAccess = await navigator.requestMIDIAccess();
  //         console.log("[HeadlessAPI] Hardware MIDI Access Granted!");
  //     } catch (err) {
  //         console.warn("[HeadlessAPI] MIDI Access Denied.", err);
  //     }
  // },
  startMidiScheduler() {
    this.midiTimer && clearInterval(this.midiTimer), this.midiTimer = setInterval(() => {
      this.isPlaying() ? this.processHardwareMidi(this.getPlaybackPosition()) : (this.flushHardwareMidi(), this.lastRenderedPpq = this.getPlaybackPosition());
    }, 10);
  },
  sendMidiMessage(u, i, t, d, o = 0) {
    if (!this.midiAccess) return;
    let r = this.midiAccess.outputs.get(u);
    if (!r) return;
    let s = i & 240 | o & 15;
    (i & 240) === 192 || (i & 240) === 208 ? r.send([s, t]) : d !== void 0 ? r.send([s, t, d]) : r.send([s, t]);
  },
  processHardwareMidi(u) {
    u < this.lastRenderedPpq && (this.flushHardwareMidi(), this.lastRenderedPpq = -1e-3);
    for (let i = this.activeHardwareNotes.length - 1; i >= 0; i--) {
      let t = this.activeHardwareNotes[i];
      u >= t.endPpq && (this.sendMidiMessage(t.portId, 128, t.pitch, 0, t.channel), this.activeHardwareNotes.splice(i, 1));
    }
    for (let i = 0; i < G.tracks.length; i++) {
      let t = G.tracks[i];
      if (t.type !== "midi" || t.midiOutId === "none" || t.midiOutId === "fluidsynth") continue;
      let d = t.midiChannel;
      for (let o of t.clips || [])
        if (u >= o.start && u < o.start + o.length)
          for (let r of o.notes) {
            let s = o.start + r.start, n = s + r.length;
            if (s > this.lastRenderedPpq && s <= u) {
              let c = r.velocity !== void 0 ? r.velocity : 100;
              this.sendMidiMessage(t.midiOutId, 144, r.pitch, c, d), this.activeHardwareNotes.push({
                portId: t.midiOutId,
                channel: d,
                trackIndex: i,
                pitch: r.pitch,
                endPpq: n
              });
            }
          }
    }
    this.lastRenderedPpq = u;
  },
  flushHardwareMidi() {
    this.activeHardwareNotes.forEach((u) => {
      this.sendMidiMessage(u.portId, 128, u.pitch, 0, u.channel);
    }), this.activeHardwareNotes = [];
  },
  // Inside HeadlessAPI.MediMuse
  async generateBiometrics(u = "MIDI", i = !0) {
    try {
      at.emit("MEDIMUSE_JOB_STARTED", { jobType: u });
      const t = {
        jobType: u,
        useVibeTempo: i,
        processTempo: 120
      }, d = await this.MediMuse.generateAndPoll(t, (o, r) => {
        at.emit("MEDIMUSE_JOB_PROGRESS", { status: o, data: r });
      });
      return at.emit("MEDIMUSE_JOB_COMPLETE", d), d;
    } catch (t) {
      throw at.emit("MEDIMUSE_JOB_FAILED", { error: t.message }), t;
    }
  },
  // ==========================================
  // HARDWARE AUDIO I/O ROUTING
  // ==========================================
  activeAudioInputStream: null,
  // 1. Ask the browser what is plugged in
  async getHardwareAudioDevices() {
    await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: !1,
        autoGainControl: !1,
        noiseSuppression: !1
      }
    }).catch(() => {
    });
    const u = await navigator.mediaDevices.enumerateDevices();
    return {
      inputs: u.filter((i) => i.kind === "audioinput"),
      outputs: u.filter((i) => i.kind === "audiooutput")
    };
  },
  // 3. Route an Input Soundcard directly into the C++ Engine!
  async connectAudioInput(u, i) {
    this.activeAudioInputStream && this.activeAudioInputStream.getTracks().forEach((o) => o.stop());
    const t = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: { exact: u }, echoCancellation: !1, autoGainControl: !1, noiseSuppression: !1 }
    });
    this.activeAudioInputStream = t, window.sharedAudioCtx.createMediaStreamSource(t).connect(window.wasmWorkletNode, 0, i), console.log(`[HeadlessAPI] Microphone routed to C++ Track ${i}`);
  },
  getSampleRate() {
    return E.getSampleRate();
  },
  // ==========================================
  // HARDWARE CV / HID ROUTING
  // ==========================================
  activeHidDevice: null,
  isRecordingCV: !1,
  liveCvBuffer: [],
  // Temporarily holds data while recording
  // 3. Parse the binary data from the microcontroller
  handleIncomingHeartData(u) {
    const t = new DataView(u.data.buffer).getFloat32(0, !0);
    this.isRecordingCV && this.isPlaying() && this.liveCvBuffer.push({
      time: this.getPlaybackPosition(),
      val: t
    });
  },
  // 1. The Global Security Unlock
  async requestAllPermissions() {
    try {
      return (await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: !1,
          autoGainControl: !1,
          noiseSuppression: !1
        }
      })).getTracks().forEach((i) => i.stop()), navigator.requestMIDIAccess && (this.midiAccess = await navigator.requestMIDIAccess()), !0;
    } catch (u) {
      throw console.error("[HeadlessAPI] Failed to get hardware permissions:", u), u;
    }
  },
  // 2. Fetch Audio Devices securely
  async getAudioDevices() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices)
      return { inputs: [], outputs: [] };
    try {
      const u = await navigator.mediaDevices.enumerateDevices();
      return {
        inputs: u.filter((i) => i.kind === "audioinput" && i.deviceId !== "default" && i.deviceId !== "communications"),
        outputs: u.filter((i) => i.kind === "audiooutput" && i.deviceId !== "default" && i.deviceId !== "communications")
      };
    } catch (u) {
      return console.error("[HeadlessAPI] Failed to enumerate audio devices", u), { inputs: [], outputs: [] };
    }
  },
  async setAudioOutput(u) {
    if (localStorage.setItem("biodaw_preferred_audio_out", u), window.sharedAudioCtx && typeof window.sharedAudioCtx.setSinkId == "function")
      try {
        await window.sharedAudioCtx.setSinkId(u);
        const i = window.sharedAudioCtx.destination.maxChannelCount;
        if (window.sharedAudioCtx.destination.channelCount = i, window.sharedAudioCtx.destination.channelCountMode = "explicit", window.sharedAudioCtx.destination.channelInterpretation = "discrete", E.get() && E.get().wasmNode) {
          const t = E.get().wasmNode;
          t.disconnect(), t.channelCount = i, t.channelCountMode = "explicit", t.channelInterpretation = "discrete", t.connect(window.sharedAudioCtx.destination);
        }
        console.log(`[HeadlessAPI] Routed Master Bus to Output: ${u}`), console.log(`[HeadlessAPI] 🚀 Pipeline unlocked to ${i} discrete channels!`);
      } catch (i) {
        console.error("[HeadlessAPI] Failed to route audio output:", i);
      }
  },
  // 4. Prompt the user for the custom TinyUSB HID Device
  async connectHeartMonitor(u = 51966) {
    try {
      const i = await navigator.hid.requestDevice({ filters: [{ vendorId: u }] });
      return i.length === 0 ? !1 : (this.activeHidDevice = i[0], await this.activeHidDevice.open(), console.log(`[HeadlessAPI] Connected to WebHID: ${this.activeHidDevice.productName}`), this.activeHidDevice.addEventListener("inputreport", (t) => {
      }), !0);
    } catch (i) {
      return console.error("[HeadlessAPI] WebHID Connection Failed:", i), !1;
    }
  },
  // ==========================================
  // CLIP & REGION MANAGEMENT
  // ==========================================
  removeClip(u) {
    let i = null, t = -1;
    for (let o of G.tracks)
      if (t = o.clips.findIndex((r) => r.id === u), t !== -1) {
        i = o;
        break;
      }
    if (!i || t === -1) return;
    const d = i.clips[t];
    if (E.get() && (d.type === "midi" ? E.removeMidiClip(i.cppTrackId, u) : typeof E.get()._remove_channel == "function" && E.get()._remove_channel(u)), (d.type === "audio" || d.type === "cv") && d.assetPath && this.audioMemoryPool && this.audioMemoryPool.has(d.assetPath)) {
      const o = this.audioMemoryPool.get(d.assetPath);
      o.refCount--, o.refCount <= 0 && this.audioMemoryPool.delete(d.assetPath);
    }
    i.clips.splice(t, 1), G.markDirty();
  },
  getDiagnostics() {
    return E.getDiagnostics();
  },
  // Add this new method to the HeadlessAPI object:
  setTrackOutputLane(u, i) {
    const t = G.tracks.find((d) => d.id === u);
    t && (t.outputLane = i, G.markDirty(), E.setTrackOutputLane(t.cppTrackId, i));
  },
  // ==========================================
  // 9. OFFLINE RENDER / BOUNCE TO WAV
  // ==========================================
  /**
   * Render the project to a stereo WAV file and trigger a browser download.
   *
   * @param {number}  startPpq  Start position in PPQ (default: 0)
   * @param {number}  endPpq    End position in PPQ   (default: project end)
   * @param {string}  filename  Download filename      (default: "<projectName>.wav")
   * @returns {Promise<void>}
   */
  async bounceToWav(u = 0, i = null, t = null) {
    const d = E.get();
    if (!d) throw new Error("[BioDAW] Engine not ready");
    const o = this.getSampleRate();
    if (i === null) {
      let g = 4;
      G.tracks.forEach((b) => {
        (b.clips || []).forEach((l) => {
          const y = (l.start || 0) + (l.length || 0);
          y > g && (g = y);
        });
      }), i = g + 8;
    }
    t || (t = `${G.name || "mixdown"}.wav`);
    const r = this.ppqToAbsoluteSeconds(i) - this.ppqToAbsoluteSeconds(u), s = Math.ceil(r * o), n = s * 2;
    console.log(`[BioDAW] Bounce: ${u.toFixed(2)} – ${i.toFixed(2)} PPQ | ${r.toFixed(2)}s | ${s} frames`);
    const c = window.sharedAudioCtx, p = c ? c.state === "suspended" : !0;
    c && !p && await c.suspend();
    let w = 0;
    try {
      const g = n * Float32Array.BYTES_PER_ELEMENT, b = d._malloc(g);
      if (!b) throw new Error("[BioDAW] Failed to malloc render buffer");
      w = d.ccall(
        "biodaw_offline_render",
        "number",
        ["number", "number", "number", "number"],
        [u, i, b, s]
      ), console.log(`[BioDAW] C++ wrote ${w} stereo frames`);
      const l = new Float32Array(d.HEAPF32.buffer, b, w * 2).slice();
      d._free(b);
      const y = this._encodeWav(l, w, 2, o);
      this._triggerDownload(y, t), console.log(`[BioDAW] ✅ Bounce complete → ${t}`);
    } finally {
      c && !p && await c.resume();
    }
  },
  /** @private — Convert a Float32 interleaved PCM array to a 16-bit WAV Blob */
  _encodeWav(u, i, t, d) {
    const s = t * 2, n = d * s, c = i * s, p = 44, w = new ArrayBuffer(p + c), g = new DataView(w), b = new Int16Array(w, p), l = (y, h) => {
      for (let m = 0; m < h.length; m++) g.setUint8(y + m, h.charCodeAt(m));
    };
    l(0, "RIFF"), g.setUint32(4, 36 + c, !0), l(8, "WAVE"), l(12, "fmt "), g.setUint32(16, 16, !0), g.setUint16(20, 1, !0), g.setUint16(22, t, !0), g.setUint32(24, d, !0), g.setUint32(28, n, !0), g.setUint16(32, s, !0), g.setUint16(34, 16, !0), l(36, "data"), g.setUint32(40, c, !0);
    for (let y = 0; y < u.length; y++) {
      const h = Math.max(-1, Math.min(1, u[y]));
      b[y] = h < 0 ? h * 32768 : h * 32767;
    }
    return new Blob([w], { type: "audio/wav" });
  },
  /** @private — Create a hidden anchor and fire a click to download a Blob */
  _triggerDownload(u, i) {
    const t = URL.createObjectURL(u), d = document.createElement("a");
    d.style.display = "none", d.href = t, d.download = i, document.body.appendChild(d), d.click(), setTimeout(() => {
      URL.revokeObjectURL(t), d.remove();
    }, 5e3);
  },
  ppqToAbsoluteSeconds(u) {
    const i = G.tempoMap;
    let t = i[0];
    for (let r = 1; r < i.length && i[r].ppq <= u; r++)
      t = i[r];
    const d = u - t.ppq, o = t.bpm / 60;
    return t.time + d / o;
  },
  absoluteSecondsToPpq(u) {
    const i = G.tempoMap;
    let t = i[0];
    for (let r = 1; r < i.length && i[r].time <= u; r++)
      t = i[r];
    const d = u - t.time, o = t.bpm / 60;
    return t.ppq + d * o;
  }
}, yt = new WebSocket("ws://localhost:8880");
let zt = [], It = !1;
yt.onopen = () => {
  for (It = !0, console.log("🔌 [Bridge] WebSocket Connected!"); zt.length > 0; )
    yt.send(zt.shift());
};
yt.onclose = () => {
  It = !1, console.warn("🔌 [Bridge] WebSocket Disconnected.");
};
yt.onerror = (u) => {
  It = !1;
};
qt.isBridgeReady = () => It;
window.onPdGuiMessage = (u) => {
  typeof yt < "u" && yt.readyState === 1 && yt.send(u);
};
yt.onmessage = (u) => {
  E.get() && E.get().ccall(
    "biodaw_gui_receive",
    null,
    // Return type (void)
    ["string"],
    // Argument types
    [u.data]
    // The FUDI string from the Desktop GUI
  );
};
export {
  qt as HeadlessAPI
};
