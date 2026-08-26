import { useState, useEffect, useRef } from "react";
import {
  Plus,
  X,
  Camera,
  Clipboard,
  Users,
  Shuffle,
  Loader2,
  RefreshCw,
  Trash2,
  AlertCircle,
  History,
  Check,
  Pencil,
  Trophy,
  Undo2,
  Flag,
  Download,
  Printer,
  Mail,
  ChevronsUp,
  Info,
} from "lucide-react";

const C = {
  court: "#146B64",
  courtDark: "#0E4E49",
  line: "#FAFAF5",
  optic: "#D7F24E",
  ink: "#16211E",
  paper: "#F3F5F0",
  card: "#FFFFFF",
  coral: "#FF6B5B",
  sky: "#3E93C9",
  muted: "#71807B",
  border: "#E3E7E1",
};

const DISPLAY = "'Space Grotesk', sans-serif";
const MONO = "'JetBrains Mono', monospace";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function shuffleArr(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function avgDupr(players) {
  const vals = players.map((p) => p.dupr).filter((v) => v != null && !isNaN(v));
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function formTeams(players, balanceGender, balanceDupr) {
  if (balanceGender) {
    let males = players.filter((p) => p.gender === "M");
    let females = players.filter((p) => p.gender === "F");
    let others = players.filter((p) => !p.gender);

    males = balanceDupr
      ? [...males].sort((a, b) => (b.dupr ?? -1) - (a.dupr ?? -1))
      : shuffleArr(males);
    females = balanceDupr
      ? [...females].sort((a, b) => (b.dupr ?? -1) - (a.dupr ?? -1))
      : shuffleArr(females);

    const n = Math.min(males.length, females.length);
    const teams = [];
    for (let i = 0; i < n; i++) {
      teams.push({ id: uid(), players: [males[i], females[i]] });
    }
    let leftover = shuffleArr([...males.slice(n), ...females.slice(n), ...others]);
    while (leftover.length >= 2) {
      teams.push({ id: uid(), players: [leftover.pop(), leftover.pop()] });
    }
    return { teams: shuffleArr(teams), bench: leftover };
  }

  const pool = balanceDupr
    ? [...players].sort((a, b) => (a.dupr ?? 0) - (b.dupr ?? 0))
    : shuffleArr(players);
  const teams = [];
  const arr = [...pool];
  while (arr.length >= 2) {
    const lo = arr.shift();
    const hi = arr.pop();
    teams.push({ id: uid(), players: [lo, hi] });
  }
  return { teams: shuffleArr(teams), bench: arr };
}

function formMatches(teams, balanceDupr, maxCourts) {
  const haveDupr = teams.some((t) => avgDupr(t.players) != null);
  let pool =
    balanceDupr && haveDupr
      ? [...teams].sort((a, b) => (avgDupr(a.players) ?? 0) - (avgDupr(b.players) ?? 0))
      : shuffleArr(teams);
  const matches = [];
  const arr = [...pool];
  let court = 1;
  while (arr.length >= 2 && (!maxCourts || court <= maxCourts)) {
    const teamA = arr.shift();
    const teamB = arr.shift();
    matches.push({ id: uid(), court: court++, teamA, teamB, headerLabel: `COURT ${court - 1}` });
  }
  return { matches, benchTeams: arr };
}

const FORMATS = {
  roundRobin: {
    label: "Round Robin",
    short: "Fresh pairs every round",
    blurb:
      "Every time you hit Generate, players are re-paired into brand new teams and matched against a new opponent team. No memory of past rounds — the simplest option for casual play, drop-ins, or when people are still arriving.",
  },
  kingCourt: {
    label: "King / Queen of the Court",
    short: "Ladder — winners climb, losers drop",
    blurb:
      "Players are split across numbered courts. After each round, the winning team moves up a court and the losing team moves down a court — and partners split so everyone gets a new teammate. The goal is to climb to Court 1 and hold it.",
  },
  creamCrop: {
    label: "Cream of the Crop",
    short: "Skill pods, everyone partners once",
    blurb:
      "Players are grouped into 4-person pods by skill level. Inside a pod, everyone partners with each other exactly once across 3 games. Once a pod finishes its 3 games, the top 2 scorers move up to a tougher pod and the bottom 2 move down.",
  },
};

function splitFourIntoTeams(four, balanceGender) {
  const arr = shuffleArr(four);
  if (balanceGender) {
    const m = arr.filter((p) => p.gender === "M");
    const f = arr.filter((p) => p.gender === "F");
    if (m.length === 2 && f.length === 2) {
      return [
        [m[0], f[0]],
        [m[1], f[1]],
      ];
    }
  }
  return [
    [arr[0], arr[1]],
    [arr[2], arr[3]],
  ];
}

function chunkIntoFours(players, useDupr, maxGroups) {
  const pool = useDupr
    ? [...players].sort((a, b) => (b.dupr ?? -1) - (a.dupr ?? -1))
    : shuffleArr(players);
  const groups = [];
  let i = 0;
  while (i + 4 <= pool.length) {
    groups.push(pool.slice(i, i + 4));
    i += 4;
  }
  let bench = pool.slice(i);
  if (maxGroups && groups.length > maxGroups) {
    const overflow = groups.slice(maxGroups).flat();
    groups.length = maxGroups;
    bench = [...bench, ...overflow];
  }
  return { groups, bench };
}

function waterfallReassign(groups, upFromGroup, downFromGroup) {
  const n = groups.length;
  const next = groups.map(() => []);
  for (let i = 0; i < n; i++) {
    const up = upFromGroup(i);
    const down = downFromGroup(i);
    if (i === 0) next[0].push(...up);
    else next[i - 1].push(...up);
    if (i === n - 1) next[n - 1].push(...down);
    else next[i + 1].push(...down);
  }
  return next;
}

const POD_COMBOS = [
  [
    [0, 1],
    [2, 3],
  ],
  [
    [0, 2],
    [1, 3],
  ],
  [
    [0, 3],
    [1, 2],
  ],
];

function VsDivider() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0" }}>
      <div style={{ flex: 1, height: 1, background: C.border }} />
      <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted, letterSpacing: 1.5 }}>VS</span>
      <div style={{ flex: 1, height: 1, background: C.border }} />
    </div>
  );
}

function CourtCard({ match, onScoreChange, onSaveScore, onEditScore }) {
  const nameA = match.teamA.players.map((p) => p.name).join(" & ");
  const nameB = match.teamB.players.map((p) => p.name).join(" & ");
  const dA = avgDupr(match.teamA.players);
  const dB = avgDupr(match.teamB.players);

  const aNum = match.scoreA === "" ? null : Number(match.scoreA);
  const bNum = match.scoreB === "" ? null : Number(match.scoreB);
  const canSave =
    aNum != null && bNum != null && !isNaN(aNum) && !isNaN(bNum) && aNum !== bNum;
  const tied = aNum != null && bNum != null && !isNaN(aNum) && !isNaN(bNum) && aNum === bNum;

  return (
    <div
      style={{
        background: C.card,
        borderRadius: 18,
        overflow: "hidden",
        boxShadow: "0 2px 12px rgba(20,30,25,0.10)",
        border: `1px solid ${C.border}`,
      }}
    >
      <div
        style={{
          background: C.ink,
          padding: "8px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontFamily: MONO, color: C.optic, fontSize: 12, letterSpacing: 1.5 }}>
          {match.headerLabel || `COURT ${match.court}`}
        </span>
      </div>
      <div style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 16, color: C.ink }}>
            {nameA}
          </span>
          {dA != null && (
            <span style={{ fontFamily: MONO, fontSize: 11, color: C.muted, flexShrink: 0 }}>
              {dA.toFixed(2)}
            </span>
          )}
        </div>
        <VsDivider />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 16, color: C.ink }}>
            {nameB}
          </span>
          {dB != null && (
            <span style={{ fontFamily: MONO, fontSize: 11, color: C.muted, flexShrink: 0 }}>
              {dB.toFixed(2)}
            </span>
          )}
        </div>

        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
          {match.recorded ? (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.ink }}>
                <Trophy size={14} color={C.court} />
                <span style={{ fontFamily: DISPLAY, fontWeight: 700 }}>
                  {match.scoreA > match.scoreB ? nameA : nameB}
                </span>
                <span style={{ fontFamily: MONO, color: C.muted }}>
                  won {Math.max(match.scoreA, match.scoreB)}–{Math.min(match.scoreA, match.scoreB)}
                </span>
              </div>
              <button
                onClick={() => onEditScore(match.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  border: "none",
                  background: "none",
                  color: C.muted,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                <Pencil size={12} /> Edit
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                value={match.scoreA}
                onChange={(e) => onScoreChange(match.id, "scoreA", e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="0"
                inputMode="numeric"
                aria-label={`${nameA} score`}
                style={{
                  width: 44,
                  textAlign: "center",
                  padding: "6px 4px",
                  borderRadius: 6,
                  border: `1px solid ${C.border}`,
                  fontFamily: MONO,
                  fontSize: 14,
                }}
              />
              <span style={{ color: C.muted, fontSize: 12 }}>vs</span>
              <input
                value={match.scoreB}
                onChange={(e) => onScoreChange(match.id, "scoreB", e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="0"
                inputMode="numeric"
                aria-label={`${nameB} score`}
                style={{
                  width: 44,
                  textAlign: "center",
                  padding: "6px 4px",
                  borderRadius: 6,
                  border: `1px solid ${C.border}`,
                  fontFamily: MONO,
                  fontSize: 14,
                }}
              />
              <button
                onClick={() => onSaveScore(match.id)}
                disabled={!canSave}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  padding: "7px 8px",
                  borderRadius: 8,
                  border: "none",
                  background: canSave ? C.ink : C.border,
                  color: canSave ? C.optic : C.muted,
                  fontFamily: DISPLAY,
                  fontWeight: 700,
                  fontSize: 12.5,
                  cursor: canSave ? "pointer" : "default",
                }}
              >
                <Check size={13} /> Save score
              </button>
            </div>
          )}
          {tied && (
            <div style={{ marginTop: 4, fontSize: 11.5, color: C.coral }}>Scores can't tie — fix one.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function GenderToggle({ value, onChange }) {
  const opts = [
    { v: "M", label: "M" },
    { v: "F", label: "F" },
    { v: null, label: "—" },
  ];
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {opts.map((o) => (
        <button
          key={String(o.v)}
          onClick={() => onChange(o.v)}
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            fontFamily: MONO,
            fontSize: 12,
            fontWeight: 600,
            border: `1px solid ${value === o.v ? C.court : C.border}`,
            background: value === o.v ? C.court : "transparent",
            color: value === o.v ? C.line : C.muted,
            cursor: "pointer",
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const REVEAL_WIDTH = 72;
const DELETE_DISTANCE = 150;

function SwipeRow({ onRemove, children }) {
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [removing, setRemoving] = useState(false);
  const startX = useRef(0);
  const startDragX = useRef(0);
  const moved = useRef(false);

  function onPointerDown(e) {
    startX.current = e.clientX;
    startDragX.current = dragX;
    moved.current = false;
    setDragging(true);
  }
  function onPointerMove(e) {
    if (!dragging) return;
    const delta = e.clientX - startX.current;
    if (Math.abs(delta) > 4) moved.current = true;
    let next = startDragX.current + delta;
    next = Math.max(-DELETE_DISTANCE - 40, Math.min(0, next));
    setDragX(next);
  }
  function finishDrag() {
    if (!dragging) return;
    setDragging(false);
    if (dragX <= -DELETE_DISTANCE) {
      setRemoving(true);
      setDragX(-500);
      setTimeout(onRemove, 160);
    } else if (dragX <= -REVEAL_WIDTH / 2) {
      setDragX(-REVEAL_WIDTH);
    } else {
      setDragX(0);
    }
  }
  function confirmDelete() {
    setRemoving(true);
    setDragX(-500);
    setTimeout(onRemove, 160);
  }

  return (
    <div style={{ position: "relative", borderRadius: 10, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          justifyContent: "flex-end",
          background: C.coral,
        }}
      >
        <button
          onClick={confirmDelete}
          aria-label="Delete player"
          style={{
            width: REVEAL_WIDTH + 40,
            border: "none",
            background: "transparent",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <Trash2 size={18} />
        </button>
      </div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: dragging ? "none" : removing ? "transform 0.16s ease-in" : "transform 0.22s ease",
          touchAction: "pan-y",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default function App() {
  const [players, setPlayers] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("roster");
  const [addMode, setAddMode] = useState("quick");

  const [nameInput, setNameInput] = useState("");
  const [genderInput, setGenderInput] = useState(null);
  const [duprInput, setDuprInput] = useState("");

  const [pasteText, setPasteText] = useState("");

  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [photoPreview, setPhotoPreview] = useState(null);
  const fileRef = useRef(null);

  const [balanceGender, setBalanceGender] = useState(true);
  const [balanceDupr, setBalanceDupr] = useState(true);
  const [format, setFormatState] = useState("roundRobin");
  const [courtLimit, setCourtLimit] = useState("");
  const [matches, setMatches] = useState([]);
  const [benchPlayers, setBenchPlayers] = useState([]);
  const [benchTeams, setBenchTeams] = useState([]);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [history, setHistory] = useState([]);

  const [ladderCourts, setLadderCourts] = useState(null);
  const [pods, setPods] = useState(null);
  const [podScores, setPodScores] = useState({});

  const [undoInfo, setUndoInfo] = useState(null);
  const undoTimerRef = useRef(null);

  const [showEndSession, setShowEndSession] = useState(false);

  function pushUndo(message, restore) {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoInfo({ message, restore });
    undoTimerRef.current = setTimeout(() => setUndoInfo(null), 7000);
  }

  function dismissUndo() {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoInfo(null);
  }

  function runUndo() {
    if (undoInfo?.restore) undoInfo.restore();
    dismissUndo();
  }

  function setFormat(next) {
    setFormatState(next);
    setMatches([]);
    setBenchPlayers([]);
    setBenchTeams([]);
    setHasGenerated(false);
    setLadderCourts(null);
    setPods(null);
    setPodScores({});
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("roster", false);
        if (res && res.value) {
          const parsed = JSON.parse(res.value);
          if (Array.isArray(parsed)) setPlayers(parsed);
        }
      } catch (e) {
        // nothing saved yet
      }
      try {
        const res = await window.storage.get("history", false);
        if (res && res.value) {
          const parsed = JSON.parse(res.value);
          if (Array.isArray(parsed)) setHistory(parsed);
        }
      } catch (e) {
        // nothing saved yet
      }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    window.storage.set("roster", JSON.stringify(players), false).catch(() => {});
  }, [players, loaded]);

  useEffect(() => {
    if (!loaded) return;
    window.storage.set("history", JSON.stringify(history), false).catch(() => {});
  }, [history, loaded]);

  const hasGenderData = players.some((p) => p.gender);
  const hasDuprData = players.some((p) => p.dupr != null);

  function addPlayer() {
    const name = nameInput.trim();
    if (!name) return;
    const dupr = duprInput.trim() ? parseFloat(duprInput) : null;
    setPlayers((ps) => [
      ...ps,
      { id: uid(), name, gender: genderInput, dupr: isNaN(dupr) ? null : dupr },
    ]);
    setNameInput("");
    setGenderInput(null);
    setDuprInput("");
  }

  function parsePaste() {
    const lines = pasteText.split("\n").map((l) => l.trim()).filter(Boolean);
    const added = lines
      .map((line) => {
        const parts = line.split(/\t|,/).map((s) => s.trim());
        const name = parts[0];
        let gender = null;
        let dupr = null;
        for (let i = 1; i < parts.length; i++) {
          const v = parts[i];
          if (/^[mf]$/i.test(v)) gender = v.toUpperCase();
          else if (v && !isNaN(parseFloat(v))) dupr = parseFloat(v);
        }
        return { id: uid(), name, gender, dupr };
      })
      .filter((p) => p.name);
    setPlayers((ps) => [...ps, ...added]);
    setPasteText("");
  }

  async function handlePhotoFile(file) {
    if (!file) return;
    setPhotoError("");
    setPhotoLoading(true);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      setPhotoPreview(dataUrl);
      const mediaType = file.type || "image/jpeg";
      const base64 = dataUrl.split(",")[1];

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
                {
                  type: "text",
                  text:
                    "This is a photo of a participant list for a pickleball event. Read every name you can find. If a gender marker (M/F) or a DUPR rating number is written next to a name, capture it too. Respond with ONLY raw JSON, no markdown fences, no commentary, in exactly this shape: {\"clear\": true, \"players\": [{\"name\": \"Jane Doe\", \"gender\": \"F\", \"dupr\": 3.75}]}. Use null for gender or dupr when not shown. If the image is too blurry, dark, cropped, or otherwise unreliable to read confidently, respond instead with {\"clear\": false, \"players\": []}.",
                },
              ],
            },
          ],
        }),
      });
      const data = await res.json();
      const textBlock = (data.content || [])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("");
      const cleaned = textBlock.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleaned);

      if (!parsed.clear || !parsed.players || !parsed.players.length) {
        setPhotoError("Couldn't read that clearly — try a straighter, brighter shot with all names visible.");
      } else {
        const newPlayers = parsed.players
          .map((pl) => ({
            id: uid(),
            name: (pl.name || "").trim(),
            gender: pl.gender ? String(pl.gender).toUpperCase()[0] : null,
            dupr: pl.dupr != null && !isNaN(Number(pl.dupr)) ? Number(pl.dupr) : null,
          }))
          .filter((p) => p.name);
        setPlayers((ps) => [...ps, ...newPlayers]);
        setPhotoPreview(null);
      }
    } catch (e) {
      setPhotoError("Something went wrong reading that photo. Give it another try.");
    } finally {
      setPhotoLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function patchPlayerEverywhere(id, patch) {
    const patchP = (p) => (p.id === id ? { ...p, ...patch } : p);
    setMatches((ms) =>
      ms.map((m) => ({
        ...m,
        teamA: { ...m.teamA, players: m.teamA.players.map(patchP) },
        teamB: { ...m.teamB, players: m.teamB.players.map(patchP) },
      }))
    );
    setLadderCourts((lc) => (lc ? lc.map((court) => court.map(patchP)) : lc));
    setPods((ps) => (ps ? ps.map((pod) => ({ ...pod, players: pod.players.map(patchP) })) : ps));
  }

  function updatePlayer(id, patch) {
    setPlayers((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    patchPlayerEverywhere(id, patch);
  }

  function removePlayer(id) {
    setPlayers((ps) => {
      const idx = ps.findIndex((p) => p.id === id);
      if (idx === -1) return ps;
      const item = ps[idx];

      const inActiveRound = matches.some(
        (m) => m.teamA.players.some((p) => p.id === id) || m.teamB.players.some((p) => p.id === id)
      );
      if (inActiveRound) {
        setMatches([]);
        setBenchPlayers([]);
        setBenchTeams([]);
        setHasGenerated(false);
        setLadderCourts(null);
        setPods(null);
        setPodScores({});
      }

      pushUndo(
        inActiveRound
          ? `Removed ${item.name} — active round was cleared, generate a new one`
          : `Removed ${item.name}`,
        () =>
          setPlayers((cur) => {
            const arr = [...cur];
            arr.splice(Math.min(idx, arr.length), 0, item);
            return arr;
          })
      );
      return ps.filter((p) => p.id !== id);
    });
  }

  function clearRoster() {
    if (players.length && !window.confirm("Clear the entire roster?")) return;
    setPlayers([]);
    setMatches([]);
    setBenchPlayers([]);
    setBenchTeams([]);
    setHasGenerated(false);
    setLadderCourts(null);
    setPods(null);
    setPodScores({});
  }

  function getCourtLimit() {
    const n = parseInt(courtLimit, 10);
    return courtLimit && n > 0 ? n : undefined;
  }

  function initMatches(list) {
    setMatches(list.map((m) => ({ ...m, scoreA: "", scoreB: "", recorded: false })));
    setHasGenerated(true);
  }

  // --- Round Robin ---
  function generateRoundRobin() {
    const { teams, bench } = formTeams(players, balanceGender && hasGenderData, balanceDupr && hasDuprData);
    const limit = getCourtLimit();
    const { matches, benchTeams } = formMatches(teams, balanceDupr && hasDuprData, limit);
    initMatches(matches);
    setBenchPlayers(bench);
    setBenchTeams(benchTeams);
  }

  // --- King / Queen of the Court ---
  function ladderMatchesFromCourts(courts) {
    return courts.map((four, i) => {
      const [teamA, teamB] = splitFourIntoTeams(four, balanceGender && hasGenderData);
      return {
        id: uid(),
        court: i + 1,
        headerLabel: i === 0 ? "COURT 1 · KING/QUEEN" : `COURT ${i + 1}`,
        teamA: { id: uid(), players: teamA },
        teamB: { id: uid(), players: teamB },
      };
    });
  }

  function startLadder() {
    const limit = getCourtLimit();
    const { groups, bench } = chunkIntoFours(players, hasDuprData, limit);
    setLadderCourts(groups);
    setBenchPlayers(bench);
    setBenchTeams([]);
    initMatches(ladderMatchesFromCourts(groups));
  }

  function advanceLadder() {
    if (!ladderCourts) return;
    const winners = (i) => {
      const m = matches[i];
      const w = Number(m.scoreA) > Number(m.scoreB) ? m.teamA.players : m.teamB.players;
      return w;
    };
    const losers = (i) => {
      const m = matches[i];
      const l = Number(m.scoreA) > Number(m.scoreB) ? m.teamB.players : m.teamA.players;
      return l;
    };
    const nextCourts = waterfallReassign(ladderCourts, winners, losers);
    setLadderCourts(nextCourts);
    initMatches(ladderMatchesFromCourts(nextCourts));
  }

  // --- Cream of the Crop ---
  function podMatchesFromPods(podList) {
    return podList.map((pod, i) => {
      const [ia, ib] = POD_COMBOS[pod.gameIndex];
      const teamA = ia.map((idx) => pod.players[idx]);
      const teamB = ib.map((idx) => pod.players[idx]);
      return {
        id: uid(),
        court: i + 1,
        podIndex: i,
        headerLabel: `POD ${i + 1} · GAME ${pod.gameIndex + 1} OF 3`,
        teamA: { id: uid(), players: teamA },
        teamB: { id: uid(), players: teamB },
      };
    });
  }

  function startPods() {
    const limit = getCourtLimit();
    const { groups, bench } = chunkIntoFours(players, hasDuprData, limit);
    const podList = groups.map((players4) => ({ players: players4, gameIndex: 0 }));
    setPods(podList);
    setPodScores({});
    setBenchPlayers(bench);
    setBenchTeams([]);
    initMatches(podMatchesFromPods(podList));
  }

  function advancePods() {
    if (!pods) return;
    // Tally this game's points onto each player's running pod total.
    const nextScores = { ...podScores };
    matches.forEach((m) => {
      m.teamA.players.forEach((p) => {
        nextScores[p.id] = (nextScores[p.id] || 0) + Number(m.scoreA);
      });
      m.teamB.players.forEach((p) => {
        nextScores[p.id] = (nextScores[p.id] || 0) + Number(m.scoreB);
      });
    });

    const finishedCycle = pods[0].gameIndex >= 2;
    if (!finishedCycle) {
      const nextPods = pods.map((pod) => ({ ...pod, gameIndex: pod.gameIndex + 1 }));
      setPods(nextPods);
      setPodScores(nextScores);
      initMatches(podMatchesFromPods(nextPods));
      return;
    }

    // Cycle complete — reshuffle pods by each player's total points.
    const podGroups = pods.map((pod) =>
      [...pod.players].sort((a, b) => (nextScores[b.id] || 0) - (nextScores[a.id] || 0))
    );
    const topTwo = (i) => podGroups[i].slice(0, 2);
    const bottomTwo = (i) => podGroups[i].slice(2, 4);
    const reshuffled = waterfallReassign(podGroups, topTwo, bottomTwo);
    const newPods = reshuffled.map((players4) => ({ players: players4, gameIndex: 0 }));
    setPods(newPods);
    setPodScores({});
    initMatches(podMatchesFromPods(newPods));
  }

  function setMatchScore(matchId, side, value) {
    setMatches((ms) => ms.map((m) => (m.id === matchId ? { ...m, [side]: value } : m)));
  }

  function saveMatchScore(matchId) {
    setMatches((ms) => {
      const m = ms.find((x) => x.id === matchId);
      if (!m) return ms;
      const a = parseInt(m.scoreA, 10);
      const b = parseInt(m.scoreB, 10);
      if (isNaN(a) || isNaN(b) || a === b) return ms;
      const aWon = a > b;
      const entry = {
        id: uid(),
        matchId,
        date: new Date().toISOString(),
        location: m.headerLabel || `Court ${m.court}`,
        format: FORMATS[format].label,
        winnerNames: (aWon ? m.teamA : m.teamB).players.map((p) => p.name).join(" & "),
        winnerScore: aWon ? a : b,
        loserNames: (aWon ? m.teamB : m.teamA).players.map((p) => p.name).join(" & "),
        loserScore: aWon ? b : a,
      };
      setHistory((h) => [entry, ...h.filter((e) => e.matchId !== matchId)]);
      return ms.map((x) => (x.id === matchId ? { ...x, scoreA: a, scoreB: b, recorded: true } : x));
    });
  }

  function editMatchScore(matchId) {
    setHistory((h) => h.filter((e) => e.matchId !== matchId));
    setMatches((ms) => ms.map((m) => (m.id === matchId ? { ...m, recorded: false } : m)));
  }

  function removeHistoryEntry(id) {
    setHistory((h) => {
      const idx = h.findIndex((e) => e.id === id);
      if (idx === -1) return h;
      const item = h[idx];
      pushUndo(`Removed game result`, () =>
        setHistory((cur) => {
          const arr = [...cur];
          arr.splice(Math.min(idx, arr.length), 0, item);
          return arr;
        })
      );
      return h.filter((e) => e.id !== id);
    });
  }

  // --- End-of-session export ---
  function sessionDateLabel() {
    return new Date().toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  }

  function winCounts() {
    const counts = {};
    history.forEach((h) => {
      h.winnerNames.split(" & ").forEach((n) => {
        counts[n] = (counts[n] || 0) + 1;
      });
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportCSV() {
    const rows = [["Date", "Location", "Format", "Winner", "Winner Score", "Loser", "Loser Score"]];
    [...history]
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .forEach((h) =>
        rows.push([
          new Date(h.date).toLocaleString(),
          h.location,
          h.format || "",
          h.winnerNames,
          h.winnerScore,
          h.loserNames,
          h.loserScore,
        ])
      );
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}\"`).join(",")).join("\n");
    downloadBlob(new Blob([csv], { type: "text/csv" }), `kitchen-draw-${sessionDateLabel().replace(/\s|,/g, "-")}.csv`);
  }

  function exportPNG() {
    const rowsData = [...history].sort((a, b) => new Date(a.date) - new Date(b.date));
    const leaders = winCounts().slice(0, 5);
    const width = 720;
    const rowH = 34;
    const headerH = 150;
    const leaderH = leaders.length ? 40 + leaders.length * 26 : 0;
    const height = headerH + rowsData.length * rowH + leaderH + 40;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = C.court;
    ctx.fillRect(0, 0, width, headerH);
    ctx.fillStyle = C.optic;
    ctx.font = "600 13px monospace";
    ctx.fillText("MIXED DOUBLES", 24, 34);
    ctx.fillStyle = C.line;
    ctx.font = "700 30px sans-serif";
    ctx.fillText("Session Recap", 24, 70);
    ctx.font = "13px sans-serif";
    ctx.fillText(`${sessionDateLabel()} · ${rowsData.length} games played`, 24, 96);

    let y = headerH + 28;
    ctx.font = "600 13px monospace";
    ctx.fillStyle = C.muted;
    ctx.fillText("RESULTS", 24, y);
    y += 20;
    ctx.font = "14px sans-serif";
    rowsData.forEach((h) => {
      ctx.fillStyle = C.ink;
      ctx.font = "700 14px sans-serif";
      ctx.fillText(`${h.winnerNames}`, 24, y);
      ctx.font = "13px monospace";
      ctx.fillStyle = C.court;
      ctx.fillText(`${h.winnerScore}`, 380, y);
      ctx.font = "14px sans-serif";
      ctx.fillStyle = C.muted;
      ctx.fillText(`vs ${h.loserNames}`, 420, y);
      ctx.font = "13px monospace";
      ctx.fillText(`${h.loserScore}`, width - 50, y);
      y += rowH;
    });

    if (leaders.length) {
      y += 10;
      ctx.font = "600 13px monospace";
      ctx.fillStyle = C.muted;
      ctx.fillText("MOST WINS", 24, y);
      y += 24;
      leaders.forEach(([name, count]) => {
        ctx.font = "600 15px sans-serif";
        ctx.fillStyle = C.ink;
        ctx.fillText(name, 24, y);
        ctx.font = "13px monospace";
        ctx.fillStyle = C.court;
        ctx.fillText(`${count} win${count === 1 ? "" : "s"}`, width - 100, y);
        y += 26;
      });
    }

    canvas.toBlob((blob) => {
      downloadBlob(blob, `kitchen-draw-recap-${sessionDateLabel().replace(/\s|,/g, "-")}.png`);
    });
  }

  function emailResults() {
    const lines = [...history]
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 40)
      .map((h) => `${h.location}: ${h.winnerNames} def. ${h.loserNames}  ${h.winnerScore}-${h.loserScore}`);
    const body = [`Session recap — ${sessionDateLabel()}`, `${history.length} games played`, "", ...lines].join("\n");
    const mailto = `mailto:?subject=${encodeURIComponent(
      `Pickleball session recap — ${sessionDateLabel()}`
    )}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  }

  function printResults() {
    window.print();
  }

  const maleCount = players.filter((p) => p.gender === "M").length;
  const femaleCount = players.filter((p) => p.gender === "F").length;
  const otherCount = players.length - maleCount - femaleCount;

  return (
    <div style={{ minHeight: "100vh", background: C.paper, fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap');
        * { box-sizing: border-box; }
        input:focus, textarea:focus, button:focus-visible { outline: 2px solid ${C.court}; outline-offset: 1px; }
        ::placeholder { color: #A6B0AB; }
        .print-only { display: none; }
        @media print {
          .screen-only { display: none !important; }
          .print-only { display: block !important; }
        }
      `}</style>

      {/* Header */}
      <div className="screen-only" style={{ background: C.court, padding: "22px 18px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: C.optic, marginBottom: 4 }}>
              MIXED DOUBLES
            </div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 26, color: C.line, lineHeight: 1.1 }}>
              Kitchen Draw
            </div>
          </div>
          <button
            onClick={() => setShowEndSession(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 12px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.35)",
              background: "rgba(255,255,255,0.1)",
              color: C.line,
              fontFamily: DISPLAY,
              fontWeight: 700,
              fontSize: 12,
              cursor: "pointer",
              marginTop: 2,
            }}
          >
            <Flag size={13} /> End session
          </button>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          {[
            { id: "roster", label: "Roster", icon: Users },
            { id: "matches", label: "Matches", icon: Shuffle },
            { id: "history", label: "History", icon: History },
          ].map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 14px",
                  borderRadius: 999,
                  border: "none",
                  fontFamily: DISPLAY,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                  background: active ? C.optic : "rgba(255,255,255,0.12)",
                  color: active ? C.ink : C.line,
                }}
              >
                <Icon size={15} />
                {t.label}
                {t.id === "roster" && players.length > 0 && (
                  <span style={{ fontFamily: MONO, fontSize: 11, opacity: 0.75 }}>{players.length}</span>
                )}
                {t.id === "history" && history.length > 0 && (
                  <span style={{ fontFamily: MONO, fontSize: 11, opacity: 0.75 }}>{history.length}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="screen-only" style={{ padding: "16px 14px 40px", maxWidth: 560, margin: "0 auto" }}>
        {tab === "roster" && (
          <>
            {/* Add mode switch */}
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              {[
                { id: "quick", label: "Type", icon: Plus },
                { id: "paste", label: "Paste", icon: Clipboard },
                { id: "photo", label: "Photo", icon: Camera },
              ].map((m) => {
                const Icon = m.icon;
                const active = addMode === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setAddMode(m.id)}
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      padding: "9px 8px",
                      borderRadius: 10,
                      border: `1px solid ${active ? C.court : C.border}`,
                      background: active ? C.court : C.card,
                      color: active ? C.line : C.ink,
                      fontFamily: DISPLAY,
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    <Icon size={14} />
                    {m.label}
                  </button>
                );
              })}
            </div>

            {/* Add panel */}
            <div
              style={{
                background: C.card,
                border: `1px solid ${C.border}`,
                borderRadius: 14,
                padding: 14,
                marginBottom: 18,
              }}
            >
              {addMode === "quick" && (
                <div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addPlayer()}
                      placeholder="Player name"
                      style={{
                        flex: 1,
                        padding: "9px 10px",
                        borderRadius: 8,
                        border: `1px solid ${C.border}`,
                        fontFamily: "'Inter', sans-serif",
                        fontSize: 14,
                      }}
                    />
                    <GenderToggle value={genderInput} onChange={setGenderInput} />
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <input
                      value={duprInput}
                      onChange={(e) => setDuprInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addPlayer()}
                      placeholder="DUPR (optional)"
                      inputMode="decimal"
                      style={{
                        width: 130,
                        padding: "9px 10px",
                        borderRadius: 8,
                        border: `1px solid ${C.border}`,
                        fontFamily: MONO,
                        fontSize: 13,
                      }}
                    />
                    <button
                      onClick={addPlayer}
                      style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        background: C.ink,
                        color: C.optic,
                        border: "none",
                        borderRadius: 8,
                        fontFamily: DISPLAY,
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      <Plus size={15} /> Add player
                    </button>
                  </div>
                </div>
              )}

              {addMode === "paste" && (
                <div>
                  <textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder={"Paste names, one per line.\nOptional: Name, Gender, DUPR\ne.g. Jane Doe, F, 3.75"}
                    rows={5}
                    style={{
                      width: "100%",
                      padding: 10,
                      borderRadius: 8,
                      border: `1px solid ${C.border}`,
                      fontFamily: "'Inter', sans-serif",
                      fontSize: 13.5,
                      resize: "vertical",
                    }}
                  />
                  <button
                    onClick={parsePaste}
                    disabled={!pasteText.trim()}
                    style={{
                      marginTop: 8,
                      width: "100%",
                      padding: "9px 10px",
                      background: pasteText.trim() ? C.ink : C.border,
                      color: pasteText.trim() ? C.optic : C.muted,
                      border: "none",
                      borderRadius: 8,
                      fontFamily: DISPLAY,
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: pasteText.trim() ? "pointer" : "default",
                    }}
                  >
                    Add from paste
                  </button>
                </div>
              )}

              {addMode === "photo" && (
                <div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => handlePhotoFile(e.target.files?.[0])}
                    style={{ display: "none" }}
                  />
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={photoLoading}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      padding: "18px 10px",
                      borderRadius: 10,
                      border: `2px dashed ${C.court}`,
                      background: "rgba(20,107,100,0.05)",
                      color: C.court,
                      fontFamily: DISPLAY,
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: "pointer",
                    }}
                  >
                    {photoLoading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" /> Reading photo…
                      </>
                    ) : (
                      <>
                        <Camera size={16} /> Take or upload a photo of the list
                      </>
                    )}
                  </button>
                  {photoError && (
                    <div
                      style={{
                        marginTop: 8,
                        display: "flex",
                        gap: 6,
                        alignItems: "flex-start",
                        color: C.coral,
                        fontSize: 12.5,
                      }}
                    >
                      <AlertCircle size={14} style={{ marginTop: 1, flexShrink: 0 }} />
                      {photoError}
                    </div>
                  )}
                  {photoPreview && !photoLoading && (
                    <img
                      src={photoPreview}
                      alt="Uploaded list"
                      style={{ marginTop: 8, width: "100%", borderRadius: 8, maxHeight: 160, objectFit: "cover" }}
                    />
                  )}
                </div>
              )}
            </div>

            {/* Roster list */}
            {players.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 10px", color: C.muted, fontSize: 13.5 }}>
                No players yet. Add your first one above.
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                    padding: "0 2px",
                  }}
                >
                  <span style={{ fontFamily: MONO, fontSize: 11, color: C.muted, letterSpacing: 1 }}>
                    {maleCount}M · {femaleCount}F{otherCount ? ` · ${otherCount} unspecified` : ""}
                  </span>
                  <button
                    onClick={clearRoster}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      background: "none",
                      border: "none",
                      color: C.muted,
                      fontSize: 11.5,
                      fontFamily: "'Inter', sans-serif",
                      cursor: "pointer",
                    }}
                  >
                    <Trash2 size={12} /> Clear all
                  </button>
                </div>
                <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 8, padding: "0 2px" }}>
                  Swipe a player left to remove.
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {players.map((p) => (
                    <SwipeRow key={p.id} onRemove={() => removePlayer(p.id)}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          background: C.card,
                          border: `1px solid ${C.border}`,
                          borderRadius: 10,
                          padding: "8px 12px",
                        }}
                      >
                        <input
                          value={p.name}
                          onChange={(e) => updatePlayer(p.id, { name: e.target.value })}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            border: "none",
                            background: "transparent",
                            fontFamily: DISPLAY,
                            fontWeight: 600,
                            fontSize: 14.5,
                            color: C.ink,
                          }}
                        />
                        <input
                          value={p.dupr ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            const num = v.trim() === "" ? null : parseFloat(v);
                            updatePlayer(p.id, { dupr: num == null || isNaN(num) ? null : num });
                          }}
                          placeholder="DUPR"
                          inputMode="decimal"
                          style={{
                            width: 56,
                            border: `1px solid ${C.border}`,
                            borderRadius: 6,
                            padding: "4px 6px",
                            fontFamily: MONO,
                            fontSize: 12,
                            textAlign: "center",
                          }}
                        />
                        <GenderToggle value={p.gender} onChange={(g) => updatePlayer(p.id, { gender: g })} />
                      </div>
                    </SwipeRow>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {tab === "matches" && (
          <>
            {/* Format selector */}
            <div
              style={{
                background: C.card,
                border: `1px solid ${C.border}`,
                borderRadius: 14,
                padding: 14,
                marginBottom: 12,
              }}
            >
              <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1, color: C.muted, marginBottom: 8 }}>
                TOURNAMENT STYLE
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {Object.entries(FORMATS).map(([key, f]) => {
                  const active = format === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setFormat(key)}
                      style={{
                        textAlign: "left",
                        padding: "9px 10px",
                        borderRadius: 10,
                        border: `1px solid ${active ? C.court : C.border}`,
                        background: active ? "rgba(20,107,100,0.07)" : "transparent",
                        cursor: "pointer",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 14, color: C.ink }}>
                          {f.label}
                        </span>
                        {active && <Check size={15} color={C.court} />}
                      </div>
                      <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{f.short}</div>
                    </button>
                  );
                })}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  marginTop: 10,
                  padding: 10,
                  borderRadius: 8,
                  background: "rgba(20,107,100,0.05)",
                  fontSize: 12.5,
                  color: C.ink,
                  lineHeight: 1.4,
                }}
              >
                <Info size={14} color={C.court} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{FORMATS[format].blurb}</span>
              </div>
            </div>

            <div
              style={{
                background: C.card,
                border: `1px solid ${C.border}`,
                borderRadius: 14,
                padding: 14,
                marginBottom: 16,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 13.5,
                      color: C.ink,
                      marginBottom: 6,
                      fontWeight: 500,
                    }}
                  >
                    Courts available
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      value={courtLimit}
                      onChange={(e) => setCourtLimit(e.target.value.replace(/[^0-9]/g, ""))}
                      placeholder="Auto"
                      inputMode="numeric"
                      style={{
                        width: 72,
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: `1px solid ${C.border}`,
                        fontFamily: MONO,
                        fontSize: 14,
                        textAlign: "center",
                      }}
                    />
                    <span style={{ fontSize: 12, color: C.muted, flex: 1 }}>
                      {courtLimit && parseInt(courtLimit, 10) > 0
                        ? `Only ${courtLimit} court${courtLimit === "1" ? "" : "s"} will be filled each round — extra players sit out.`
                        : courtLimit === "0"
                        ? "0 courts isn't valid — treating this as Auto."
                        : "Leave blank to fill as many courts as the group needs."}
                    </span>
                  </div>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: hasGenderData ? C.ink : C.muted }}>
                  <input
                    type="checkbox"
                    checked={balanceGender}
                    disabled={!hasGenderData || format === "creamCrop"}
                    onChange={(e) => setBalanceGender(e.target.checked)}
                  />
                  Pair 1 male + 1 female per team{" "}
                  {!hasGenderData ? "(add gender tags to enable)" : format === "creamCrop" ? "(not used in pods)" : ""}
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: hasDuprData ? C.ink : C.muted }}>
                  <input
                    type="checkbox"
                    checked={balanceDupr}
                    disabled={!hasDuprData || format !== "roundRobin"}
                    onChange={(e) => setBalanceDupr(e.target.checked)}
                  />
                  Balance by DUPR rating{" "}
                  {!hasDuprData
                    ? "(add ratings to enable)"
                    : format !== "roundRobin"
                    ? "(used automatically to seed courts/pods)"
                    : ""}
                </label>
              </div>

              {(() => {
                const allRecorded = matches.length > 0 && matches.every((m) => m.recorded);
                let label = "Generate matches";
                let Icon = Shuffle;
                let action = generateRoundRobin;
                let disabled = players.length < 4;

                if (format === "kingCourt") {
                  if (!ladderCourts) {
                    label = "Start King of the Court";
                    action = startLadder;
                  } else if (!allRecorded) {
                    label = "Score all courts to continue";
                    Icon = AlertCircle;
                    disabled = true;
                    action = () => {};
                  } else {
                    label = "Next round →";
                    Icon = RefreshCw;
                    action = advanceLadder;
                  }
                } else if (format === "creamCrop") {
                  if (!pods) {
                    label = "Start Cream of the Crop";
                    action = startPods;
                  } else if (!allRecorded) {
                    label = "Score all courts to continue";
                    Icon = AlertCircle;
                    disabled = true;
                    action = () => {};
                  } else if (pods[0].gameIndex < 2) {
                    label = `Next game (${pods[0].gameIndex + 2} of 3) →`;
                    Icon = RefreshCw;
                    action = advancePods;
                  } else {
                    label = "Reshuffle pods →";
                    Icon = ChevronsUp;
                    action = advancePods;
                  }
                } else {
                  if (hasGenerated) {
                    label = "Regenerate";
                    Icon = RefreshCw;
                  }
                }

                if (players.length < 4) disabled = true;

                return (
                  <>
                    <button
                      onClick={action}
                      disabled={disabled}
                      style={{
                        marginTop: 12,
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        padding: "11px 10px",
                        borderRadius: 10,
                        border: "none",
                        background: disabled ? C.border : C.court,
                        color: disabled ? C.muted : C.line,
                        fontFamily: DISPLAY,
                        fontWeight: 700,
                        fontSize: 14.5,
                        cursor: disabled ? "default" : "pointer",
                      }}
                    >
                      <Icon size={16} />
                      {label}
                    </button>
                    {players.length < 4 && (
                      <div style={{ marginTop: 8, fontSize: 12, color: C.muted }}>
                        Add at least 4 players to generate a match.
                      </div>
                    )}
                    {players.length >= 4 && players.length % 4 !== 0 && format !== "roundRobin" && (
                      <div style={{ marginTop: 8, fontSize: 12, color: C.muted }}>
                        {players.length % 4} player{players.length % 4 === 1 ? "" : "s"} won't fit into a group of 4
                        and will sit out for the whole session (they won't rotate in automatically) — swap them in by
                        restarting the format, or add {4 - (players.length % 4)} more player
                        {4 - (players.length % 4) === 1 ? "" : "s"} first.
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {hasGenerated && (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {matches.map((m) => (
                    <CourtCard
                      key={m.id}
                      match={m}
                      onScoreChange={setMatchScore}
                      onSaveScore={saveMatchScore}
                      onEditScore={editMatchScore}
                    />
                  ))}
                </div>

                {(benchTeams.length > 0 || benchPlayers.length > 0) && (
                  <div
                    style={{
                      marginTop: 16,
                      padding: 12,
                      borderRadius: 12,
                      border: `1px dashed ${C.border}`,
                      background: "rgba(20,107,100,0.04)",
                    }}
                  >
                    <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1, color: C.muted, marginBottom: 4 }}>
                      SITTING OUT THIS ROUND
                    </div>
                    <div style={{ fontSize: 13.5, color: C.ink }}>
                      {[
                        ...benchTeams.flatMap((t) => t.players.map((p) => p.name)),
                        ...benchPlayers.map((p) => p.name),
                      ].join(", ")}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {tab === "history" && (
          <>
            {history.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 10px", color: C.muted, fontSize: 13.5 }}>
                No games recorded yet. Save a score from the Matches tab and it'll show up here.
              </div>
            ) : (
              <>
                <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 8, padding: "0 2px" }}>
                  Swipe a game left to remove it.
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[...history]
                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                    .map((h) => (
                      <SwipeRow key={h.id} onRemove={() => removeHistoryEntry(h.id)}>
                        <div
                          style={{
                            background: C.card,
                            border: `1px solid ${C.border}`,
                            borderRadius: 12,
                            padding: "12px 14px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginBottom: 6,
                            }}
                          >
                            <span style={{ fontFamily: MONO, fontSize: 11, color: C.muted, letterSpacing: 0.5 }}>
                              {h.location} ·{" "}
                              {new Date(h.date).toLocaleString([], {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                              {h.format ? ` · ${h.format}` : ""}
                            </span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <Trophy size={14} color={C.court} style={{ flexShrink: 0 }} />
                            <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 14.5, color: C.ink }}>
                              {h.winnerNames}
                            </span>
                            <span style={{ fontFamily: MONO, fontSize: 13, color: C.court, fontWeight: 600 }}>
                              {h.winnerScore}
                            </span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                            <span style={{ width: 14, flexShrink: 0 }} />
                            <span style={{ fontFamily: DISPLAY, fontSize: 13.5, color: C.muted }}>
                              {h.loserNames}
                            </span>
                            <span style={{ fontFamily: MONO, fontSize: 13, color: C.muted }}>{h.loserScore}</span>
                          </div>
                        </div>
                      </SwipeRow>
                    ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Printable summary (only visible when printing) */}
      <div className="print-only" style={{ padding: 24, fontFamily: "'Inter', sans-serif", color: C.ink }}>
        <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 24 }}>Kitchen Draw — Session Recap</div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
          {sessionDateLabel()} · {history.length} games played
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              {["Location", "Format", "Winner", "Score", "Loser", "Score"].map((th) => (
                <th key={th} style={{ textAlign: "left", borderBottom: `1px solid #ccc`, padding: "4px 6px" }}>
                  {th}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...history]
              .sort((a, b) => new Date(a.date) - new Date(b.date))
              .map((h) => (
                <tr key={h.id}>
                  <td style={{ padding: "4px 6px", borderBottom: "1px solid #eee" }}>{h.location}</td>
                  <td style={{ padding: "4px 6px", borderBottom: "1px solid #eee" }}>{h.format}</td>
                  <td style={{ padding: "4px 6px", borderBottom: "1px solid #eee" }}>{h.winnerNames}</td>
                  <td style={{ padding: "4px 6px", borderBottom: "1px solid #eee" }}>{h.winnerScore}</td>
                  <td style={{ padding: "4px 6px", borderBottom: "1px solid #eee" }}>{h.loserNames}</td>
                  <td style={{ padding: "4px 6px", borderBottom: "1px solid #eee" }}>{h.loserScore}</td>
                </tr>
              ))}
          </tbody>
        </table>
        {winCounts().length > 0 && (
          <>
            <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 16, marginTop: 20 }}>Most Wins</div>
            {winCounts().map(([name, count]) => (
              <div key={name} style={{ fontSize: 13, padding: "2px 0" }}>
                {name} — {count} win{count === 1 ? "" : "s"}
              </div>
            ))}
          </>
        )}
      </div>

      {/* Undo toast */}
      {undoInfo && (
        <div
          className="screen-only"
          style={{
            position: "fixed",
            left: 14,
            right: 14,
            bottom: 18,
            maxWidth: 560,
            margin: "0 auto",
            background: C.ink,
            color: C.line,
            borderRadius: 12,
            padding: "10px 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
            zIndex: 50,
          }}
        >
          <span style={{ fontSize: 13 }}>{undoInfo.message}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
            <button
              onClick={runUndo}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                background: "none",
                border: "none",
                color: C.optic,
                fontFamily: DISPLAY,
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              <Undo2 size={14} /> Undo
            </button>
            <button
              onClick={dismissUndo}
              aria-label="Dismiss"
              style={{ background: "none", border: "none", color: C.line, opacity: 0.6, cursor: "pointer" }}
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* End session modal */}
      {showEndSession && (
        <div
          className="screen-only"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,20,18,0.55)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            zIndex: 60,
          }}
          onClick={() => setShowEndSession(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: C.paper,
              borderRadius: "18px 18px 0 0",
              padding: 20,
              width: "100%",
              maxWidth: 560,
            }}
          >
            <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 18, color: C.ink, marginBottom: 4 }}>
              End session
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
              {history.length > 0
                ? `${history.length} game${history.length === 1 ? "" : "s"} recorded. Export a recap before you wrap up?`
                : "No games recorded yet — nothing to export."}
            </div>

            {history.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button onClick={exportPNG} style={exportBtnStyle}>
                  <Download size={16} color={C.court} />
                  <div>
                    <div style={exportBtnTitle}>Download recap image (PNG)</div>
                    <div style={exportBtnSub}>Shareable graphic for a group chat</div>
                  </div>
                </button>
                <button onClick={exportCSV} style={exportBtnStyle}>
                  <Download size={16} color={C.court} />
                  <div>
                    <div style={exportBtnTitle}>Download game log (CSV)</div>
                    <div style={exportBtnSub}>Opens in Excel, Sheets, Numbers</div>
                  </div>
                </button>
                <button onClick={printResults} style={exportBtnStyle}>
                  <Printer size={16} color={C.court} />
                  <div>
                    <div style={exportBtnTitle}>Print / Save as PDF</div>
                    <div style={exportBtnSub}>Uses your browser's print dialog</div>
                  </div>
                </button>
                <button onClick={emailResults} style={exportBtnStyle}>
                  <Mail size={16} color={C.court} />
                  <div>
                    <div style={exportBtnTitle}>Email results</div>
                    <div style={exportBtnSub}>
                      Opens your mail app with a summary — attach a downloaded file if you want one included
                    </div>
                  </div>
                </button>
              </div>
            )}

            <button
              onClick={() => setShowEndSession(false)}
              style={{
                marginTop: 14,
                width: "100%",
                padding: "10px",
                borderRadius: 10,
                border: `1px solid ${C.border}`,
                background: "transparent",
                color: C.muted,
                fontFamily: DISPLAY,
                fontWeight: 600,
                fontSize: 13.5,
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const exportBtnStyle = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  textAlign: "left",
  padding: "10px 12px",
  borderRadius: 10,
  border: `1px solid ${C.border}`,
  background: C.card,
  cursor: "pointer",
};
const exportBtnTitle = { fontFamily: DISPLAY, fontWeight: 700, fontSize: 13.5, color: C.ink };
const exportBtnSub = { fontSize: 11.5, color: C.muted, marginTop: 1 };
