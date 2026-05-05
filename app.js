// ═══════════════════════════════════════════════
// WISSENSABFRAGEN — Core Application
// ═══════════════════════════════════════════════

const APP = {
  version: '1.0.0',
  storageKeys: {
    sessions: 'wa_sessions',
    questions: 'wa_questions',
    submissions: 'wa_submissions',
    materials: 'wa_materials',
    settings: 'wa_settings',
    adminPin: 'wa_admin_pin',
  },

  // ── Storage ──────────────────────────────────
  get(key) {
    try { return JSON.parse(localStorage.getItem(key)) || []; }
    catch { return []; }
  },
  getObj(key, def = {}) {
    try { return JSON.parse(localStorage.getItem(key)) || def; }
    catch { return def; }
  },
  set(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  },

  // ── ID & Dates ───────────────────────────────
  uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); },
  now() { return new Date().toISOString(); },
  formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
  },
  formatShortDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric' });
  },

  // ── Toast Notifications ───────────────────────
  toast(msg, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    container.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(100%)'; t.style.transition = '0.2s'; setTimeout(() => t.remove(), 200); }, duration);
  },

  // ── Modal Helpers ─────────────────────────────
  openModal(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.add('open'); document.body.style.overflow = 'hidden'; }
  },
  closeModal(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.remove('open'); document.body.style.overflow = ''; }
  },

  // ── Admin Auth ────────────────────────────────
  isAdmin() { return sessionStorage.getItem('wa_admin') === '1'; },
  adminLogin(pin) {
    const stored = localStorage.getItem(APP.storageKeys.adminPin) || '1234';
    if (pin === stored) { sessionStorage.setItem('wa_admin', '1'); return true; }
    return false;
  },
  adminLogout() { sessionStorage.removeItem('wa_admin'); },

  // ── Shuffle ────────────────────────────────────
  shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },

  // ── Score Calculation ──────────────────────────
  scoreColor(pct) {
    if (pct >= 75) return 'var(--accent-green)';
    if (pct >= 50) return 'var(--accent-amber)';
    return 'var(--accent-red)';
  },
  scoreLabel(pct) {
    if (pct >= 90) return 'Hervorragend';
    if (pct >= 75) return 'Bestanden';
    if (pct >= 50) return 'Ausreichend';
    return 'Nicht bestanden';
  },

  // ── Question Auto-Score ────────────────────────
  autoScore(question, userAnswer) {
    if (question.type === 'freitext') return null; // manual
    if (question.type === 'multiple_choice') {
      const correct = question.options.filter(o => o.correct).map(o => o.id).sort().join(',');
      const given = (Array.isArray(userAnswer) ? userAnswer : [userAnswer]).sort().join(',');
      return correct === given ? question.points : 0;
    }
    if (question.type === 'single_choice') {
      const correct = question.options.find(o => o.correct)?.id;
      return userAnswer === correct ? question.points : 0;
    }
    if (question.type === 'zuordnung') {
      if (!userAnswer || typeof userAnswer !== 'object') return 0;
      let pts = 0;
      question.pairs.forEach(p => { if (userAnswer[p.left] === p.right) pts++; });
      return Math.round((pts / question.pairs.length) * question.points);
    }
    return null;
  },
};

// ═══════════════════════════════════════════════
// QUESTION TYPES
// ═══════════════════════════════════════════════
const Q_TYPES = {
  single_choice:  { label: 'Auswahlfrage',    icon: '◉' },
  multiple_choice:{ label: 'Multiple Choice', icon: '☑' },
  freitext:       { label: 'Freitext',        icon: '✎' },
  zuordnung:      { label: 'Zuordnung',       icon: '⇌' },
};

// ═══════════════════════════════════════════════
// API — KI-Fraggenerierung
// ═══════════════════════════════════════════════
const AI = {
  async generateQuestions(material, count, types, apiKey) {
    const typeList = types.join(', ');
    const prompt = `Du bist ein Experte für Wissensabfragen im Sicherheits- und Einsatzbereich.

Analysiere folgendes Material und erstelle genau ${count} Fragen daraus.
Nutze diese Fragetypen: ${typeList}

Verteile die Fragetypen möglichst gleichmäßig.

MATERIAL:
---
${material}
---

Antworte NUR mit einem gültigen JSON-Array ohne Markdown, exakt dieses Schema:
[
  {
    "type": "single_choice",
    "text": "Frage hier?",
    "points": 1,
    "options": [
      {"id": "a", "text": "Option A", "correct": true},
      {"id": "b", "text": "Option B", "correct": false},
      {"id": "c", "text": "Option C", "correct": false},
      {"id": "d", "text": "Option D", "correct": false}
    ]
  },
  {
    "type": "multiple_choice",
    "text": "Frage hier?",
    "points": 2,
    "options": [
      {"id": "a", "text": "Option A", "correct": true},
      {"id": "b", "text": "Option B", "correct": true},
      {"id": "c", "text": "Option C", "correct": false}
    ]
  },
  {
    "type": "freitext",
    "text": "Frage hier?",
    "points": 3,
    "sampleAnswer": "Beispielantwort hier"
  },
  {
    "type": "zuordnung",
    "text": "Ordne die folgenden Begriffe zu:",
    "points": 2,
    "pairs": [
      {"left": "Begriff A", "right": "Definition A"},
      {"left": "Begriff B", "right": "Definition B"}
    ]
  }
]

Nur die tatsächlich nötigen Typen einbauen. Antworte ausschließlich mit dem JSON-Array.`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `API-Fehler ${res.status}`);
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return parsed.map(q => ({ ...q, id: APP.uid() }));
  },
};
