// ═══════════════════════════════════════════════════════
// WISSENSABFRAGEN — Core App v3.0
// ═══════════════════════════════════════════════════════

const APP = {
  version: '3.0.0',
  storageKeys: {
    sessions:     'wa_sessions',
    questions:    'wa_questions',
    submissions:  'wa_submissions',
    materials:    'wa_materials',
    settings:     'wa_settings',
    adminPin:     'wa_admin_pin',
    feedback:     'wa_feedback',
    initialized:  'wa_initialized_v3',
  },

  // ── Storage ──────────────────────────────────────────
  get(key)          { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } },
  getObj(key, d={}) { try { return JSON.parse(localStorage.getItem(key)) || d; } catch { return d; } },
  set(key, val)     { try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) { console.error('Storage error', e); } },

  // ── Helpers ──────────────────────────────────────────
  uid()   { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); },
  now()   { return new Date().toISOString(); },
  formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
  },
  formatShortDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric' });
  },
  formatCountdown(seconds) {
    if (seconds <= 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  },

  // ── Toast ─────────────────────────────────────────────
  toast(msg, type = 'info', duration = 3500) {
    const c = document.getElementById('toastContainer');
    if (!c) return;
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transform = 'translateX(100%)';
      t.style.transition = '0.2s';
      setTimeout(() => t.remove(), 200);
    }, duration);
  },

  // ── Modals ────────────────────────────────────────────
  openModal(id)  { const e = document.getElementById(id); if (e) { e.classList.add('open'); document.body.style.overflow = 'hidden'; } },
  closeModal(id) { const e = document.getElementById(id); if (e) { e.classList.remove('open'); document.body.style.overflow = ''; } },

  // ── Auth ──────────────────────────────────────────────
  isAdmin()       { return sessionStorage.getItem('wa_admin') === '1'; },
  adminLogin(pin) { const s = localStorage.getItem(APP.storageKeys.adminPin) || '1234'; if (pin === s) { sessionStorage.setItem('wa_admin','1'); return true; } return false; },
  adminLogout()   { sessionStorage.removeItem('wa_admin'); },

  // ── Misc ──────────────────────────────────────────────
  shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },
  scoreColor(pct)  { if (pct >= 75) return '#3a9a4a'; if (pct >= 50) return '#c8a840'; return '#cc1414'; },
  scoreLabel(pct)  { if (pct >= 90) return 'Hervorragend'; if (pct >= 75) return 'Bestanden'; if (pct >= 50) return 'Ausreichend'; return 'Nicht bestanden'; },

  autoScore(question, userAnswer) {
    if (question.type === 'freitext') return null;
    if (question.type === 'single_choice') {
      const correct = question.options.find(o => o.correct)?.id;
      return userAnswer === correct ? question.points : 0;
    }
    if (question.type === 'multiple_choice') {
      const correct = question.options.filter(o => o.correct).map(o => o.id).sort().join(',');
      const given   = (Array.isArray(userAnswer) ? userAnswer : [userAnswer]).sort().join(',');
      return correct === given ? question.points : 0;
    }
    if (question.type === 'zuordnung') {
      if (!userAnswer || typeof userAnswer !== 'object') return 0;
      let pts = 0;
      question.pairs.forEach(p => { if (userAnswer[p.left] === p.right) pts++; });
      return Math.round((pts / question.pairs.length) * question.points);
    }
    return null;
  },

  // Session remaining time in seconds
  sessionRemainingSeconds(session) {
    if (!session.timer || session.timer === 0) return null;
    if (!session.startedAt) return session.timer * 60;
    const elapsed = Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000);
    return Math.max(0, session.timer * 60 - elapsed);
  },
};

// ── Question types ────────────────────────────────────
const Q_TYPES = {
  single_choice:  { label: 'Auswahlfrage',    icon: '◉' },
  multiple_choice:{ label: 'Multiple Choice', icon: '☑' },
  freitext:       { label: 'Freitext',        icon: '✎' },
  zuordnung:      { label: 'Zuordnung',       icon: '⇌' },
};

// ═══════════════════════════════════════════════════════
// KI-INTEGRATION
// ═══════════════════════════════════════════════════════
const AI = {
  async generateQuestions(material, count, types, apiKey) {
    const typeList = types.join(', ');
    const prompt = `Du bist Experte für militärische Wissensabfragen in der Großen Armee der Republik (GAR), Clone Wars Rollenspiel auf Deutsch.

Erstelle genau ${count} Prüfungsfragen aus folgendem Material. Nutze nur: ${typeList}. Verteile gleichmäßig.

MATERIAL:
---
${material}
---

Antworte NUR mit JSON-Array, kein Markdown:
[
  {"type":"single_choice","text":"Frage?","points":1,"options":[{"id":"a","text":"A","correct":true},{"id":"b","text":"B","correct":false},{"id":"c","text":"C","correct":false},{"id":"d","text":"D","correct":false}]},
  {"type":"multiple_choice","text":"Frage?","points":2,"options":[{"id":"a","text":"A","correct":true},{"id":"b","text":"B","correct":true},{"id":"c","text":"C","correct":false}]},
  {"type":"freitext","text":"Frage?","points":3,"sampleAnswer":"Musterlösung"},
  {"type":"zuordnung","text":"Ordne zu:","points":2,"pairs":[{"left":"Begriff","right":"Definition"},{"left":"Begriff2","right":"Definition2"}]}
]`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
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
    return JSON.parse(clean).map(q => ({ ...q, id: APP.uid() }));
  },
};

// ═══════════════════════════════════════════════════════
// VORINSTALLIERTE LERNMATERIALIEN
// ═══════════════════════════════════════════════════════
const PRESET_MATERIALS = [
  {
    id: 'mat_sg_kern',
    title: 'Strafgesetz – Kernparagraphen',
    category: 'Strafgesetz (SG)',
    content: `§1 Mord: G∞/60, E,T,K – Vorsätzliche Tötung eines humanoiden Lebewesens.
§2 Totschlag: G120/30 E,T,K – Töten außer Notwehr oder valider Exekutionsbefehl.
§3 Fahrlässige Tötung: G90 – Töten durch außer Acht lassen der erforderlichen Sorgfalt.
§4 Hochverrat: G∞/60, E,T,K – Absicht die Republik zu schwächen/stürzen. Umfasst Informationsweitergabe an KUS, bewaffneten Widerstand, Attentate auf Senatoren/Jedi/Kommandeure.
§5 Fahnenflucht: G∞/30 – Flucht vom Dienstposten.
§6 Ungehorsam: G∞, A – Befehl nicht befolgt mit negativen Folgen.
§7 Gehorsamsverweigerung: G90, A – Aktive Befehlsverweigerung.
§8 Widerstand: G30 – Nur für Zivilisten: verzögertes Ausführen von Befehlen.
§9 Körperverletzung: G90 – Verletzen ohne Waffe, außer Notwehr.
§10 Schwere Körperverletzung: G∞ – Verletzen mit Waffe, außer Notwehr.
§11 Gefängnisausbruch: G∞, O – Unerlaubtes Verlassen. Hilfestellung = Hochverrat.
§13 Schwerwiegende Falschaussage: T – Falsche Aussage in Tribunal.
§14 Falschaussage: G30, O – Nachgewiesene Unwahrheiten im Strafverfahren.
§15 Androhung von Gewalt: G90 – Außer Notwehr/Training.
§16 Freiheitsberaubung: G90 – Einsperren/Fesseln außer auf Basis Strafverfahren.
§17 Rechtswidrige Betäubung: G60 – Betäubungswaffe ohne Rechtsgrundlage.
§18 Diebstahl: G60, A – Nicht autorisierte Aneignung fremder Gegenstände.
§19 Sachbeschädigung: G60, A – Beschädigen fremder Besitztümer.
§21 Unerlaubter Waffenbesitz: G60 – Schusswaffe als Zivilist, außer verdeckt getragene Blasterpistole.
§22 Unerlaubter Besitz: G30 – Ausrüstung nicht durch CO/ROK zugewiesen.
§29 Unangemeldete Patrouille: A, G30 – Ohne NO-Genehmigung.
§30 Unangemeldetes Verlassen der Basis: A, G30 – Ohne NO-Genehmigung.
§32 Offenbarung des Dienstgrades: A, G30 – Gegenüber Zivilisten/Feinden; Salutieren im Gefecht.
§33 Beleidigung: A, D – Verbaler Angriff auf Vorgesetzten.
§34 Salutverweigerung: A, D – Weglassen Salut gegenüber Offizier+, außer Gefecht oder bereits heute.
§37 Meuterei: G∞, T – Zusammenrotten zur Gehorsamsverweigerung/KV.
§38 Angriff auf Vorgesetzten: G∞, A – Tätliches Werden.
§44 Wachverfehlung: G30 – Posten verlassen ohne Ablösung.
§45 Rechtswidriger Waffengebrauch: G90 – Ohne Training, Feindkontakt, Notwehr.
§47 Verweigern von Gefangenenrechten: T – Rechte nicht verlesen. Soldat: kein Recht zu schweigen, einmaliges Recht Vorgesetzten zu sprechen. Zivilist: Recht zu schweigen.
§48 Missbrauch von Kriegsgefangenen: G∞ – Foltern, Verletzen, Töten verboten, außer Tribunal.
§49 Folter: G∞ – Foltern eines humanoiden Lebewesens.
§61 Manipulation ARC-Prüfung: E,T,R,K,A – Prüfungsinhalte herausgeben, betrügen.
§66 Geheimnisverrat: T – Geheiminformationen an Unbefugte.
§67 Unterlassene Hilfeleistung: G90 – Keine Hilfe bei Unglücksfällen.
§85 Identitätsfälschung: G120 – Fremde Identität vortäuschen, nicht zugewiesenen Rang führen.
§86 Vortäuschen von Befehlsgewalt: G∞ – Als weisungsbefugte Person ausgeben ohne Berechtigung.
§89 Unerlaubte Flugbewegung: G90 – Starten/Landen ohne NO-Genehmigung. Ausnahme: 3 Versuche (30 Sek. Abstand) ohne Antwort.
§93 Rechtswidriges Steuern von Großkreuzern: G∞ – Steuerelemente bedienen ohne ausgebildetes RN-Mitglied.
§94 Widerstand gegen Flugaufsicht: G90 – NO-Anweisungen als Pilot verweigern.
§107 Unerlaubtes Hacken: G∞ – Unbefugtes Eindringen in republikanische Systeme.
§108 Technische Sabotage: G∞ – Zerstörung/Manipulation technischer Infrastruktur.
§115 Eigenmächtiges Feuern: G∞ – Feuer ohne Befehl, Notwehr oder Freigabe.
§119 Propaganda gegen Republik: G∞ – Feindliche Informationen verbreiten.
§148 Befehlsverweigerung im Einsatz: X – Im Gefecht Befehl vorsätzlich nicht befolgen.`,
  },
  {
    id: 'mat_rg_kern',
    title: 'Regelungsgesetz – Struktur & Posten',
    category: 'Regelungsgesetz (RG)',
    content: `§1 Commanding Officer (CO): Aktiver Einsatzleiter. Kann nicht festgenommen werden.
§2 Executive Officer (XO): Durch CO ernannt. Vollständig weisungsbefugt. Übernimmt CO bei Befehlsunfähigkeit.
§3 Naval Officer (NO): Ranghöchster Fleet Crew. Besetzt ATC. Ist Beschwerdestelle.
§5 Security Officer (SO): Ranghöchster Schocktruppen/Kamino/Coruscant Guard.
§6 Medical Officer (MO): Ranghöchster Medical Platoon.
§7 Technical Officer (TO): Ranghöchster Engineering Company.
§8 Notwehr: Nicht rechtswidrig wenn gegenwärtigen rechtswidrigen Angriff abwendet. Geschütztes Interesse muss beeinträchtigtes wesentlich überwiegen.
§9 Verjährung: 4 Wochen ab Tatzeitpunkt. Ausnahmen: §1,§2,§4,§75,§200-§202,§206,§207.
§11 Hausrecht: CO über gesamte Basis/Schiff. NO über Brücke/Hangare/ATC/Tore. SO über Gefängnis/Checkpoints. TO über technische Bereiche. MO über Sanitätsstation.
§12 Weisungsbefugnis: Befehlsbefugt ist wer Oberbefehlshaber ist, im Namen ROK handelt, CO-Posten innehat, höheren Dienstgrad hat, Teil Exekutivgewalt (Strafverfahren).
§13 Exekutivgewalt: Schocktruppen, Coruscant Guard, Kamino Guard, 5. Flottensicherheit, SEB (angefordert), ROK-Ernannte.
§14 Dienstgruppen: TRP-SFC=Untere Mannschaft. LCPL-1CPL=Obere Mannschaft. SGT-SMJ=Unteroffizier. LT-1LT=Offizier. CPT-Commander=Stabsoffizier. SCMD+=Generalität/Admiralität.
§15 Bestrafungen zulässig: Gefängnisstrafe max. 120 ZE, Degradierung, Disziplinarmaßnahmen, Beförderungssperre max. 2 Wochen, Exekution. Unzulässig: KV (außer Exekution), Kollektivstrafen, Verweis bei Klonen.
§16 Strafverfahren: Nur durch Exekutivgewalt. Benötigt Verdacht und Rechtsgrundlage. Kategorien: Aurek=laufend, Besh=Strafe Exekutive, Cresh=Tribunal, Nirn=Freispruch.
§17 Festnahme: Betäubungswaffe nur bei akuter Flucht oder Widerstand. Unkooperatives Gehverhalten=Widerstand.
§18 Tribunal: 3 ranghöchste Soldaten. Exekutivgewalt darf nie Mitglied sein. Kernablauf: Eröffnung→Tatvorwurf→Zeugen Anklage→Zeugen Verteidigung→Tathergang→Verteidigung→Zeugenanhörung→Schuldbekenntnis→Bestrafungsvorschlag.
§18a Schnelles Tribunal: Bei <G60 in Gefängniszelle. Min. 2 Min. Anhörung.
§18b Kampftribunal: CO+XO+SO. Nur Kapitalverbrechen. Nur einstimmig. Nur Freispruch oder Exekution.
§21 Disziplinarbefugnis: Höherer Dienstgrad + gleiche Einheit + mind. Unteroffizier. Oder CO/XO. Oder Stabsoffizier.
§22 Lizenzen: Alle Flugobjekte/Bodenfahrzeuge = AVP-Einheitsleiter. AT-/TX-Serien = Torrent/Ghost Company.
§24 Autorisierungsstufen: Alpha=Stabsoffizier+. Bravo=Offizier+. Charlie=Unteroffizier+. Delta=Techniker/Mediziner. Echo=alle GAR-Mitglieder.
§26 DEFCON: 0=Normal, 5=Bereitschaft, 4=Annäherung, 3=Angriff, 2=Infiltration, 1=Evakuierung.`,
  },
  {
    id: 'mat_funkcodes',
    title: 'Funkcodes & Militäralphabet',
    category: 'Kommunikation',
    content: `Funkcodes:
10-1: Melde mich im Dienst/Funk
10-2: Wiederholen, nicht verständlich
10-3: Negativ, Lehne ab, Stimme nicht zu
10-4: Positiv, Bestätige, Habe verstanden
10-5: Brauche Unterstützung
10-5(Einheit): Brauche Unterstützung bestimmter Einheit
10-6: Feind gesichtet
10-7: Unidentifizierte Person
10-8: Erbitte Starterlaubnis
10-9: Erbitte Landeerlaubnis
10-10: Erbitte Öffnung Basis/Hangartore
10-11: Erwarte Befehle
10-15a: Einheiten vorrücken
10-15b: Einheiten zurückziehen
10-18a: Melde mich vom Dienst ab
10-20: Standortabfrage/Standortübermittlung

Militäralphabet:
A=Aurek, B=Besh, C=Cresh, D=Dorn, E=Esk, F=Forn, G=Grek, H=Herf, I=Isk, J=Jenth, K=Krill, L=Leth, M=Mern, N=Nirn, O=Osk, P=Peth, Q=Qek, R=Reesh, S=Senth, T=Trill, U=Usk, V=Vev, W=Wesk, X=Xesh, Y=Yirt, Z=Zerek`,
  },
  {
    id: 'mat_raenge',
    title: 'Rangfolge & Dienstgrade',
    category: 'Struktur',
    content: `Heer → Navy:
GEN=General → ADM=Admiral
MCMD=Marshall Commander → VADM=Vice Admiral
SCMD=Senior Commander → RADM=Rear Admiral
CMD=Commander → CMDR=Commodore
MJR=Major → CMD=Commander
CPT=Captain → CPT=Captain
1LT=First Lieutenant → LTCMD=Lieutenant-Commander
LT=Lieutenant → LT=Lieutenant
SMJ=Sergeant Major → ENS=Ensign
FSGT=First Sergeant → MSM=Midshipman
MSGT=Master Sergeant → CPO=Chief Petty Officer
SGT=Sergeant → SPO=Senior Petty Officer
1CPL=First Corporal → PO=Petty Officer
CCPL=Chief Corporal → CDO=Chief Deck Officer
CPL=Corporal → SDO=Senior Deck Officer
LCPL=Lance Corporal → DO=Deck Officer
SFC=Specialist First Class → SCM=Senior Crewman
SPC=Specialist → CM=Crewman
PFC=Private First Class → JCM=Junior Crewman
PVT=Private → FCT=Fleet Cadet
TRP=Trooper → TRP=Trooper

Dienstgruppen:
Untere Mannschaft: TRP bis SFC
Obere Mannschaft: LCPL bis 1CPL
Unteroffizier: SGT bis SMJ
Offizier: LT bis 1LT
Stabsoffizier: CPT bis Commander
Generalität/Admiralität: Senior Commander und höher

Motto der 5. Flotte: INTEGRITÄT, LOYALITÄT, AUTORITÄT

Verbände:
Linie: kommandiert durch LT oder LTCMD
Sektion: kommandiert durch Captain
Geschwader: kommandiert durch Captain oder Commodore
Flotte: kommandiert durch Admiral
Armada: kommandiert durch Jedi-Generäle`,
  },
  {
    id: 'mat_defcon',
    title: 'DEFCON-Stufen',
    category: 'Einsatzprotokoll',
    content: `DEFCON 0 – NORMALBETRIEB: Keine Gefahr. Freizeitaktivitäten gestattet.

DEFCON 5 – BEREITSCHAFTSALARM:
Voraussetzungen: Unbekannte Bedrohungslage / Kampfeinsatz bevorsteht.
Maßnahmen: Trainings abbrechen (außer TOs). Alle kampfbereit. Einsatzleitungsfunk besetzen. Salutieren UNTERSAGT. Vorgesetzte mit Rufnamen oder Sir ansprechen.

DEFCON 4 – ANNÄHERUNGSALARM:
Voraussetzungen: Unbekannte Ziele in unmittelbarer Nähe, Angriff nicht ausgeschlossen.
Maßnahmen: Verteidigungspositionen. Kontaktaufnahme per FK. Befehlshabende in Einsatzleitungsfunk. Verteidigungsanlagen aktivieren. Sternenjäger vorbereiten.

DEFCON 3 – ANGRIFFSALARM:
Voraussetzungen: Feinde außerhalb greifen aktiv an.
Maßnahmen: Verteidigungspositionen. Alle Verteidigungsanlagen aktivieren. Oberkommando informieren.

DEFCON 2 – INFILTRATIONSALARM:
Voraussetzungen: Feinde auf Basisgelände/Schiff.
Maßnahmen: Infanterie (TC,GHC) patrouilliert im Buddy-System. Spezialisierte Einheiten sichern Infrastruktur. ID-Kontrollen. Verstärkung anfordern.

DEFCON 1 – EVAKUIERUNG:
Voraussetzungen: Kontrolle nicht rückgewinnbar. Nur Ranghöchster darf ausrufen.
Maßnahmen: Evakuierungsplan via Ankündigungsfunk. Verletzte Rot (nicht transportfähig) zurücklassen. Geheime Daten vernichten. Selbstzerstörungsmodus aktivieren.`,
  },
  {
    id: 'mat_konsolen',
    title: 'Konsolen & Militärvokabular',
    category: 'Schiffsbetrieb',
    content: `Konsolen:
ATC-Konsole: Luftverkehrsüberwachung → Naval Officer
Raumbelegungskonsole: Räume Soldaten zuordnen → Naval Officer
Ankündigungskonsole: Durchsagen innerhalb Basis/Schiff
Scan-Konsole: Aktive Signalunterscheidung, höhere Reichweite → Scanoffizier
Waffenkonsole: Turbolaser (aktiv) + Punktverteidigung (passiv) → Waffenoffizier
Kommunikationskonsole: Funksprüche + Antennen → Kommunikationsoffizier
Nautische Konsole: Flugbahn und Hyperraumsprung → Nautischer Offizier
Maschinenkonsole: Sublichtantriebe + Geschwindigkeit → Maschinenoffizier
Hyperraumsystem: Ausrichtung Hyperraumsprung → Steuermann
Lagetisch: Live-Radar auf Tisch
Holotisch: Holografische Übertragungen

Militärische Begriffe:
Grundhaltung: Gerader Stand, Hände hinter dem Rücken
Stillgestanden: Gerader Stand, Kopf geradeaus, Hände an Seiten
Achtung: Stillgestanden + Salut
Rühren: Grundhaltung einnehmen
Antreten: Vor Vorgesetztem in Linie ranggeordnet aufstellen (ab SDO+ salutieren)
Wegtreten: Freigang genehmigt
Kolonne: In einer Reihe stehen/marschieren
Rechts-um: 90° nach rechts über rechte Schulter
Links-um: 90° nach links über linke Schulter
Kehrt-um: 180° drehen über rechte Schulter
Stille Fahrt: Alle Systeme auf Minimum (Tarnung vor Sensoren)
Backbord: Linke Seite des Schiffes
Steuerbord: Rechte Seite des Schiffes
Bug: Vorderseite des Schiffes
Heck: Hinterseite des Schiffes
RSS: Republic Star Ship
RAS: Republic Army Ship (Truppentransport)
RSD: Republic Star Destroyer
RCS: Republic Carrier Ship`,
  },
  {
    id: 'mat_schiffe',
    title: 'Schiffsklassen',
    category: 'Flottenorganisation',
    content: `GAR-Schiffe:
Venator (RSS/RSD): Sternzerstörer/Träger – Hauptkampfschiff der GAR
Acclamator (RAS): Kreuzer/Transporter/Versorgungsschiff – Truppenlandung
Arquitens: Leichter Kreuzer – Eskortaufgaben
Victory (RSD): Sternzerstörer – Schiff-zu-Schiff Kampf
Secutor (RCS): Sternzerstörer/Träger – Trägerfunktion
Pelta: Fregatte
CR-90: Korvette (GAR/Fraktionslos)
Consular: Korvette (GAR/Fraktionslos)
C-70: Korvette (GAR/Fraktionslos)
Quasar: Träger (GAR/Fraktionslos)

KUS-Schiffe:
Munificent: Fregatte
Providence: Zerstörer/Träger
Recusant: Zerstörer
Lucrehulk: Schlachtschiff/Träger
Subjugator: Dreadnought
DH-Omni: Versorgungsschiff
C9979: Landungsschiff
Hardcell: Transporter

Mandalorianer:
Kom'rk: Jäger/Landungsschiff
Fang: Jäger
Kandosii: Schlachtschiff`,
  },
  {
    id: 'mat_einheiten',
    title: 'Einheiten & Kürzel',
    category: 'Struktur',
    content: `Einheitskürzel:
GHC=Ghost Company (212th) – Hauptinfanterie, Aufklärung, Scharfschützen, Orts-&Häuserkampf
EC=Engineering Company – Pioniere, Stellungsbau, Wartung, Brandbekämpfung, BSQ
TC=Torrent Company (501st) – Hauptinfanterie, Vorhut, schwere Infanterie, Grenadiere
MP=Medical Platoon – Medizinische Versorgung, Forschung
ST=Schocktruppen – Schutz Infrastruktur, Strafverfolgung, Personenschutz
FC=Fleet Crew (RN) – ATC, Fernmeldewesen, Kreuzersteuerung, Sektorkontrolle
AVP=Armored Vehicle Platoon (RN) – Piloten, Panzerfahrer, Transport
GM=Galactic Marines (RN) – CQC, Sturm, Brückensicherung, Extremwetter
ARC=Advanced Recon Commando – Lokale Distribution der SEB
SEB=Sondereinsatzbrigade – Inlandsgeheimdienst
RIS=Republic Intelligence Service – Auslandsgeheimdienst
ROK=Republikanisches Oberkommando

Offiziersposten-Kürzel:
CO=Commanding Officer
XO=Executive Officer
SO=Security Officer
MO=Medical Officer
TO=Technical Officer
NO=Naval Officer

Orte-Kürzel:
MH=Main Hangar, OH=Oberer Hangar, UH=Unterer Hangar, SH=Seitenhangar
GF=Gefängnis, AP=Außenposten

Sonstiges:
ATC=Air Traffic Control, TO=TryOut, AV=Auswahlverfahren
EB=Einheitsbesprechung, FB=Fortbildung, FEB=Führungsebenebesprechung`,
  },
];

// ═══════════════════════════════════════════════════════
// 200+ VORGEFERTIGTE PRÜFUNGSFRAGEN
// ═══════════════════════════════════════════════════════
const PRESET_QUESTIONS = [
  // ── FUNKCODES ────────────────────────────────────────
  { id:'q001', type:'single_choice', text:'Was bedeutet der Funkcode 10-4?', points:1, category:'Funkcodes', options:[{id:'a',text:'Brauche Unterstützung',correct:false},{id:'b',text:'Positiv, Bestätige, Habe verstanden',correct:true},{id:'c',text:'Feind gesichtet',correct:false},{id:'d',text:'Melde mich im Dienst',correct:false}]},
  { id:'q002', type:'single_choice', text:'Was bedeutet der Funkcode 10-6?', points:1, category:'Funkcodes', options:[{id:'a',text:'Erbitte Starterlaubnis',correct:false},{id:'b',text:'Unidentifizierte Person',correct:false},{id:'c',text:'Feind gesichtet',correct:true},{id:'d',text:'Erwarte Befehle',correct:false}]},
  { id:'q003', type:'single_choice', text:'Welchen Funkcode verwendest du, wenn du Unterstützung brauchst?', points:1, category:'Funkcodes', options:[{id:'a',text:'10-3',correct:false},{id:'b',text:'10-5',correct:true},{id:'c',text:'10-7',correct:false},{id:'d',text:'10-11',correct:false}]},
  { id:'q004', type:'single_choice', text:'Was bedeutet 10-9?', points:1, category:'Funkcodes', options:[{id:'a',text:'Erbitte Starterlaubnis',correct:false},{id:'b',text:'Erbitte Landeerlaubnis',correct:true},{id:'c',text:'Öffnung der Hangartore',correct:false},{id:'d',text:'Melde mich vom Dienst ab',correct:false}]},
  { id:'q005', type:'single_choice', text:'Welcher Code bedeutet "Einheiten vorrücken"?', points:1, category:'Funkcodes', options:[{id:'a',text:'10-11',correct:false},{id:'b',text:'10-20',correct:false},{id:'c',text:'10-15a',correct:true},{id:'d',text:'10-15b',correct:false}]},
  { id:'q006', type:'single_choice', text:'Was bedeutet 10-3?', points:1, category:'Funkcodes', options:[{id:'a',text:'Positiv, Verstanden',correct:false},{id:'b',text:'Negativ, Lehne ab',correct:true},{id:'c',text:'Melde mich im Dienst',correct:false},{id:'d',text:'Wiederholen',correct:false}]},
  { id:'q007', type:'single_choice', text:'Mit welchem Code meldest du dich vom Dienst ab?', points:1, category:'Funkcodes', options:[{id:'a',text:'10-1',correct:false},{id:'b',text:'10-20',correct:false},{id:'c',text:'10-18a',correct:true},{id:'d',text:'10-11',correct:false}]},
  { id:'q008', type:'single_choice', text:'Was bedeutet 10-20?', points:1, category:'Funkcodes', options:[{id:'a',text:'Feind gesichtet',correct:false},{id:'b',text:'Standortabfrage/Standortübermittlung',correct:true},{id:'c',text:'Brauche Unterstützung',correct:false},{id:'d',text:'Erwarte Befehle',correct:false}]},
  { id:'q009', type:'single_choice', text:'Was bedeutet 10-7?', points:1, category:'Funkcodes', options:[{id:'a',text:'Feind gesichtet',correct:false},{id:'b',text:'Unidentifizierte Person',correct:true},{id:'c',text:'Erbitte Landeerlaubnis',correct:false},{id:'d',text:'Einheiten zurückziehen',correct:false}]},
  { id:'q010', type:'single_choice', text:'Welcher Code wird verwendet um Öffnung der Basis/Hangartore zu erbitten?', points:1, category:'Funkcodes', options:[{id:'a',text:'10-8',correct:false},{id:'b',text:'10-9',correct:false},{id:'c',text:'10-10',correct:true},{id:'d',text:'10-11',correct:false}]},
  { id:'q011', type:'zuordnung', text:'Ordne die Funkcodes ihren Bedeutungen zu:', points:3, category:'Funkcodes', pairs:[{left:'10-1',right:'Melde mich im Dienst'},{left:'10-2',right:'Wiederholen, nicht verständlich'},{left:'10-6',right:'Feind gesichtet'},{left:'10-11',right:'Erwarte Befehle'}]},

  // ── MILITÄRALPHABET ──────────────────────────────────
  { id:'q012', type:'single_choice', text:'Wie lautet der Militärbegriff für den Buchstaben "A"?', points:1, category:'Militäralphabet', options:[{id:'a',text:'Alpha',correct:false},{id:'b',text:'Aurek',correct:true},{id:'c',text:'Anton',correct:false},{id:'d',text:'Amok',correct:false}]},
  { id:'q013', type:'single_choice', text:'Wie lautet der Militärbegriff für den Buchstaben "B"?', points:1, category:'Militäralphabet', options:[{id:'a',text:'Bravo',correct:false},{id:'b',text:'Beta',correct:false},{id:'c',text:'Besh',correct:true},{id:'d',text:'Bora',correct:false}]},
  { id:'q014', type:'single_choice', text:'Was steht "Nirn" im Militäralphabet für?', points:1, category:'Militäralphabet', options:[{id:'a',text:'M',correct:false},{id:'b',text:'N',correct:true},{id:'c',text:'O',correct:false},{id:'d',text:'L',correct:false}]},
  { id:'q015', type:'single_choice', text:'Wie lautet der Militärbegriff für "S"?', points:1, category:'Militäralphabet', options:[{id:'a',text:'Senth',correct:true},{id:'b',text:'Sigma',correct:false},{id:'c',text:'Sierra',correct:false},{id:'d',text:'Sorn',correct:false}]},
  { id:'q016', type:'single_choice', text:'Was steht "Trill" für?', points:1, category:'Militäralphabet', options:[{id:'a',text:'Th',correct:false},{id:'b',text:'T',correct:true},{id:'c',text:'V',correct:false},{id:'d',text:'U',correct:false}]},
  { id:'q017', type:'zuordnung', text:'Ordne die Militärbuchstaben zu:', points:3, category:'Militäralphabet', pairs:[{left:'Cresh',right:'C'},{left:'Dorn',right:'D'},{left:'Reesh',right:'R'},{left:'Zerek',right:'Z'}]},
  { id:'q018', type:'single_choice', text:'Was steht "Wesk" für?', points:1, category:'Militäralphabet', options:[{id:'a',text:'V',correct:false},{id:'b',text:'X',correct:false},{id:'c',text:'W',correct:true},{id:'d',text:'U',correct:false}]},
  { id:'q019', type:'single_choice', text:'Wie lautet der Militärbegriff für "K"?', points:1, category:'Militäralphabet', options:[{id:'a',text:'Kilo',correct:false},{id:'b',text:'Krill',correct:true},{id:'c',text:'Kern',correct:false},{id:'d',text:'Kesh',correct:false}]},

  // ── STRAFGESETZ ──────────────────────────────────────
  { id:'q020', type:'single_choice', text:'Was ist die Strafe für Mord (§1)?', points:2, category:'Strafgesetz', options:[{id:'a',text:'G120',correct:false},{id:'b',text:'G∞/60, E,T,K',correct:true},{id:'c',text:'G90',correct:false},{id:'d',text:'Tribunal',correct:false}]},
  { id:'q021', type:'single_choice', text:'Was regelt §5 SG (Fahnenflucht)?', points:2, category:'Strafgesetz', options:[{id:'a',text:'Verlassen des Postens ohne Ablösung',correct:false},{id:'b',text:'Flucht vom Dienstposten um sich der GAR-Autorität zu entziehen',correct:true},{id:'c',text:'Unerlaubtes Verlassen der Basis',correct:false},{id:'d',text:'Sabotage von Ausrüstung',correct:false}]},
  { id:'q022', type:'single_choice', text:'Ab welchem Paragraphen ist Hochverrat geregelt?', points:1, category:'Strafgesetz', options:[{id:'a',text:'§2',correct:false},{id:'b',text:'§3',correct:false},{id:'c',text:'§4',correct:true},{id:'d',text:'§6',correct:false}]},
  { id:'q023', type:'single_choice', text:'Was ist der Unterschied zwischen §6 (Ungehorsam) und §7 (Gehorsamsverweigerung)?', points:2, category:'Strafgesetz', options:[{id:'a',text:'Kein Unterschied',correct:false},{id:'b',text:'§6 erfordert negative Folgen, §7 ist aktive Verweigerung',correct:true},{id:'c',text:'§7 gilt nur für Offiziere',correct:false},{id:'d',text:'§6 gilt nur für Zivilisten',correct:false}]},
  { id:'q024', type:'single_choice', text:'Welche Strafe droht für §85 (Identitätsfälschung)?', points:1, category:'Strafgesetz', options:[{id:'a',text:'G30',correct:false},{id:'b',text:'G90',correct:false},{id:'c',text:'G60',correct:false},{id:'d',text:'G120',correct:true}]},
  { id:'q025', type:'single_choice', text:'Was regelt §47 SG bezüglich Soldaten bei Festnahme?', points:2, category:'Strafgesetz', options:[{id:'a',text:'Soldaten haben das Recht zu schweigen',correct:false},{id:'b',text:'Soldaten haben kein Recht zu schweigen, aber das einmalige Recht ihren direkten Vorgesetzten zu sprechen',correct:true},{id:'c',text:'Soldaten haben dieselben Rechte wie Zivilisten',correct:false},{id:'d',text:'Soldaten müssen gar keine Rechte erhalten',correct:false}]},
  { id:'q026', type:'single_choice', text:'Was passiert wenn ein Soldat der Exekutivgewalt bei einem Gefängnisausbruch (§11) hilft?', points:2, category:'Strafgesetz', options:[{id:'a',text:'G60',correct:false},{id:'b',text:'Er begeht Gehorsamsverweigerung',correct:false},{id:'c',text:'Er begeht Hochverrat gegen die Republik',correct:true},{id:'d',text:'Nichts, er handelt in seiner Pflicht',correct:false}]},
  { id:'q027', type:'single_choice', text:'Welcher Paragraph regelt den rechtswidrigen Waffengebrauch?', points:1, category:'Strafgesetz', options:[{id:'a',text:'§43',correct:false},{id:'b',text:'§44',correct:false},{id:'c',text:'§45',correct:true},{id:'d',text:'§46',correct:false}]},
  { id:'q028', type:'single_choice', text:'Was regelt §32 SG?', points:2, category:'Strafgesetz', options:[{id:'a',text:'Beleidigung',correct:false},{id:'b',text:'Salutverweigerung',correct:false},{id:'c',text:'Offenbarung des Dienstgrades und Salutieren im Gefecht',correct:true},{id:'d',text:'Meuterei',correct:false}]},
  { id:'q029', type:'single_choice', text:'Welche Strafe steht auf §115 (Eigenmächtiges Feuern)?', points:1, category:'Strafgesetz', options:[{id:'a',text:'G60',correct:false},{id:'b',text:'G90',correct:false},{id:'c',text:'G∞',correct:true},{id:'d',text:'T',correct:false}]},
  { id:'q030', type:'single_choice', text:'Was bedeutet das Kürzel "X" bei einem Strafparagraphen?', points:2, category:'Strafgesetz', options:[{id:'a',text:'Extrastrafe',correct:false},{id:'b',text:'Person gilt als Feind der Republik, Exekution durch jedermann zulässig',correct:true},{id:'c',text:'Muss durch Tribunal geurteilt werden',correct:false},{id:'d',text:'Exklusiv für Offiziere',correct:false}]},
  { id:'q031', type:'single_choice', text:'Was regelt §89 SG (Unerlaubte Flugbewegung)?', points:2, category:'Strafgesetz', options:[{id:'a',text:'Fliegen ohne Lizenz',correct:false},{id:'b',text:'Starten/Landen auf Basis ohne NO-Genehmigung, Ausnahme bei 3 Versuchen ohne Antwort',correct:true},{id:'c',text:'Verbotene Flugmanöver',correct:false},{id:'d',text:'Fliegen in Sperrgebieten',correct:false}]},
  { id:'q032', type:'single_choice', text:'Welche Strafe steht auf §37 (Meuterei)?', points:1, category:'Strafgesetz', options:[{id:'a',text:'G90',correct:false},{id:'b',text:'G60, A',correct:false},{id:'c',text:'G∞, T',correct:true},{id:'d',text:'G120',correct:false}]},
  { id:'q033', type:'freitext', text:'Erkläre die Ausnahmen beim §16 (Freiheitsberaubung). Nenne mindestens 4 Ausnahmen.', points:4, category:'Strafgesetz', sampleAnswer:'Außer auf Basis Strafverfahren, außer durch Notwehr, außer zur Verhinderung Straftat, außer zum Beseitigen unmittelbarer Gefahr, außer innerhalb Training, außer Disziplinarstrafe, außer medizinische Zwangsbehandlung durch MO, außer Feststellung ungeklärter Identität.'},
  { id:'q034', type:'single_choice', text:'Was regelt §93 SG?', points:2, category:'Strafgesetz', options:[{id:'a',text:'Unerlaubte Drohnennutzung',correct:false},{id:'b',text:'Rechtswidriges Steuern von Großkreuzern ohne ausgebildetes RN-Mitglied zu sein',correct:true},{id:'c',text:'Riskante Flugmanöver',correct:false},{id:'d',text:'Unerlaubte Flugbewegung',correct:false}]},
  { id:'q035', type:'single_choice', text:'Was bedeutet §148 SG (Befehlsverweigerung unter Einsatzbedingungen)?', points:2, category:'Strafgesetz', options:[{id:'a',text:'G90',correct:false},{id:'b',text:'Person wird degradiert',correct:false},{id:'c',text:'X – Person gilt als Feind der Republik',correct:true},{id:'d',text:'Tribunal',correct:false}]},
  { id:'q036', type:'multiple_choice', text:'Welche der folgenden Handlungen fallen unter §4 (Hochverrat)? (Mehrere richtig)', points:3, category:'Strafgesetz', options:[{id:'a',text:'Informationsweitergabe an KUS',correct:true},{id:'b',text:'Unerlaubtes Verlassen der Basis',correct:false},{id:'c',text:'Attentat auf Senatoren oder Jedi',correct:true},{id:'d',text:'Propaganda gegen die Republik',correct:true}]},
  { id:'q037', type:'single_choice', text:'Welcher Paragraph regelt Folter?', points:1, category:'Strafgesetz', options:[{id:'a',text:'§47',correct:false},{id:'b',text:'§48',correct:false},{id:'c',text:'§49',correct:true},{id:'d',text:'§50',correct:false}]},
  { id:'q038', type:'single_choice', text:'Was ist die Verjährungsfrist für normale Straftaten (§9 RG)?', points:1, category:'Strafgesetz', options:[{id:'a',text:'2 Wochen',correct:false},{id:'b',text:'4 Wochen',correct:true},{id:'c',text:'6 Wochen',correct:false},{id:'d',text:'8 Wochen',correct:false}]},

  // ── REGELUNGSGESETZ / STRUKTUR ───────────────────────
  { id:'q039', type:'single_choice', text:'Wer ist der Naval Officer?', points:1, category:'Regelungsgesetz', options:[{id:'a',text:'Der ranghöchste Offizier auf dem Schiff',correct:false},{id:'b',text:'Der ranghöchste anwesende Soldat der Fleet Crew oder ein Ernannter',correct:true},{id:'c',text:'Der Kommandant der Schocktruppen',correct:false},{id:'d',text:'Immer der CO',correct:false}]},
  { id:'q040', type:'single_choice', text:'Was passiert wenn der CO befehlsunfähig wird?', points:2, category:'Regelungsgesetz', options:[{id:'a',text:'Der NO übernimmt',correct:false},{id:'b',text:'Der XO übernimmt automatisch den CO-Posten',correct:true},{id:'c',text:'Der ranghöchste Soldat übernimmt',correct:false},{id:'d',text:'Das ROK muss benachrichtigt werden',correct:false}]},
  { id:'q041', type:'single_choice', text:'Welche Autorisierungsstufe benötigt ein Unteroffizier?', points:1, category:'Regelungsgesetz', options:[{id:'a',text:'Alpha',correct:false},{id:'b',text:'Bravo',correct:false},{id:'c',text:'Charlie',correct:true},{id:'d',text:'Delta',correct:false}]},
  { id:'q042', type:'single_choice', text:'Was regelt §18b RG (Kampftribunal)?', points:2, category:'Regelungsgesetz', options:[{id:'a',text:'Tribunal für Kampfeinsätze mit 5 Mitgliedern',correct:false},{id:'b',text:'CO+XO+SO, nur Kapitalverbrechen, nur einstimmig, nur Freispruch oder Exekution',correct:true},{id:'c',text:'Schnelles Tribunal im Feld mit 2 Mitgliedern',correct:false},{id:'d',text:'Tribunal für ARC-Mitglieder',correct:false}]},
  { id:'q043', type:'single_choice', text:'Woraus besteht ein normales Tribunal (§18 RG)?', points:2, category:'Regelungsgesetz', options:[{id:'a',text:'Aus den 5 ranghöchsten Soldaten',correct:false},{id:'b',text:'Aus den 3 ranghöchsten Soldaten, Exekutivgewalt darf nie Mitglied sein',correct:true},{id:'c',text:'Aus CO, XO und SO',correct:false},{id:'d',text:'Aus Mitgliedern der Schocktruppen',correct:false}]},
  { id:'q044', type:'single_choice', text:'Was bedeutet Strafverfahren-Kategorie "Nirn"?', points:1, category:'Regelungsgesetz', options:[{id:'a',text:'Laufendes Verfahren',correct:false},{id:'b',text:'Verfahren mit Bestrafung durch Tribunal',correct:false},{id:'c',text:'Abgeschlossenes Verfahren ohne Bestrafung / Freispruch',correct:true},{id:'d',text:'Verfahren mit Bestrafung durch Exekutive',correct:false}]},
  { id:'q045', type:'zuordnung', text:'Ordne die Strafverfahrenskategorien zu:', points:3, category:'Regelungsgesetz', pairs:[{left:'Aurek',right:'Laufendes Verfahren'},{left:'Besh',right:'Bestrafung durch Exekutive'},{left:'Cresh',right:'Bestrafung durch Tribunal'},{left:'Nirn',right:'Freispruch'}]},
  { id:'q046', type:'single_choice', text:'Wer hat das Hausrecht über das Gefängnis und die ST-Checkpoints?', points:1, category:'Regelungsgesetz', options:[{id:'a',text:'Der CO',correct:false},{id:'b',text:'Der NO',correct:false},{id:'c',text:'Der Security Officer',correct:true},{id:'d',text:'Der XO',correct:false}]},
  { id:'q047', type:'single_choice', text:'Was gilt bei §18a (Schnelles Tribunal)?', points:2, category:'Regelungsgesetz', options:[{id:'a',text:'Nur bei Strafanträgen unter G60, in der Gefängniszelle, min. 2 Min. Anhörung',correct:true},{id:'b',text:'Nur bei Kapitalverbrechen',correct:false},{id:'c',text:'Nur im Feld während eines Einsatzes',correct:false},{id:'d',text:'Ohne Zeitbeschränkung',correct:false}]},
  { id:'q048', type:'single_choice', text:'Wer darf laut §17 RG Betäubungswaffen bei Festnahmen einsetzen?', points:2, category:'Regelungsgesetz', options:[{id:'a',text:'Jeder Soldat der GAR',correct:false},{id:'b',text:'Nur Offiziere',correct:false},{id:'c',text:'Exekutivgewalt, nur bei akuter Flucht oder Widerstand',correct:true},{id:'d',text:'Nur der SO',correct:false}]},
  { id:'q049', type:'freitext', text:'Beschreibe den Kernablauf eines Tribunals nach §18 RG in der richtigen Reihenfolge.', points:5, category:'Regelungsgesetz', sampleAnswer:'1. Eröffnung, 2. Tatvorwurf durch Anklage, 3. Zeugen durch Anklage nennen, 4. Zeugen durch Verteidigung nennen, 5. Tathergang durch Anklage, 6. Verteidigung, 7. Anhörung jedes Zeugen, 8. Schuldgeständig & Letzte Worte, 9. Bestrafungsvorschlag durch Anklage.'},
  { id:'q050', type:'single_choice', text:'Was besagt §8 RG (Notwehr)?', points:2, category:'Regelungsgesetz', options:[{id:'a',text:'Notwehr ist immer strafbar',correct:false},{id:'b',text:'Wer einen gegenwärtigen rechtswidrigen Angriff abwendet handelt nicht rechtswidrig, wenn das geschützte Interesse überwiegt',correct:true},{id:'c',text:'Notwehr gilt nur für Offiziere',correct:false},{id:'d',text:'Notwehr muss immer gemeldet werden',correct:false}]},

  // ── RÄNGE ────────────────────────────────────────────
  { id:'q051', type:'single_choice', text:'Was ist der Navy-Äquivalent zum Heer-Rang "Sergeant"?', points:1, category:'Rangfolge', options:[{id:'a',text:'Ensign',correct:false},{id:'b',text:'Midshipman',correct:false},{id:'c',text:'Senior Petty Officer',correct:true},{id:'d',text:'Chief Petty Officer',correct:false}]},
  { id:'q052', type:'single_choice', text:'Welchem Heer-Rang entspricht der Navy-Rang "Admiral"?', points:1, category:'Rangfolge', options:[{id:'a',text:'Major',correct:false},{id:'b',text:'Commander',correct:false},{id:'c',text:'General',correct:true},{id:'d',text:'Captain',correct:false}]},
  { id:'q053', type:'single_choice', text:'Was ist das Kürzel für "First Lieutenant" im Heer?', points:1, category:'Rangfolge', options:[{id:'a',text:'LT',correct:false},{id:'b',text:'1LT',correct:true},{id:'c',text:'FLT',correct:false},{id:'d',text:'FLTC',correct:false}]},
  { id:'q054', type:'single_choice', text:'Welche Dienstgruppe haben SGT bis SMJ?', points:1, category:'Rangfolge', options:[{id:'a',text:'Obere Mannschaft',correct:false},{id:'b',text:'Offizier',correct:false},{id:'c',text:'Unteroffizier',correct:true},{id:'d',text:'Stabsoffizier',correct:false}]},
  { id:'q055', type:'single_choice', text:'Was ist das Navy-Äquivalent zu "Captain" im Heer?', points:1, category:'Rangfolge', options:[{id:'a',text:'Commander',correct:false},{id:'b',text:'Lieutenant-Commander',correct:false},{id:'c',text:'Captain',correct:true},{id:'d',text:'Commodore',correct:false}]},
  { id:'q056', type:'zuordnung', text:'Ordne Heer-Ränge ihren Navy-Äquivalenten zu:', points:3, category:'Rangfolge', pairs:[{left:'General',right:'Admiral'},{left:'Captain',right:'Captain'},{left:'Lieutenant',right:'Lieutenant'},{left:'Private',right:'Fleet Cadet'}]},
  { id:'q057', type:'single_choice', text:'Ab welcher Dienstgruppe gilt jemand als Stabsoffizier?', points:1, category:'Rangfolge', options:[{id:'a',text:'Ab First Lieutenant',correct:false},{id:'b',text:'Ab Captain',correct:true},{id:'c',text:'Ab Major',correct:false},{id:'d',text:'Ab Commander',correct:false}]},
  { id:'q058', type:'single_choice', text:'Was ist das Kürzel für "Senior Petty Officer" (Navy)?', points:1, category:'Rangfolge', options:[{id:'a',text:'CPO',correct:false},{id:'b',text:'PO',correct:false},{id:'c',text:'SPO',correct:true},{id:'d',text:'SDO',correct:false}]},
  { id:'q059', type:'single_choice', text:'Wie lautet das Motto der 5. Flotte?', points:1, category:'Rangfolge', options:[{id:'a',text:'Mut, Ehre, Stärke',correct:false},{id:'b',text:'Integrität, Loyalität, Autorität',correct:true},{id:'c',text:'Stärke, Ordnung, Disziplin',correct:false},{id:'d',text:'Treue, Pflicht, Gehorsam',correct:false}]},
  { id:'q060', type:'multiple_choice', text:'Welche Ränge gehören zur Dienstgruppe "Offizier"? (Mehrere richtig)', points:2, category:'Rangfolge', options:[{id:'a',text:'Lieutenant (LT)',correct:true},{id:'b',text:'First Lieutenant (1LT)',correct:true},{id:'c',text:'Captain (CPT)',correct:false},{id:'d',text:'Sergeant (SGT)',correct:false}]},

  // ── DEFCON ───────────────────────────────────────────
  { id:'q061', type:'single_choice', text:'Was ist DEFCON 2?', points:2, category:'DEFCON', options:[{id:'a',text:'Angriffsalarm',correct:false},{id:'b',text:'Infiltrationsalarm',correct:true},{id:'c',text:'Annäherungsalarm',correct:false},{id:'d',text:'Evakuierung',correct:false}]},
  { id:'q062', type:'single_choice', text:'Bei welchem DEFCON ist Salutieren untersagt?', points:2, category:'DEFCON', options:[{id:'a',text:'DEFCON 3',correct:false},{id:'b',text:'DEFCON 4',correct:false},{id:'c',text:'DEFCON 5',correct:true},{id:'d',text:'DEFCON 2',correct:false}]},
  { id:'q063', type:'single_choice', text:'Was ist DEFCON 1?', points:2, category:'DEFCON', options:[{id:'a',text:'Normalbetrieb',correct:false},{id:'b',text:'Bereitschaftsalarm',correct:false},{id:'c',text:'Evakuierung',correct:true},{id:'d',text:'Angriffsalarm',correct:false}]},
  { id:'q064', type:'single_choice', text:'Wer darf DEFCON 1 ausrufen?', points:2, category:'DEFCON', options:[{id:'a',text:'Jeder Offizier',correct:false},{id:'b',text:'Nur der CO',correct:false},{id:'c',text:'Nur der Ranghöchste',correct:true},{id:'d',text:'Der NO',correct:false}]},
  { id:'q065', type:'single_choice', text:'Was passiert mit geheimen Daten bei DEFCON 1?', points:2, category:'DEFCON', options:[{id:'a',text:'Sie werden gesichert und mitgenommen',correct:false},{id:'b',text:'Sie werden umgehend vernichtet',correct:true},{id:'c',text:'Nichts, sie bleiben auf dem System',correct:false},{id:'d',text:'Sie werden dem ROK übermittelt',correct:false}]},
  { id:'q066', type:'single_choice', text:'Was müssen TC und GHC bei DEFCON 2 tun?', points:2, category:'DEFCON', options:[{id:'a',text:'Verteidigungspositionen einnehmen',correct:false},{id:'b',text:'Im Buddy-System die gesamte Basis patrouillieren',correct:true},{id:'c',text:'Hangar sichern',correct:false},{id:'d',text:'Evakuierung einleiten',correct:false}]},
  { id:'q067', type:'zuordnung', text:'Ordne die DEFCON-Stufen ihren Bezeichnungen zu:', points:3, category:'DEFCON', pairs:[{left:'DEFCON 1',right:'Evakuierung'},{left:'DEFCON 3',right:'Angriffsalarm'},{left:'DEFCON 4',right:'Annäherungsalarm'},{left:'DEFCON 5',right:'Bereitschaftsalarm'}]},
  { id:'q068', type:'multiple_choice', text:'Welche Maßnahmen gelten bei DEFCON 4? (Mehrere richtig)', points:3, category:'DEFCON', options:[{id:'a',text:'Verteidigungspositionen einnehmen',correct:true},{id:'b',text:'Kontaktaufnahme mit unbekanntem Ziel',correct:true},{id:'c',text:'Sternenjäger vorbereiten',correct:true},{id:'d',text:'Sofort Feuer eröffnen',correct:false}]},
  { id:'q069', type:'single_choice', text:'Was ist DEFCON 0?', points:1, category:'DEFCON', options:[{id:'a',text:'Bereitschaftsalarm',correct:false},{id:'b',text:'Normalbetrieb, Freizeitaktivitäten gestattet',correct:true},{id:'c',text:'Eingeschränkter Betrieb',correct:false},{id:'d',text:'Geheimoperation',correct:false}]},
  { id:'q070', type:'single_choice', text:'Bei welchem DEFCON müssen Trainings abgebrochen werden (außer TOs)?', points:2, category:'DEFCON', options:[{id:'a',text:'DEFCON 2',correct:false},{id:'b',text:'DEFCON 3',correct:false},{id:'c',text:'DEFCON 4',correct:false},{id:'d',text:'DEFCON 5',correct:true}]},

  // ── SCHIFFE ──────────────────────────────────────────
  { id:'q071', type:'single_choice', text:'Was bedeutet die Abkürzung "RAS"?', points:1, category:'Schiffe', options:[{id:'a',text:'Republic Attack Ship',correct:false},{id:'b',text:'Republic Army Ship',correct:true},{id:'c',text:'Republic Armored Soldier',correct:false},{id:'d',text:'Republic ATC System',correct:false}]},
  { id:'q072', type:'single_choice', text:'Welche Klasse ist der Venator?', points:1, category:'Schiffe', options:[{id:'a',text:'Fregatte',correct:false},{id:'b',text:'Korvette',correct:false},{id:'c',text:'Sternzerstörer/Träger',correct:true},{id:'d',text:'Kreuzer',correct:false}]},
  { id:'q073', type:'single_choice', text:'Zu welcher Fraktion gehört der Lucrehulk?', points:1, category:'Schiffe', options:[{id:'a',text:'GAR',correct:false},{id:'b',text:'Mandalorianer',correct:false},{id:'c',text:'KUS',correct:true},{id:'d',text:'Fraktionslos',correct:false}]},
  { id:'q074', type:'single_choice', text:'Was ist der Acclamator (RAS)?', points:1, category:'Schiffe', options:[{id:'a',text:'Sternzerstörer',correct:false},{id:'b',text:'Kreuzer/Transporter/Versorgungsschiff',correct:true},{id:'c',text:'Jäger',correct:false},{id:'d',text:'Fregatte',correct:false}]},
  { id:'q075', type:'single_choice', text:'Was bedeutet "Backbord"?', points:1, category:'Schiffe', options:[{id:'a',text:'Rechte Seite des Schiffes',correct:false},{id:'b',text:'Hinterseite des Schiffes',correct:false},{id:'c',text:'Linke Seite des Schiffes',correct:true},{id:'d',text:'Vorderseite des Schiffes',correct:false}]},
  { id:'q076', type:'single_choice', text:'Was bedeutet "Steuerbord"?', points:1, category:'Schiffe', options:[{id:'a',text:'Linke Seite',correct:false},{id:'b',text:'Rechte Seite',correct:true},{id:'c',text:'Vorderseite (Bug)',correct:false},{id:'d',text:'Hinterseite (Heck)',correct:false}]},
  { id:'q077', type:'zuordnung', text:'Ordne die Schiffsbezeichnungen zu:', points:3, category:'Schiffe', pairs:[{left:'RSS',right:'Republic Star Ship'},{left:'RAS',right:'Republic Army Ship'},{left:'RSD',right:'Republic Star Destroyer'},{left:'RCS',right:'Republic Carrier Ship'}]},
  { id:'q078', type:'single_choice', text:'Was bedeutet "stille Fahrt"?', points:2, category:'Schiffe', options:[{id:'a',text:'Langsam fahren',correct:false},{id:'b',text:'Alle Systeme auf Minimum fahren um von Sensoren schlechter erkannt zu werden',correct:true},{id:'c',text:'Autopilot aktivieren',correct:false},{id:'d',text:'Kommunikation abschalten',correct:false}]},
  { id:'q079', type:'single_choice', text:'Zu welcher Fraktion gehört der Subjugator?', points:1, category:'Schiffe', options:[{id:'a',text:'GAR',correct:false},{id:'b',text:'KUS',correct:true},{id:'c',text:'Mandalorianer',correct:false},{id:'d',text:'Fraktionslos',correct:false}]},
  { id:'q080', type:'single_choice', text:'Was ist ein Venator in der Navy-Nomenklatur?', points:1, category:'Schiffe', options:[{id:'a',text:'RAS',correct:false},{id:'b',text:'RCS',correct:false},{id:'c',text:'RSS oder RSD',correct:true},{id:'d',text:'HHS',correct:false}]},

  // ── EINHEITEN & KÜRZEL ───────────────────────────────
  { id:'q081', type:'single_choice', text:'Was steht "GHC" für?', points:1, category:'Einheiten', options:[{id:'a',text:'Grand Heer Command',correct:false},{id:'b',text:'Ghost Company',correct:true},{id:'c',text:'General High Command',correct:false},{id:'d',text:'Galactic Heavy Corps',correct:false}]},
  { id:'q082', type:'single_choice', text:'Was ist die Hauptaufgabe der Schocktruppen (ST)?', points:2, category:'Einheiten', options:[{id:'a',text:'Hauptinfanterie und Frontkampf',correct:false},{id:'b',text:'Schutz infrastrukturell wichtiger Objekte, Strafverfolgung, Sicherheit',correct:true},{id:'c',text:'Luftraumkontrolle und ATC',correct:false},{id:'d',text:'Medizinische Versorgung',correct:false}]},
  { id:'q083', type:'single_choice', text:'Was bedeutet "AVP"?', points:1, category:'Einheiten', options:[{id:'a',text:'Advanced Vanguard Platoon',correct:false},{id:'b',text:'Armored Vehicle Platoon',correct:true},{id:'c',text:'Air Vehicle Protection',correct:false},{id:'d',text:'Armored Vanguard Post',correct:false}]},
  { id:'q084', type:'single_choice', text:'Was bedeutet "BSQ"?', points:1, category:'Einheiten', options:[{id:'a',text:'Battle Squad',correct:false},{id:'b',text:'Base Security Quick',correct:false},{id:'c',text:'Bomb Squad / Kampfmittelräumung',correct:true},{id:'d',text:'Brigade Support Quality',correct:false}]},
  { id:'q085', type:'single_choice', text:'Zu welchem Verband gehört der ARC?', points:2, category:'Einheiten', options:[{id:'a',text:'Er ist eine eigenständige Einheit',correct:false},{id:'b',text:'Er ist lokale Distribution der SEB',correct:true},{id:'c',text:'Er gehört zu den Schocktruppen',correct:false},{id:'d',text:'Er gehört zum Medical Platoon',correct:false}]},
  { id:'q086', type:'single_choice', text:'Was ist die Aufgabe der SEB?', points:2, category:'Einheiten', options:[{id:'a',text:'Schwere Infanterie und Frontkampf',correct:false},{id:'b',text:'Inlandsgeheimdienst für operative Aufgaben',correct:true},{id:'c',text:'Luftraumüberwachung',correct:false},{id:'d',text:'Technische Wartung',correct:false}]},
  { id:'q087', type:'single_choice', text:'Was bedeutet "NO" als Positionskürzel?', points:1, category:'Einheiten', options:[{id:'a',text:'Night Officer',correct:false},{id:'b',text:'Naval Officer',correct:true},{id:'c',text:'Non-commissioned Officer',correct:false},{id:'d',text:'Navigations Officer',correct:false}]},
  { id:'q088', type:'zuordnung', text:'Ordne die Einheitskürzel zu:', points:3, category:'Einheiten', pairs:[{left:'TC',right:'Torrent Company'},{left:'MP',right:'Medical Platoon'},{left:'EC',right:'Engineering Company'},{left:'GM',right:'Galactic Marines'}]},
  { id:'q089', type:'single_choice', text:'Welche Einheit hat Vorrecht auf Nutzung von Luftfahrzeugen?', points:2, category:'Einheiten', options:[{id:'a',text:'Ghost Company',correct:false},{id:'b',text:'Torrent Company',correct:false},{id:'c',text:'Armored Vehicle Platoon (AVP)',correct:true},{id:'d',text:'Fleet Crew',correct:false}]},
  { id:'q090', type:'single_choice', text:'Was bedeutet "MH" als Ortskürzel?', points:1, category:'Einheiten', options:[{id:'a',text:'Medical Hub',correct:false},{id:'b',text:'Main Hangar',correct:true},{id:'c',text:'Military Headquarters',correct:false},{id:'d',text:'Mission Hall',correct:false}]},

  // ── MILITÄRISCHES VOKABULAR / BEFEHLE ───────────────
  { id:'q091', type:'single_choice', text:'Was bedeutet der Befehl "Achtung"?', points:1, category:'Militärvokabular', options:[{id:'a',text:'Grundhaltung einnehmen',correct:false},{id:'b',text:'Stillgestanden + Salut',correct:true},{id:'c',text:'Rühren',correct:false},{id:'d',text:'Antreten',correct:false}]},
  { id:'q092', type:'single_choice', text:'Was bedeutet "Rühren"?', points:1, category:'Militärvokabular', options:[{id:'a',text:'Stillgestanden einnehmen',correct:false},{id:'b',text:'Wegtreten',correct:false},{id:'c',text:'Grundhaltung annehmen',correct:true},{id:'d',text:'Marschieren',correct:false}]},
  { id:'q093', type:'single_choice', text:'Was bedeutet "Kehrt-um"?', points:1, category:'Militärvokabular', options:[{id:'a',text:'90° nach rechts drehen',correct:false},{id:'b',text:'90° nach links drehen',correct:false},{id:'c',text:'180° drehen über rechte Schulter',correct:true},{id:'d',text:'In Ausgangsposition begeben',correct:false}]},
  { id:'q094', type:'single_choice', text:'Was bedeutet "Antreten"?', points:2, category:'Militärvokabular', options:[{id:'a',text:'Marschieren beginnen',correct:false},{id:'b',text:'Im Rahmen des Befehls vor dem Vorgesetzten in Linie ranggeordnet aufstellen',correct:true},{id:'c',text:'Kolonne bilden',correct:false},{id:'d',text:'Salutieren',correct:false}]},
  { id:'q095', type:'single_choice', text:'Was ist die "Grundhaltung"?', points:1, category:'Militärvokabular', options:[{id:'a',text:'Gerader Stand, Hände an den Seiten',correct:false},{id:'b',text:'Gerader Stand, Kopf geradeaus',correct:false},{id:'c',text:'Gerader Stand, Hände hinter dem Rücken',correct:true},{id:'d',text:'Entspannte Haltung',correct:false}]},
  { id:'q096', type:'single_choice', text:'Was ist "Stillgestanden"?', points:1, category:'Militärvokabular', options:[{id:'a',text:'Gerader Stand, Hände hinter dem Rücken',correct:false},{id:'b',text:'Gerader Stand, Kopf geradeaus, Hände an den Seiten',correct:true},{id:'c',text:'Grundhaltung + Salut',correct:false},{id:'d',text:'Entspannte Haltung',correct:false}]},
  { id:'q097', type:'single_choice', text:'Was bedeutet "Rechts-um"?', points:1, category:'Militärvokabular', options:[{id:'a',text:'Über linke Schulter nach rechts drehen',correct:false},{id:'b',text:'90° nach rechts über rechte Schulter',correct:true},{id:'c',text:'180° nach rechts drehen',correct:false},{id:'d',text:'Schritt nach rechts',correct:false}]},
  { id:'q098', type:'single_choice', text:'Ab welchem Rang muss beim Antreten salutiert werden?', points:2, category:'Militärvokabular', options:[{id:'a',text:'Ab Corporal (CPL)',correct:false},{id:'b',text:'Ab Lance Corporal (LCPL)',correct:false},{id:'c',text:'Ab Senior Deck Officer (SDO)',correct:true},{id:'d',text:'Ab Deck Officer (DO)',correct:false}]},
  { id:'q099', type:'single_choice', text:'Was bedeutet "Wegtreten"?', points:1, category:'Militärvokabular', options:[{id:'a',text:'Formation auflösen und antreten',correct:false},{id:'b',text:'Freigang ist genehmigt',correct:true},{id:'c',text:'Abmarsch in Formation',correct:false},{id:'d',text:'Rückzug befehlen',correct:false}]},
  { id:'q100', type:'freitext', text:'Erkläre den Unterschied zwischen einfacher und doppelter Kolonne und wann diese verwendet werden.', points:3, category:'Militärvokabular', sampleAnswer:'Eine einfache Kolonne ist eine einreihige Formation. Eine doppelte Kolonne besteht aus zwei parallel marschierenden Reihen. Die Kolonne wird beim Marschieren oder geordneten Aufstellen verwendet.'},

  // ── KONSOLEN & SCHIFFSBETRIEB ────────────────────────
  { id:'q101', type:'single_choice', text:'Welche Konsole nutzt der Naval Officer?', points:1, category:'Schiffsbetrieb', options:[{id:'a',text:'Waffenkonsole',correct:false},{id:'b',text:'ATC-Konsole',correct:true},{id:'c',text:'Maschinenkonsole',correct:false},{id:'d',text:'Hyperraumsystem',correct:false}]},
  { id:'q102', type:'single_choice', text:'Was macht die Waffenkonsole?', points:2, category:'Schiffsbetrieb', options:[{id:'a',text:'Steuert nur Turbolaser aktiv',correct:false},{id:'b',text:'Steuert Turbolaser (aktiv) und Punktverteidigung (passiv)',correct:true},{id:'c',text:'Berechnet Hyperraumspünge',correct:false},{id:'d',text:'Überwacht Luftverkehr',correct:false}]},
  { id:'q103', type:'single_choice', text:'Wer nutzt die Nautische Konsole?', points:1, category:'Schiffsbetrieb', options:[{id:'a',text:'Der Waffenoffizier',correct:false},{id:'b',text:'Der Maschinenoffizier',correct:false},{id:'c',text:'Der Nautische Offizier (berechnet Flugbahn und Hyperraumsprung)',correct:true},{id:'d',text:'Der Kommunikationsoffizier',correct:false}]},
  { id:'q104', type:'single_choice', text:'Was ist ein Holotisch?', points:1, category:'Schiffsbetrieb', options:[{id:'a',text:'Ein Radar-System',correct:false},{id:'b',text:'Empfängt und liefert holografische Übertragungen in beide Richtungen',correct:true},{id:'c',text:'Ein Navigationssystem',correct:false},{id:'d',text:'Eine Waffensteuerung',correct:false}]},
  { id:'q105', type:'single_choice', text:'Was ist der Unterschied zwischen Radar und Scanner?', points:2, category:'Schiffsbetrieb', options:[{id:'a',text:'Kein Unterschied',correct:false},{id:'b',text:'Radar läuft automatisiert, Scanner muss aktiv ausgelöst werden und hat höhere Reichweite',correct:true},{id:'c',text:'Scanner läuft automatisiert, Radar muss aktiviert werden',correct:false},{id:'d',text:'Radar hat höhere Reichweite',correct:false}]},
  { id:'q106', type:'zuordnung', text:'Ordne die Konsolen ihren Nutzern zu:', points:3, category:'Schiffsbetrieb', pairs:[{left:'ATC-Konsole',right:'Naval Officer'},{left:'Waffenkonsole',right:'Waffenoffizier'},{left:'Maschinenkonsole',right:'Maschinenoffizier'},{left:'Nautische Konsole',right:'Nautischer Offizier'}]},
  { id:'q107', type:'single_choice', text:'Was bedeutet "ATC"?', points:1, category:'Schiffsbetrieb', options:[{id:'a',text:'Armed Tactical Command',correct:false},{id:'b',text:'Air Traffic Control',correct:true},{id:'c',text:'Armored Troop Carrier',correct:false},{id:'d',text:'Alliance Training Corps',correct:false}]},
  { id:'q108', type:'single_choice', text:'Wer nutzt das Hyperraumsystem?', points:1, category:'Schiffsbetrieb', options:[{id:'a',text:'Der Nautische Offizier',correct:false},{id:'b',text:'Der Maschinenoffizier',correct:false},{id:'c',text:'Der Steuermann (nutzt Daten des Nautischen Offiziers)',correct:true},{id:'d',text:'Der NO',correct:false}]},

  // ── HAUSRECHT & WEISUNGSBEFUGNIS ─────────────────────
  { id:'q109', type:'single_choice', text:'Wer hat das Hausrecht über die gesamte Basis/das gesamte Schiff?', points:1, category:'Regelungsgesetz', options:[{id:'a',text:'Der NO',correct:false},{id:'b',text:'Der XO',correct:false},{id:'c',text:'Der CO (Commanding Officer)',correct:true},{id:'d',text:'Der SO',correct:false}]},
  { id:'q110', type:'single_choice', text:'Über welche Bereiche hat der TO Hausrecht?', points:1, category:'Regelungsgesetz', options:[{id:'a',text:'Hangare und ATC',correct:false},{id:'b',text:'Die technischen Bereiche',correct:true},{id:'c',text:'Das Gefängnis',correct:false},{id:'d',text:'Die Baracken',correct:false}]},
  { id:'q111', type:'multiple_choice', text:'Wer ist laut §12 RG weisungsbefugt? (Mehrere richtig)', points:3, category:'Regelungsgesetz', options:[{id:'a',text:'Wer den CO-Posten innehat',correct:true},{id:'b',text:'Wer höheren Dienstgrad hat',correct:true},{id:'c',text:'Jeder der älter ist',correct:false},{id:'d',text:'Teil der Exekutivgewalt bei Strafverfahren',correct:true}]},
  { id:'q112', type:'single_choice', text:'Wann darf der MO Befehle erteilen?', points:2, category:'Regelungsgesetz', options:[{id:'a',text:'Immer, er ist Offizier',correct:false},{id:'b',text:'Nur wenn der Befehl auf einem medizinischen Notfall begründet ist',correct:true},{id:'c',text:'Nur gegenüber Unteroffizieren',correct:false},{id:'d',text:'Nie, der MO hat keine Weisungsbefugnis',correct:false}]},

  // ── AUTORISIERUNGSSTUFEN ─────────────────────────────
  { id:'q113', type:'single_choice', text:'Was ist die Autorisierungsstufe "Bravo"?', points:1, category:'Regelungsgesetz', options:[{id:'a',text:'Zutritt für Stabsoffizier+',correct:false},{id:'b',text:'Zutritt für Offizier+',correct:true},{id:'c',text:'Zutritt für Unteroffizier+',correct:false},{id:'d',text:'Zutritt für alle GAR-Mitglieder',correct:false}]},
  { id:'q114', type:'single_choice', text:'Welche Stufe ist "Echo"?', points:1, category:'Regelungsgesetz', options:[{id:'a',text:'Nur Offiziere',correct:false},{id:'b',text:'Nur Unteroffiziere',correct:false},{id:'c',text:'Zutritt für alle Mitglieder der GAR',correct:true},{id:'d',text:'Nur Stabsoffiziere',correct:false}]},
  { id:'q115', type:'zuordnung', text:'Ordne die Autorisierungsstufen zu:', points:3, category:'Regelungsgesetz', pairs:[{left:'Alpha',right:'Stabsoffizier+'},{left:'Bravo',right:'Offizier+'},{left:'Charlie',right:'Unteroffizier+'},{left:'Echo',right:'Alle GAR-Mitglieder'}]},
  { id:'q116', type:'single_choice', text:'Wer hat immer Zugriff auf alle Autorisierungsstufen?', points:2, category:'Regelungsgesetz', options:[{id:'a',text:'Nur der CO',correct:false},{id:'b',text:'Exekutivgewalt (Strafverfahren), Medical Platoon (Notfall), EC (Aufgaben), CO, SO, RN, SEB',correct:true},{id:'c',text:'Alle Offiziere',correct:false},{id:'d',text:'Nur Stabsoffiziere',correct:false}]},

  // ── DATENKLASSIFIZIERUNG ─────────────────────────────
  { id:'q117', type:'single_choice', text:'Wer darf "Streng geheime" Informationen einstufen?', points:2, category:'Regelungsgesetz', options:[{id:'a',text:'Jeder Offizier',correct:false},{id:'b',text:'Nur Stabsoffiziere',correct:false},{id:'c',text:'Nur Mitglieder der Generalität oder Admiralität',correct:true},{id:'d',text:'Der NO',correct:false}]},
  { id:'q118', type:'single_choice', text:'Wer hat Zugriff auf "Geheime" Informationen?', points:2, category:'Regelungsgesetz', options:[{id:'a',text:'Alle GAR-Mitglieder',correct:false},{id:'b',text:'Alle Offiziere',correct:false},{id:'c',text:'Stabsoffiziere und höher',correct:true},{id:'d',text:'Nur die Generalität',correct:false}]},

  // ── ALLGEMEINE WISSENSABFRAGEN ───────────────────────
  { id:'q119', type:'single_choice', text:'Was ist die Exekutivgewalt?', points:2, category:'Regelungsgesetz', options:[{id:'a',text:'Alle Offiziere der GAR',correct:false},{id:'b',text:'Schocktruppen, Coruscant Guard, Kamino Guard, 5. Flottensicherheit, SEB, ROK-Ernannte',correct:true},{id:'c',text:'Nur die Schocktruppen',correct:false},{id:'d',text:'Alle Unteroffiziere',correct:false}]},
  { id:'q120', type:'single_choice', text:'Was passiert bei einem X-Paragraphen?', points:2, category:'Strafgesetz', options:[{id:'a',text:'Nur der CO darf eingreifen',correct:false},{id:'b',text:'Die Person gilt als Feind der Republik und Exekution durch jedermann ist zulässig',correct:true},{id:'c',text:'Tribunal ist zwingend vorgeschrieben',correct:false},{id:'d',text:'Sofortige Verhaftung',correct:false}]},
  { id:'q121', type:'freitext', text:'Welche Rechte müssen einem festgenommenen Soldaten (kein Zivilist) verlesen werden (§47 SG)?', points:4, category:'Strafgesetz', sampleAnswer:'Sie haben nicht das Recht zu schweigen und sind verpflichtet zu kooperieren. Alles was sie Sagen kann und wird gegen sie verwendet werden. Sie haben das einmalige Recht, ihren direkten Vorgesetzten zu sprechen. Sie haben das Recht auf eine frei wählbare Person als Rechtsbeistand.'},
  { id:'q122', type:'freitext', text:'Welche Rechte müssen einem festgenommenen Zivilisten verlesen werden (§47 SG)?', points:3, category:'Strafgesetz', sampleAnswer:'Sie haben das Recht zu schweigen, alles was Sie sagen kann und wird gegen Sie verwendet werden. Sie haben das Recht auf eine frei wählbare Person als Rechtsbeistand.'},
  { id:'q123', type:'multiple_choice', text:'Welche der folgenden Bestrafungen sind laut §15 RG unzulässig? (Mehrere richtig)', points:3, category:'Regelungsgesetz', options:[{id:'a',text:'Körperverletzung (außer Exekution)',correct:true},{id:'b',text:'Gefängnisstrafe bis 60 Min.',correct:false},{id:'c',text:'Kollektivstrafen',correct:true},{id:'d',text:'Verweis aus dem Militärdienst bei Klonen',correct:true}]},
  { id:'q124', type:'single_choice', text:'Was ist ein "Verband" in militärischen Begriffen?', points:1, category:'Militärvokabular', options:[{id:'a',text:'Ein medizinischer Begriff',correct:false},{id:'b',text:'Zusammenfassung mehrerer Schiffe/Jäger zu einer Gesamtheit',correct:true},{id:'c',text:'Eine Formation',correct:false},{id:'d',text:'Eine Einheit auf Bataillonsniveau',correct:false}]},
  { id:'q125', type:'single_choice', text:'Was ist eine "Flotte"?', points:1, category:'Rangfolge', options:[{id:'a',text:'Kommandiert durch einen Captain',correct:false},{id:'b',text:'Gesamtheit aller größeren Schiffsverbände, kommandiert durch einen Admiral',correct:true},{id:'c',text:'Mehrere Jägerverbände',correct:false},{id:'d',text:'Ein kleiner Verband aus 5 Schiffen',correct:false}]},
  { id:'q126', type:'single_choice', text:'Wer kommandiert eine "Sektion"?', points:1, category:'Rangfolge', options:[{id:'a',text:'Lieutenant',correct:false},{id:'b',text:'Captain',correct:true},{id:'c',text:'Admiral',correct:false},{id:'d',text:'Commodore',correct:false}]},
  { id:'q127', type:'single_choice', text:'Was ist die Aufgabe des RIS?', points:2, category:'Einheiten', options:[{id:'a',text:'Inlandsgeheimdienst',correct:false},{id:'b',text:'Auslandsgeheimdienst zur Informationsbeschaffung und Spionage',correct:true},{id:'c',text:'Technische Wartung',correct:false},{id:'d',text:'Medizinische Forschung',correct:false}]},
  { id:'q128', type:'single_choice', text:'Was bedeutet "ROK"?', points:1, category:'Einheiten', options:[{id:'a',text:'Republic Operations Kommando',correct:false},{id:'b',text:'Republikanisches Oberkommando',correct:true},{id:'c',text:'Republic Order of Korps',correct:false},{id:'d',text:'Ranks of Officers Kommand',correct:false}]},
  { id:'q129', type:'single_choice', text:'Wann ist Salutieren verboten?', points:2, category:'Militärvokabular', options:[{id:'a',text:'Im Dienst generell',correct:false},{id:'b',text:'In einer Gefechtssituation oder wenn es Dienstgrade offenbaren würde',correct:true},{id:'c',text:'Gegenüber Unteroffizieren',correct:false},{id:'d',text:'Salutieren ist immer erlaubt',correct:false}]},
  { id:'q130', type:'single_choice', text:'Was bedeutet "Kolonne"?', points:1, category:'Militärvokabular', options:[{id:'a',text:'Eine Kampfformation',correct:false},{id:'b',text:'In einer Reihe stehen oder marschieren',correct:true},{id:'c',text:'Kreisformation',correct:false},{id:'d',text:'Defensivformation',correct:false}]},
];

// ═══════════════════════════════════════════════════════
// DATEN-INITIALISIERUNG
// ═══════════════════════════════════════════════════════
function initializePresetData() {
  if (localStorage.getItem(APP.storageKeys.initialized)) return;

  // Materialien laden
  const existingMats = APP.get(APP.storageKeys.materials);
  const newMats = PRESET_MATERIALS.filter(m => !existingMats.find(e => e.id === m.id));
  APP.set(APP.storageKeys.materials, [
    ...existingMats,
    ...newMats.map(m => ({ ...m, createdAt: APP.now() }))
  ]);

  // Vorgefertigte Fragen laden
  const existingQs = APP.get(APP.storageKeys.questions);
  const newQs = PRESET_QUESTIONS.filter(q => !existingQs.find(e => e.id === q.id));
  APP.set(APP.storageKeys.questions, [
    ...existingQs,
    ...newQs.map(q => ({ ...q, createdAt: APP.now() }))
  ]);

  localStorage.setItem(APP.storageKeys.initialized, '1');
  console.log(`Wissensabfragen v${APP.version} initialisiert: ${newQs.length} Fragen, ${newMats.length} Materialien geladen.`);
}

// Auto-Init beim Laden
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    initializePresetData();
  });
}
