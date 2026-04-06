import React, { useState, useEffect } from "react";
import axios from "axios";
import { Heart, MessageCircle, Bookmark, Send, User, Trash2, RefreshCw, Clock } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function DiscoverPage({ user, username }) {
    const [feed, setFeed] = useState([]);
    const [loading, setLoading] = useState(true);

    // State to track if the user has attempted a question: { [qId]: { selected: "A", isCorrect: true } }
    const [attempts, setAttempts] = useState({});

    // UI states
    const [showComments, setShowComments] = useState({}); // { [qId]: boolean }
    const [commentText, setCommentText] = useState({}); // { [qId]: string }
    const [savedToPool, setSavedToPool] = useState({}); // { [qId]: boolean }
    const [viewAvatarUrl, setViewAvatarUrl] = useState(null);
    const [postToDelete, setPostToDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const loadFeed = async () => {
        setLoading(true);
        try {
            const [feedRes, attemptsRes] = await Promise.all([
                axios.get(`${API}/api/discover`),
                axios.get(`${API}/api/user/${encodeURIComponent(user.email)}/discover_attempts`).catch(() => ({ data: { attempts: {} } }))
            ]);
            setFeed(feedRes.data.feed || []);
            setAttempts(attemptsRes.data.attempts || {});
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    };

    useEffect(() => { loadFeed(); }, []);

    const handleOptionSelect = async (q, option) => {
        if (attempts[q.id]) return; // Zaten çözülmüş

        const isCorrect = option === q.correctAnswer;
        setAttempts(prev => ({ ...prev, [q.id]: { selected: option, isCorrect } }));

        // Arka plana kaydet
        try {
            await axios.post(`${API}/api/user/${encodeURIComponent(user.email)}/discover_attempts`, {
                questionId: q.id,
                selectedOption: option,
                isCorrect: isCorrect
            });
        } catch (err) {
            console.error("Çözüm kaydedilemedi", err);
        }
    };

    const handleLike = async (qId) => {
        try {
            const res = await axios.post(`${API}/api/discover/${qId}/like`, { email: user.email });

            // Update local state optimizing UX
            setFeed(prev => prev.map(q => {
                if (q.id === qId) {
                    let newLikes = [...(q.likes || [])];
                    if (res.data.liked) newLikes.push(user.email);
                    else newLikes = newLikes.filter(e => e !== user.email);
                    return { ...q, likes: newLikes };
                }
                return q;
            }));
        } catch (err) {
            alert("Beğeni işlemi başarısız: " + err.message);
        }
    };

    const handleComment = async (qId) => {
        const text = commentText[qId]?.trim();
        if (!text) return;

        try {
            const res = await axios.post(`${API}/api/discover/${qId}/comment`, {
                authorEmail: user.email,
                authorUsername: username,
                text: text
            });

            // Update local state
            setFeed(prev => prev.map(q => {
                if (q.id === qId) {
                    return { ...q, comments: [...(q.comments || []), res.data.comment] };
                }
                return q;
            }));
            setCommentText(prev => ({ ...prev, [qId]: "" }));
        } catch (err) {
            alert("Yorum yapılamadı: " + err.message);
        }
    };

    const [flippedCards, setFlippedCards] = useState({}); // { [qId]: boolean }

    const handleSaveCardToPool = async (q) => {
        try {
            await axios.post(`${API}/api/user/${encodeURIComponent(user.email)}/card_pool`, {
                kavram: q.kavram,
                tanim: q.tanim,
                kategori: q.kategori
            });
            setSavedToPool(prev => ({ ...prev, [q.id]: true }));
            alert("Kart başarıyla havuza eklendi!");
        } catch (err) {
            alert("Havuza eklenemedi: " + (err.response?.data?.detail || err.message));
        }
    };

    const handleSaveToPool = async (q) => {
        try {
            await axios.post(`${API}/api/user/${encodeURIComponent(user.email)}/question_pool`, {
                questionText: q.questionText,
                options: q.options,
                correctAnswer: q.correctAnswer,
                explanation: q.explanation || ""
            });
            setSavedToPool(prev => ({ ...prev, [q.id]: true }));
        } catch (err) {
            alert("Havuza eklenemedi: " + err.message);
        }
    };

    const handleDeletePost = async () => {
        if (!postToDelete) return;
        setDeleting(true);
        try {
            await axios.delete(`${API}/api/discover/${postToDelete.id}/${encodeURIComponent(user.email)}`);
            setFeed(prev => prev.filter(q => q.id !== postToDelete.id));
            setPostToDelete(null);
        } catch (err) {
            alert("Silinemedi: " + (err.response?.data?.detail || err.message));
        }
        setDeleting(false);
    };

    const formatTimestamp = (ts) => {
        if (!ts) return "";
        try {
            // Firestore timestamps often come as "2023-10-27 04:46:34..." or ISO
            const d = new Date(ts);
            if (isNaN(d.getTime())) return ts.split(".")[0];
            return d.toLocaleString("tr-TR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            });
        } catch {
            return ts;
        }
    };

    return (
        <div style={{ maxWidth: "800px", margin: "0 auto", paddingBottom: "40px" }}>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "20px" }}>
                <button
                    onClick={loadFeed}
                    disabled={loading}
                    style={{
                        display: "flex", alignItems: "center", gap: "8px",
                        padding: "10px 18px", borderRadius: "12px", border: "1px solid #E5E7EB",
                        background: "#FFFFFF", color: "#374151", fontWeight: 700, fontSize: "0.9rem",
                        cursor: "pointer", transition: "all 0.2s", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)"
                    }}
                    onMouseOver={e => { e.currentTarget.style.background = "#F9FAFB"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                    onMouseOut={e => { e.currentTarget.style.background = "#FFFFFF"; e.currentTarget.style.transform = "translateY(0)"; }}
                >
                    <RefreshCw size={16} className={loading ? "spin-anim" : ""} style={{ color: "#3B82F6" }} />
                    {loading ? "Yenileniyor..." : "Yenile"}
                </button>
            </div>

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .spin-anim { animation: spin 1s linear infinite; }
            `}</style>

            {loading && <div style={{ textAlign: "center", padding: "40px", color: "#6B7280" }}>Yükleniyor...</div>}
            {!loading && feed.length === 0 && (
                <div style={{ textAlign: "center", padding: "60px 20px", color: "#9CA3AF" }}>
                    <p>Henüz kimse soru paylaşmamış.</p>
                </div>
            )}

            {!loading && feed.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                    {feed.map((q) => {
                        const attempted = attempts[q.id];
                        const likedByMe = (q.likes || []).includes(user.email);
                        const commentsVisible = showComments[q.id];

                        return (
                            <div key={q.id} style={{ background: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: "16px", overflow: "hidden", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>

                                {/* Header */}
                                <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "12px", borderBottom: "1px solid #F3F4F6", background: "#FAFAFA" }}>
                                    <div style={{ position: "relative", width: "36px", height: "36px" }}>
                                        <img
                                            src={`${API}/api/user/${encodeURIComponent(q.authorEmail)}/avatar`}
                                            alt="Avatar"
                                            onClick={() => setViewAvatarUrl(`${API}/api/user/${encodeURIComponent(q.authorEmail)}/avatar`)}
                                            style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover", cursor: "zoom-in", border: "1px solid #E5E7EB" }}
                                            onError={(e) => { e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'flex'; }}
                                        />
                                        <div style={{ display: "none", width: "100%", height: "100%", borderRadius: "50%", background: "#DBEAFE", alignItems: "center", justifyContent: "center", color: "#1D4ED8", fontWeight: 800 }}>
                                            {q.authorEmail.charAt(0).toUpperCase()}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 700, color: "#374151", fontSize: "0.95rem" }}>{q.authorUsername ? `@${q.authorUsername}` : q.authorEmail.split("@")[0]}</div>
                                        <div style={{ fontSize: "0.75rem", color: "#9CA3AF", display: "flex", alignItems: "center", gap: "4px" }}>
                                            <Clock size={12} /> {formatTimestamp(q.timestamp)}
                                        </div>
                                    </div>
                                    <div style={{ flex: 1 }} />
                                    {q.type === "card" && (
                                        <button
                                            onClick={() => handleSaveCardToPool(q)}
                                            disabled={savedToPool[q.id]}
                                            style={{ background: savedToPool[q.id] ? "#F3F4F6" : "#E0E7FF", color: savedToPool[q.id] ? "#9CA3AF" : "#4F46E5", border: "none", borderRadius: "8px", padding: "6px 14px", fontSize: "0.85rem", fontWeight: 700, cursor: savedToPool[q.id] ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                                        >
                                            <Bookmark size={14} fill={savedToPool[q.id] ? "currentColor" : "none"} />
                                            {savedToPool[q.id] ? "Havuzunda" : "Havuzuma Ekle"}
                                        </button>
                                    )}
                                    {q.type !== "card" && attempted && (
                                        <button
                                            onClick={() => handleSaveToPool(q)}
                                            disabled={savedToPool[q.id]}
                                            style={{ background: savedToPool[q.id] ? "#F3F4F6" : "#FEF3C7", color: savedToPool[q.id] ? "#9CA3AF" : "#D97706", border: "none", borderRadius: "8px", padding: "6px 14px", fontSize: "0.85rem", fontWeight: 700, cursor: savedToPool[q.id] ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                                        >
                                            <Bookmark size={14} fill={savedToPool[q.id] ? "currentColor" : "none"} />
                                            {savedToPool[q.id] ? "Havuzunda" : "Havuzuma Ekle"}
                                        </button>
                                    )}
                                    {q.authorEmail === user.email && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setPostToDelete(q); }}
                                            style={{ background: "#FEE2E2", color: "#DC2626", border: "none", borderRadius: "8px", padding: "6px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                                            title="Paylaşımı Sil"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>

                                {/* Body */}
                                <div style={{ padding: "20px" }}>
                                    {q.type === "card" ? (
                                        <div 
                                            onClick={() => setFlippedCards(prev => ({ ...prev, [q.id]: !prev[q.id] }))}
                                            style={{ 
                                                perspective: "1000px", 
                                                cursor: "pointer", 
                                                height: "170px",
                                                position: "relative",
                                                width: "100%",
                                                maxWidth: "500px",
                                                margin: "0 auto"
                                            }}
                                        >
                                            <div style={{
                                                position: "relative",
                                                width: "100%",
                                                height: "100%",
                                                textAlign: "center",
                                                transition: "transform 0.6s",
                                                transformStyle: "preserve-3d",
                                                transform: flippedCards[q.id] ? "rotateY(180deg)" : "none"
                                            }}>
                                                {/* Front */}
                                                <div style={{
                                                    position: "absolute",
                                                    width: "100%",
                                                    height: "100%",
                                                    backfaceVisibility: "hidden",
                                                    background: "#F5F3FF",
                                                    borderRadius: "16px",
                                                    border: "1.5px solid #DDD6FE",
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    padding: "20px",
                                                    boxShadow: "0 4px 15px rgba(139, 92, 246, 0.1)"
                                                }}>
                                                    <span style={{ position: "absolute", top: "12px", left: "12px", background: "#8B5CF6", color: "white", fontSize: "0.7rem", fontWeight: 800, padding: "3px 10px", borderRadius: "20px" }}>{q.kategori || "Bilgi Kartı"}</span>
                                                    <p style={{ fontWeight: 800, fontSize: "1.3rem", color: "#111827", margin: 0, lineHeight: 1.3 }}>{q.kavram}</p>
                                                    <div style={{ marginTop: "16px", display: "flex", alignItems: "center", gap: "6px", color: "#8B5CF6", fontSize: "0.75rem", fontWeight: 700, opacity: 0.8 }}>
                                                        <RefreshCw size={12} /> Cevabı görmek için dokun
                                                    </div>
                                                </div>

                                                {/* Back */}
                                                <div style={{
                                                    position: "absolute",
                                                    width: "100%",
                                                    height: "100%",
                                                    backfaceVisibility: "hidden",
                                                    background: "#FFFFFF",
                                                    borderRadius: "16px",
                                                    border: "2px solid #3B82F6",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    padding: "24px",
                                                    transform: "rotateY(180deg)",
                                                    color: "#374151"
                                                }}>
                                                     <p style={{ fontSize: "1rem", lineHeight: 1.6, textAlign: "center", margin: 0, fontWeight: 500 }}>{q.tanim}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <p style={{ fontWeight: 700, color: "#111827", marginBottom: "16px", fontSize: "1.05rem", lineHeight: 1.5 }}>
                                                {q.questionText}
                                            </p>

                                            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                                {q.options.map((opt, j) => {
                                                    const isSelected = attempted?.selected === opt;
                                                    const isCorrect = opt === q.correctAnswer;

                                                    let bg = "#F9FAFB", border = "1px solid #E5E7EB", color = "#374151";
                                                    if (attempted) {
                                                        if (isCorrect) { bg = "#DCFCE7"; border = "1.5px solid #86EFAC"; color = "#166534"; }
                                                        else if (isSelected && !isCorrect) { bg = "#FEE2E2"; border = "1.5px solid #FCA5A5"; color = "#991B1B"; }
                                                    }

                                                    return (
                                                        <button
                                                            key={j}
                                                            onClick={() => handleOptionSelect(q, opt)}
                                                            style={{ padding: "12px 16px", borderRadius: "8px", background: bg, border, color, fontWeight: isSelected || (attempted && isCorrect) ? 600 : 500, cursor: attempted ? "default" : "pointer", textAlign: "left", transition: "all 0.15s", fontSize: "0.95rem" }}
                                                        >
                                                            {opt} {attempted && isCorrect ? "✓" : ""} {attempted && isSelected && !isCorrect ? "✗" : ""}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </>
                                    )}

                                    {/* Explanation shown after attempting */}
                                    {attempted && q.explanation && (
                                        <div style={{ marginTop: "16px", padding: "14px", background: "#EFF6FF", borderLeft: "4px solid #3B82F6", borderRadius: "0 8px 8px 0", color: "#1D4ED8", fontSize: "0.9rem", lineHeight: 1.6 }}>
                                            <strong style={{ display: "block", marginBottom: "4px" }}>Açıklama:</strong>
                                            {q.explanation}
                                        </div>
                                    )}
                                </div>

                                {/* Social Actions */}
                                <div style={{ padding: "12px 20px", display: "flex", alignItems: "center", gap: "20px", borderTop: "1px solid #F3F4F6", background: "#FFFFFF" }}>
                                    <button
                                        onClick={() => handleLike(q.id)}
                                        style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: "6px", color: likedByMe ? "#EF4444" : "#6B7280", fontWeight: 600, fontSize: "0.95rem", cursor: "pointer", padding: 0 }}
                                    >
                                        <Heart size={20} fill={likedByMe ? "#EF4444" : "none"} /> {(q.likes || []).length}
                                    </button>

                                    <button
                                        onClick={() => setShowComments(prev => ({ ...prev, [q.id]: !prev[q.id] }))}
                                        style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: "6px", color: "#6B7280", fontWeight: 600, fontSize: "0.95rem", cursor: "pointer", padding: 0 }}
                                    >
                                        <MessageCircle size={20} /> {(q.comments || []).length}
                                    </button>
                                </div>

                                {/* Comments Section */}
                                {commentsVisible && (
                                    <div style={{ background: "#F9FAFB", padding: "16px 20px", borderTop: "1px solid #F3F4F6" }}>
                                        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "16px" }}>
                                            {(q.comments || []).length === 0 ? (
                                                <div style={{ color: "#9CA3AF", fontSize: "0.85rem", textAlign: "center", padding: "10px 0" }}>İlk yorumu sen yap.</div>
                                            ) : (
                                                (q.comments || []).map((c, idx) => (
                                                    <div key={idx} style={{ display: "flex", gap: "10px" }}>
                                                        <div style={{ position: "relative", width: "28px", height: "28px", flexShrink: 0 }}>
                                                            <img
                                                                src={`${API}/api/user/${encodeURIComponent(c.authorEmail)}/avatar`}
                                                                alt="Avatar"
                                                                onClick={() => setViewAvatarUrl(`${API}/api/user/${encodeURIComponent(c.authorEmail)}/avatar`)}
                                                                style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover", cursor: "zoom-in", border: "1px solid #E5E7EB" }}
                                                                onError={(e) => { e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'flex'; }}
                                                            />
                                                            <div style={{ display: "none", width: "100%", height: "100%", borderRadius: "50%", background: "#E5E7EB", alignItems: "center", justifyContent: "center", color: "#4B5563", fontWeight: 800, fontSize: "0.75rem" }}>
                                                                {c.authorEmail.charAt(0).toUpperCase()}
                                                            </div>
                                                        </div>
                                                        <div style={{ background: "#FFFFFF", padding: "10px 14px", borderRadius: "0 12px 12px 12px", border: "1px solid #E5E7EB", fontSize: "0.9rem", color: "#374151", flex: 1 }}>
                                                            <div style={{ fontWeight: 700, fontSize: "0.8rem", color: "#111827", marginBottom: "2px" }}>{c.authorUsername ? `@${c.authorUsername}` : c.authorEmail.split("@")[0]}</div>
                                                            {c.text}
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>

                                        <div style={{ display: "flex", gap: "8px" }}>
                                            <input
                                                type="text"
                                                placeholder="Yüzüne bir gülümseme bırak..."
                                                value={commentText[q.id] || ""}
                                                onChange={e => setCommentText(prev => ({ ...prev, [q.id]: e.target.value }))}
                                                onKeyDown={e => e.key === "Enter" && handleComment(q.id)}
                                                style={{ flex: 1, padding: "10px 14px", borderRadius: "20px", border: "1px solid #D1D5DB", outline: "none", fontSize: "0.9rem" }}
                                            />
                                            <button
                                                onClick={() => handleComment(q.id)}
                                                disabled={!commentText[q.id]?.trim()}
                                                style={{ background: "#3B82F6", color: "white", border: "none", borderRadius: "50%", width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center", cursor: !commentText[q.id]?.trim() ? "not-allowed" : "pointer", opacity: !commentText[q.id]?.trim() ? 0.6 : 1 }}
                                            >
                                                <Send size={16} style={{ marginLeft: "-2px" }} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* CUSTOM DELETE CONFIRMATION MODAL */}
            {postToDelete && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }} onClick={() => setPostToDelete(null)}>
                    <div style={{ background: "#fff", borderRadius: "16px", padding: "32px", maxWidth: "400px", width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "48px", height: "48px", borderRadius: "50%", background: "#FEE2E2", color: "#DC2626", margin: "0 auto 16px" }}>
                            <Trash2 size={24} />
                        </div>
                        <h3 style={{ margin: "0 0 8px", fontSize: "1.2rem", fontWeight: 800, color: "#111827", textAlign: "center" }}>
                            Paylaşımı Sil
                        </h3>
                        <p style={{ margin: "0 0 24px", fontSize: "0.95rem", color: "#6B7280", lineHeight: 1.5, textAlign: "center" }}>
                            Bu soruyu paylaşımlardan kaldırmak istediğinize emin misiniz? Bu işlem geri alınamaz.
                        </p>
                        <div style={{ display: "flex", gap: "12px" }}>
                            <button
                                onClick={() => setPostToDelete(null)}
                                style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "1px solid #D1D5DB", background: "#F9FAFB", color: "#374151", fontWeight: 700, fontSize: "0.95rem", cursor: "pointer" }}
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleDeletePost}
                                disabled={deleting}
                                style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "none", background: "#EF4444", color: "white", fontWeight: 700, fontSize: "0.95rem", cursor: deleting ? "not-allowed" : "pointer", opacity: deleting ? 0.7 : 1 }}
                            >
                                {deleting ? "Siliniyor..." : "Evet, Sil"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* AVATAR MODAL */}
            {viewAvatarUrl && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(5px)" }} onClick={() => setViewAvatarUrl(null)}>
                    <img
                        src={viewAvatarUrl}
                        alt="Büyük Avatar"
                        onClick={e => e.stopPropagation()}
                        style={{ maxWidth: "90%", maxHeight: "90vh", borderRadius: "16px", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)", objectFit: "contain", border: "4px solid white" }}
                    />
                    <button onClick={() => setViewAvatarUrl(null)} style={{ position: "absolute", top: "20px", right: "20px", background: "white", border: "none", borderRadius: "50%", width: "40px", height: "40px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#374151", boxShadow: "0 4px 6px rgba(0,0,0,0.1)", fontSize: "20px" }}>
                        ✕
                    </button>
                </div>
            )}
        </div>
    );
}
