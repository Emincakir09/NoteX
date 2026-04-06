import React, { useState } from "react";
import axios from "axios";
import "./auth.css";

const API = "http://localhost:8000";

export default function AuthPage({ onLogin }) {
    const [tab, setTab] = useState("login"); // "login" | "register"
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");

        if (!email || !password) {
            setError("Lütfen e-posta ve şifreyi girin.");
            return;
        }

        if (password.length < 6) {
            setError("Şifre en az 6 karakter olmalıdır.");
            return;
        }

        setLoading(true);
        try {
            const endpoint = tab === "login" ? "/api/auth/login" : "/api/auth/register";
            const res = await axios.post(`${API}${endpoint}`, { email, password });

            if (res.data.success) {
                if (tab === "register") {
                    setSuccess("✅ Hesap oluşturuldu! Giriş yapabilirsiniz.");
                    setTab("login");
                } else {
                    // Giriş başarılı → kullanıcı bilgilerini üst bileşene aktar
                    const userData = res.data.user;
                    onLogin({
                        email: userData.email,
                        idToken: userData.idToken,
                        localId: userData.localId
                    });
                }
            }
        } catch (err) {
            const detail = err.response?.data?.detail || err.message || "Bir hata oluştu.";
            // Firebase hata mesajlarını Türkçe'ye çevir
            if (detail.includes("INVALID_PASSWORD") || detail.includes("INVALID_LOGIN_CREDENTIALS")) {
                setError("❌ E-posta veya şifre hatalı.");
            } else if (detail.includes("EMAIL_EXISTS")) {
                setError("❌ Bu e-posta zaten kayıtlı. Giriş yapmayı deneyin.");
            } else if (detail.includes("USER_NOT_FOUND")) {
                setError("❌ Hesap bulunamadı. Önce kayıt olun.");
            } else if (detail.includes("TOO_MANY_ATTEMPTS")) {
                setError("❌ Çok fazla deneme. Lütfen biraz bekleyin.");
            } else {
                setError(`❌ Hata: ${detail.substring(0, 120)}`);
            }
        }
        setLoading(false);
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                {/* Logo ve Başlık */}
                <div className="auth-logo">
                    <img src="/logo.png" alt="NoteX Logo" className="auth-logo-img" />
                    <h1>NoteX</h1>
                    <p>AI Powered Learning Platform</p>
                </div>

                {/* Login / Register Sekmeleri */}
                <div className="auth-tabs">
                    <button
                        className={`auth-tab ${tab === "login" ? "active" : ""}`}
                        onClick={() => { setTab("login"); setError(""); setSuccess(""); }}
                    >
                        Giriş Yap
                    </button>
                    <button
                        className={`auth-tab ${tab === "register" ? "active" : ""}`}
                        onClick={() => { setTab("register"); setError(""); setSuccess(""); }}
                    >
                        Kayıt Ol
                    </button>
                </div>

                {/* Form */}
                <form className="auth-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">E-Posta Adresi</label>
                        <input
                            type="email"
                            className="form-input"
                            placeholder="ornek@email.com"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            autoComplete="email"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Şifre</label>
                        <input
                            type="password"
                            className="form-input"
                            placeholder={tab === "register" ? "En az 6 karakter" : "Şifreniz"}
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            autoComplete={tab === "login" ? "current-password" : "new-password"}
                        />
                    </div>

                    {error && <div className="auth-error">{error}</div>}
                    {success && <div className="auth-success">{success}</div>}

                    <button className="auth-submit-btn" type="submit" disabled={loading}>
                        {loading ? "Bekleniyor..." : tab === "login" ? "Giriş Yap" : "Hesap Oluştur"}
                    </button>
                </form>

                <div className="auth-footer">
                    Verileriniz Firebase ile güvende saklanmaktadır.
                </div>
            </div>
        </div>
    );
}
