import React, { useState } from "react";
import axios from "axios";
import { Bookmark } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function QuizPage({ user, username, selectedDocs }) {
    const [quiz, setQuiz] = useState([]);
    const [answers, setAnswers] = useState({});
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [score, setScore] = useState(0);
    const [savedToPool, setSavedToPool] = useState({});
    const [sharedToDiscover, setSharedToDiscover] = useState({});

    const addToPool = async (index) => {
        const q = quiz[index];
        try {
            await axios.post(`${API}/api/user/${encodeURIComponent(user.email)}/question_pool`, {
                questionText: q.soru,
                options: q.secenekler,
                correctAnswer: q.dogru_cevap,
                explanation: q.aciklama || ""
            });
            setSavedToPool(prev => ({ ...prev, [index]: true }));
        } catch (err) {
            alert("Havuza eklenemedi: " + (err.response?.data?.detail || err.message));
        }
    };

    const shareToDiscover = async (index) => {
        const q = quiz[index];
        try {
            await axios.post(`${API}/api/discover`, {
                authorEmail: user.email,
                authorUsername: username,
                questionText: q.soru,
                options: q.secenekler,
                correctAnswer: q.dogru_cevap,
                explanation: q.aciklama || ""
            });
            setSharedToDiscover(prev => ({ ...prev, [index]: true }));
        } catch (err) {
            alert("Paylaşılamadı: " + (err.response?.data?.detail || err.message));
        }
    };

    const generateQuiz = async () => {
        if (selectedDocs.length === 0) {
            setError("⚠️ Lütfen önce en az bir belge seçin.");
            return;
        }
        setLoading(true);
        setError("");
        setQuiz([]);
        setAnswers({});
        setSubmitted(false);

        try {
            const res = await axios.post(`${API}/api/quiz/generate`, {
                email: user.email,
                selected_docs: selectedDocs
            });
            setQuiz(res.data.quiz);
        } catch (err) {
            setError("❌ " + (err.response?.data?.detail || err.message));
        }
        setLoading(false);
    };

    const submitQuiz = async () => {
        let s = 0;
        quiz.forEach((q, i) => {
            if (answers[i] === q.dogru_cevap) s++;
        });
        setScore(s);
        setSubmitted(true);
        // Skoru kaydet
        try {
            await axios.post(`${API}/api/quiz/save-score`, {
                email: user.email,
                score: s,
                total: quiz.length,
                documents: selectedDocs
            });
        } catch { }
    };

    const reset = () => {
        setQuiz([]);
        setAnswers({});
        setSubmitted(false);
        setScore(0);
        setError("");
        setSavedToPool({});
        setSharedToDiscover({});
    };

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
                <div>
                    <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#111827", margin: "0 0 4px" }}>📝 Sınav Hazırla</h2>
                    <p style={{ color: "#6B7280", margin: 0, fontSize: "0.9rem" }}>Seçili belgelerden {quiz.length > 0 ? quiz.length : 5} soruluk sınav oluştur.</p>
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                    {quiz.length > 0 && !submitted && (
                        <button onClick={reset} style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid #D1D5DB", background: "#F9FAFB", fontWeight: 600, cursor: "pointer", color: "#374151" }}>
                            Sıfırla
                        </button>
                    )}
                    <button
                        onClick={submitted ? reset : (quiz.length === 0 ? generateQuiz : submitQuiz)}
                        disabled={loading}
                        style={{ padding: "10px 22px", borderRadius: "8px", border: "none", background: "linear-gradient(135deg, #3B82F6, #1E3A8A)", color: "white", fontWeight: 700, cursor: "pointer", fontSize: "0.95rem", boxShadow: "0 4px 8px rgba(59,130,246,0.3)" }}
                    >
                        {loading ? "⏳ Oluşturuluyor..." : submitted ? "🔁 Yeni Sınav" : quiz.length === 0 ? "🚀 Sınav Oluştur" : "📊 Sonuçları Gör"}
                    </button>
                </div>
            </div>

            {error && (
                <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", color: "#DC2626", borderRadius: "10px", padding: "12px 16px", marginBottom: "16px", fontWeight: 500 }}>
                    {error}
                </div>
            )}

            {loading && (
                <div style={{ textAlign: "center", padding: "60px", color: "#6B7280" }}>
                    <div style={{ fontSize: "3rem", marginBottom: "16px" }}>🧠</div>
                    <p style={{ fontWeight: 600 }}>Yapay Zeka soruları hazırlıyor...</p>
                </div>
            )}

            {/* Score Banner */}
            {submitted && (
                <div style={{
                    background: score / quiz.length >= 0.8 ? "#F0FDF4" : score / quiz.length >= 0.5 ? "#FFFBEB" : "#FEF2F2",
                    border: `2px solid ${score / quiz.length >= 0.8 ? "#86EFAC" : score / quiz.length >= 0.5 ? "#FDE68A" : "#FCA5A5"}`,
                    borderRadius: "14px", padding: "20px 24px", marginBottom: "24px", textAlign: "center"
                }}>
                    <div style={{ fontSize: "3rem" }}>{score / quiz.length >= 0.8 ? "🏆" : score / quiz.length >= 0.5 ? "👍" : "📚"}</div>
                    <div style={{ fontSize: "2rem", fontWeight: 800, color: "#111827", margin: "8px 0" }}>{score} / {quiz.length}</div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 600, color: "#374151" }}>%{Math.round((score / quiz.length) * 100)} Başarı</div>
                </div>
            )}

            {/* Questions */}
            {quiz.length > 0 && !loading && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {quiz.map((q, i) => (
                        <div key={i} style={{
                            background: submitted ? (answers[i] === q.dogru_cevap ? "#F0FDF4" : "#FEF2F2") : "#FFFFFF",
                            border: `1.5px solid ${submitted ? (answers[i] === q.dogru_cevap ? "#86EFAC" : "#FCA5A5") : "#E5E7EB"}`,
                            borderRadius: "12px", padding: "20px 22px"
                        }}>
                            <p style={{ fontWeight: 700, color: "#111827", marginBottom: "14px", fontSize: "0.95rem", lineHeight: 1.5 }}>
                                {i + 1}. {q.soru}
                            </p>
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                {q.secenekler.map((opt, j) => {
                                    const isSelected = answers[i] === opt;
                                    const isCorrect = opt === q.dogru_cevap;
                                    let bg = "#F9FAFB", border = "1px solid #E5E7EB", color = "#374151";
                                    if (submitted) {
                                        if (isCorrect) { bg = "#DCFCE7"; border = "1.5px solid #86EFAC"; color = "#166534"; }
                                        else if (isSelected && !isCorrect) { bg = "#FEE2E2"; border = "1.5px solid #FCA5A5"; color = "#991B1B"; }
                                    } else if (isSelected) {
                                        bg = "#EFF6FF"; border = "1.5px solid #3B82F6"; color = "#1E3A8A";
                                    }
                                    return (
                                        <button key={j} onClick={() => !submitted && setAnswers(a => ({ ...a, [i]: opt }))} style={{ padding: "10px 14px", borderRadius: "8px", background: bg, border, color, fontWeight: isSelected || (submitted && isCorrect) ? 600 : 400, cursor: submitted ? "default" : "pointer", textAlign: "left", transition: "all 0.15s" }}>
                                            {opt} {submitted && isCorrect ? "✓" : ""} {submitted && isSelected && !isCorrect ? "✗" : ""}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Havuza Ekle ve Paylaş Butonları */}
                            {submitted && (
                                <div style={{ marginTop: "14px", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                                    <button 
                                        onClick={() => shareToDiscover(i)}
                                        disabled={sharedToDiscover[i]}
                                        style={{ 
                                            background: sharedToDiscover[i] ? "#F3F4F6" : "#E0E7FF", 
                                            color: sharedToDiscover[i] ? "#9CA3AF" : "#4F46E5", 
                                            border: "none", borderRadius: "8px", padding: "6px 12px", 
                                            fontSize: "0.8rem", fontWeight: 700, cursor: sharedToDiscover[i] ? "not-allowed" : "pointer",
                                            display: "flex", alignItems: "center", gap: "6px", transition: "0.2s" 
                                        }}
                                        onMouseOver={e => !sharedToDiscover[i] && (e.currentTarget.style.background = "#C7D2FE")}
                                        onMouseOut={e => !sharedToDiscover[i] && (e.currentTarget.style.background = "#E0E7FF")}
                                        title="Bu soruyu Topluluk ile paylaş"
                                    >
                                        🌍 {sharedToDiscover[i] ? "Paylaşıldı" : "Keşfet'te Paylaş"}
                                    </button>

                                    <button 
                                        onClick={() => addToPool(i)}
                                        disabled={savedToPool[i]}
                                        style={{ 
                                            background: savedToPool[i] ? "#F3F4F6" : "#FEF3C7", 
                                            color: savedToPool[i] ? "#9CA3AF" : "#D97706", 
                                            border: "none", borderRadius: "8px", padding: "6px 12px", 
                                            fontSize: "0.8rem", fontWeight: 700, cursor: savedToPool[i] ? "not-allowed" : "pointer",
                                            display: "flex", alignItems: "center", gap: "6px", transition: "0.2s" 
                                        }}
                                        onMouseOver={e => !savedToPool[i] && (e.currentTarget.style.background = "#FDE68A")}
                                        onMouseOut={e => !savedToPool[i] && (e.currentTarget.style.background = "#FEF3C7")}
                                        title="Bu soruyu tekrar yapmak için Soru Havuzu'na kaydet"
                                    >
                                        <Bookmark size={14} fill={savedToPool[i] ? "currentColor" : "none"} />
                                        {savedToPool[i] ? "Havuzda" : "Havuza Ekle"}
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
