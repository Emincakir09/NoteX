import React, { useState, useEffect } from "react";
import axios from "axios";
import { Bookmark, ChevronDown, ChevronUp, Trash2, Globe } from "lucide-react";

const API = "http://localhost:8000";

export default function AnalyticsPage({ user, username, initialTab }) {
    const [history, setHistory] = useState([]);
    const [pool, setPool] = useState([]);
    const [cardPool, setCardPool] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState(initialTab === "card_pool" ? "pool" : (initialTab || "history")); // "history" | "pool"
    const [poolTab, setPoolTab] = useState(initialTab === "card_pool" ? "cards" : "questions"); // "questions" | "cards"

    useEffect(() => {
        if (initialTab === "card_pool") {
            setTab("pool");
            setPoolTab("cards");
        } else if (initialTab === "pool") {
            setTab("pool");
            setPoolTab("questions");
        } else if (initialTab) {
            setTab(initialTab);
        }
    }, [initialTab]);

    const [expandedQ, setExpandedQ] = useState(null);
    const [shared, setShared] = useState({});

    const loadData = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const [resHist, resPool, resCards] = await Promise.all([
                axios.get(`${API}/api/user/${encodeURIComponent(user.email)}/quiz-history`).catch(() => ({ data: { history: [] } })),
                axios.get(`${API}/api/user/${encodeURIComponent(user.email)}/question_pool`).catch(() => ({ data: { questions: [] } })),
                axios.get(`${API}/api/user/${encodeURIComponent(user.email)}/card_pool`).catch(() => ({ data: { cards: [] } }))
            ]);
            setHistory(resHist.data.history || []);
            setPool(resPool.data.questions || []);
            setCardPool(resCards.data.cards || []);
        } catch { }
        setLoading(false);
    };

    useEffect(() => { loadData(); }, [user]);

    const deleteFromPool = async (e, qId) => {
        e.stopPropagation();
        if (!qId) {
            alert("Hata: Soru ID'si bulunamadı.");
            return;
        }
        if (!window.confirm("Bu soruyu havuzdan kaldırmak istediğinize emin misiniz?")) return;
        try {
            await axios.delete(`${API}/api/user/${encodeURIComponent(user.email)}/question_pool/${qId}`);
            setPool(p => p.filter(x => x.id !== qId));
        } catch (err) {
            alert("Silinemedi: " + (err.response?.data?.detail || err.message));
        }
    };

    const deleteFromCardPool = async (e, cId) => {
        e.stopPropagation();
        if (!cId) return;
        if (!window.confirm("Bu kartı havuzdan kaldırmak istediğinize emin misiniz?")) return;
        try {
            await axios.delete(`${API}/api/user/${encodeURIComponent(user.email)}/card_pool/${cId}`);
            setCardPool(p => p.filter(x => x.id !== cId));
        } catch (err) {
            alert("Silinemedi: " + err.message);
        }
    };

    const shareToDiscover = async (e, q) => {
        e.stopPropagation();
        if (!username) {
            alert("Keşfet'te paylaşmak için lütfen profilinizden bir Kullanıcı Adı belirleyin.");
            return;
        }
        try {
            await axios.post(`${API}/api/discover`, {
                authorEmail: user.email,
                authorUsername: username,
                type: "question",
                questionText: q.questionText,
                options: q.options || [],
                correctAnswer: q.correctAnswer,
                explanation: q.explanation || ""
            });
            setShared(prev => ({ ...prev, [q.id]: true }));
        } catch (err) {
            alert("Keşfete paylaşılamadı: " + (err.response?.data?.detail || err.message));
        }
    };

    const shareCardToDiscover = async (e, card) => {
        e.stopPropagation();
        if (!username) {
            alert("Keşfet'te paylaşmak için lütfen profilinizden bir Kullanıcı Adı belirleyin.");
            return;
        }
        try {
            await axios.post(`${API}/api/discover`, {
                authorEmail: user.email,
                authorUsername: username,
                type: "card",
                kavram: card.kavram,
                tanim: card.tanim,
                kategori: card.kategori
            });
            setShared(prev => ({ ...prev, [card.id]: true }));
        } catch (err) {
            alert("Keşfete paylaşılamadı: " + (err.response?.data?.detail || err.message));
        }
    };

    const avg = history.length > 0 ? Math.round(history.reduce((a, h) => a + h.percentage, 0) / history.length) : 0;
    const best = history.length > 0 ? Math.max(...history.map(h => h.percentage)) : 0;

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#111827", margin: 0 }}>
                    {initialTab === "card_pool" ? "🃏 Kart Havuzu" : "📊 Analitik ve Havuz"}
                </h2>
                {initialTab !== "card_pool" && (
                    <div style={{ display: "flex", background: "#F3F4F6", borderRadius: "10px", padding: "4px" }}>
                        <button onClick={() => setTab("history")} style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: tab === "history" ? "#FFFFFF" : "transparent", color: tab === "history" ? "#3B82F6" : "#6B7280", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", boxShadow: tab === "history" ? "0 2px 4px rgba(0,0,0,0.05)" : "none", transition: "all 0.2s" }}>
                            📈 İstatistikler
                        </button>
                        <button onClick={() => setTab("pool")} style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: tab === "pool" ? "#FFFFFF" : "transparent", color: tab === "pool" ? "#3B82F6" : "#6B7280", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", boxShadow: tab === "pool" ? "0 2px 4px rgba(0,0,0,0.05)" : "none", transition: "all 0.2s" }}>
                            📚 Soru Havuzu
                        </button>
                    </div>
                )}
            </div>

            {tab === "history" && (
                <>
                    {/* Stats Row */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px", marginBottom: "28px" }}>
                        {[
                            { label: "Toplam Sınav", value: history.length, icon: "📝", color: "#3B82F6" },
                            { label: "Ortalama Puan", value: `%${avg}`, icon: "📈", color: "#10B981" },
                            { label: "En Yüksek Puan", value: `%${best}`, icon: "🏆", color: "#F59E0B" },
                        ].map(s => (
                            <div key={s.label} style={{ background: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: "12px", padding: "18px", textAlign: "center" }}>
                                <div style={{ fontSize: "1.8rem", marginBottom: "6px" }}>{s.icon}</div>
                                <div style={{ fontSize: "1.6rem", fontWeight: 800, color: s.color }}>{s.value}</div>
                                <div style={{ fontSize: "0.8rem", color: "#6B7280", fontWeight: 500, marginTop: "4px" }}>{s.label}</div>
                            </div>
                        ))}
                    </div>

                    {/* History List */}
                    <h3 style={{ fontWeight: 700, color: "#374151", marginBottom: "14px", fontSize: "1rem" }}>Son Sınavlar</h3>
                    {loading && <p style={{ color: "#9CA3AF" }}>Yükleniyor...</p>}
                    {!loading && history.length === 0 && (
                        <div style={{ textAlign: "center", padding: "50px", color: "#9CA3AF" }}>
                            <div style={{ fontSize: "3rem", marginBottom: "12px" }}>📊</div>
                            <p>Henüz tamamlanmış sınav yok. Quiz sekmesinde ilk sınavınızı yapın!</p>
                        </div>
                    )}
                    {!loading && history.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            {history.map((h, i) => {
                                const color = h.percentage >= 80 ? "#10B981" : h.percentage >= 50 ? "#F59E0B" : "#EF4444";
                                return (
                                    <div key={i} style={{ background: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: "12px", padding: "14px 18px", display: "flex", alignItems: "center", gap: "16px" }}>
                                        <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: `${color}15`, border: `2px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color, fontSize: "0.9rem", flexShrink: 0 }}>
                                            %{h.percentage}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 600, color: "#111827", fontSize: "0.9rem" }}>{h.score}/{h.total} doğru</div>
                                            <div style={{ fontSize: "0.78rem", color: "#9CA3AF", marginTop: "3px" }}>
                                                Kaynaklar: {(h.documents || []).join(", ") || "Genel"}
                                            </div>
                                        </div>
                                        {/* Progress bar */}
                                        <div style={{ width: "100px", background: "#F3F4F6", borderRadius: "10px", height: "8px", overflow: "hidden" }}>
                                            <div style={{ height: "100%", width: `${h.percentage}%`, background: color, borderRadius: "10px" }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {tab === "pool" && (
                <>
                    <div style={{ display: "flex", gap: "15px", marginBottom: "20px", borderBottom: "1px solid #E5E7EB" }}>
                        <button onClick={() => setPoolTab("questions")} style={{ background: "none", border: "none", padding: "10px 5px", cursor: "pointer", color: poolTab === "questions" ? "#3B82F6" : "#6B7280", fontWeight: poolTab === "questions" ? 700 : 600, fontSize: "0.9rem", borderBottom: poolTab === "questions" ? "2px solid #3B82F6" : "2px solid transparent", marginBottom: "-1px", transition: "0.2s" }}>❓ Soru Havuzu</button>
                        <button onClick={() => setPoolTab("cards")} style={{ background: "none", border: "none", padding: "10px 5px", cursor: "pointer", color: poolTab === "cards" ? "#3B82F6" : "#6B7280", fontWeight: poolTab === "cards" ? 700 : 600, fontSize: "0.9rem", borderBottom: poolTab === "cards" ? "2px solid #3B82F6" : "2px solid transparent", marginBottom: "-1px", transition: "0.2s" }}>🃏 Kart Havuzu</button>
                    </div>

                    {poolTab === "questions" && (
                        <>
                            <p style={{ color: "#6B7280", fontSize: "0.9rem", marginBottom: "16px" }}>Sınavlarda "Havuza Ekle" diyerek kaydettiğiniz sorular. Öğrenmek için üzerine tıklayın.</p>
                            {loading && <p style={{ color: "#9CA3AF" }}>Yükleniyor...</p>}
                            {!loading && pool.length === 0 && (
                                <div style={{ textAlign: "center", padding: "50px", color: "#9CA3AF" }}>
                                    <div style={{ fontSize: "3rem", marginBottom: "12px", opacity: 0.5 }}>📚</div>
                                    <p>Havuzda hiç soru yok. Sınavlarda beğendiğiniz soruları havuza alabilirsiniz.</p>
                                </div>
                            )}
                            {!loading && pool.length > 0 && (
                                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                    {pool.map((q, i) => {
                                        const isExpanded = expandedQ === q.id;
                                        return (
                                            <div key={q.id || i} style={{ background: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: "12px", overflow: "hidden" }}>
                                                <div
                                                    onClick={() => setExpandedQ(isExpanded ? null : q.id)}
                                                    style={{ padding: "16px", display: "flex", alignItems: "flex-start", gap: "12px", cursor: "pointer", background: isExpanded ? "#EFF6FF" : "transparent", transition: "0.2s" }}
                                                >
                                                    <Bookmark size={16} fill="#3B82F6" color="#3B82F6" style={{ marginTop: "2px", flexShrink: 0 }} />
                                                    <div style={{ flex: 1, fontWeight: 600, color: "#111827", fontSize: "0.95rem", lineHeight: 1.5 }}>
                                                        {q.questionText}
                                                    </div>
                                                    <button onClick={(e) => deleteFromPool(e, q.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", padding: "4px", borderRadius: "4px" }} onMouseOver={e => e.currentTarget.style.color = "#EF4444"} onMouseOut={e => e.currentTarget.style.color = "#9CA3AF"} title="Havuzdan Sil">
                                                        <Trash2 size={16} />
                                                    </button>
                                                    <div style={{ color: "#9CA3AF" }}>{isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</div>
                                                </div>

                                                {isExpanded && (
                                                    <div style={{ padding: "0 16px 16px 44px", borderTop: "1px solid #E5E7EB", background: "#EFF6FF" }}>
                                                        <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                                                            {(q.options || [q.correctAnswer]).map((opt, idx) => {
                                                                const isCorrect = opt === q.correctAnswer;
                                                                return (
                                                                    <div
                                                                        key={idx}
                                                                        style={{
                                                                            padding: "10px 14px",
                                                                            borderRadius: "8px",
                                                                            background: isCorrect ? "#DCFCE7" : "#FFFFFF",
                                                                            border: isCorrect ? "1.5px solid #86EFAC" : "1px solid #D1D5DB",
                                                                            color: isCorrect ? "#166534" : "#374151",
                                                                            fontWeight: isCorrect ? 600 : 500,
                                                                            fontSize: "0.95rem"
                                                                        }}
                                                                    >
                                                                        {opt} {isCorrect ? "✅" : ""}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>

                                                        {q.explanation && (
                                                            <div style={{ padding: "12px", background: "#FFFFFF", borderLeft: "4px solid #3B82F6", borderRadius: "0 8px 8px 0", color: "#1E3A8A", fontSize: "0.9rem", lineHeight: 1.5, marginTop: "16px" }}>
                                                                <strong style={{ display: "block", marginBottom: "4px" }}>Açıklama:</strong>
                                                                {q.explanation}
                                                            </div>
                                                        )}

                                                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
                                                            <button
                                                                onClick={(e) => shareToDiscover(e, q)}
                                                                disabled={shared[q.id]}
                                                                style={{ background: shared[q.id] ? "#F3F4F6" : "#E0E7FF", color: shared[q.id] ? "#9CA3AF" : "#4F46E5", border: "none", borderRadius: "8px", padding: "8px 14px", fontSize: "0.85rem", fontWeight: 700, cursor: shared[q.id] ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "6px", transition: "0.2s" }}
                                                            >
                                                                <Globe size={16} />
                                                                {shared[q.id] ? "Keşfet'te Paylaşıldı" : "Keşfet'te Paylaş"}
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}

                    {poolTab === "cards" && (
                        <>
                            <p style={{ color: "#6B7280", fontSize: "0.9rem", marginBottom: "16px" }}>Bilgi kartlarınızdan havuzunuza eklediğiniz kartlar. Üzerine tıklayarak tanımı görebilirsiniz.</p>
                            {loading && <p style={{ color: "#9CA3AF" }}>Yükleniyor...</p>}
                            {!loading && cardPool.length === 0 && (
                                <div style={{ textAlign: "center", padding: "50px", color: "#9CA3AF" }}>
                                    <div style={{ fontSize: "3rem", marginBottom: "12px", opacity: 0.5 }}>🃏</div>
                                    <p>Kart havuzunuz boş. Bilgi Kartları sekmesinden ekleme yapabilirsiniz.</p>
                                </div>
                            )}
                            {!loading && cardPool.length > 0 && (
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
                                    {cardPool.map((c, i) => {
                                        const isExpanded = expandedQ === c.id;
                                        return (
                                            <div key={c.id || i} style={{ background: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: "14px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                                                <div
                                                    onClick={() => setExpandedQ(isExpanded ? null : c.id)}
                                                    style={{ padding: "16px", cursor: "pointer", flex: 1, display: "flex", flexDirection: "column", gap: "12px", background: isExpanded ? "#F5F3FF" : "transparent" }}
                                                >
                                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                                        <span style={{ background: "#8B5CF6", color: "white", fontSize: "0.65rem", fontWeight: 800, padding: "2px 8px", borderRadius: "10px" }}>{c.kategori}</span>
                                                        <div style={{ display: "flex", gap: "4px" }}>
                                                            <button onClick={(e) => deleteFromCardPool(e, c.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF" }} onMouseOver={e => e.currentTarget.style.color = "#EF4444"} onMouseOut={e => e.currentTarget.style.color = "#9CA3AF"}>
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div style={{ fontWeight: 700, color: "#111827", textAlign: "center", fontSize: "1.05rem" }}>{c.kavram}</div>
                                                    {isExpanded && (
                                                        <div style={{ fontSize: "0.85rem", color: "#4B5563", borderTop: "1px solid #DDD6FE", paddingTop: "12px", lineHeight: 1.5 }}>
                                                            {c.tanim}
                                                        </div>
                                                    )}
                                                </div>
                                                <div style={{ padding: "8px 16px", borderTop: "1px solid #F3F4F6", display: "flex", justifyContent: "flex-end" }}>
                                                    <button
                                                        onClick={(e) => shareCardToDiscover(e, c)}
                                                        disabled={shared[c.id]}
                                                        style={{ background: "none", border: "none", color: shared[c.id] ? "#9CA3AF" : "#6366F1", fontSize: "0.75rem", fontWeight: 700, cursor: shared[c.id] ? "default" : "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                                                    >
                                                        <Globe size={12} /> {shared[c.id] ? "Paylaşıldı" : "Paylaş"}
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}
                </>
            )}
        </div>
    );
}
