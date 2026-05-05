import { useState, useEffect, useMemo } from 'react';
import { User, Plus, LogIn, Lock, Trash2, ChevronUp, ChevronDown, TreeDeciduous, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc,
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  serverTimestamp
} from 'firebase/firestore';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { db, auth } from './lib/firebase';

// --- Types ---
interface FamilyMember {
  id: string;
  name: string;
  years: string;
  status: 'alive' | 'deceased';
  role: string;
  type: 'adult' | 'child';
  parentId: string | null;
  generation: number;
}

// --- Components ---

const TreeCard = ({ 
  member, 
  isAdmin, 
  onAddSub, 
  onAddParent, 
  onEdit,
  onDelete,
  delay = 0 
}: { 
  member: FamilyMember; 
  isAdmin: boolean; 
  onAddSub: (id: string, gen: number) => void;
  onAddParent: (id: string, gen: number) => void;
  onEdit: (m: FamilyMember) => void;
  onDelete: (id: string) => void;
  delay?: number;
}) => {
  const isDeceased = member.status === 'deceased';
  let bgStyle, badgeStyle, textStyle, roleStyle;

  if (isDeceased) {
    bgStyle = "bg-slate-50 border-slate-200 shadow-sm opacity-90";
    badgeStyle = member.role.includes("Bobo") ? "bg-slate-800" : "bg-slate-400";
    textStyle = "text-slate-700 font-serif";
    roleStyle = "text-slate-400";
  } else if (member.type === 'adult') {
    bgStyle = "bg-blue-50/40 border-blue-100 shadow-[0_8px_16px_rgba(59,130,246,0.06)]";
    badgeStyle = "bg-blue-600";
    textStyle = "text-blue-900 font-serif";
    roleStyle = "text-blue-500";
  } else {
    const isSpecial = member.name === "Sayfulo" || member.name === "Salmon";
    bgStyle = isSpecial ? "bg-emerald-50/50 border-emerald-300 ring-4 ring-emerald-50/50" : "bg-emerald-50/50 border-emerald-100 shadow-sm";
    badgeStyle = "bg-emerald-600";
    textStyle = "text-emerald-900 font-serif";
    roleStyle = "text-emerald-500";
  }

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay }}
      className={`group relative flex flex-col items-center w-36 md:w-44 p-4 md:p-5 rounded-2xl border transition-all duration-500 hover:-translate-y-1.5 hover:shadow-xl z-20 ${bgStyle}`}
    >
      {isDeceased && (
        <span className={`absolute -top-2 left-1/2 -translate-x-1/2 text-white text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wider shadow-sm z-30 ${badgeStyle}`}>
          {member.role.includes("Bobo") ? "Bobokalon" : "Rahmatli"}
        </span>
      )}
      
      {!isDeceased && (
        <span className={`absolute -top-2 left-1/2 -translate-x-1/2 text-white text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wider shadow-sm z-30 ${badgeStyle} opacity-0 group-hover:opacity-100 transition-opacity`}>
          {member.role}
        </span>
      )}
      
      <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center mb-2 md:mb-3 shadow-inner bg-white/50 border border-current/10 ${roleStyle}`}>
        <User size={20} strokeWidth={1.5} />
      </div>
      
      <h3 className={`font-bold text-sm md:text-base text-center leading-tight mb-1 truncate w-full ${textStyle}`}>
        {member.name}
      </h3>
      
      <div className="flex flex-col items-center text-center">
        <span className={`text-[10px] font-bold tracking-[0.1em] uppercase mb-0.5 ${roleStyle}`}>
          {member.role}
        </span>
        <span className="text-[10px] md:text-[11px] font-medium text-slate-400 tracking-wide">
          {member.years}
        </span>
      </div>

      {isAdmin && (
        <div className="absolute top-0 right-0 p-1 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={() => onDelete(member.id)}
            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded bg-white shadow-sm border border-red-100"
          >
            <Trash2 size={12} />
          </button>
          <button 
            onClick={() => onEdit(member)}
            className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded bg-white shadow-sm border border-blue-100"
          >
            <Plus size={12} className="rotate-45" /> {/* Using Plus as Edit substitute or just Edit icon */}
          </button>
        </div>
      )}

      {isAdmin && (
        <div className="mt-3 flex gap-2">
          <button 
            onClick={() => onAddSub(member.id, member.generation + 1)}
            title="Avlod qo'shish"
            className="flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 rounded-lg text-[9px] font-bold text-slate-500 hover:border-slate-400 transition-colors"
          >
            <ChevronDown size={10} /> Avlod
          </button>
          {!member.parentId && (
            <button 
              onClick={() => onAddParent(member.id, member.generation - 1)}
              title="Ajdod qo'shish (Yuqoriga)"
              className="flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 rounded-lg text-[9px] font-bold text-slate-500 hover:border-slate-400 transition-colors"
            >
              <ChevronUp size={10} /> Ajdod
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default function App() {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [password, setPassword] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState<{ parentId: string | null; generation: number } | null>(null);
  const [newMember, setNewMember] = useState({
    name: "",
    years: "",
    status: 'alive' as 'alive' | 'deceased',
    role: "",
    type: 'adult' as 'adult' | 'child'
  });

  // --- Real-time Fetch ---
  useEffect(() => {
    const q = query(collection(db, "familyMembers"), orderBy("generation", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FamilyMember));
      setMembers(data);
    });
    return () => unsubscribe();
  }, []);

  // --- Auth logic ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // User is signed in anonymously
      } else {
        signInAnonymously(auth).catch(e => console.error("Auth error:", e));
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = () => {
    if (password === "1111") {
      setIsAdmin(true);
      setShowLogin(false);
      setPassword("");
    } else {
      alert("Xato parol!");
    }
  };

  const handleSaveMember = async () => {
    if (!newMember.name || !newMember.role) return;

    try {
      if (editingId) {
        await updateDoc(doc(db, "familyMembers", editingId), {
          ...newMember
        });
      } else {
        await addDoc(collection(db, "familyMembers"), {
          ...newMember,
          parentId: showAddForm?.parentId || null,
          generation: showAddForm?.generation || 0,
          createdAt: serverTimestamp()
        });
      }
      setShowAddForm(null);
      setEditingId(null);
      setNewMember({ name: "", years: "", status: 'alive', role: "", type: 'adult' });
    } catch (e) {
      console.error("Save error:", e);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Haqiqatan ham o'chirmoqchisiz?")) {
      await deleteDoc(doc(db, "familyMembers", id));
    }
  };

  const handleEdit = (m: FamilyMember) => {
    setNewMember({
      name: m.name,
      years: m.years,
      status: m.status,
      role: m.role,
      type: m.type
    });
    setEditingId(m.id);
    setShowAddForm({ parentId: m.parentId, generation: m.generation });
  };

  const seedInitialData = async () => {
    try {
      // 1. Nazirxo'ja
      const kattaBoboRef = await addDoc(collection(db, "familyMembers"), {
        name: "Nazirxo'ja",
        years: "Bobokalon",
        status: "deceased",
        role: "Katta Bobo",
        type: "adult",
        parentId: null,
        generation: 0,
        createdAt: serverTimestamp()
      });

      // 2. Rahmatullo
      const boboRef = await addDoc(collection(db, "familyMembers"), {
        name: "Rahmatullo",
        years: "1954 — 2012",
        status: "deceased",
        role: "Bobo",
        type: "adult",
        parentId: kattaBoboRef.id,
        generation: 1,
        createdAt: serverTimestamp()
      });

      // 3. Ravshan
      const otaRef = await addDoc(collection(db, "familyMembers"), {
        name: "Ravshan",
        years: "1975",
        status: "alive",
        role: "Ota",
        type: "adult",
        parentId: boboRef.id,
        generation: 2,
        createdAt: serverTimestamp()
      });

      // 4. Sayfulo
      await addDoc(collection(db, "familyMembers"), {
        name: "Sayfulo",
        years: "2014",
        status: "alive",
        role: "Men (Aka)",
        type: "child",
        parentId: otaRef.id,
        generation: 3,
        createdAt: serverTimestamp()
      });

      // 5. Salmon
      await addDoc(collection(db, "familyMembers"), {
        name: "Salmon",
        years: "2019",
        status: "alive",
        role: "Uka",
        type: "child",
        parentId: otaRef.id,
        generation: 3,
        createdAt: serverTimestamp()
      });

      // 6. Sulaymon
      await addDoc(collection(db, "familyMembers"), {
        name: "Sulaymon",
        years: "2021",
        status: "alive",
        role: "Uka",
        type: "child",
        parentId: otaRef.id,
        generation: 3,
        createdAt: serverTimestamp()
      });
    } catch (e) {
      console.error("Seed error:", e);
    }
  };

  // --- Recursive Tree Rendering ---
  const renderTree = (parentId: string | null, generation: number) => {
    const children = members.filter(m => m.parentId === parentId);
    if (children.length === 0) return null;

    return (
      <div className="flex flex-col items-center w-full">
        {generation !== 0 && <div className="w-px h-6 bg-slate-200"></div>}
        <div className="flex flex-row justify-center items-start gap-4 md:gap-12 flex-wrap w-full px-4">
          {children.map((member, idx) => (
            <div key={member.id} className="flex flex-col items-center">
              <TreeCard 
                member={member} 
                isAdmin={isAdmin}
                onAddSub={(id, gen) => setShowAddForm({ parentId: id, generation: gen })}
                onAddParent={(id, gen) => setShowAddForm({ parentId: null, generation: gen })} 
                onEdit={handleEdit}
                onDelete={handleDelete}
                delay={idx * 0.1}
              />
              {renderTree(member.id, generation + 1)}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Find root members
  const rootMembers = useMemo(() => {
    const ids = new Set(members.map(m => m.id));
    return members.filter(m => !m.parentId || !ids.has(m.parentId));
  }, [members]);

  return (
    <div className="min-h-screen bg-[#fdfdfd] flex flex-col items-center p-6 font-sans text-slate-800 overflow-x-hidden">
      
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-5">
        <TreeDeciduous className="absolute -top-20 -left-20 w-96 h-96 text-emerald-600" />
        <Heart className="absolute top-1/4 -right-10 w-40 h-40 text-rose-300" />
        <TreeDeciduous className="absolute bottom-10 left-1/3 w-80 h-80 text-emerald-400" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border border-slate-100 rounded-full"></div>
      </div>

      <header className="text-center mb-16 relative z-30 pt-10">
        <motion.div
           initial={{ opacity: 0, y: -20 }}
           animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-4xl md:text-6xl font-serif text-slate-900 tracking-tight font-medium mb-4">
            Rahmatullayevlar <span className="text-slate-300 mx-1 font-light italic">Shajarasi</span>
          </h1>
          <div className="inline-flex items-center gap-3 px-5 py-2 bg-white/90 backdrop-blur-sm border border-slate-100 rounded-full shadow-sm">
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400">Oilaviy Meros</span>
            <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse"></div>
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400">Avlodlar Bog'i</span>
          </div>
        </motion.div>
      </header>

      {/* Main Tree Canvas */}
      <main className="relative flex-grow flex flex-col items-center gap-12 w-full max-w-7xl pb-40 z-20">
        {members.length === 0 ? (
          <div className="flex flex-col items-center gap-6 text-slate-300 mt-20">
            <div className="relative">
               <TreeDeciduous size={120} strokeWidth={0.5} className="text-emerald-100" />
               <motion.div 
                 animate={{ y: [0, -10, 0] }}
                 transition={{ repeat: Infinity, duration: 2 }}
                 className="absolute inset-0 flex items-center justify-center pt-4"
               >
                 <Plus size={40} className="text-emerald-400 opacity-50" />
               </motion.div>
            </div>
            <p className="font-serif italic text-2xl text-slate-400">Shajara hali boshlanmagan...</p>
            {isAdmin && (
              <div className="flex flex-col gap-4">
                <button 
                  onClick={() => setShowAddForm({ parentId: null, generation: 0 })}
                  className="flex items-center justify-center gap-2 bg-slate-900 text-white px-8 py-4 rounded-full hover:bg-slate-800 shadow-xl shadow-slate-200 transition-all active:scale-95"
                >
                  <Plus size={20} /> Markaziy Boboni Qo'shish
                </button>
                <button 
                  onClick={seedInitialData}
                  className="flex items-center justify-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-100 px-8 py-4 rounded-full hover:bg-emerald-100 transition-all active:scale-95 text-sm font-bold uppercase tracking-widest"
                >
                  Boshlang'ich Ma'lumotlarni Yuklash
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center w-full">
            {rootMembers.map(root => (
              <div key={root.id} className="flex flex-col items-center w-full">
                <TreeCard 
                  member={root} 
                  isAdmin={isAdmin}
                  onAddSub={(id, gen) => setShowAddForm({ parentId: id, generation: gen })}
                  onAddParent={(id, gen) => setShowAddForm({ parentId: null, generation: gen })}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
                {renderTree(root.id, root.generation + 1)}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Admin Controls */}
      <div className="fixed bottom-8 right-8 z-50 flex flex-col-reverse items-end gap-3">
        {!isAdmin ? (
          <button 
            onClick={() => setShowLogin(true)}
            className="w-14 h-14 flex items-center justify-center bg-white border border-slate-100 rounded-full shadow-2xl hover:shadow-emerald-100 hover:scale-110 transition-all text-slate-300 hover:text-emerald-500"
          >
            <Lock size={24} />
          </button>
        ) : (
          <>
            <button 
              onClick={() => setIsAdmin(false)}
              className="px-6 py-3 bg-white border border-slate-200 text-slate-500 rounded-full shadow-lg hover:bg-slate-50 transition-colors font-bold text-xs uppercase tracking-widest"
            >
              Tahrirlashni Tugatish
            </button>
            <div className="bg-emerald-600 text-white px-6 py-2 rounded-full text-[10px] font-bold shadow-xl animate-bounce uppercase tracking-widest">
              Admin Rejimi Faol
            </div>
          </>
        )}
      </div>

      {/* Login Modal */}
      <AnimatePresence>
        {showLogin && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLogin(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-lg"
            ></motion.div>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-sm rounded-[32px] shadow-2xl p-10 border border-white"
            >
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                  <LogIn className="text-slate-300" size={32} />
                </div>
                <h2 className="text-3xl font-serif text-slate-900">Admin</h2>
                <p className="text-slate-400 text-sm mt-2">Boshqaruv uchun parolni kiriting</p>
              </div>
              <input 
                type="password" 
                placeholder="••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-2xl mb-6 focus:ring-4 focus:ring-emerald-50 outline-none transition-all text-center text-3xl tracking-[0.8em] font-mono"
                autoFocus
              />
              <button 
                onClick={handleLogin}
                className="w-full py-5 bg-slate-900 text-white rounded-2xl font-bold shadow-2xl hover:bg-slate-800 active:scale-95 transition-all text-sm uppercase tracking-widest"
              >
                Kirish
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Member Modal */}
      <AnimatePresence>
        {showAddForm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddForm(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-lg"
            ></motion.div>
            <motion.div 
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className="relative bg-white w-full max-w-lg rounded-[40px] shadow-2xl p-10 border border-white max-h-[90vh] overflow-y-auto"
            >
              <h2 className="text-3xl font-serif text-slate-900 mb-8 flex items-center gap-4">
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                  <Plus className={`text-emerald-600 transition-transform ${editingId ? 'rotate-45' : ''}`} size={20} />
                </div>
                {editingId ? "Ma'lumotni Tahrirlash" : "Yangi A'zo"}
              </h2>
              <div className="space-y-6">
                <div className="group">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] block mb-2 px-1">Ism-Sharif</label>
                  <input 
                    type="text" 
                    placeholder="Masalan: G'ulomxo'ja"
                    value={newMember.name}
                    onChange={e => setNewMember({...newMember, name: e.target.value})}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-50 transition-all text-lg font-serif"
                  />
                </div>
                <div className="flex gap-4">
                   <div className="flex-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] block mb-2 px-1">Yillar</label>
                    <input 
                      type="text" 
                      placeholder="1940 — 2010"
                      value={newMember.years}
                      onChange={e => setNewMember({...newMember, years: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] block mb-2 px-1">O'rni</label>
                    <input 
                      type="text" 
                      placeholder="Bobo, Ota..."
                      value={newMember.role}
                      onChange={e => setNewMember({...newMember, role: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] block mb-2 px-1">Holati</label>
                    <select 
                      value={newMember.status}
                      onChange={e => setNewMember({...newMember, status: e.target.value as any})}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none appearance-none"
                    >
                      <option value="alive">Hayot</option>
                      <option value="deceased">Vafot etgan</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] block mb-2 px-1">Turi</label>
                    <select 
                      value={newMember.type}
                      onChange={e => setNewMember({...newMember, type: e.target.value as any})}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none appearance-none"
                    >
                      <option value="adult">Katta</option>
                      <option value="child">Yosh</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="mt-12 flex gap-4">
                <button 
                  onClick={() => { setShowAddForm(null); setEditingId(null); setNewMember({ name: "", years: "", status: 'alive', role: "", type: 'adult' }); }}
                  className="flex-1 py-5 border border-slate-100 text-slate-400 font-bold rounded-[20px] hover:bg-slate-50 transition-colors uppercase tracking-widest text-xs"
                >
                  Bekor qilish
                </button>
                <button 
                  onClick={handleSaveMember}
                  className="flex-1 py-5 bg-slate-900 text-white font-bold rounded-[20px] shadow-2xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95 uppercase tracking-widest text-xs"
                >
                  {editingId ? "Saqlash" : "Qo'shish"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="fixed bottom-0 left-0 right-0 p-8 z-40 bg-white/60 backdrop-blur-2xl border-t border-white/40 hidden lg:block">
        <div className="max-w-7xl mx-auto flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em]">
            <div className="flex gap-12">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-100 border border-slate-300"></div>
                <span>O'tganlar</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-100 border border-blue-200"></div>
                <span>Kattalar</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-100 border border-emerald-200"></div>
                <span>Farzandlar</span>
              </div>
            </div>
            <div className="font-serif italic capitalize tracking-normal text-slate-300 text-sm">
              Inson o'z ajdodini bilishi shart...
            </div>
        </div>
      </footer>
    </div>
  );
}
