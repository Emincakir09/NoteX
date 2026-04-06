import React, { useState, useRef } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

const ACCEPTED_EXTENSIONS = ".pdf,.docx,.doc,.txt,.wav,.mp3,.ogg,.m4a,.webm";

function getFileIcon(name) {
    if (name.startsWith("YouTube")) return "📺";
    const ext = name.split(".").pop().toLowerCase();
    if (ext === "pdf") return "📄";
    if (["docx", "doc"].includes(ext)) return "📝";
    if (ext === "txt") return "📃";
    if (["wav", "mp3", "ogg", "m4a", "webm"].includes(ext)) return "🎵";
    return "📎";
}

export default function DocManager({ user, documents, onDocsChange, selectedDocs, onSelectionChange }) {
    const [uploading, setUploading] = useState(false);
    const [uploadMsg, setUploadMsg] = useState("");
    const [dragOver, setDragOver] = useState(false);
    const [uploadProgress, setUploadProgress] = useState("");
    const [ytLink, setYtLink] = useState("");
    const fileRef = useRef();

    const handleUpload = async (files) => {
        if (!files || files.length === 0) return;
        setUploading(true);
        setUploadMsg("");

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const ext = file.name.split(".").pop().toLowerCase();
            const allowed = ["pdf", "docx", "doc", "txt", "wav", "mp3", "ogg", "m4a", "webm"];
            if (!allowed.includes(ext)) {
                setUploadMsg(`❌ Desteklenmeyen dosya: .${ext}. Desteklenen: PDF, Word, TXT, WAV, MP3, OGG, M4A`);
                continue;
            }

            setUploadProgress(files.length > 1
                ? `⏳ ${file.name} yükleniyor… (${i + 1}/${files.length})`
                : `⏳ ${file.name} yükleniyor…`
            );

            const formData = new FormData();
            formData.append("email", user.email);
            formData.append("file", file);

            try {
                const res = await axios.post(`${API}/api/upload/document`, formData, {
                    headers: { "Content-Type": "multipart/form-data" },
                    timeout: 120000 // 2 dakika (ses dosyaları uzun sürebilir)
                });
                setUploadMsg(`✅ ${res.data.filename} başarıyla yüklendi!`);
                onDocsChange();
            } catch (err) {
                setUploadMsg("❌ Yükleme hatası: " + (err.response?.data?.detail || err.message));
            }
        }
        setUploadProgress("");
        setUploading(false);
    };

    const handleYoutubeUpload = async () => {
        if (!ytLink) return;
        setUploading(true);
        setUploadProgress("⏳ YouTube altyazısı indiriliyor...");
        setUploadMsg("");
        try {
            const res = await axios.post(`${API}/api/upload/youtube`, { email: user.email, url: ytLink });
            setUploadMsg(`✅ ${res.data.filename} eklendi!`);
            setYtLink("");
            onDocsChange();
        } catch (err) {
            setUploadMsg("❌ " + (err.response?.data?.detail || err.message));
        }
        setUploadProgress("");
        setUploading(false);
    };

    const toggleDoc = (docName) => {
        if (selectedDocs.includes(docName)) {
            onSelectionChange(selectedDocs.filter(d => d !== docName));
        } else {
            onSelectionChange([...selectedDocs, docName]);
        }
    };

    const selectAll = () => onSelectionChange([...documents]);
    const deselectAll = () => onSelectionChange([]);

    return (
        <div>
            {/* Upload area */}
            <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files); }}
                onClick={() => fileRef.current.click()}
                style={{
                    border: `2px dashed ${dragOver ? "#3B82F6" : "#D1D5DB"}`,
                    borderRadius: "12px",
                    padding: "28px 16px",
                    textAlign: "center",
                    cursor: "pointer",
                    background: dragOver ? "#EFF6FF" : "#FAFAFA",
                    marginBottom: "16px",
                    transition: "all 0.2s"
                }}
            >
                <div style={{ fontSize: "2.2rem", marginBottom: "8px" }}>📂</div>
                <p style={{ fontWeight: 600, color: "#374151", margin: 0, fontSize: "0.88rem" }}>Dosya yüklemek için tıklayın veya sürükleyin</p>
                <p style={{ fontSize: "0.75rem", color: "#9CA3AF", margin: "6px 0 0", lineHeight: 1.5 }}>
                    Desteklenen: PDF, Word, TXT, Ses (WAV, MP3, OGG, M4A)
                </p>
                <input ref={fileRef} type="file" accept={ACCEPTED_EXTENSIONS} multiple style={{ display: "none" }} onChange={e => handleUpload(e.target.files)} />
            </div>

            <div style={{ display: "flex", gap: "8px", marginTop: "12px", marginBottom: "16px", width: "100%", boxSizing: "border-box" }}>
                <input
                    type="text"
                    placeholder="▶️ YouTube linki yapıştırın..."
                    value={ytLink}
                    onChange={e => setYtLink(e.target.value)}
                    style={{ flex: 1, minWidth: 0, padding: "10px 12px", borderRadius: "8px", border: "1px solid #D1D5DB", outline: "none", fontSize: "0.85rem", boxSizing: "border-box" }}
                    onKeyDown={e => e.key === "Enter" && handleYoutubeUpload()}
                />
                <button
                    onClick={handleYoutubeUpload}
                    disabled={uploading || !ytLink}
                    style={{ background: "#EF4444", color: "white", border: "none", borderRadius: "8px", padding: "0 14px", fontWeight: 600, cursor: uploading || !ytLink ? "not-allowed" : "pointer", opacity: uploading || !ytLink ? 0.6 : 1, transition: "0.2s", flexShrink: 0, boxSizing: "border-box" }}
                >
                    Ekle
                </button>
            </div>

            {(uploading || uploadProgress) && (
                <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "8px", padding: "10px 14px", marginBottom: "12px", color: "#1E3A8A", fontWeight: 500, fontSize: "0.85rem" }}>
                    {uploadProgress || "⏳ Yükleniyor ve işleniyor..."}
                </div>
            )}
            {uploadMsg && !uploading && (
                <div style={{ background: uploadMsg.startsWith("✅") ? "#F0FDF4" : "#FEF2F2", border: `1px solid ${uploadMsg.startsWith("✅") ? "#86EFAC" : "#FCA5A5"}`, borderRadius: "8px", padding: "10px 14px", marginBottom: "12px", color: uploadMsg.startsWith("✅") ? "#16A34A" : "#DC2626", fontWeight: 500, fontSize: "0.85rem" }}>
                    {uploadMsg}
                </div>
            )}

            {/* Document list */}
            {documents.length > 0 && (
                <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                        <p style={{ fontWeight: 700, fontSize: "0.9rem", color: "#374151", margin: 0 }}>📋 Yüklü Kaynaklar ({documents.length})</p>
                        <div style={{ display: "flex", gap: "8px" }}>
                            <button onClick={selectAll} style={{ fontSize: "0.75rem", padding: "4px 10px", borderRadius: "6px", border: "1px solid #D1D5DB", background: "#F9FAFB", cursor: "pointer", fontWeight: 600 }}>Tümünü Seç</button>
                            <button onClick={deselectAll} style={{ fontSize: "0.75rem", padding: "4px 10px", borderRadius: "6px", border: "1px solid #D1D5DB", background: "#F9FAFB", cursor: "pointer", fontWeight: 600 }}>Seçimi Kaldır</button>
                        </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {documents.map(doc => (
                            <div
                                key={doc}
                                onClick={() => toggleDoc(doc)}
                                style={{
                                    display: "flex", alignItems: "center", gap: "10px",
                                    padding: "10px 14px", borderRadius: "10px", cursor: "pointer",
                                    border: `1.5px solid ${selectedDocs.includes(doc) ? "#3B82F6" : "#E5E7EB"}`,
                                    background: selectedDocs.includes(doc) ? "#EFF6FF" : "#FFFFFF",
                                    transition: "all 0.15s"
                                }}
                            >
                                <div style={{ width: "18px", height: "18px", borderRadius: "5px", border: `2px solid ${selectedDocs.includes(doc) ? "#3B82F6" : "#D1D5DB"}`, background: selectedDocs.includes(doc) ? "#3B82F6" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                    {selectedDocs.includes(doc) && <span style={{ color: "white", fontSize: "0.7rem", fontWeight: 800 }}>✓</span>}
                                </div>
                                <span style={{ fontSize: "0.85rem", fontWeight: 500, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{getFileIcon(doc)} {doc}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {documents.length === 0 && !uploading && (
                <div style={{ textAlign: "center", padding: "20px", color: "#9CA3AF", fontSize: "0.9rem" }}>
                    Henüz kaynak yüklenmedi.
                </div>
            )}
        </div>
    );
}
