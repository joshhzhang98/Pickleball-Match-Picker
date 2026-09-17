import { useState, useEffect, useRef, useCallback } from "react";
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
  Moon,
  Sun,
  Share2,
  Timer,
  BarChart3,
  UserPlus,
  UserMinus,
  ChevronRight,
  Clock,
  Award,
  Target,
} from "lucide-react";

const LIGHT = {
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

const DARK = {
  court: "#1A8A80",
  courtDark: "#146B64",
  line: "#E8EBE6",
  optic: "#D7F24E",
  ink: "#E8EBE6",
  paper: "#121A17",
  card: "#1C2825",
  coral: "#FF7B6D",
  sky: "#5AA8DB",
  muted: "#8A9994",
  border: "#2E3D37",
};

function useTheme() {
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem("kd_dark") === "1"; } catch { return false; }
  });
  const toggle = () => setDark(d => { const next = !d; try { localStorage.setItem("kd_dark", next ? "1" : "0"); } catch {} return next; });
  return { dark, toggle, C: dark ? DARK : LIGHT };
}

const DISPLAY = "'Space Grotesk', sans-serif";
const MONO = "'JetBrains Mono', monospace";

// Global theme reference — updated by App's useTheme hook
let C = LIGHT;

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

function formMatches(teams, balanceDupr, maxCourts, pastMatchups) {
  const haveDupr = teams.some((t) => avgDupr(t.players) != null);
  let pool =
    balanceDupr && haveDupr
      ? [...teams].sort((a, b) => (avgDupr(a.players) ?? 0) - (avgDupr(b.players) ?? 0))
      : shuffleArr(teams);

  // Feature 5: Rematch avoidance — try to avoid same team-vs-team matchups
  if (pastMatchups && pastMatchups.size > 0 && pool.length >= 4) {
    const bestPool = findBestMatchOrder(pool, pastMatchups);
    if (bestPool) pool = bestPool;
  }

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

// Feature 5: Try different orderings to minimize rematch count
function matchupKey(teamA, teamB) {
  const a = teamA.players.map(p => p.id).sort().join("+");
  const b = teamB.players.map(p => p.id).sort().join("+");
  return [a, b].sort().join("vs");
}

function findBestMatchOrder(teams, pastMatchups) {
  let bestOrder = null;
  let bestRematches = Infinity;
  // Try 20 random shuffles, pick the one with fewest rematches
  for (let attempt = 0; attempt < 20; attempt++) {
    const shuffled = shuffleArr(teams);
    let rematches = 0;
    for (let i = 0; i + 1 < shuffled.length; i += 2) {
      const key = matchupKey(shuffled[i], shuffled[i + 1]);
      if (pastMatchups.has(key)) rematches++;
    }
    if (rematches < bestRematches) {
      bestRematches = rematches;
      bestOrder = shuffled;
      if (rematches === 0) break; // perfect — no rematches
    }
  }
  return bestOrder;
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

// Splits a group of 4 players into two teams of 2, optionally trying for one
// male + one female per team when the data supports it.
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

// Chunks a player pool into groups of 4 (skill-sorted if DUPR is available),
// returning the groups plus any leftover players who don't fill a full group.
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

// Shared "waterfall" movement: given groups of 4 (index 0 = top tier) and
// functions that return the 2 players moving up / down from each group,
// returns the reshuffled groups for the next round.
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
      setTimeout(onRemove, 250);
    } else if (dragX <= -REVEAL_WIDTH / 2) {
      setDragX(-REVEAL_WIDTH);
    } else {
      setDragX(0);
    }
  }
  function confirmDelete() {
    setRemoving(true);
    setDragX(-500);
    setTimeout(onRemove, 250);
  }

  // How far through the delete threshold (0 = resting, 1 = at delete point)
  const progress = Math.min(1, Math.abs(dragX) / DELETE_DISTANCE);
  // Trash icon scales from 1x to 1.35x as you drag
  const trashScale = 1 + progress * 0.35;
  // Red background intensifies from muted to vivid
  const redOpacity = 0.4 + progress * 0.6;
  // Row fades out as it approaches full delete
  const rowOpacity = removing ? 0 : dragX <= -DELETE_DISTANCE ? 0.3 : 1;

  return (
    <div style={{ position: "relative", borderRadius: 10, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          justifyContent: "flex-end",
          background: C.coral,
          opacity: redOpacity,
          transition: dragging ? "none" : "opacity 0.2s ease",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: REVEAL_WIDTH + 40,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <button
          onClick={confirmDelete}
          aria-label="Delete player"
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            background: "transparent",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <Trash2
            size={18}
            style={{
              transform: `scale(${trashScale})`,
              transition: dragging ? "none" : "transform 0.2s ease",
            }}
          />
        </button>
      </div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        style={{
          transform: `translateX(${dragX}px)`,
          opacity: rowOpacity,
          transition: dragging
            ? "none"
            : removing
            ? "transform 0.25s cubic-bezier(0.4, 0, 1, 1), opacity 0.25s ease"
            : "transform 0.35s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.15s ease",
          touchAction: "pan-y",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default function App() {
  const { dark, toggle: toggleDark, C: themeC } = useTheme();
  C = themeC; // Update global C for subcomponents

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
  const [courtNames, setCourtNames] = useState({}); // Feature 9: custom court names
  const [matches, setMatches] = useState([]);
  const [benchPlayers, setBenchPlayers] = useState([]);
  const [benchTeams, setBenchTeams] = useState([]);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [benchHistory, setBenchHistory] = useState([]);
  const [roundNumber, setRoundNumber] = useState(0); // Feature 1: round counter
  const [sessionMatchups, setSessionMatchups] = useState(new Set()); // Feature 5: rematch avoidance
  const [history, setHistory] = useState([]);

  const [ladderCourts, setLadderCourts] = useState(null);
  const [pods, setPods] = useState(null);
  const [podScores, setPodScores] = useState({});

  const [undoInfo, setUndoInfo] = useState(null);
  const undoTimerRef = useRef(null);

  const [showEndSession, setShowEndSession] = useState(false);
  const [showSwipeTip, setShowSwipeTip] = useState(false);
  const swipeTipShown = useRef(false);

  // Feature 2: Latecomer/early-leaver status
  const [leftPlayers, setLeftPlayers] = useState(new Set()); // ids of players who left early

  // Feature 4: Player stats modal
  const [statsPlayer, setStatsPlayer] = useState(null);

  // Feature 6: Session timer
  const [sessionStart, setSessionStart] = useState(null);
  const [elapsed, setElapsed] = useState("");

  // Feature 8: Share roster
  const [shareMsg, setShareMsg] = useState("");

  function pushUndo(message, restore) {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoInfo({ message, restore });
    undoTimerRef.current = setTimeout(() => setUndoInfo(null), 12000);
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
    setBenchHistory([]);
    setRoundNumber(0);
    setSessionMatchups(new Set());
    setLeftPlayers(new Set());
    setLadderCourts(null);
    setPods(null);
    setPodScores({});
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem("kd_roster");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setPlayers(parsed);
      }
    } catch (e) {
      // nothing saved yet
    }
    try {
      const saved = localStorage.getItem("kd_history");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setHistory(parsed);
      }
    } catch (e) {
      // nothing saved yet
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem("kd_roster", JSON.stringify(players)); } catch (e) {}
  }, [players, loaded]);

  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem("kd_history", JSON.stringify(history)); } catch (e) {}
  }, [history, loaded]);

  // Show one-time swipe tip when roster goes from 0 to 1+ players
  useEffect(() => {
    if (players.length > 0 && !swipeTipShown.current) {
      try {
        const seen = localStorage.getItem("kd_swipe_tip_seen");
        if (!seen) {
          setShowSwipeTip(true);
          localStorage.setItem("kd_swipe_tip_seen", "1");
          setTimeout(() => setShowSwipeTip(false), 5000);
        }
      } catch (e) {}
      swipeTipShown.current = true;
    }
  }, [players.length]);

  // Feature 6: Session timer — tick every 30s
  useEffect(() => {
    if (!sessionStart) return;
    const tick = () => {
      const diff = Math.floor((Date.now() - sessionStart) / 1000);
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      setElapsed(h > 0 ? `${h}h ${m}m` : `${m}m`);
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [sessionStart]);

  // Feature 8: Load shared roster from URL on mount
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const shared = params.get("roster");
      if (shared) {
        const decoded = JSON.parse(decodeURIComponent(escape(atob(shared))));
        if (Array.isArray(decoded) && decoded.length > 0) {
          setPlayers(prev => {
            if (prev.length > 0) return prev; // don't overwrite existing roster
            return decoded.map(p => ({ ...p, id: uid() }));
          });
          // Clean URL without reload
          window.history.replaceState({}, "", window.location.pathname);
        }
      }
    } catch {}
  }, []);

  // Feature 4: Player stats calculator
  function getPlayerStats(playerId) {
    const playerName = players.find(p => p.id === playerId)?.name;
    if (!playerName) return null;
    let wins = 0, losses = 0, pointsFor = 0, pointsAgainst = 0;
    const partners = {}, opponents = {};
    history.forEach(h => {
      const isWinner = h.winnerNames.split(" & ").includes(playerName);
      const isLoser = h.loserNames.split(" & ").includes(playerName);
      if (!isWinner && !isLoser) return;
      if (isWinner) {
        wins++;
        pointsFor += h.winnerScore;
        pointsAgainst += h.loserScore;
        h.winnerNames.split(" & ").forEach(n => { if (n !== playerName) partners[n] = (partners[n] || 0) + 1; });
        h.loserNames.split(" & ").forEach(n => { opponents[n] = (opponents[n] || 0) + 1; });
      } else {
        losses++;
        pointsFor += h.loserScore;
        pointsAgainst += h.winnerScore;
        h.loserNames.split(" & ").forEach(n => { if (n !== playerName) partners[n] = (partners[n] || 0) + 1; });
        h.winnerNames.split(" & ").forEach(n => { opponents[n] = (opponents[n] || 0) + 1; });
      }
    });
    const games = wins + losses;
    const topPartner = Object.entries(partners).sort((a, b) => b[1] - a[1])[0];
    const topOpponent = Object.entries(opponents).sort((a, b) => b[1] - a[1])[0];
    return {
      name: playerName, games, wins, losses,
      winPct: games > 0 ? Math.round((wins / games) * 100) : 0,
      avgFor: games > 0 ? (pointsFor / games).toFixed(1) : "–",
      avgAgainst: games > 0 ? (pointsAgainst / games).toFixed(1) : "–",
      topPartner: topPartner ? topPartner[0] : "–",
      topOpponent: topOpponent ? topOpponent[0] : "–",
      benchCount: benchHistory.filter(id => id === playerId).length,
    };
  }

  const hasGenderData = players.some((p) => p.gender);
  const hasDuprData = players.some((p) => p.dupr != null);

  function addPlayer() {
    const name = nameInput.trim();
    if (!name) return;
    const dupr = duprInput.trim() ? parseFloat(duprInput) : null;
    const newPlayer = { id: uid(), name, gender: genderInput, dupr: isNaN(dupr) ? null : dupr };
    setPlayers((ps) => [...ps, newPlayer]);
    // Feature 2: If session is active, balance their bench count
    if (hasGenerated) joinMidSession(newPlayer);
    setNameInput("");
    setGenderInput(null);
    setDuprInput("");
  }

  // Shared name cleaner: strips bullets, numbering, and validates
  const HEADER_WORDS = /^(name|player|gender|dupr|rating|score|team|court|#)$/i;
  function cleanName(raw) {
    if (!raw) return null;
    // Strip leading bullets, numbers, checkboxes: "1. ", "1) ", "• ", "- ", "* ", "☐ ", etc.
    let name = raw.replace(/^[\s]*(?:\d+[.)]\s+|\d+\)\s*|\d+\s+(?=[A-Za-z])|[•\-*→▸▹☐☑✓✗►]\s*)/g, "").trim();
    if (!name || name.length < 2) return null;
    // Must contain at least one letter (filters "12345", "..", "---")
    if (!/[a-zA-Z]/.test(name)) return null;
    // Skip common header words
    if (HEADER_WORDS.test(name)) return null;
    return name;
  }

  function parsePaste() {
    // Step 1: Split by newlines first
    const rawLines = pasteText.split("\n").map((l) => l.trim()).filter(Boolean);

    // Step 2: For each line, decide if commas separate players or fields (name,gender,DUPR)
    // Heuristic: if a comma-separated part looks like a name (2+ chars, not M/F, not a number),
    // treat the whole line as multiple players separated by commas.
    const entries = [];
    rawLines.forEach((line) => {
      const parts = line.split(/[,;]/).map((s) => s.trim()).filter(Boolean);

      if (parts.length <= 1) {
        // No commas — single entry, might be tab-separated
        const tabParts = line.split(/\t/).map((s) => s.trim());
        entries.push(tabParts);
        return;
      }

      // Check if commas are separating multiple player names or one player's fields
      // A "name-like" part is: 2+ chars, not a single M/F, not a pure number
      const nameLikeParts = parts.filter(
        (p) => p.length >= 2 && !/^[mf]$/i.test(p) && isNaN(parseFloat(p))
      );

      if (nameLikeParts.length >= 2) {
        // Multiple names on one line — each comma-separated value is a potential player
        // But some might have gender/DUPR right after: "Marcus Ellis, M, 3.5, Jenna Wallace, F, 4.0"
        let i = 0;
        while (i < parts.length) {
          const part = parts[i];
          // If this part looks like a name (not M/F, not a number)
          if (part.length >= 2 && !/^[mf]$/i.test(part) && isNaN(parseFloat(part))) {
            // Collect trailing gender/DUPR fields
            const entry = [part];
            while (i + 1 < parts.length) {
              const next = parts[i + 1];
              if (/^[mf]$/i.test(next) || (!isNaN(parseFloat(next)) && next.length < 6)) {
                entry.push(next);
                i++;
              } else {
                break;
              }
            }
            entries.push(entry);
          }
          i++;
        }
      } else {
        // Only 1 name-like part — treat the whole line as one player: name, gender, DUPR
        entries.push(parts);
      }
    });

    // Step 3: Parse each entry into a player
    const added = entries
      .map((parts) => {
        const name = cleanName(parts[0]);
        if (!name) return null;
        let gender = null;
        let dupr = null;
        for (let i = 1; i < parts.length; i++) {
          const v = parts[i].trim();
          if (/^[mf]$/i.test(v)) gender = v.toUpperCase();
          else if (v && !isNaN(parseFloat(v))) dupr = parseFloat(v);
        }
        return { id: uid(), name, gender, dupr };
      })
      .filter(Boolean);
    setPlayers((ps) => [...ps, ...added]);
    setPasteText("");
  }

  async function handlePhotoFile(file) {
    if (!file) return;
    setPhotoError("");
    setPhotoPreview(null);
    setPhotoLoading(true);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      setPhotoPreview(dataUrl);

      // Load Tesseract.js from CDN if not already loaded
      if (!window.Tesseract) {
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
          s.onload = resolve;
          s.onerror = () => reject(new Error("Failed to load OCR library"));
          document.head.appendChild(s);
        });
      }

      const result = await window.Tesseract.recognize(dataUrl, "eng", {
        logger: () => {},
      });

      const rawText = result.data.text || "";
      const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);

      if (!lines.length) {
        setPhotoPreview(null);
        setPhotoError("Couldn't read any text — try a clearer, well-lit photo with printed or typed names.");
        return;
      }

      const newPlayers = lines
        .map((line) => {
          // Clean up OCR noise: remove non-alphanumeric chars except punctuation used in names
          const cleaned = line.replace(/[^a-zA-Z0-9.,\s\-'/]/g, "").trim();
          if (!cleaned || cleaned.length < 2) return null;

          const parts = cleaned.split(/\t|,|(?<=\S)\s{2,}/).map((s) => s.trim());
          const name = cleanName(parts[0]);
          if (!name) return null;
          let gender = null;
          let dupr = null;
          for (let i = 1; i < parts.length; i++) {
            const v = parts[i];
            if (/^[mf]$/i.test(v)) gender = v.toUpperCase();
            else if (v && !isNaN(parseFloat(v))) dupr = parseFloat(v);
          }
          return {
            id: uid(),
            name,
            gender: gender ? String(gender).toUpperCase()[0] : null,
            dupr: dupr != null && !isNaN(dupr) ? dupr : null,
          };
        })
        .filter(Boolean);

      if (!newPlayers.length) {
        setPhotoPreview(null);
        setPhotoError("Found text but couldn't identify any player names. Try a clearer photo, or use Paste instead.");
      } else {
        setPlayers((ps) => [...ps, ...newPlayers]);
        setPhotoPreview(null);
      }
    } catch (e) {
      setPhotoPreview(null);
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
        setBenchHistory([]);
        setLadderCourts(null);
        setPods(null);
        setPodScores({});
      } else {
        // Remove this player's entries from bench rotation history
        setBenchHistory((prev) => prev.filter((pid) => pid !== id));
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
    setBenchHistory([]);
    setRoundNumber(0);
    setSessionMatchups(new Set());
    setLeftPlayers(new Set());
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
    const limit = getCourtLimit();
    // Feature 2: Filter out players who left early
    const activePlayers = players.filter(p => !leftPlayers.has(p.id));
    const maxActivePlayers = limit ? limit * 4 : activePlayers.length;
    const activeTarget = Math.min(activePlayers.length, maxActivePlayers);
    const evenActive = activeTarget - (activeTarget % 2);
    const totalBench = activePlayers.length - evenActive;

    let playingPlayers = activePlayers;
    let preBenched = [];

    if (totalBench > 0) {
      const counts = {};
      activePlayers.forEach(p => {
        counts[p.id] = benchHistory.filter(id => id === p.id).length;
      });
      const sorted = shuffleArr(activePlayers).sort((a, b) => counts[a.id] - counts[b.id]);
      preBenched = sorted.slice(0, totalBench);
      playingPlayers = sorted.slice(totalBench);
      const newBenchIds = preBenched.map(p => p.id);
      setBenchHistory(prev => [...prev, ...newBenchIds]);
    }

    const { teams, bench } = formTeams(playingPlayers, balanceGender && hasGenderData, balanceDupr && hasDuprData);
    // Feature 5: Pass session matchup history for rematch avoidance
    const { matches: newMatches, benchTeams } = formMatches(teams, balanceDupr && hasDuprData, limit, sessionMatchups);

    // Track new matchups
    setSessionMatchups(prev => {
      const next = new Set(prev);
      newMatches.forEach(m => next.add(matchupKey(m.teamA, m.teamB)));
      return next;
    });

    // Feature 9: Apply custom court names
    const namedMatches = newMatches.map(m => ({
      ...m,
      headerLabel: courtNames[m.court] || `COURT ${m.court}`,
    }));

    initMatches(namedMatches);
    setBenchPlayers([...preBenched, ...bench]);
    setBenchTeams(benchTeams);
    setRoundNumber(prev => prev + 1);
    // Feature 6: Start session timer on first generate
    if (!sessionStart) setSessionStart(Date.now());
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

  // Feature 3: Haptic + sound on score save
  function playScoreSound() {
    try { navigator.vibrate?.(50); } catch {}
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    } catch {}
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
      playScoreSound();
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
  // Feature 8: Share roster via URL (unicode-safe)
  function shareRoster() {
    try {
      const data = players.map(p => ({ name: p.name, gender: p.gender, dupr: p.dupr }));
      const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
      const url = `${window.location.origin}${window.location.pathname}?roster=${encoded}`;
      navigator.clipboard?.writeText(url).then(() => {
        setShareMsg("Link copied! Send it to your co-organizer.");
        setTimeout(() => setShareMsg(""), 3000);
      }).catch(() => {
        window.prompt("Copy this link:", url);
      });
    } catch {}
  }

  // Feature 2: Mark player as left / rejoin
  function togglePlayerLeft(id) {
    setLeftPlayers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // Feature 2: Join mid-session (set bench count to average so they don't get unfair priority)
  function joinMidSession(player) {
    if (benchHistory.length > 0 && players.length > 1) {
      // Give them the average bench count so they don't skip to front of rotation
      const counts = {};
      players.forEach(p => { counts[p.id] = benchHistory.filter(id => id === p.id).length; });
      const avg = Math.round(Object.values(counts).reduce((a, b) => a + b, 0) / Object.values(counts).length);
      const padding = Array(avg).fill(player.id);
      setBenchHistory(prev => [...prev, ...padding]);
    }
  }

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
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
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

    // Helper: truncate text to fit within maxWidth
    function truncText(text, maxW) {
      let t = text;
      while (ctx.measureText(t).width > maxW && t.length > 3) {
        t = t.slice(0, -2) + "…";
      }
      return t;
    }

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
    rowsData.forEach((h) => {
      ctx.fillStyle = C.ink;
      ctx.font = "700 14px sans-serif";
      ctx.fillText(truncText(h.winnerNames, 340), 24, y);
      ctx.font = "13px monospace";
      ctx.fillStyle = C.court;
      ctx.fillText(`${h.winnerScore}`, 380, y);
      ctx.font = "14px sans-serif";
      ctx.fillStyle = C.muted;
      ctx.fillText(truncText(`vs ${h.loserNames}`, 230), 420, y);
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
        ctx.fillText(truncText(name, width - 160), 24, y);
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
    <div style={{ minHeight: "100vh", background: C.paper, fontFamily: "'Inter', sans-serif", color: C.ink, transition: "background 0.3s, color 0.3s" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap');
        * { box-sizing: border-box; }
        input, textarea, select { color: ${C.ink}; background: ${C.card}; }
        input:focus, textarea:focus, button:focus-visible { outline: 2px solid ${C.court}; outline-offset: 1px; }
        ::placeholder { color: ${dark ? "#5A6B65" : "#A6B0AB"}; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
        @keyframes tipSlideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
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
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: C.optic }}>
                MIXED DOUBLES
              </span>
              {/* Feature 6: Session timer */}
              {sessionStart && (
                <span style={{ fontFamily: MONO, fontSize: 10, color: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", gap: 3 }}>
                  <Clock size={10} /> {elapsed} · {history.length} game{history.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 26, color: C.line, lineHeight: 1.1 }}>
              Kitchen Draw
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 2 }}>
            {/* Feature 7: Dark mode toggle */}
            <button
              onClick={toggleDark}
              aria-label="Toggle dark mode"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 34, height: 34, borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.25)",
                background: "rgba(255,255,255,0.08)",
                color: C.line, cursor: "pointer",
              }}
            >
              {dark ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <button
              onClick={() => setShowEndSession(true)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 12px", borderRadius: 999,
                border: `1px solid ${C.coral}`,
                background: "rgba(255,107,91,0.2)",
                color: "#FF8A7A",
                fontFamily: DISPLAY, fontWeight: 700, fontSize: 12, cursor: "pointer",
              }}
            >
              <Flag size={13} /> End session
            </button>
          </div>
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
                    onChange={(e) => handlePhotoFile(e.target.files?.[0])}
                    style={{ display: "none" }}
                  />
                  <button
                    onClick={() => {
                      if (fileRef.current) fileRef.current.value = "";
                      fileRef.current?.click();
                    }}
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
                      cursor: photoLoading ? "default" : "pointer",
                    }}
                  >
                    {photoLoading ? (
                      <>
                        <Loader2 size={16} className="spin" /> Reading photo…
                      </>
                    ) : (
                      <>
                        <Camera size={16} /> Take or upload a photo of the list
                      </>
                    )}
                  </button>
                  <div style={{ fontSize: 11.5, color: C.muted, marginTop: 6, textAlign: "center" }}>
                    Works best with printed or typed text. Handwriting may be less accurate.
                  </div>
                  {photoError && (
                    <div
                      style={{
                        marginTop: 8,
                        padding: "10px 12px",
                        borderRadius: 8,
                        background: "rgba(255,107,91,0.08)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      <div style={{ display: "flex", gap: 6, alignItems: "flex-start", color: C.coral, fontSize: 12.5 }}>
                        <AlertCircle size={14} style={{ marginTop: 1, flexShrink: 0 }} />
                        {photoError}
                      </div>
                      <button
                        onClick={() => {
                          setPhotoError("");
                          setPhotoPreview(null);
                          if (fileRef.current) fileRef.current.value = "";
                          fileRef.current?.click();
                        }}
                        style={{
                          alignSelf: "flex-start",
                          padding: "6px 14px",
                          borderRadius: 8,
                          border: `1px solid ${C.coral}`,
                          background: "transparent",
                          color: C.coral,
                          fontFamily: DISPLAY,
                          fontWeight: 700,
                          fontSize: 12.5,
                          cursor: "pointer",
                        }}
                      >
                        <RefreshCw size={12} style={{ marginRight: 4, verticalAlign: -1 }} />
                        Try again
                      </button>
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
                    {leftPlayers.size > 0 && ` · ${leftPlayers.size} left`}
                  </span>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    {/* Feature 8: Share roster */}
                    {players.length >= 2 && (
                      <button
                        onClick={shareRoster}
                        style={{
                          display: "flex", alignItems: "center", gap: 4,
                          background: "none", border: "none", color: C.court,
                          fontSize: 11.5, fontFamily: "'Inter', sans-serif", cursor: "pointer",
                        }}
                      >
                        <Share2 size={12} /> Share
                      </button>
                    )}
                    <button
                      onClick={clearRoster}
                      style={{
                        display: "flex", alignItems: "center", gap: 4,
                        background: "none", border: "none", color: C.muted,
                        fontSize: 11.5, fontFamily: "'Inter', sans-serif", cursor: "pointer",
                      }}
                    >
                      <Trash2 size={12} /> Clear all
                    </button>
                  </div>
                </div>
                {showSwipeTip && (
                  <div
                    onClick={() => setShowSwipeTip(false)}
                    style={{
                      marginBottom: 10,
                      padding: "10px 14px",
                      borderRadius: 10,
                      background: C.ink,
                      color: C.line,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 13,
                      boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
                      animation: "tipSlideIn 0.35s cubic-bezier(0.25,1,0.5,1)",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ fontSize: 18 }}>👈</span>
                    <span>Swipe left on a player to remove them</span>
                    <span style={{ marginLeft: "auto", fontSize: 11, opacity: 0.5 }}>tap to dismiss</span>
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {players.map((p) => {
                    const isLeft = leftPlayers.has(p.id);
                    return (
                    <SwipeRow key={p.id} onRemove={() => removePlayer(p.id)}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          background: C.card,
                          border: `1px solid ${isLeft ? C.coral : C.border}`,
                          borderRadius: 10,
                          padding: "8px 12px",
                          opacity: isLeft ? 0.5 : 1,
                        }}
                      >
                        {/* Feature 4: Tap name for stats */}
                        <button
                          onClick={() => setStatsPlayer(p.id)}
                          style={{
                            flex: 1, minWidth: 0, border: "none", background: "transparent",
                            fontFamily: DISPLAY, fontWeight: 600, fontSize: 14.5, color: C.ink,
                            textAlign: "left", cursor: "pointer", padding: 0,
                            textDecoration: isLeft ? "line-through" : "none",
                          }}
                        >
                          {p.name}
                          {isLeft && <span style={{ fontSize: 10, color: C.coral, marginLeft: 6 }}>LEFT</span>}
                        </button>
                        {/* Feature 2: Leave/rejoin toggle */}
                        {hasGenerated && (
                          <button
                            onClick={() => togglePlayerLeft(p.id)}
                            title={isLeft ? "Rejoin session" : "Mark as left"}
                            style={{
                              display: "flex", alignItems: "center", justifyContent: "center",
                              width: 28, height: 28, borderRadius: 6,
                              border: `1px solid ${isLeft ? C.court : C.border}`,
                              background: isLeft ? "rgba(20,107,100,0.1)" : "transparent",
                              color: isLeft ? C.court : C.muted, cursor: "pointer",
                            }}
                          >
                            {isLeft ? <UserPlus size={13} /> : <UserMinus size={13} />}
                          </button>
                        )}
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
                    );
                  })}
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
                {/* Feature 1: Round counter + bench preview */}
                {format === "roundRobin" && (
                  <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "8px 12px", borderRadius: 10,
                    background: `${C.court}15`, marginBottom: 12,
                  }}>
                    <span style={{ fontFamily: MONO, fontSize: 12, color: C.court, fontWeight: 600 }}>
                      Round {roundNumber}
                    </span>
                    {(() => {
                      // Preview who sits out next round
                      const active = players.filter(p => !leftPlayers.has(p.id));
                      const limit = getCourtLimit();
                      const maxAct = limit ? limit * 4 : active.length;
                      const actTarget = Math.min(active.length, maxAct);
                      const evenAct = actTarget - (actTarget % 2);
                      const nextBenchCount = active.length - evenAct;
                      if (nextBenchCount <= 0) return null;
                      const counts = {};
                      const nextHist = [...benchHistory, ...(benchPlayers.map(p => p.id))];
                      active.forEach(p => { counts[p.id] = nextHist.filter(id => id === p.id).length; });
                      const sorted = [...active].sort((a, b) => counts[a.id] - counts[b.id]);
                      const nextBench = sorted.slice(0, Math.min(nextBenchCount, 3)).map(p => p.name);
                      return (
                        <span style={{ fontSize: 11, color: C.muted }}>
                          Next to sit: {nextBench.join(", ")}{nextBenchCount > 3 ? ` +${nextBenchCount - 3}` : ""}
                        </span>
                      );
                    })()}
                  </div>
                )}

                {/* Feature 9: Custom court names */}
                <details style={{ marginBottom: 12 }}>
                  <summary style={{ fontSize: 12, color: C.muted, cursor: "pointer", padding: "4px 2px" }}>
                    Rename courts
                  </summary>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                    {matches.map(m => (
                      <div key={m.court} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontFamily: MONO, fontSize: 11, color: C.muted, width: 60 }}>Court {m.court}</span>
                        <input
                          value={courtNames[m.court] || ""}
                          onChange={e => setCourtNames(prev => ({ ...prev, [m.court]: e.target.value }))}
                          placeholder={`COURT ${m.court}`}
                          style={{
                            flex: 1, padding: "6px 8px", borderRadius: 6,
                            border: `1px solid ${C.border}`, fontFamily: MONO, fontSize: 12,
                            background: C.card, color: C.ink,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </details>
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
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 8, padding: "0 2px", opacity: 0.7 }}>
                  ← Swipe left to remove a game
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

      {/* Feature 8: Share message toast */}
      {shareMsg && (
        <div
          className="screen-only"
          style={{
            position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)",
            background: C.court, color: C.line, padding: "10px 18px",
            borderRadius: 10, fontSize: 13, fontFamily: DISPLAY, fontWeight: 600,
            boxShadow: "0 4px 16px rgba(0,0,0,0.2)", zIndex: 70,
            animation: "tipSlideIn 0.3s ease",
          }}
        >
          <Share2 size={13} style={{ verticalAlign: -2, marginRight: 6 }} />
          {shareMsg}
        </div>
      )}

      {/* Feature 4: Player stats modal */}
      {statsPlayer && (() => {
        const stats = getPlayerStats(statsPlayer);
        if (!stats) { setStatsPlayer(null); return null; }
        return (
          <div
            className="screen-only"
            style={{
              position: "fixed", inset: 0, background: "rgba(15,20,18,0.55)",
              display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60,
            }}
            onClick={() => setStatsPlayer(null)}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: C.paper, borderRadius: 18, padding: 20,
                width: "90%", maxWidth: 360,
                boxShadow: "0 8px 30px rgba(0,0,0,0.2)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 18, color: C.ink }}>{stats.name}</div>
                <button onClick={() => setStatsPlayer(null)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}>
                  <X size={18} />
                </button>
              </div>

              {stats.games === 0 ? (
                <div style={{ fontSize: 13, color: C.muted, textAlign: "center", padding: "20px 0" }}>
                  No games recorded yet for this player.
                </div>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
                    {[
                      { label: "Games", value: stats.games, icon: Target },
                      { label: "Wins", value: stats.wins, icon: Trophy },
                      { label: "Win %", value: `${stats.winPct}%`, icon: Award },
                    ].map(s => (
                      <div key={s.label} style={{
                        background: C.card, borderRadius: 10, padding: "10px 8px",
                        textAlign: "center", border: `1px solid ${C.border}`,
                      }}>
                        <s.icon size={16} color={C.court} style={{ marginBottom: 4 }} />
                        <div style={{ fontFamily: MONO, fontWeight: 600, fontSize: 18, color: C.ink }}>{s.value}</div>
                        <div style={{ fontSize: 10, color: C.muted }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                      <span style={{ color: C.muted }}>Avg score for</span>
                      <span style={{ fontFamily: MONO, color: C.ink }}>{stats.avgFor}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                      <span style={{ color: C.muted }}>Avg score against</span>
                      <span style={{ fontFamily: MONO, color: C.ink }}>{stats.avgAgainst}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                      <span style={{ color: C.muted }}>Top partner</span>
                      <span style={{ fontFamily: MONO, color: C.ink }}>{stats.topPartner}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                      <span style={{ color: C.muted }}>Top opponent</span>
                      <span style={{ fontFamily: MONO, color: C.ink }}>{stats.topOpponent}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
                      <span style={{ color: C.muted }}>Times sat out</span>
                      <span style={{ fontFamily: MONO, color: C.ink }}>{stats.benchCount}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}

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
