import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Heart, 
  MessageCircle, 
  Flame, 
  Compass, 
  History, 
  RefreshCw,
  Sparkles,
  Users,
  Copy,
  Check,
  Play,
  RotateCcw,
  Trophy,
  Timer as TimerIcon,
  Plus,
  LogOut,
  X,
  ChevronRight,
  TrendingUp,
  ThumbsUp,
  ThumbsDown,
  Gift
} from 'lucide-react';
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  onSnapshot, 
  serverTimestamp
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  signInAnonymously,
  GoogleAuthProvider,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { db, auth } from './firebase';

// --- Types & Constants ---

type Category = 'Deep' | 'Riddle' | 'Flashback' | 'Dare' | 'Future' | 'Gift';

interface Question {
  id: string;
  text: string;
  category: Category;
  type?: 'boolean' | 'completion';
}

interface RoomData {
  id: string;
  status: 'waiting' | 'setup' | 'active' | 'finished';
  hostId: string;
  hostName: string;
  guestId?: string;
  guestName?: string;
  wheelState: 'idle' | 'spinning' | 'result';
  nextSpinnerId: string;
  lastSpinnerId?: string;
  rotation: number;
  currentQuestion?: Question;
  timerEndTime?: number | null;
  customQuestions?: Question[];
  maxRounds: number;
  currentRound: number;
  scores: {
    host: number;
    guest: number;
  };
  lastAction: 'accepted' | 'declined' | null;
  createdAt: any;
}

const CATEGORIES: { id: Category; label: string; color: string; icon: any }[] = [
  { id: 'Deep', label: 'Qoto Dheer', color: '#8b5cf6', icon: MessageCircle },
  { id: 'Riddle', label: 'Xujooyin', color: '#f59e0b', icon: Sparkles },
  { id: 'Flashback', label: 'Xusuus', color: '#10b981', icon: History },
  { id: 'Dare', label: 'Caqabado', color: '#ef4444', icon: Flame },
  { id: 'Future', label: 'Mustaqbalka', color: '#3b82f6', icon: Compass },
  { id: 'Gift', label: 'Abaal-marin', color: '#ec4899', icon: Gift },
];

const INITIAL_QUESTIONS: Question[] = [
  { id: 'd1', category: 'Deep', text: 'Maxaad ugu malaysaa inay tahay sirta xiriirka guuleysta?', type: 'completion' },
  { id: 'd2', category: 'Deep', text: 'Waa maxay cabsidaada ugu weyn ee dhinaca xiriirka?', type: 'completion' },
  { id: 'r1', category: 'Riddle', text: 'Waxa uu leeyahay af laakiin ma hadlo, waxa uu leeyahay sariir laakiin ma seexdo. Waa maxay? (Waa Wabi)', type: 'completion' },
  { id: 'r2', category: 'Riddle', text: 'Waa maxay waxa mar walba kuu imaanaya laakiin aan waligiis soo gaarin? (Waa Berri)', type: 'completion' },
  { id: 'f1', category: 'Flashback', text: 'Waa maxay xusuustaadii ugu horeysay ee nala kulmay?', type: 'completion' },
  { id: 'f2', category: 'Flashback', text: 'Ma xasuusataa hadalkii ugu horeeyay ee aan is weydaarsanay?', type: 'completion' },
  { id: 'dr1', category: 'Dare', text: 'Igu samee 3 compliment oo kala duwan 10 ilbiriqsi gudahood!', type: 'boolean' },
  { id: 'dr2', category: 'Dare', text: 'Igu hor hees hal daqiiqo, ha joojin ilaa aan ku dhaha jooji!', type: 'boolean' },
  { id: 'ft1', category: 'Future', text: 'Xagee jeceshahay inaan u safarno sanadka dambe?', type: 'completion' },
  { id: 'ft2', category: 'Future', text: 'Riyadaada ugu weyn ee aad rabto inaan wada gaarno waa maxay?', type: 'completion' },
  { id: 'g1', category: 'Gift', text: 'Waxaad xaq u leedahay in lagu dhunkado 5 jeer hadda! 😘', type: 'boolean' },
  { id: 'g2', category: 'Gift', text: 'Qofka kale waa inuu kuu sameeyaa koob shaah ama qaxwo ah.', type: 'boolean' },
];

// --- Helpers ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || false,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo.error;
}

// --- Components ---

function Wheel({ rotation, onSpinEnd }: { rotation: number; onSpinEnd?: () => void }) {
  return (
    <div className="relative w-72 h-72 md:w-80 md:h-80 mx-auto">
      {/* Needle */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-4 z-20">
        <div className="w-8 h-8 bg-gray-900 shadow-lg" style={{ clipPath: 'polygon(50% 100%, 0% 0%, 100% 0%)' }} />
      </div>
      
      <motion.div
        animate={{ rotate: rotation }}
        transition={{ type: 'spring', damping: 20, stiffness: 40, mass: 2 }}
        onAnimationComplete={onSpinEnd}
        className="w-full h-full rounded-full border-8 border-white shadow-[0_20px_50px_rgba(0,0,0,0.15)] relative overflow-hidden bg-white"
      >
        {CATEGORIES.map((cat, i) => {
          const angle = 360 / CATEGORIES.length;
          const rotate = i * angle;
          return (
            <div
              key={cat.id}
              className="absolute top-0 left-0 w-full h-full origin-center"
              style={{
                transform: `rotate(${rotate}deg)`,
                clipPath: 'polygon(50% 50%, 50% 0%, 100% 0%, 100% 50%)',
                backgroundColor: cat.color,
              }}
            >
              <div 
                className="absolute top-12 left-1/2 -translate-x-1/2 text-white flex flex-col items-center gap-1"
                style={{ 
                  transform: `rotate(${angle / 2}deg)`,
                  width: '120px',
                  textAlign: 'center'
                }}
              >
                <div className="bg-black/20 p-2 rounded-full backdrop-blur-sm mb-1 ring-1 ring-white/30">
                  {React.createElement(cat.icon, { size: 20, className: "drop-shadow-lg" })}
                </div>
                <span className="text-[11px] font-black uppercase tracking-wider leading-tight [text-shadow:0_2px_4px_rgba(0,0,0,0.8)] bg-black/10 px-3 py-1 rounded-full border border-white/10">
                  {cat.label}
                </span>
              </div>
            </div>
          );
        })}
        {/* Center Cap */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 bg-white rounded-full shadow-xl z-10 flex items-center justify-center">
          <div className="w-10 h-10 rounded-full border-4 border-rose-50 flex items-center justify-center">
            <div className="w-2 h-2 bg-rose-500 rounded-full" />
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Timer({ endTime }: { endTime: number }) {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((endTime - now) / 1000));
      setTimeLeft(diff);
      if (diff === 0) clearInterval(interval);
    }, 100);
    return () => clearInterval(interval);
  }, [endTime]);

  return (
    <div className="flex items-center gap-2 text-rose-600 font-mono font-bold text-xl bg-white px-6 py-3 rounded-2xl border-4 border-rose-100 shadow-sm">
      <TimerIcon className="w-6 h-6 animate-pulse" />
      {timeLeft}s
    </div>
  );
}

function Confetti() {
  return (
    <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
      {Array.from({ length: 50 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 1, x: 0, y: 0, scale: 0 }}
          animate={{ 
            opacity: 0, 
            x: (Math.random() - 0.5) * 600, 
            y: (Math.random() - 0.5) * 600,
            scale: Math.random() * 2,
            rotate: Math.random() * 360
          }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="absolute w-4 h-4 rounded-sm"
          style={{ backgroundColor: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#ec4899'][i % 5] }}
        />
      ))}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [room, setRoom] = useState<RoomData | null>(null);
  const [roomCode, setRoomCode] = useState('');
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Setup states
  const [numRounds, setNumRounds] = useState(10);
  const [customInput, setCustomInput] = useState('');
  const [customList, setCustomList] = useState<string[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const loginAsGuest = async () => {
    try {
      await signInAnonymously(auth);
      setError(null);
    } catch (e: any) {
      setError(`Guest login failed: ${e.message}`);
    }
  };

  const loginWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setError(null);
    } catch (e: any) {
      console.error("Login Error:", e);
      if (e.code === 'auth/popup-blocked') {
        setError("Popup-ka waa la xiray. Fadlan ogolow popup-ka daaqadaada.");
      } else if (e.code === 'auth/unauthorized-domain') {
        setError("Domain-kaan (maalloveai.vercel.app) looma ogola Google Login. Waxaad ku geli kartaa 'GUEST' hoos ka dooro.");
      } else {
        setError(`Galita way ku fashilantay: ${e.message || 'Cillad aan la garaneyn'}`);
      }
    }
  };

  useEffect(() => {
    if (!room?.id) return;
    const unsub = onSnapshot(doc(db, 'rooms', room.id), (snapshot) => {
      if (snapshot.exists()) { 
        const data = snapshot.data() as RoomData;
        if (data.lastAction === 'accepted' && room?.lastAction !== 'accepted') {
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 2000);
        }
        setRoom(data); 
      }
    });
    return () => unsub();
  }, [room?.id, room?.lastAction]);

  const createRoom = async () => {
    if (!user || !userName.trim()) return setError("Fadlan magacaaga qor!");
    const id = Math.random().toString(36).substring(2, 7).toUpperCase();
    const newRoom: Partial<RoomData> = {
      id, status: 'waiting', hostId: user.uid, hostName: userName, wheelState: 'idle', 
      rotation: 0, nextSpinnerId: user.uid, currentRound: 0, maxRounds: 10,
      scores: { host: 0, guest: 0 }, lastAction: null, createdAt: serverTimestamp()
    };
    try {
      await setDoc(doc(db, 'rooms', id), newRoom);
      setRoom(newRoom as RoomData);
      setError(null);
    } catch (e) { setError(handleFirestoreError(e, OperationType.CREATE, `rooms/${id}`)); }
  };

  const joinRoom = async () => {
    if (!user || !userName.trim() || !roomCode.trim()) return setError("Fadlan buuxi meelaha bannaan!");
    try {
      const roomRef = doc(db, 'rooms', roomCode.toUpperCase());
      const snapshot = await getDoc(roomRef);
      if (snapshot.exists()) {
        const data = snapshot.data() as RoomData;
        if (data.status !== 'waiting') return setError("Qolkan ciyaartu way bilaabatay!");
        await updateDoc(roomRef, { guestId: user.uid, guestName: userName, status: 'setup' });
        setRoom(data);
        setError(null);
      } else setError("Code-ka lama helin!");
    } catch (e) { setError(handleFirestoreError(e, OperationType.UPDATE, `rooms/${roomCode}`)); }
  };

  const saveSetup = async () => {
    if (!room) return;
    const customQuestions: Question[] = customList.map((text, i) => ({
      id: `c${i}`, text, category: 'Deep', type: 'completion'
    }));
    try {
      await updateDoc(doc(db, 'rooms', room.id), {
        status: 'active', maxRounds: numRounds, customQuestions, currentRound: 1
      });
    } catch (e) { setError(handleFirestoreError(e, OperationType.UPDATE, `rooms/${room.id}`)); }
  };

  const spinWheel = async () => {
    if (!room || room.wheelState === 'spinning' || room.nextSpinnerId !== user?.uid) return;
    
    const extraRotations = 5 + Math.random() * 5;
    const newRotation = room.rotation + (extraRotations * 360);
    const index = Math.floor((360 - (newRotation % 360)) / (360 / CATEGORIES.length)) % CATEGORIES.length;
    const category = CATEGORIES[index];
    
    const allQuestions = [...INITIAL_QUESTIONS, ...(room.customQuestions || [])];
    const pool = allQuestions.filter(q => q.category === category.id);
    const question = pool[Math.floor(Math.random() * pool.length)] || allQuestions[0];

    try {
      await updateDoc(doc(db, 'rooms', room.id), {
        rotation: newRotation, wheelState: 'spinning', lastSpinnerId: user.uid, 
        currentQuestion: question, timerEndTime: null, lastAction: null
      });
    } catch (e) { handleFirestoreError(e, OperationType.UPDATE, `rooms/${room.id}`); }
  };

  const onSpinEnd = async () => {
    if (room?.lastSpinnerId === user?.uid && room.wheelState === 'spinning') {
      try { await updateDoc(doc(db, 'rooms', room.id), { wheelState: 'result' }); } catch (e) {}
    }
  };

  const [responseText, setResponseText] = useState('');

  const handleResponse = async (accepted: boolean) => {
    if (!room || !user) return;
    const isHost = user.uid === room.hostId;
    const targetIsHost = room.lastSpinnerId === room.guestId;
    
    // Only the target player can respond
    if ((targetIsHost && !isHost) || (!targetIsHost && isHost)) return;

    if (accepted && room.currentQuestion?.type === 'completion' && !responseText.trim()) {
      return alert("Fadlan qor jawaabtaada!");
    }

    const newScores = { ...room.scores };
    if (accepted) {
      if (isHost) newScores.host += 1;
      else newScores.guest += 1;
    }

    const isGameOver = room.currentRound >= room.maxRounds;
    const nextSpinnerId = room.lastSpinnerId === room.hostId ? room.guestId! : room.hostId;

    try {
      await updateDoc(doc(db, 'rooms', room.id), {
        scores: newScores,
        lastAction: accepted ? 'accepted' : 'declined',
        wheelState: 'idle',
        status: isGameOver ? 'finished' : 'active',
        nextSpinnerId,
        currentRound: isGameOver ? room.currentRound : room.currentRound + 1
      });
      setResponseText(''); // Clear for next round
    } catch (e) { handleFirestoreError(e, OperationType.UPDATE, `rooms/${room.id}`); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-rose-50 text-rose-500 font-bold"><Heart size={48} className="animate-pulse fill-current" /></div>;

  return (
    <div className="min-h-screen bg-[#FFF8F8] font-sans text-gray-900 overflow-x-hidden selection:bg-rose-200">
      {showConfetti && <Confetti />}
      
      {/* Bg elements */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-15%] right-[-10%] w-[50%] h-[50%] bg-rose-200/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-100/30 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-xl mx-auto px-6 py-8 flex flex-col min-h-screen">
        {!user ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col justify-center items-center text-center gap-10">
            <div className="relative">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} className="w-32 h-32 border-4 border-dashed border-rose-300 rounded-full flex items-center justify-center">
                <Heart size={48} className="text-rose-500 fill-rose-500" />
              </motion.div>
              <Sparkles className="absolute -top-2 -right-2 text-amber-400" />
            </div>
            <div className="space-y-4">
              <h1 className="text-5xl font-black italic tracking-tighter bg-gradient-to-br from-rose-600 to-orange-500 bg-clip-text text-transparent">Lamaanaha Wheel</h1>
              <p className="text-gray-500 font-medium text-lg italic px-10">Ku soo dhawaada ciyaarta is-barashada iyo qosolka u dhexeeysa lamaanaha! ❤️</p>
            </div>
            <div className="flex flex-col gap-4 w-full px-8">
              <button onClick={loginWithGoogle} className="group bg-white text-gray-800 font-black py-5 px-8 rounded-[2rem] shadow-xl hover:shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-4 border-b-4 border-gray-100">
                <img src="https://www.google.com/favicon.ico" alt="" className="w-5 h-5" />
                KU GAL GOOGLE
              </button>
              
              <button onClick={loginAsGuest} className="bg-rose-100/50 text-rose-600 font-black py-4 px-8 rounded-[2rem] hover:bg-rose-100 transition-all border-b-2 border-rose-200 text-sm">
                KU GAL MARTI (GUEST)
              </button>
            </div>
            {error && <p className="text-rose-500 font-bold bg-white px-6 py-3 rounded-full shadow-sm">{error}</p>}
          </motion.div>
        ) : !room ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex-1 flex flex-col justify-center gap-10">
            <div className="text-center">
              <h2 className="text-3xl font-black text-gray-800 italic mb-2">Soo dhowoow!</h2>
              <p className="text-gray-500 font-medium">Lammaanahaagu ma halkan buu joogaa?</p>
            </div>

            <div className="bg-white/90 backdrop-blur-xl p-10 rounded-[3rem] shadow-2xl space-y-8 border border-white">
              <div className="space-y-4">
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest ml-2">Magacaaga Ciyaarta</label>
                <input type="text" value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="Tusaale: Saafi" className="w-full bg-gray-50 border-2 border-rose-50 rounded-3xl py-5 px-8 outline-none focus:border-rose-300 font-bold text-lg" />
              </div>

              <div className="grid gap-4">
                <button onClick={createRoom} className="w-full bg-rose-500 text-white font-black py-5 rounded-3xl shadow-lg active:scale-95 flex items-center justify-center gap-3 text-lg">
                  <Plus /> SAMEE QOL CUSUB
                </button>
                <div className="flex items-center gap-4 py-2 opacity-30"><div className="flex-1 h-px bg-gray-900" /> <span className="text-[10px] font-black uppercase">Ama</span> <div className="flex-1 h-px bg-gray-900" /></div>
                <div className="flex gap-3">
                  <input type="text" value={roomCode} onChange={(e) => setRoomCode(e.target.value.toUpperCase())} placeholder="CODE" className="flex-1 bg-gray-50 border-2 border-gray-100 rounded-3xl py-5 px-6 font-mono font-bold text-center text-xl outline-none focus:border-rose-300" />
                  <button onClick={joinRoom} className="bg-gray-900 text-white px-10 rounded-3xl font-black active:scale-95">BIIR</button>
                </div>
              </div>
              {error && <p className="text-rose-500 text-center text-sm font-bold bg-rose-50 py-3 rounded-2xl">{error}</p>}
            </div>
          </motion.div>
        ) : room.status === 'waiting' ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-10">
            <div className="w-32 h-32 bg-rose-100 rounded-full flex items-center justify-center animate-pulse">
              <Users size={64} className="text-rose-400" />
            </div>
            <div className="space-y-4">
              <h2 className="text-3xl font-black text-gray-800 italic">Sugaya Gacaliyahaaga...</h2>
              <p className="text-gray-500 px-10">U dir code-kan qofka aad jeceshahay si uu kuugu soo biiro qolka.</p>
            </div>
            <button onClick={() => { navigator.clipboard.writeText(room.id); setCopying(true); setTimeout(() => setCopying(false), 2000); }} className="bg-white p-8 rounded-[3rem] shadow-2xl border-4 border-rose-100 group active:scale-95 transition-all">
              <span className="text-[10px] font-black text-rose-300 uppercase tracking-[0.5em] block mb-2">Room Code</span>
              <div className="text-5xl font-black tracking-widest text-rose-500 flex items-center justify-center gap-4">
                {room.id}
                {copying ? <Check size={32} className="text-green-500" /> : <Copy size={32} className="text-rose-200 group-hover:text-rose-500" />}
              </div>
            </button>
            <button onClick={() => setRoom(null)} className="text-gray-400 font-bold uppercase text-[10px] tracking-widest hover:text-rose-500">Kala noqo creation-ka</button>
          </div>
        ) : room.status === 'setup' ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col">
            <div className="text-center mb-10">
              <h1 className="text-3xl font-black text-gray-800 mb-2 italic">Qaabeynta Ciyaarta</h1>
              <p className="text-gray-500">Labadiinuba waad joogtaan! {room.hostName} & {room.guestName} ✨</p>
            </div>

            <div className="bg-white p-8 rounded-[3rem] shadow-xl space-y-10 border border-gray-50">
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Imisa Su'aalood? (Rounds)</label>
                  <span className="text-2xl font-black text-rose-500">{numRounds}</span>
                </div>
                <input type="range" min="5" max="30" step="1" value={numRounds} onChange={(e) => setNumRounds(parseInt(e.target.value))} className="w-full h-3 bg-rose-100 rounded-lg appearance-none cursor-pointer accent-rose-500" disabled={user?.uid !== room.hostId} />
              </div>

              <div className="space-y-4">
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Su'aalo adiga kuu gaar ah (Custom)</label>
                <div className="flex gap-2">
                  <input type="text" value={customInput} onChange={(e) => setCustomInput(e.target.value)} placeholder="Qor su'aal gaar ah..." className="flex-1 bg-gray-50 border-2 border-gray-100 rounded-2xl py-4 px-6 font-bold outline-none focus:border-rose-300" />
                  <button onClick={() => { if(customInput.trim()){ setCustomList([...customList, customInput]); setCustomInput(''); } }} className="bg-gray-100 p-4 rounded-2xl text-gray-400 hover:bg-rose-500 hover:text-white transition-all"><Plus /></button>
                </div>
                <div className="max-h-40 overflow-y-auto space-y-2 pr-2">
                  {customList.map((q, i) => (
                    <div key={i} className="bg-rose-50/50 p-4 rounded-2xl flex justify-between items-center group">
                      <span className="text-sm font-bold text-gray-700">{q}</span>
                      <button onClick={() => setCustomList(customList.filter((_, idx) => idx !== i))} className="text-gray-300 hover:text-rose-500"><X size={16} /></button>
                    </div>
                  ))}
                </div>
              </div>

              {user?.uid === room.hostId ? (
                <button onClick={saveSetup} className="w-full bg-rose-500 text-white font-black py-6 rounded-3xl shadow-xl active:scale-95 text-lg flex items-center justify-center gap-3">
                  CIYAARTA BILAW <ChevronRight />
                </button>
              ) : (
                <div className="text-center p-6 bg-rose-50 rounded-3xl border-2 border-dashed border-rose-200">
                  <p className="text-rose-500 font-bold italic animate-pulse">Host-ka ( {room.hostName} ) ayaa qaabeynaya ciyaarta...</p>
                </div>
              )}
            </div>
          </motion.div>
        ) : room.status === 'active' ? (
          <div className="flex-1 flex flex-col">
            <header className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-4">
                <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-50 flex items-center gap-3">
                  <div className="flex -space-x-2">
                    <div className={`w-10 h-10 rounded-full border-2 border-white flex items-center justify-center text-xs font-black text-white uppercase shadow-sm ${room.nextSpinnerId === room.hostId ? 'bg-rose-500 scale-110' : 'bg-gray-200'}`}>{room.hostName[0]}</div>
                    <div className={`w-10 h-10 rounded-full border-2 border-white flex items-center justify-center text-xs font-black text-white uppercase shadow-sm ${room.nextSpinnerId === room.guestId ? 'bg-blue-500 scale-110' : 'bg-gray-200'}`}>{room.guestName?.[0]}</div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Turn-ka waxaa leh</span>
                    <span className="text-sm font-black text-gray-800 leading-tight">
                      {room.nextSpinnerId === room.hostId ? room.hostName : room.guestName}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="bg-white px-4 py-2 rounded-2xl shadow-sm border border-orange-100 flex items-center gap-2">
                  <TrendingUp size={14} className="text-orange-500" />
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Round</span>
                  <span className="text-sm font-black text-orange-600">{room.currentRound}/{room.maxRounds}</span>
                </div>
                <button 
                  onClick={() => { if(window.confirm("Ma hubtaa inaad ka baxayso ciyaarta?")) setRoom(null); }} 
                  className="bg-rose-50 px-4 py-1.5 rounded-xl text-rose-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-rose-100 transition-colors"
                >
                  <LogOut size={12} /> Ka Bax
                </button>
              </div>
            </header>

            <div className="flex-1 flex flex-col items-center justify-center gap-12">
              <div className="relative">
                <Wheel rotation={room.rotation} onSpinEnd={onSpinEnd} />
                {room.wheelState === 'spinning' && (
                  <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] font-black px-6 py-2 rounded-full uppercase tracking-[0.2em] shadow-2xl whitespace-nowrap z-30">
                    Wuu wareegayaa... 🎡
                  </div>
                )}
              </div>

              <AnimatePresence mode="wait">
                {room.wheelState === 'result' && room.currentQuestion && (
                  <motion.div initial={{ scale: 0.5, opacity: 0, y: 50 }} animate={{ scale: 1, opacity: 1, y: 0 }} className="w-full bg-white rounded-[3rem] p-10 shadow-2xl border-b-8 border-rose-100 text-center relative overflow-hidden flex flex-col items-center">
                    <div className="absolute top-0 right-0 w-32 h-32 blur-3xl opacity-10 bg-rose-500 p-4" />
                    
                    <div className="space-y-4 mb-8">
                      <span className="px-6 py-2 bg-rose-50 text-rose-500 rounded-full text-xs font-black uppercase tracking-[0.3em]">
                        {CATEGORIES.find(c => c.id === room.currentQuestion?.category)?.label}
                      </span>
                      <div className="text-rose-500 font-black text-sm uppercase">
                        {room.lastSpinnerId === room.hostId ? room.guestName : room.hostName} waa inuu jawaabaa:
                      </div>
                      <h2 className="text-2xl md:text-3xl font-black text-gray-800 leading-tight">
                        {room.currentQuestion.text}
                      </h2>
                    </div>

                    {room.currentQuestion.type === 'completion' && (
                      <div className="w-full mb-8">
                        <textarea
                          value={responseText}
                          onChange={(e) => setResponseText(e.target.value)}
                          placeholder="Ku qor jawaabtaada halkan..."
                          className="w-full bg-gray-50 border-2 border-rose-50 rounded-2xl p-4 font-bold text-gray-700 outline-none focus:border-rose-200 resize-none"
                          rows={3}
                          disabled={(user?.uid === room.hostId && room.lastSpinnerId === room.hostId) || (user?.uid === room.guestId && room.lastSpinnerId === room.guestId)}
                        />
                      </div>
                    )}

                    {room.currentQuestion.category === 'Dare' && room.timerEndTime && (
                      <div className="mb-8 scale-110">
                        <Timer endTime={room.timerEndTime} />
                      </div>
                    )}

                    <div className="w-full">
                      {room.currentQuestion.type === 'completion' ? (
                        <button 
                          onClick={() => handleResponse(true)} 
                          disabled={(user?.uid === room.hostId && room.lastSpinnerId === room.hostId) || (user?.uid === room.guestId && room.lastSpinnerId === room.guestId)}
                          className="w-full bg-rose-500 text-white py-6 rounded-[2.5rem] font-black text-xl shadow-xl active:scale-95 disabled:opacity-40 transition-all flex items-center justify-center gap-3"
                        >
                          <Check size={28} /> DIYAAR / GUD-BI
                        </button>
                      ) : (
                        <div className="grid grid-cols-2 gap-4 w-full">
                          <button 
                            onClick={() => handleResponse(true)} 
                            disabled={(user?.uid === room.hostId && room.lastSpinnerId === room.hostId) || (user?.uid === room.guestId && room.lastSpinnerId === room.guestId)}
                            className="bg-green-500 text-white py-5 rounded-[2rem] font-black text-lg shadow-lg active:scale-95 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
                          >
                            <ThumbsUp /> HAA
                          </button>
                          <button 
                            onClick={() => handleResponse(false)} 
                            disabled={(user?.uid === room.hostId && room.lastSpinnerId === room.hostId) || (user?.uid === room.guestId && room.lastSpinnerId === room.guestId)}
                            className="bg-rose-500 text-white py-5 rounded-[2rem] font-black text-lg shadow-lg active:scale-95 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
                          >
                            <ThumbsDown /> MAYA
                          </button>
                        </div>
                      )}
                    </div>
                    
                    {((user?.uid === room.hostId && room.lastSpinnerId === room.hostId) || (user?.uid === room.guestId && room.lastSpinnerId === room.guestId)) && (
                      <p className="mt-6 text-gray-400 text-xs font-bold uppercase italic">Sug jawaabta gacaliyahaaga... ⏳</p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {room.wheelState === 'idle' && (
                <div className="w-full space-y-6">
                  {room.nextSpinnerId === user?.uid ? (
                    <button onClick={spinWheel} className="w-full bg-gray-900 text-white rounded-[2.5rem] py-6 font-black text-xl shadow-2xl active:scale-95 flex items-center justify-center gap-4 group">
                      <RefreshCw className="w-8 h-8 group-hover:rotate-180 transition-transform duration-700" />
                      WAREEJI WHEEL-KA
                    </button>
                  ) : (
                    <div className="w-full bg-white p-8 rounded-[2.5rem] shadow-xl border-2 border-dashed border-gray-200 text-center">
                      <p className="text-gray-400 font-black uppercase tracking-[0.2em] animate-pulse">
                        Wuxuu u haray: {room.nextSpinnerId === room.hostId ? room.hostName : room.guestName}
                      </p>
                    </div>
                  )}
                  
                  <div className="flex justify-center gap-10 py-4 px-10 bg-white/50 rounded-full border border-white">
                    <div className="text-center">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">{room.hostName}</span>
                      <span className="text-xl font-black text-rose-500">{room.scores.host}</span>
                    </div>
                    <div className="text-center">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">{room.guestName}</span>
                      <span className="text-xl font-black text-blue-500">{room.scores.guest}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex-1 flex flex-col items-center justify-center gap-12 py-10">
            <div className="relative">
              <Trophy size={120} className="text-amber-400 drop-shadow-xl" />
              <Sparkles className="absolute top-0 right-0 text-amber-500 animate-pulse" />
            </div>
            
            <div className="text-center space-y-2">
              <h1 className="text-5xl font-black italic tracking-tighter text-gray-900">NATIIJADA!</h1>
              <p className="text-gray-500 font-bold uppercase tracking-widest">Markaa labadiinuba waad guuleysateen! 🎉</p>
            </div>

            <div className="w-full grid grid-cols-2 gap-6">
              <div className="bg-white p-8 rounded-[3rem] shadow-xl text-center border-b-8 border-rose-100">
                <span className="text-xs font-black text-gray-400 mb-2 block">{room.hostName}</span>
                <span className="text-6xl font-black text-rose-500">{room.scores.host}</span>
                <span className="block text-[10px] font-bold text-gray-300 mt-4 uppercase">Wuu yeelay</span>
              </div>
              <div className="bg-white p-8 rounded-[3rem] shadow-xl text-center border-b-8 border-blue-100">
                <span className="text-xs font-black text-gray-400 mb-2 block">{room.guestName}</span>
                <span className="text-6xl font-black text-blue-500">{room.scores.guest}</span>
                <span className="block text-[10px] font-bold text-gray-300 mt-4 uppercase">Way yeeshay</span>
              </div>
            </div>

            <div className="flex flex-col w-full gap-4">
              <button onClick={() => setRoom(null)} className="w-full bg-gray-900 text-white rounded-[2rem] py-6 px-12 font-black text-lg shadow-2xl active:scale-95 flex items-center justify-center gap-3">
                <RotateCcw /> CIYAAR CUSUB BILAW
              </button>
              <button onClick={() => setRoom(null)} className="w-full bg-white text-rose-500 border-2 border-rose-100 rounded-[2rem] py-4 px-12 font-black text-sm shadow-sm active:scale-95 flex items-center justify-center gap-3">
                <LogOut size={16} /> KA BAX GUUD AHAAN
              </button>
            </div>
          </motion.div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        body { font-family: 'Plus Jakarta Sans', sans-serif; }
        .animate-spin-slow { animation: spin 12s linear infinite; }
        input[type='range']::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 24px;
          height: 24px;
          background: #ef4444;
          border: 4px solid white;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
        }
      `}} />
    </div>
  );
}
