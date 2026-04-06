import React, { useState, useEffect } from "react";
import axios from "axios";
import { Bookmark, Clock, Check } from "lucide-react";

const API = "http://localhost:8000";

function FlashCard({ card, user }) {
    const [flipped, setFlipped] = useState(false);
    const [saved, setSaved] = useState(false);
    const catColors = { "Tanım": "#3B82F6", "Yöntem": "#10B981", "İlke": "#8B5CF6", "Formül": "#F59E0B", "Tarih": "#EF4444", "Şahsiyet": "#EC4899" };
    const catColor = catColors[card.kategori] || "#6B7280";

    const handleSave = async (e) => {
        e.stopPropagation();
        if (saved) return;
        try {
            await axios.post(`${API}/api/user/${encodeURIComponent(user.email)}/card_pool`, {
                kavram: card.kavram,
                tanim: card.tanim,
                kategori: card.kategori
            });
            setSaved(true);
        } catch (err) {
            alert("Havuza eklenemedi: " + err.message);
        }
    };

    return (
        <div
            onClick={() => setFlipped(f => !f)}
            style={{
                cursor: "pointer", minHeight: "180px", borderRadius: "14px", display: "flex", flexDirection: "column", justifyContent: "space-between",
                padding: "20px", border: `2px solid ${flipped ? catColor : "#E5E7EB"}`,
                background: flipped ? `${catColor}15` : "#FFFFFF",
                boxShadow: flipped ? `0 4px 14px ${catColor}30` : "0 2px 6px rgba(0,0,0,0.04)",
                transition: "all 0.25s ease",
                position: "relative"
            }}
        >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                <span style={{ background: catColor, color: "white", fontSize: "0.7rem", fontWeight: 700, padding: "3px 10px", borderRadius: "20px" }}>{card.kategori}</span>
                <div style={{ display: "flex", gap: "8px" }}>
                    <button 
                        onClick={handleSave}
                        style={{ background: saved ? "#DCFCE7" : "#F3F4F6", color: saved ? "#10B981" : "#6B7280", border: "none", borderRadius: "6px", width: "24px", height: "24px", display: "flex", alignItems: "center", justifyContent: "center", cursor: saved ? "default" : "pointer" }}
                        title={saved ? "Havuzunuzda" : "Havuza Ekle"}
                    >
                        {saved ? <Check size={14} strokeWidth={3} /> : <Bookmark size={14} />}
                    </button>
                    <span style={{ fontSize: "0.7rem", color: "#9CA3AF", fontWeight: 500 }}>{flipped ? "👆" : "👆"}</span>
                </div>
            </div>

            {!flipped ? (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <p style={{ fontWeight: 700, fontSize: "1.1rem", color: "#111827", textAlign: "center", margin: 0, lineHeight: 1.4 }}>{card.kavram}</p>
                </div>
            ) : (
                <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
                    <p style={{ fontSize: "0.88rem", color: "#374151", lineHeight: 1.6, margin: 0 }}>{card.tanim}</p>
                </div>
            )}
        </div>
    );
}

export default function FlashcardsPage({ user, selectedDocs, researchId }) {
    const [cards, setCards] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (researchId) {
            axios.get(`${API}/api/cards/${encodeURIComponent(user.email)}/${researchId}`)
                .then(res => { if (res.data.cards?.length) setCards(res.data.cards); })
                .catch(() => { });
        }
    }, [researchId]);

    const generateCards = async () => {
        if (selectedDocs.length === 0) { setError("⚠️ Lütfen en az bir belge seçin."); return; }
        setLoading(true); setError(""); setCards([]);
        try {
            const res = await axios.post(`${API}/api/cards/generate`, { email: user.email, selected_docs: selectedDocs });
            setCards(res.data.cards);
            if (researchId) {
                axios.post(`${API}/api/cards/save`, { email: user.email, research_id: researchId, cards: res.data.cards }).catch(() => { });
            }
        } catch (err) {
            setError("❌ " + (err.response?.data?.detail || err.message));
        }
        setLoading(false);
    };

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
                <div>
                    <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#111827", margin: "0 0 4px" }}>🃏 Bilgi Kartları</h2>
                    <p style={{ color: "#6B7280", margin: 0, fontSize: "0.9rem" }}>Belgeyi kartlara böl, kavramları eğlenceli öğren. Karta tıkla → Tanımı gör!</p>
                </div>
                <button onClick={generateCards} disabled={loading} style={{ padding: "10px 22px", borderRadius: "8px", border: "none", background: "linear-gradient(135deg, #8B5CF6, #6D28D9)", color: "white", fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 8px rgba(139,92,246,0.3)" }}>
                    {loading ? "⏳ Oluşturuluyor..." : cards.length > 0 ? "🔁 Yenile" : "✨ Kart Oluştur"}
                </button>
            </div>

            {error && <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", color: "#DC2626", borderRadius: "10px", padding: "12px 16px", marginBottom: "16px", fontWeight: 500 }}>{error}</div>}

            {loading && (
                <div style={{ textAlign: "center", padding: "60px", color: "#6B7280" }}>
                    <div style={{ fontSize: "3rem", marginBottom: "16px" }}>🃏</div>
                    <p style={{ fontWeight: 600 }}>Kartlar hazırlanıyor...</p>
                </div>
            )}

            {cards.length > 0 && (
                <>
                    <p style={{ color: "#6B7280", fontSize: "0.85rem", marginBottom: "16px" }}>{cards.length} kart oluşturuldu. Kartlara tıklayarak açıklama görebilirsiniz.</p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "14px" }}>
                        {cards.map((card, i) => <FlashCard key={i} card={card} user={user} />)}
                    </div>
                </>
            )}

            {cards.length === 0 && !loading && (
                <div style={{ textAlign: "center", padding: "60px", color: "#9CA3AF" }}>
                    <div style={{ fontSize: "4rem", marginBottom: "12px" }}>🃏</div>
                    <p style={{ fontSize: "1rem", fontWeight: 500 }}>Belge seçip "Kart Oluştur" butonuna basın.</p>
                </div>
            )}
        </div>
    );
}
