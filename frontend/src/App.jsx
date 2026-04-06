import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { MessageSquare, BookOpen, ChevronDown, LogOut, User, FileText, BarChart2, Map, Layers, Plus, Trash2, FolderOpen, Globe, Play, Pause, RotateCcw, Settings, Camera, Heart, MessageCircle, Bookmark, Send, Database, Book } from "lucide-react";
import AuthPage from "./AuthPage";
import DocManager from "./DocManager";
import QuizPage from "./QuizPage";
import FlashcardsPage from "./FlashcardsPage";
import ConceptMapPage from "./ConceptMapPage";
import AnalyticsPage from "./AnalyticsPage";
import DiscoverPage from "./DiscoverPage";
import NotebookPage from "./NotebookPage";
import "./index.css";

const API = "http://localhost:8000";

// ── Pomodoro (Advanced UI) ──
function PomodoroDisplay({ timeLeft, running, start, pause, reset, setTime }) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputVal, setInputVal] = useState(Math.floor(timeLeft / 60));

  const m = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const s = String(timeLeft % 60).padStart(2, "0");

  const handleApply = () => {
    const min = parseInt(inputVal);
    if (!isNaN(min) && min > 0) setTime(min * 60);
    setIsEditing(false);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "4px 10px", background: "#FFFFFF", borderRadius: "12px", border: "1px solid #E5E7EB", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
      {isEditing ? (
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <input
            type="number"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onBlur={handleApply}
            onKeyDown={e => e.key === "Enter" && handleApply()}
            style={{ width: "40px", padding: "2px 4px", border: "1px solid #3B82F6", borderRadius: "4px", fontSize: "0.9rem", fontWeight: 700, textAlign: "center", outline: "none" }}
            autoFocus
          />
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#6B7280" }}>dk</span>
        </div>
      ) : (
        <span
          onClick={() => !running && setIsEditing(true)}
          style={{ fontSize: "1.05rem", fontWeight: 800, color: running ? "#10B981" : "#1D4ED8", fontFamily: "monospace", cursor: running ? "default" : "pointer" }}
          title={running ? "Süre işliyor" : "Süreyi değiştirmek için tıkla"}
        >
          {m}:{s}
        </span>
      )}

      <div style={{ display: "flex", gap: "2px", borderLeft: "1px solid #F3F4F6", paddingLeft: "6px" }}>
        {!running ? (
          <button onClick={start} style={{ background: "none", border: "none", cursor: "pointer", color: "#10B981", padding: "4px", display: "flex" }} title="Başlat/Devam Et"><Play size={14} /></button>
        ) : (
          <button onClick={pause} style={{ background: "none", border: "none", cursor: "pointer", color: "#F59E0B", padding: "4px", display: "flex" }} title="Durdur"><Pause size={14} /></button>
        )}
        <button onClick={reset} style={{ background: "none", border: "none", cursor: "pointer", color: "#EF4444", padding: "4px", display: "flex" }} title="Sıfırla"><RotateCcw size={14} /></button>
      </div>
    </div>
  );
}

// ── Main App ──
export default function App() {
  const [user, setUser] = useState(null);
  const [activePage, setActivePage] = useState("chat");
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [selectedDocs, setSelectedDocs] = useState([]);
  const [researches, setResearches] = useState([]);
  const [activeResearch, setActiveResearch] = useState(null); // { id, title, sources }
  const [sidebarTab, setSidebarTab] = useState("researches"); // "docs" | "researches"
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [isCreatingResearch, setIsCreatingResearch] = useState(false);
  const [newResearchName, setNewResearchName] = useState("");
  const newResearchInputRef = useRef(null);
  const msgsEndRef = useRef(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // researchId to confirm delete

  // Pomodoro State
  const [pomoTime, setPomoTime] = useState(25 * 60);
  const [pomoRunning, setPomoRunning] = useState(false);
  const pomoRef = useRef(null);

  const startPomo = () => {
    if (pomoRunning) return;
    setPomoRunning(true);
    pomoRef.current = setInterval(() => {
      setPomoTime(p => {
        if (p <= 1) { clearInterval(pomoRef.current); setPomoRunning(false); return 25 * 60; }
        return p - 1;
      });
    }, 1000);
  };
  const pausePomo = () => { clearInterval(pomoRef.current); setPomoRunning(false); };
  const resetPomo = () => { clearInterval(pomoRef.current); setPomoRunning(false); setPomoTime(25 * 60); };

  const navDropdownRef = useRef(null);
  const profileDropdownRef = useRef(null);
  const avatarInputRef = useRef(null);
  const [avatarKey, setAvatarKey] = useState(Date.now());
  const [viewAvatar, setViewAvatar] = useState(false);
  const [clearChatConfirm, setClearChatConfirm] = useState(false);

  const [username, setUsername] = useState("");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [analyticsTab, setAnalyticsTab] = useState("history");
  const [usernameModalVisible, setUsernameModalVisible] = useState(false);
  const [newUsernameInput, setNewUsernameInput] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiKeySaving, setApiKeySaving] = useState(false);
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [apiKeyHelpVisible, setApiKeyHelpVisible] = useState(false);
  const [apiKeyOnboardVisible, setApiKeyOnboardVisible] = useState(false);
  const [onboardInput, setOnboardInput] = useState("");
  const [onboardSaving, setOnboardSaving] = useState(false);

  useEffect(() => {
    function handleClickOutside(event) {
      if (navDropdownRef.current && !navDropdownRef.current.contains(event.target)) {
        setNavOpen(false);
      }
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (user) { loadDocs(); loadResearches(); loadProfile(); }
  }, [user]);

  const loadProfile = async () => {
    try {
      const res = await axios.get(`${API}/api/user/${encodeURIComponent(user.email)}/profile`);
      setUsername(res.data.username || "");
    } catch { }
    try {
      const res2 = await axios.get(`${API}/api/user/${encodeURIComponent(user.email)}/apikey`);
      const savedKey = res2.data.api_key || "";
      setApiKey(savedKey);
      setApiKeyInput(savedKey);
      if (!savedKey) {
        setApiKeyOnboardVisible(true);
      }
    } catch { }
  };

  useEffect(() => {
    msgsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // When we switch research, load its messages
  useEffect(() => {
    if (activeResearch?.id) {
      loadMessagesForResearch(activeResearch.id);
      if (activeResearch.sources?.length) setSelectedDocs(activeResearch.sources);
    }
  }, [activeResearch?.id]);

  const loadDocs = async () => {
    try {
      const res = await axios.get(`${API}/api/user/${encodeURIComponent(user.email)}/documents`);
      setDocuments(res.data.documents || []);
    } catch { }
  };

  const loadResearches = async () => {
    try {
      const res = await axios.get(`${API}/api/user/${encodeURIComponent(user.email)}/researches`);
      setResearches(res.data.researches || []);
    } catch { }
  };

  const loadMessagesForResearch = async (chatId) => {
    try {
      const res = await axios.get(`${API}/api/messages/${encodeURIComponent(user.email)}/${chatId}`);
      setMessages(res.data.messages || []);
    } catch { }
  };

  const createNewResearch = async (title) => {
    const finalTitle = (title || "").trim() || "Yeni Araştırma";
    setIsCreatingResearch(false);
    setNewResearchName("");
    try {
      const res = await axios.post(`${API}/api/research/create`, { email: user.email, title: finalTitle });
      const newR = { id: res.data.id, title: res.data.title, sources: [] };
      setResearches(prev => [newR, ...prev]);
      setActiveResearch(newR);
      setMessages([{ role: "assistant", content: `👋 **"${finalTitle}"** başarıyla oluşturuldu! Araştırmanıza başlamadan önce sol paneldeki "Kaynaklar" sekmesinden ilgili dosyalarınızı seçmeyi unutmayın.` }]);
      setSelectedDocs([]);
      setActivePage("chat");
    } catch (e) {
      alert("Araştırma oluşturulamadı: " + e.message);
    }
  };

  const startCreatingResearch = () => {
    setIsCreatingResearch(true);
    setNewResearchName("");
    setTimeout(() => newResearchInputRef.current?.focus(), 60);
  };

  const confirmDeleteResearch = async () => {
    if (!deleteConfirm) return;
    try {
      await axios.delete(`${API}/api/research/${encodeURIComponent(user.email)}/${deleteConfirm}`);
      setResearches(prev => prev.filter(r => r.id !== deleteConfirm));
      if (activeResearch?.id === deleteConfirm) {
        setActiveResearch(null);
        setMessages([]);
      }
    } catch { }
    setDeleteConfirm(null);
  };

  const switchResearch = (research) => {
    setActiveResearch(research);
    setSidebarTab("docs");
    setActivePage("chat");
  };

  const handleSend = async () => {
    if (!prompt.trim()) return;
    if (!activeResearch) {
      setMessages(p => [...p, { role: "assistant", content: "⚠️ Sohbet edebilmek için lütfen \"Yükle\" ekranından bir araştırma seçin veya yeni bir tane oluşturun." }]);
      return;
    }
    if (selectedDocs.length === 0) {
      setMessages(p => [...p, { role: "assistant", content: "⚠️ Araştırmanızda seçili kaynak yok. Lütfen \"Yükle\" ekranından ilgili kaynakları seçin." }]);
      return;
    }

    const userMsg = { role: "user", content: prompt };
    setMessages(p => [...p, userMsg]);
    setPrompt("");
    setLoading(true);
    try {
      const res = await axios.post(`${API}/api/chat/message-with-save`, {
        email: user.email,
        prompt: userMsg.content,
        selected_docs: selectedDocs,
        chat_id: activeResearch?.id || null
      });
      // If a new chat_id was returned (first message, no research existed), update it
      if (res.data.chat_id && (!activeResearch || !activeResearch.id)) {
        const newR = { id: res.data.chat_id, title: userMsg.content.substring(0, 30), sources: selectedDocs };
        setActiveResearch(newR);
        setResearches(prev => [newR, ...prev]);
      } else if (res.data.chat_id && activeResearch) {
        // Update title if it was "Yeni Sohbet"
        if (activeResearch.title === "Yeni Sohbet") {
          const updatedTitle = userMsg.content.substring(0, 30) + (userMsg.content.length > 30 ? "..." : "");
          setActiveResearch(prev => ({ ...prev, title: updatedTitle }));
          setResearches(prev => prev.map(r => r.id === activeResearch.id ? { ...r, title: updatedTitle } : r));
        }
      }
      setMessages(p => [...p, { role: "assistant", content: res.data.reply }]);
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail || err.message;
      let errorMsg;
      if (status === 429) {
        errorMsg = "⏳ API kota sınırına ulaşıldı. Lütfen 1-2 dakika bekleyip tekrar deneyin.";
      } else {
        errorMsg = "🚫 Hata: " + detail;
      }
      setMessages(p => [...p, { role: "assistant", content: errorMsg }]);
    }
    setLoading(false);
  };

  // Update research sources when selection changes
  const handleSelectionChange = async (newDocs) => {
    setSelectedDocs(newDocs);
    if (activeResearch?.id) {
      try {
        await axios.put(`${API}/api/research/${encodeURIComponent(user.email)}/${activeResearch.id}/sources`, { sources: newDocs });
      } catch { }
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Geçici bir "yükleniyor" durumu için UI (bu örnekte alert kullanılabilir ama biz sessizce halledeceğiz)
    const formData = new FormData();
    formData.append("email", user.email);
    formData.append("file", file);

    try {
      await axios.post(`${API}/api/user/avatar`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setAvatarKey(Date.now()); // Yeni resmi yüklemek için force re-render
    } catch (err) {
      alert("Fotoğraf yüklenemedi: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleClearChat = async () => {
    if (!activeResearch) return;
    try {
      await axios.delete(`${API}/api/research/${encodeURIComponent(user.email)}/${activeResearch.id}/messages`);
      setMessages([]);
      setClearChatConfirm(false);
    } catch (err) {
      alert("Sohbet silinemedi: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleSaveUsername = async () => {
    if (!newUsernameInput.trim() || newUsernameInput.length < 3) {
      alert("Kullanıcı adı en az 3 karakter olmalıdır.");
      return;
    }
    setSavingUsername(true);
    try {
      const res = await axios.post(`${API}/api/user/${encodeURIComponent(user.email)}/username`, {
        username: newUsernameInput
      });
      setUsername(res.data.username);
      setUsernameModalVisible(false);
    } catch (err) {
      alert("Hata: " + (err.response?.data?.detail || err.message));
    }
    setSavingUsername(false);
  };

  const handleSaveApiKey = async () => {
    if (!apiKeyInput.trim()) return;
    setApiKeySaving(true);
    try {
      await axios.post(`${API}/api/user/apikey`, { email: user.email, api_key: apiKeyInput.trim() });
      setApiKey(apiKeyInput.trim());
    } catch (err) {
      alert("API key kaydedilemedi: " + (err.response?.data?.detail || err.message));
    }
    setApiKeySaving(false);
  };

  const handlePageChange = (key) => {
    if (key === "pool") {
      setAnalyticsTab("pool");
      setActivePage("analytics");
    } else if (key === "card_pool") {
      setAnalyticsTab("card_pool");
      setActivePage("analytics");
    } else {
      setActivePage(key);
      if (key === "analytics") setAnalyticsTab("history");
    }
    setNavOpen(false);
  };

  const handleLogout = () => { setUser(null); setMessages([]); setDocuments([]); setSelectedDocs([]); setResearches([]); setActiveResearch(null); };

  if (!user) return <AuthPage onLogin={setUser} />;

  const shortEmail = user.email.split("@")[0];
  const avatarUrl = `${API}/api/user/${encodeURIComponent(user.email)}/avatar?t=${avatarKey}`;

  const pages = [
    { key: "chat", icon: <MessageSquare size={15} />, label: "Akıllı Sohbet" },
    { key: "pool", icon: <Database size={15} />, label: "Soru Havuzu" },
    { key: "card_pool", icon: <Bookmark size={15} />, label: "Kart Havuzu" },
    { key: "quiz", icon: <FileText size={15} />, label: "Sınav Hazırla" },
    { key: "map", icon: <Map size={15} />, label: "Kavram Haritası" },
    { key: "cards", icon: <Layers size={15} />, label: "Bilgi Kartları" },
    { key: "notebooks", icon: <Book size={15} />, label: "Defterlerim" },
    { key: "analytics", icon: <BarChart2 size={15} />, label: "Analitik" },
  ];
  const curPage = pages.find(p => p.key === activePage) || pages[0];

  return (
    <div style={{ minHeight: "100vh", background: "#F9FAFB" }}>
      {/* ─── NAVBAR ─── */}
      <nav className="navbar" style={{ padding: "0 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="nav-brand" style={{ margin: 0, display: "flex", alignItems: "center" }}>
          <img src="/logo.png" alt="NoteX Logo" style={{ height: "48px", objectFit: "contain" }} />
          <span style={{ marginLeft: 8, fontWeight: 900, fontSize: "1.4rem", letterSpacing: "-0.5px" }}>NoteX</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {activeResearch && (
            <span style={{ fontSize: "0.75rem", color: "#6B7280", fontWeight: 600, background: "#F3F4F6", padding: "4px 12px", borderRadius: "20px", display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ opacity: 0.6 }}>ARAŞTIRMA:</span> {activeResearch.title}
            </span>
          )}

          <PomodoroDisplay timeLeft={pomoTime} running={pomoRunning} start={startPomo} pause={pausePomo} reset={resetPomo} setTime={setPomoTime} />

          <button 
            onClick={() => handlePageChange("notebooks")}
            style={{ display: "flex", alignItems: "center", gap: "6px", background: activePage === "notebooks" ? "#EFF6FF" : "#FFFFFF", color: activePage === "notebooks" ? "#1D4ED8" : "#4B5563", border: "1px solid", borderColor: activePage === "notebooks" ? "#3B82F6" : "#E5E7EB", padding: "8px 14px", borderRadius: "10px", cursor: "pointer", fontWeight: 700, fontSize: "0.9rem", margin: "0 8px", transition: "0.2s" }}
            title="Defterlerim"
          >
            <Book size={16} /> Defterler
          </button>

          <button
            onClick={() => { setSidebarOpen(v => !v); if (!sidebarOpen) setSidebarTab("researches"); }}
            style={{ display: "flex", alignItems: "center", gap: "6px", background: sidebarOpen ? "#EFF6FF" : "#FFFFFF", color: sidebarOpen ? "#1D4ED8" : "#4B5563", border: "1px solid", borderColor: sidebarOpen ? "#3B82F6" : "#E5E7EB", padding: "8px 14px", borderRadius: "10px", cursor: "pointer", fontWeight: 700, fontSize: "0.9rem", transition: "0.2s" }}
          >
            <Plus size={16} /> Yükle
          </button>

          <button
            onClick={() => handlePageChange("discover")}
            style={{ display: "flex", alignItems: "center", gap: "6px", background: activePage === "discover" ? "#EFF6FF" : "#FFFFFF", color: activePage === "discover" ? "#1D4ED8" : "#4B5563", border: "1px solid", borderColor: activePage === "discover" ? "#3B82F6" : "#E5E7EB", padding: "8px 14px", borderRadius: "10px", cursor: "pointer", fontWeight: 700, fontSize: "0.9rem" }}
          >
            <Globe size={16} /> Keşfet
          </button>

          <div className="dropdown" ref={navDropdownRef}>
            <button className="dropdown-btn" onClick={() => setNavOpen(v => !v)} style={{ height: "40px" }}>
              {curPage.icon} <span style={{ marginLeft: "4px" }}>{curPage.label}</span>
              <ChevronDown size={13} style={{ transform: navOpen ? "rotate(180deg)" : "none", transition: "0.2s" }} />
            </button>
            {navOpen && (
              <div className="dropdown-menu" style={{ display: "flex" }}>
                {pages.map(p => (
                  <div key={p.key} onClick={() => handlePageChange(p.key)}
                    style={{ display: "flex", alignItems: "center", gap: "8px", padding: "9px 12px", borderRadius: "8px", cursor: "pointer", fontWeight: 600, fontSize: "0.9rem", marginBottom: "2px", background: activePage === p.key ? "#EFF6FF" : "transparent", color: activePage === p.key ? "#1E3A8A" : "#374151" }}>
                    {p.icon} {p.label}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="dropdown" ref={profileDropdownRef}>
            <button className="dropdown-btn" onClick={() => { setProfileOpen(v => !v); if (profileOpen) setIsEditingProfile(false); }} style={{ height: "40px", padding: "0 10px" }}>
              <img
                src={avatarUrl}
                alt="Avatar"
                onClick={e => { e.stopPropagation(); setViewAvatar(true); }}
                style={{ width: "26px", height: "26px", borderRadius: "50%", objectFit: "cover", border: "1.5px solid #D1D5DB" }}
                onError={(e) => { e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'inline-block'; }}
              />
              <span style={{ display: "none" }}><User size={15} /></span>
              <span style={{ marginLeft: "6px", fontWeight: 700 }}>{username ? `@${username}` : shortEmail}</span>
              <ChevronDown size={13} style={{ transform: profileOpen ? "rotate(180deg)" : "none", transition: "0.2s", marginLeft: "4px" }} />
            </button>
            {profileOpen && (
              <div className="dropdown-menu" style={{
                position: "absolute", top: "100%", right: 0, marginTop: "12px",
                background: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: "16px",
                padding: "16px", width: "240px", boxShadow: "0 10px 25px rgba(0,0,0,0.1)", zIndex: 1001,
                display: "flex", flexDirection: "column", gap: "12px"
              }}>
                <div>
                  <p style={{ margin: "0 0 4px", fontSize: "0.7rem", fontWeight: 800, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>Hesap</p>
                  <p title={user?.email} style={{
                    margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "#111827",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                  }}>{user?.email}</p>
                </div>

                <button
                  onClick={() => setIsEditingProfile(!isEditingProfile)}
                  style={{
                    background: isEditingProfile ? "#EFF6FF" : "#F9FAFB",
                    color: isEditingProfile ? "#3B82F6" : "#374151",
                    border: isEditingProfile ? "1.5px solid #3B82F6" : "1.5px solid #E5E7EB",
                    padding: "10px", borderRadius: "10px", cursor: "pointer",
                    width: "100%", fontWeight: 700, fontSize: "0.85rem",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                    transition: "all 0.2s"
                  }}
                >
                  <Settings size={15} className={isEditingProfile ? "spin-anim" : ""} />
                  {isEditingProfile ? "Düzenlemeyi Kapat" : "Profili Düzenle"}
                </button>

                {isEditingProfile && (
                  <div style={{
                    padding: "12px", background: "#F9FAFB", borderRadius: "12px",
                    border: "1px solid #E5E7EB", display: "flex", flexDirection: "column", gap: "14px"
                  }}>
                    {/* Username section */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: "0.65rem", color: "#6B7280", fontWeight: 700, textTransform: "uppercase" }}>Kullanıcı Adı</span>
                        <span style={{ fontSize: "0.85rem", color: "#111827", fontWeight: 600 }}>{username ? `@${username}` : "Yok"}</span>
                      </div>
                      <button
                        onClick={() => { setNewUsernameInput(username); setUsernameModalVisible(true); setProfileOpen(false); }}
                        style={{ background: "#FFFFFF", color: "#3B82F6", border: "1px solid #BFDBFE", borderRadius: "8px", padding: "6px 10px", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}
                      >
                        {username ? "Değiştir" : "Ayarla"}
                      </button>
                    </div>

                    <hr style={{ border: "none", borderTop: "1px solid #E5E7EB", margin: 0 }} />

                    {/* API Key section */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                          <span style={{ fontSize: "0.65rem", color: "#6B7280", fontWeight: 700, textTransform: "uppercase" }}>Gemini API Key</span>
                          <button
                            onClick={() => setApiKeyHelpVisible(true)}
                            title="Nasıl alınır?"
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#3B82F6", padding: "0 2px", fontSize: "0.8rem", lineHeight: 1, display: "flex", alignItems: "center" }}
                          >ⓘ</button>
                        </div>
                        <span style={{ fontSize: "0.7rem", padding: "2px 8px", borderRadius: "20px", background: apiKey ? "#DCFCE7" : "#FEE2E2", color: apiKey ? "#16A34A" : "#DC2626", fontWeight: 700 }}>
                          {apiKey ? "✓ Kayıtlı" : "Yok"}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <input
                          type={apiKeyVisible ? "text" : "password"}
                          placeholder="AIzaSy..."
                          value={apiKeyInput}
                          onChange={e => setApiKeyInput(e.target.value)}
                          style={{ flex: 1, padding: "7px 10px", borderRadius: "8px", border: "1px solid #D1D5DB", fontSize: "0.78rem", fontWeight: 500, outline: "none", fontFamily: "monospace" }}
                        />
                        <button onClick={() => setApiKeyVisible(v => !v)} style={{ background: "#F3F4F6", border: "1px solid #E5E7EB", borderRadius: "8px", padding: "7px 10px", cursor: "pointer", fontSize: "0.8rem" }}>
                          {apiKeyVisible ? "🙈" : "👁"}
                        </button>
                      </div>
                      <button
                        onClick={handleSaveApiKey}
                        disabled={apiKeySaving || !apiKeyInput.trim()}
                        style={{ background: apiKeySaving || !apiKeyInput.trim() ? "#E5E7EB" : "#3B82F6", color: apiKeySaving || !apiKeyInput.trim() ? "#9CA3AF" : "white", border: "none", borderRadius: "8px", padding: "8px", fontWeight: 700, fontSize: "0.8rem", cursor: apiKeySaving || !apiKeyInput.trim() ? "not-allowed" : "pointer" }}
                      >
                        {apiKeySaving ? "⏳ Kaydediliyor..." : "💾 API Key'i Kaydet"}
                      </button>
                      <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer"
                        style={{ fontSize: "0.72rem", color: "#3B82F6", textAlign: "center", textDecoration: "none", fontWeight: 600 }}>
                        🔗 Google AI Studio'dan ücretsiz key al
                      </a>
                    </div>

                    <hr style={{ border: "none", borderTop: "1px solid #E5E7EB", margin: 0 }} />

                    {/* Photo section */}
                    <input type="file" ref={avatarInputRef} style={{ display: "none" }} accept="image/*" onChange={handleAvatarUpload} />
                    <button
                      onClick={() => avatarInputRef.current.click()}
                      style={{
                        background: "#FFFFFF", color: "#374151", border: "1px solid #E5E7EB",
                        padding: "8px", borderRadius: "8px", cursor: "pointer", width: "100%",
                        fontWeight: 700, fontSize: "0.8rem", display: "flex", alignItems: "center",
                        justifyContent: "center", gap: "8px", boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
                      }}
                    >
                      <Camera size={14} style={{ color: "#6B7280" }} /> Fotoğrafı Değiştir
                    </button>
                  </div>
                )}

                <hr style={{ border: "none", borderTop: "1px solid #E5E7EB", margin: "2px 0" }} />

                <button onClick={handleLogout} style={{ background: "#FEF2F2", color: "#DC2626", border: "1px solid #FCA5A5", padding: "10px", borderRadius: "10px", cursor: "pointer", width: "100%", fontWeight: 700, fontSize: "0.85rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                  <LogOut size={15} /> Çıkış Yap
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* ─── LAYOUT ─── */}
      <div style={{ display: "flex", maxWidth: "1280px", margin: "0 auto", padding: "1.25rem 1.5rem", gap: "18px" }}>

        {/* ─── LEFT SIDEBAR ─── */}
        {sidebarOpen && (
          <div style={{ width: "280px", flexShrink: 0 }}>
            <div style={{ background: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: "14px", overflow: "hidden", position: "sticky", top: "76px" }}>
              {/* Tabs */}
              <div style={{ display: "flex", borderBottom: "1px solid #E5E7EB" }}>
                {[
                  { key: "researches", label: "Araştırmalar", icon: "🔬" },
                  { key: "docs", label: "Kaynaklar", icon: "📂" },
                ].map(t => (
                  <button key={t.key} onClick={() => setSidebarTab(t.key)} style={{ flex: 1, padding: "10px 6px", border: "none", background: sidebarTab === t.key ? "#EFF6FF" : "transparent", color: sidebarTab === t.key ? "#1E3A8A" : "#6B7280", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", borderBottom: sidebarTab === t.key ? "2px solid #3B82F6" : "2px solid transparent" }}>
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>

              <div style={{ padding: "14px" }}>
                {/* ── ARAŞTIRMALAR TAB ── */}
                {sidebarTab === "researches" && (
                  <div>
                    {/* Inline create form */}
                    {isCreatingResearch ? (
                      <div style={{ marginBottom: "12px" }}>
                        <input
                          ref={newResearchInputRef}
                          value={newResearchName}
                          onChange={e => setNewResearchName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter") createNewResearch(newResearchName);
                            if (e.key === "Escape") { setIsCreatingResearch(false); setNewResearchName(""); }
                          }}
                          placeholder="Araştırma adı girin…"
                          style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: "8px", border: "2px solid #3B82F6", fontSize: "0.85rem", fontWeight: 600, outline: "none", marginBottom: "8px" }}
                        />
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            onClick={() => createNewResearch(newResearchName)}
                            style={{ flex: 1, padding: "8px", borderRadius: "7px", border: "none", background: "#3B82F6", color: "white", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer" }}
                          >
                            ✓ Oluştur
                          </button>
                          <button
                            onClick={() => { setIsCreatingResearch(false); setNewResearchName(""); }}
                            style={{ flex: 1, padding: "8px", borderRadius: "7px", border: "1px solid #D1D5DB", background: "#F9FAFB", color: "#6B7280", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer" }}
                          >
                            ✕ İptal
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={startCreatingResearch} style={{ width: "100%", padding: "9px", borderRadius: "8px", border: "2px dashed #BFDBFE", background: "#EFF6FF", color: "#1E3A8A", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", marginBottom: "12px" }}>
                        <Plus size={15} /> Yeni Araştırma
                      </button>
                    )}

                    {researches.length === 0 ? (
                      <p style={{ color: "#9CA3AF", fontSize: "0.82rem", textAlign: "center", padding: "20px 0" }}>Henüz araştırma yok.</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "400px", overflowY: "auto" }}>
                        {researches.map(r => (
                          <div key={r.id} onClick={() => switchResearch(r)} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "9px 10px", borderRadius: "9px", cursor: "pointer", border: `1.5px solid ${activeResearch?.id === r.id ? "#3B82F6" : "#E5E7EB"}`, background: activeResearch?.id === r.id ? "#EFF6FF" : "#FAFAFA", transition: "all 0.15s" }}>
                            <span style={{ fontSize: "1rem" }}>🔬</span>
                            <span style={{ flex: 1, fontSize: "0.82rem", fontWeight: 600, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</span>
                            <button
                              onClick={e => { e.stopPropagation(); setDeleteConfirm(r.id); }}
                              title="Araştırmayı sil"
                              style={{ background: "none", border: "none", cursor: "pointer", color: "#EF4444", padding: "10px", flexShrink: 0, opacity: 0.7, borderRadius: "8px", transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "center", minWidth: "36px", minHeight: "36px" }}
                              onMouseOver={e => { e.currentTarget.style.opacity = 1; e.currentTarget.style.background = "#FEE2E2"; }}
                              onMouseOut={e => { e.currentTarget.style.opacity = 0.7; e.currentTarget.style.background = "none"; }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── BELGELER TAB ── */}
                {sidebarTab === "docs" && (
                  <DocManager
                    user={user}
                    documents={documents}
                    onDocsChange={() => loadDocs()}
                    selectedDocs={selectedDocs}
                    onSelectionChange={handleSelectionChange}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── MAIN CONTENT ─── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Active research + doc banner */}
          {activePage !== "discover" && (activeResearch || selectedDocs.length > 0) && (
            <div style={{ background: "#FFFFFF", border: "1.5px solid #3B82F6", borderRadius: "10px", padding: "9px 16px", marginBottom: "14px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              {activeResearch && <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#1E3A8A", marginRight: "4px" }}>🔬 {activeResearch.title}</span>}
              {selectedDocs.map(d => (
                <span key={d} style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "20px", padding: "2px 10px", fontSize: "0.72rem", color: "#1E3A8A", fontWeight: 600 }}>{d}</span>
              ))}
              <div style={{ flex: 1 }} />
              {activeResearch && messages.length > 0 && activePage === "chat" && (
                <button
                  onClick={() => setClearChatConfirm(true)}
                  style={{ background: "#FEE2E2", color: "#EF4444", border: "none", borderRadius: "8px", padding: "6px 12px", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", transition: "0.2s" }}
                  onMouseOver={e => e.currentTarget.style.background = "#FECACA"}
                  onMouseOut={e => e.currentTarget.style.background = "#FEE2E2"}
                  title="Odadaki mesajları temizle"
                >
                  🧹 Sohbeti Temizle
                </button>
              )}
            </div>
          )}

          {activePage === "chat" && (
            <>
              <div className="chat-box" style={{ marginBottom: "14px" }}>
                {messages.length === 0 && (
                  <div style={{ textAlign: "center", padding: "60px 20px", color: "#9CA3AF" }}>
                    <MessageSquare size={52} style={{ color: "#3B82F6", opacity: 0.9, margin: "0 auto 16px", display: "block" }} />
                    <p style={{ fontWeight: 700, color: "#374151", fontSize: "1.2rem" }}>Merhaba, {shortEmail}! 👋</p>
                    <p style={{ fontSize: "0.9rem", color: "#6B7280", marginTop: "10px", fontWeight: 500 }}>
                      {!activeResearch ? "🔬 \"Yükle\" ekranından \"Yeni Araştırma\" oluşturun veya" : ""}
                      {documents.length > 0 ? " kaynaklarınızı seçip soru sorun." : " 📂 Kaynaklar sekmesinden PDF yükleyin."}
                    </p>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={`message ${m.role === "user" ? "user" : "ai"}`}>
                    <b style={{ fontSize: "0.78rem", display: "block", marginBottom: "5px", opacity: 0.65 }}>{m.role === "user" ? "👤 Sen" : "🤖 NoteX"}</b>
                    <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.65 }}>{m.content}</div>
                  </div>
                ))}
                {loading && (
                  <div className="message ai" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    {[0, 1, 2].map(i => <div key={i} style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#3B82F6", animation: `bounce 1s ${i * 0.15}s infinite` }} />)}
                    <span style={{ color: "#9CA3AF", fontSize: "0.88rem" }}>Düşünüyor...</span>
                  </div>
                )}
                <div ref={msgsEndRef} />
              </div>
              <div className="chat-input-wrapper">
                <input className="chat-input" placeholder="Ders notlarınızdan sorunuzu sorun…" value={prompt}
                  onChange={e => setPrompt(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()} />
                <button className="send-btn" onClick={handleSend} disabled={loading || !prompt.trim()}>
                  {loading ? "⏳" : "↑ Gönder"}
                </button>
              </div>
            </>
          )}

          {activePage === "quiz" && <QuizPage user={user} username={username} selectedDocs={selectedDocs} researchId={activeResearch?.id} />}
          {activePage === "map" && <ConceptMapPage user={user} selectedDocs={selectedDocs} researchId={activeResearch?.id} />}
          {activePage === "cards" && <FlashcardsPage user={user} selectedDocs={selectedDocs} researchId={activeResearch?.id} />}
          {activePage === "notebooks" && <NotebookPage user={user} />}
          {activePage === "analytics" && <AnalyticsPage user={user} username={username} initialTab={analyticsTab} />}
          {activePage === "discover" && <DiscoverPage user={user} username={username} />}
        </div>
      </div>

      <style>{`@keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }`}</style>

      {/* ── USERNAME MODAL ── */}
      {usernameModalVisible && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
          <div style={{ background: "#fff", borderRadius: "16px", padding: "32px", maxWidth: "400px", width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <h3 style={{ margin: "0 0 8px", fontSize: "1.2rem", fontWeight: 800, color: "#111827" }}>
              {username ? "Kullanıcı Adını Değiştir" : "Topluluğa Katıl!"}
            </h3>
            <p style={{ margin: "0 0 20px", fontSize: "0.9rem", color: "#6B7280", lineHeight: 1.5 }}>
              Keşfet sekmesinde paylaşımlarınızın ve yorumlarınızın yanında görünecek <b>benzersiz</b> bir isim belirleyin. (Sadece küçük harf, rakam ve altçizgi)
            </p>
            <input
              type="text"
              placeholder="Örn: akademik_kurt"
              maxLength={20}
              value={newUsernameInput}
              onChange={e => setNewUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "2px solid #D1D5DB", outline: "none", fontSize: "1rem", fontWeight: 600, boxSizing: "border-box", marginBottom: "20px", color: "#111827" }}
            />
            <div style={{ display: "flex", gap: "10px" }}>
              {username && (
                <button onClick={() => setUsernameModalVisible(false)} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "1px solid #D1D5DB", background: "#F9FAFB", color: "#374151", fontWeight: 700, fontSize: "0.95rem", cursor: "pointer", transition: "0.2s" }} onMouseOver={e => e.currentTarget.style.background = "#E5E7EB"} onMouseOut={e => e.currentTarget.style.background = "#F9FAFB"}>İptal</button>
              )}
              <button
                onClick={handleSaveUsername}
                disabled={savingUsername || newUsernameInput.length < 3}
                style={{ flex: 2, padding: "12px", borderRadius: "10px", border: "none", background: "#3B82F6", color: "white", fontWeight: 700, fontSize: "0.95rem", cursor: savingUsername || newUsernameInput.length < 3 ? "not-allowed" : "pointer", opacity: savingUsername || newUsernameInput.length < 3 ? 0.6 : 1, transition: "0.2s" }}
                onMouseOver={e => !savingUsername && newUsernameInput.length >= 3 && (e.currentTarget.style.background = "#2563EB")}
                onMouseOut={e => !savingUsername && newUsernameInput.length >= 3 && (e.currentTarget.style.background = "#3B82F6")}
              >
                {savingUsername ? "⏳ Kaydediliyor..." : "Kaydet ve Devam Et"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM MODAL ── */}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }} onClick={() => setDeleteConfirm(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "16px", padding: "32px", maxWidth: "400px", width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", textAlign: "center" }}>
            <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Trash2 size={24} color="#DC2626" />
            </div>
            <h3 style={{ margin: "0 0 8px", fontSize: "1.15rem", fontWeight: 700, color: "#111827" }}>Araştırmayı Sil</h3>
            <p style={{ margin: "0 0 24px", fontSize: "0.9rem", color: "#6B7280", lineHeight: 1.5 }}>
              Bu araştırma ve tüm mesajları kalıcı olarak silinecek.<br />Bu işlem geri alınamaz.
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: "11px", borderRadius: "10px", border: "1px solid #D1D5DB", background: "#F9FAFB", color: "#374151", fontWeight: 700, fontSize: "0.9rem", cursor: "pointer" }}>İptal</button>
              <button onClick={confirmDeleteResearch} style={{ flex: 1, padding: "11px", borderRadius: "10px", border: "none", background: "#DC2626", color: "white", fontWeight: 700, fontSize: "0.9rem", cursor: "pointer" }}>Evet, Sil</button>
            </div>
          </div>
        </div>
      )}

      {/* ── AVATAR VIEW MODAL ── */}
      {viewAvatar && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(5px)" }} onClick={() => setViewAvatar(false)}>
          <img
            src={avatarUrl}
            alt="Büyük Avatar"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: "90%", maxHeight: "90vh", borderRadius: "16px", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)", objectFit: "contain", border: "4px solid white" }}
          />
          <button onClick={() => setViewAvatar(false)} style={{ position: "absolute", top: "20px", right: "20px", background: "white", border: "none", borderRadius: "50%", width: "40px", height: "40px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#374151", boxShadow: "0 4px 6px rgba(0,0,0,0.1)", fontSize: "20px" }}>
            ✕
          </button>
        </div>
      )}

      {/* ── CLEAR CHAT CONFIRM MODAL ── */}
      {clearChatConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }} onClick={() => setClearChatConfirm(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "16px", padding: "32px", maxWidth: "400px", width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", textAlign: "center" }}>
            <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <MessageSquare size={24} color="#DC2626" />
            </div>
            <h3 style={{ margin: "0 0 8px", fontSize: "1.15rem", fontWeight: 700, color: "#111827" }}>Sohbeti Temizle</h3>
            <p style={{ margin: "0 0 24px", fontSize: "0.9rem", color: "#6B7280", lineHeight: 1.5 }}>
              Bu araştırmadaki tüm mesajlar kalıcı olarak silinecek.<br />Bu işlem geri alınamaz.
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setClearChatConfirm(false)} style={{ flex: 1, padding: "11px", borderRadius: "10px", border: "1px solid #D1D5DB", background: "#F9FAFB", color: "#374151", fontWeight: 700, fontSize: "0.9rem", cursor: "pointer" }}>İptal</button>
              <button onClick={handleClearChat} style={{ flex: 1, padding: "11px", borderRadius: "10px", border: "none", background: "#DC2626", color: "white", fontWeight: 700, fontSize: "0.9rem", cursor: "pointer" }}>Evet, Temizle</button>
            </div>
          </div>
        </div>
      )}

      {/* ── API KEY ONBOARD MODAL ── */}
      {apiKeyOnboardVisible && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.7)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(6px)", padding: "20px" }}>
          <div style={{ background: "#fff", borderRadius: "24px", padding: "40px 36px", maxWidth: "460px", width: "100%", boxShadow: "0 25px 80px rgba(0,0,0,0.35)", textAlign: "center" }}>
            {/* Icon */}
            <div style={{ width: "64px", height: "64px", borderRadius: "18px", background: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem", margin: "0 auto 20px" }}>🔑</div>

            <h2 style={{ margin: "0 0 8px", fontSize: "1.4rem", fontWeight: 900, color: "#111827" }}>Gemini API Key Gerekli</h2>
            <p style={{ margin: "0 0 24px", fontSize: "0.9rem", color: "#6B7280", lineHeight: 1.6 }}>
              NoteX, yapay zeka özelliklerini kullanabilmek için <b>kendi Gemini API key'ini</b> kullanmanı gerektiriyor.
              Bu sayede tüm yapay zeka kotası sana ait olur.
            </p>

            {/* Steps */}
            <div style={{ background: "#F8FAFC", borderRadius: "14px", padding: "16px", marginBottom: "20px", textAlign: "left" }}>
              {[
                { n: "1", t: "Google hesabınla ", link: "https://aistudio.google.com/apikey", lt: "AI Studio'ya git" },
                { n: "2", t: '"Create API Key" butonuna tıkla' },
                { n: "3", t: '"AIzaSy..." ile başlayan key\'i kopyala' },
                { n: "4", t: "Aşağıya yapıştır ve kaydet" },
              ].map(s => (
                <div key={s.n} style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "10px" }}>
                  <div style={{ minWidth: "22px", height: "22px", borderRadius: "50%", background: "#EFF6FF", border: "1.5px solid #BFDBFE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 800, color: "#1D4ED8", flexShrink: 0 }}>{s.n}</div>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "#374151", paddingTop: "2px" }}>
                    {s.t}{s.link && <a href={s.link} target="_blank" rel="noreferrer" style={{ color: "#3B82F6", fontWeight: 700, textDecoration: "underline" }}>{s.lt}</a>}
                  </p>
                </div>
              ))}
            </div>

            {/* Input */}
            <input
              type="text"
              placeholder="AIzaSy... key'inizi buraya yapıştırın"
              value={onboardInput}
              onChange={e => setOnboardInput(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: "12px", border: "2px solid #D1D5DB", outline: "none", fontSize: "0.9rem", fontWeight: 500, fontFamily: "monospace", marginBottom: "14px", color: "#111827" }}
              onFocus={e => e.target.style.borderColor = "#3B82F6"}
              onBlur={e => e.target.style.borderColor = "#D1D5DB"}
            />

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={async () => {
                  if (!onboardInput.trim()) return;
                  setOnboardSaving(true);
                  try {
                    await axios.post(`${API}/api/user/apikey`, { email: user.email, api_key: onboardInput.trim() });
                    setApiKey(onboardInput.trim());
                    setApiKeyInput(onboardInput.trim());
                    setApiKeyOnboardVisible(false);
                  } catch (err) {
                    alert("Kaydedilemedi: " + (err.response?.data?.detail || err.message));
                  }
                  setOnboardSaving(false);
                }}
                disabled={!onboardInput.trim() || onboardSaving}
                style={{ width: "100%", padding: "12px", borderRadius: "12px", border: "none", background: onboardInput.trim() ? "#3B82F6" : "#E5E7EB", color: onboardInput.trim() ? "white" : "#9CA3AF", fontWeight: 700, fontSize: "0.9rem", cursor: onboardInput.trim() ? "pointer" : "not-allowed", transition: "0.2s" }}
              >
                {onboardSaving ? "⏳ Kaydediliyor..." : "✓ Kaydet ve Başla"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── API KEY HELP MODAL ── */}
      {apiKeyHelpVisible && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }} onClick={() => setApiKeyHelpVisible(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "20px", padding: "32px", maxWidth: "440px", width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
              <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "linear-gradient(135deg, #3B82F6, #8B5CF6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem", flexShrink: 0 }}>🔑</div>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#111827" }}>Gemini API Key Nasıl Alınır?</h3>
                <p style={{ margin: 0, fontSize: "0.8rem", color: "#6B7280" }}>Ücretsiz, ~1 dakika sürer</p>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "24px" }}>
              {[
                { step: "1", text: "Google hesabınla ", link: "aistudio.google.com/apikey", linkText: "AI Studio'ya git", after: "" },
                { step: "2", text: "\"Create API Key\" butonuna tıkla", link: null },
                { step: "3", text: "Oluşturulan key'i kopyala (\"AIzaSy...\" ile başlar)", link: null },
                { step: "4", text: "Buraya yapıştır ve kaydet ✓", link: null },
              ].map(({ step, text, link, linkText, after }) => (
                <div key={step} style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                  <div style={{ minWidth: "26px", height: "26px", borderRadius: "50%", background: "#EFF6FF", border: "1.5px solid #BFDBFE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: 800, color: "#1D4ED8", flexShrink: 0 }}>{step}</div>
                  <p style={{ margin: 0, fontSize: "0.88rem", color: "#374151", lineHeight: 1.5, paddingTop: "3px" }}>
                    {text}{link && <a href={`https://${link}`} target="_blank" rel="noreferrer" style={{ color: "#3B82F6", fontWeight: 700, textDecoration: "underline" }}>{linkText}</a>}{after}
                  </p>
                </div>
              ))}
            </div>

            <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "10px", padding: "10px 14px", marginBottom: "20px", fontSize: "0.82rem", color: "#92400E", lineHeight: 1.5 }}>
              💡 <b>Ücretsiz kotada</b> her gün onlarca sorgu yapabilirsin. Key gizlidir, başkasıyla paylaşma.
            </div>

            <button
              onClick={() => setApiKeyHelpVisible(false)}
              style={{ width: "100%", padding: "12px", borderRadius: "12px", border: "none", background: "#3B82F6", color: "white", fontWeight: 700, fontSize: "0.95rem", cursor: "pointer" }}
            >
              Anladım ✓
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
