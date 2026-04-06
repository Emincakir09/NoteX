import React, { useState, useEffect } from "react";
import axios from "axios";
import { Plus, Trash2, Edit3, BookOpen, Clock, Loader2, Book, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import "./Notebook.css"; 

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function NotebookPage({ user }) {
  const [notes, setNotes] = useState([]);
  const [activeNote, setActiveNote] = useState(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [editContent, setEditContent] = useState("");
  const [deleteModalNote, setDeleteModalNote] = useState(null);

  const [typingTimeout, setTypingTimeout] = useState(null);

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    try {
      const res = await axios.get(`${API}/api/notes/${encodeURIComponent(user.email)}`);
      setNotes(res.data.notes || []);
      if (res.data.notes && res.data.notes.length > 0 && !activeNote) {
        const first = res.data.notes[0];
        setActiveNote(first);
        setCurrentPageIndex(0);
        setEditContent(first.pages[0] || "");
      }
    } catch (err) {
      console.error("Error fetching notes:", err);
    }
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    try {
      const res = await axios.post(`${API}/api/notes/${encodeURIComponent(user.email)}`, {
        title: newTitle.trim()
      });
      if (res.data.success) {
        const newNote = {
          id: res.data.id,
          title: res.data.title,
          pages: [""],
          updated_at: new Date().toISOString()
        };
        setNotes([newNote, ...notes]);
        setActiveNote(newNote);
        setCurrentPageIndex(0);
        setEditContent("");
        setIsCreating(false);
        setNewTitle("");
      }
    } catch (err) {
      alert("Hata: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleDelete = async () => {
    if (!deleteModalNote) return;
    try {
      const noteId = deleteModalNote.id;
      await axios.delete(`${API}/api/notes/${encodeURIComponent(user.email)}/${noteId}`);
      setNotes(notes.filter(n => n.id !== noteId));
      if (activeNote?.id === noteId) {
        setActiveNote(null);
        setEditContent("");
      }
      setDeleteModalNote(null);
    } catch (err) {
      alert("Hata: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleContentChange = (val) => {
    setEditContent(val);
    setSaveStatus("Kaydediliyor...");
    
    if (typingTimeout) clearTimeout(typingTimeout);
    
    setTypingTimeout(setTimeout(() => {
      saveContent(val);
    }, 1000));
  };

  const saveContent = async (val) => {
    if (!activeNote) return;
    try {
      const updatedPages = [...(activeNote.pages || [""])];
      updatedPages[currentPageIndex] = val;
      
      await axios.put(`${API}/api/notes/${encodeURIComponent(user.email)}/${activeNote.id}`, {
        pages: updatedPages
      });
      
      const newActive = { ...activeNote, pages: updatedPages };
      setActiveNote(newActive);
      setNotes(prev => prev.map(n => n.id === activeNote.id ? newActive : n));
      
      setSaveStatus("✅ Kaydedildi");
      setTimeout(() => setSaveStatus(""), 2000);
    } catch (err) {
      console.error("Save error:", err);
      setSaveStatus("❌ Kaydetme hatası!");
    }
  };

  const changePage = (offset) => {
    if (!activeNote) return;
    // ensure what we wrote is saved before switching
    saveContent(editContent);
    const newIdx = currentPageIndex + offset;
    if (newIdx >= 0 && newIdx < activeNote.pages.length) {
      setCurrentPageIndex(newIdx);
      setEditContent(activeNote.pages[newIdx]);
    }
  };

  const addNewPage = () => {
    if (!activeNote) return;
    saveContent(editContent);
    const updatedPages = [...(activeNote.pages || [""]), ""];
    
    // Optimistic local update so UI switches immediately
    const newActive = { ...activeNote, pages: updatedPages };
    setActiveNote(newActive);
    setNotes(prev => prev.map(n => n.id === activeNote.id ? newActive : n));
    
    setCurrentPageIndex(updatedPages.length - 1);
    setEditContent("");
    
    // Save to server
    axios.put(`${API}/api/notes/${encodeURIComponent(user.email)}/${activeNote.id}`, {
      pages: updatedPages
    });
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
        <Loader2 className="spinner" size={32} color="#3B82F6" />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: "24px", height: "calc(100vh - 120px)" }}>
      {/* ── ALREADY CREATED NOTEBOOKS LIST ── */}
      <div style={{ width: "260px", background: "white", borderRadius: "16px", border: "1px solid #E5E7EB", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "16px", background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#111827", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
            <BookOpen size={18} color="#3B82F6" /> Defterlerim
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "#6B7280" }}>Kişisel notların ve araştırma özetlerin</p>
        </div>

        <div style={{ padding: "16px", overflowY: "auto", flex: 1 }}>
          {isCreating ? (
            <div style={{ marginBottom: "16px" }}>
              <input 
                autoFocus
                type="text" 
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="Defter Başlığı..."
                onKeyDown={e => {
                  if(e.key === "Enter") handleCreate();
                  if(e.key === "Escape") { setIsCreating(false); setNewTitle(""); }
                }}
                style={{ width: "100%", padding: "10px", border: "2px solid #3B82F6", borderRadius: "8px", outline: "none", fontSize: "0.9rem", boxSizing: "border-box", marginBottom: "8px" }}
              />
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={handleCreate} style={{ flex: 1, padding: "8px", background: "#3B82F6", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>Oluştur</button>
                <button onClick={() => { setIsCreating(false); setNewTitle(""); }} style={{ flex: 1, padding: "8px", background: "#F3F4F6", color: "#4B5563", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>İptal</button>
              </div>
            </div>
          ) : (
            <button 
              onClick={() => setIsCreating(true)}
              style={{ width: "100%", padding: "12px", background: "#EFF6FF", color: "#1D4ED8", border: "2px dashed #BFDBFE", borderRadius: "10px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginBottom: "16px" }}
            >
              <Plus size={16} /> Yeni Defter
            </button>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {notes.map(note => (
              <div 
                key={note.id}
                onClick={() => {
                  setActiveNote(note);
                  setCurrentPageIndex(0);
                  setEditContent(note.pages ? note.pages[0] : (note.content || ""));
                }}
                style={{
                  padding: "12px",
                  borderRadius: "10px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: activeNote?.id === note.id ? "#3B82F6" : "transparent",
                  color: activeNote?.id === note.id ? "white" : "#374151",
                  border: activeNote?.id === note.id ? "1px solid #2563EB" : "1px solid #E5E7EB",
                  transition: "all 0.2s"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
                  <Book size={16} style={{ opacity: activeNote?.id === note.id ? 1 : 0.6 }} />
                  <span style={{ fontWeight: 600, fontSize: "0.9rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {note.title}
                  </span>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); setDeleteModalNote(note); }}
                  style={{ background: "none", border: "none", color: activeNote?.id === note.id ? "rgba(255,255,255,0.7)" : "#9CA3AF", cursor: "pointer", padding: "4px" }}
                  title="Sil"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {notes.length === 0 && !isCreating && (
              <div style={{ textAlign: "center", color: "#9CA3AF", fontSize: "0.85rem", padding: "20px 0" }}>
                Henüz defter bulunmuyor.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── NOTEBOOK WORKSPACE ── */}
      <div style={{ flex: 1, position: "relative", display: "flex", justifyContent: "center", alignItems: "flex-start", paddingBottom: "20px" }}>
        {activeNote ? (
          <div className="spiral-notebook">
            {/* Spiral bindings */}
            <div className="spiral-binding-container">
              {[...Array(15)].map((_, i) => (
                <div key={i} className="spiral-ring"></div>
              ))}
            </div>
            
            {/* Notebook Content Area */}
            <div className="notebook-page">
              <div className="notebook-header">
                <h2>{activeNote.title}</h2>
                <div style={{ color: "#9CA3AF", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Clock size={12} /> {saveStatus || "Güncel"}
                </div>
              </div>
              
              <div className="notebook-lines-container" style={{ display: "flex", flexDirection: "column" }}>
                <textarea 
                  className="notebook-textarea"
                  value={editContent}
                  onChange={e => handleContentChange(e.target.value)}
                  placeholder="Notlarınızı buraya yazmaya başlayın..."
                  spellCheck="false"
                  style={{ flex: 1 }}
                />
                
                {/* ── PAGINATION CONTROLS ── */}
                <div style={{
                  display: "flex", 
                  justifyContent: "space-between", 
                  alignItems: "center", 
                  padding: "12px 20px 12px 30px", 
                  borderTop: "2px solid rgba(56, 189, 248, 0.3)",
                  background: "#fdfdf6"
                }}>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <button 
                      onClick={() => changePage(-1)}
                      disabled={currentPageIndex === 0}
                      style={{ padding: "6px 12px", border: "1px solid #D1D5DB", background: currentPageIndex === 0 ? "#F3F4F6" : "white", color: currentPageIndex === 0 ? "#9CA3AF" : "#374151", borderRadius: "8px", cursor: currentPageIndex === 0 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "4px", fontSize: "0.85rem", fontWeight: 600 }}
                    >
                      <ChevronLeft size={16} /> Önceki
                    </button>
                    
                    <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "#4B5563" }}>
                      Sayfa {currentPageIndex + 1} / {activeNote.pages?.length || 1}
                    </span>
                    
                    <button 
                      onClick={() => changePage(1)}
                      disabled={currentPageIndex >= (activeNote.pages?.length || 1) - 1}
                      style={{ padding: "6px 12px", border: "1px solid #D1D5DB", background: currentPageIndex >= (activeNote.pages?.length || 1) - 1 ? "#F3F4F6" : "white", color: currentPageIndex >= (activeNote.pages?.length || 1) - 1 ? "#9CA3AF" : "#374151", borderRadius: "8px", cursor: currentPageIndex >= (activeNote.pages?.length || 1) - 1 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "4px", fontSize: "0.85rem", fontWeight: 600 }}
                    >
                      Sonraki <ChevronRight size={16} />
                    </button>
                  </div>

                  <button 
                    onClick={addNewPage}
                    style={{ padding: "6px 14px", border: "none", background: "#DBEAFE", color: "#1D4ED8", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem", fontWeight: 700 }}
                  >
                    <Plus size={16} /> Yeni Sayfa
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "100%", width: "100%", color: "#9CA3AF", background: "white", borderRadius: "16px", border: "1px dashed #D1D5DB" }}>
            <Edit3 size={48} style={{ marginBottom: "16px", opacity: 0.5 }} />
            <p style={{ fontWeight: 600, fontSize: "1.1rem" }}>Defter Görüntüleyici</p>
            <p style={{ fontSize: "0.9rem" }}>Not almak için soldan bir defter seçin veya yeni oluşturun.</p>
          </div>
        )}
      </div>
      
      {/* ── DELETE MODAL ── */}
      {deleteModalNote && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}>
          <div style={{ background: "white", padding: "24px", borderRadius: "16px", width: "400px", boxShadow: "0 10px 25px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#DC2626", marginBottom: "12px" }}>
              <div style={{ background: "#FEE2E2", padding: "8px", borderRadius: "50%", display: "flex" }}>
                <AlertTriangle size={24} />
              </div>
              <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>Defteri Sil</h3>
            </div>
            
            <p style={{ color: "#4B5563", fontSize: "0.95rem", lineHeight: "1.5", margin: "16px 0", padding: "0 6px" }}>
              <strong style={{ color: "#111827" }}>{deleteModalNote.title}</strong> defterini silmek istediğinize emin misiniz?
              <br /><br />
              <span style={{ fontSize: "0.85rem", color: "#6B7280" }}>👉 Bu işlem geri alınamaz ve içindeki tüm sayfalar kalıcı olarak silinir.</span>
            </p>
            
            <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
              <button 
                onClick={() => setDeleteModalNote(null)}
                style={{ flex: 1, padding: "10px 16px", background: "#F3F4F6", border: "none", borderRadius: "10px", color: "#4B5563", fontWeight: 600, cursor: "pointer", transition: "0.2s" }}
                onMouseOver={e => e.target.style.background = "#E5E7EB"}
                onMouseOut={e => e.target.style.background = "#F3F4F6"}
              >
                Vazgeç
              </button>
              <button 
                onClick={handleDelete}
                style={{ flex: 1, padding: "10px 16px", background: "#DC2626", border: "none", borderRadius: "10px", color: "white", fontWeight: 600, cursor: "pointer", transition: "0.2s" }}
                onMouseOver={e => e.target.style.background = "#B91C1C"}
                onMouseOut={e => e.target.style.background = "#DC2626"}
              >
                Evet, Sil
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
