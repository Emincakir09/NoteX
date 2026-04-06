import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Network } from "vis-network";
import { DataSet } from "vis-data";

const API = "http://localhost:8000";

const NODE_COLORS = [
    { background: "#4ecdc4", border: "#2aa39b", highlight: { background: "#6eddd6", border: "#2aa39b" } },
    { background: "#ff6b6b", border: "#e05252", highlight: { background: "#ff8585", border: "#e05252" } },
    { background: "#ffd93d", border: "#e6c200", highlight: { background: "#ffe066", border: "#e6c200" } },
    { background: "#6bcb77", border: "#4fa85a", highlight: { background: "#85e090", border: "#4fa85a" } },
    { background: "#4d96ff", border: "#2674e0", highlight: { background: "#6aaeff", border: "#2674e0" } },
    { background: "#c77dff", border: "#9b4de0", highlight: { background: "#d696ff", border: "#9b4de0" } },
    { background: "#ff9f43", border: "#e38520", highlight: { background: "#ffb566", border: "#e38520" } },
];

function NetworkGraph({ relationships }) {
    const containerRef = useRef(null);
    const networkRef = useRef(null);

    useEffect(() => {
        if (!relationships || relationships.length === 0) return;

        // Use requestAnimationFrame to ensure DOM container is painted
        const raf = requestAnimationFrame(() => {
            if (!containerRef.current) return;

            // Build nodes
            const nodeMap = {};
            let colorIdx = 0;
            relationships.forEach(r => {
                if (!nodeMap[r.source]) nodeMap[r.source] = NODE_COLORS[colorIdx++ % NODE_COLORS.length];
                if (!nodeMap[r.target]) nodeMap[r.target] = NODE_COLORS[colorIdx++ % NODE_COLORS.length];
            });

            const labelToId = {};
            const nodesArr = Object.keys(nodeMap).map((label, i) => {
                labelToId[label] = i;
                return {
                    id: i,
                    label: label,
                    color: nodeMap[label],
                    font: {
                        size: 18,
                        face: "Arial, sans-serif",
                        color: "#111827",
                        bold: true,
                        background: "rgba(255,255,255,0.95)",
                        strokeWidth: 0,
                    },
                    shape: "ellipse",
                    borderWidth: 2.5,
                    widthConstraint: { minimum: 110, maximum: 220 },
                    heightConstraint: { minimum: 52 },
                    margin: { top: 14, bottom: 14, left: 18, right: 18 },
                };
            });

            const edgesArr = relationships.map((r, i) => ({
                id: i,
                from: labelToId[r.source],
                to: labelToId[r.target],
                label: r.relation || "",
                arrows: { to: { enabled: true, scaleFactor: 1 } },
                color: { color: "#94A3B8", highlight: "#3B82F6" },
                font: { size: 12, align: "middle", color: "#374151", strokeWidth: 3, strokeColor: "#FFFFFF" },
                smooth: { enabled: true, type: "dynamic" },
                width: 2,
            }));

            const nodes = new DataSet(nodesArr);
            const edges = new DataSet(edgesArr);

            const options = {
                width: "100%",
                height: "100%",
                interaction: {
                    navigationButtons: true,
                    keyboard: true,
                    zoomView: true,
                    dragView: true,
                    hover: true,
                },
                physics: {
                    enabled: true,
                    stabilization: { enabled: true, iterations: 300, fit: true },
                    barnesHut: {
                        gravitationalConstant: -18000,
                        centralGravity: 0.3,
                        springLength: 260,
                        springConstant: 0.04,
                        damping: 0.14,
                        avoidOverlap: 1,
                    },
                },
            };

            if (networkRef.current) {
                networkRef.current.destroy();
                networkRef.current = null;
            }

            const net = new Network(containerRef.current, { nodes, edges }, options);
            networkRef.current = net;

            // Disable physics after stabilization so nodes stop moving
            net.once("stabilizationIterationsDone", () => {
                net.setOptions({ physics: { enabled: false } });
            });
        });

        return () => {
            cancelAnimationFrame(raf);
            if (networkRef.current) {
                networkRef.current.destroy();
                networkRef.current = null;
            }
        };
    }, [relationships]);

    return (
        <div
            ref={containerRef}
            style={{
                height: "520px",
                width: "100%",
                background: "#F8FAFC",
                borderRadius: "14px",
                border: "1px solid #E5E7EB",
                display: "block",
                overflow: "hidden",
            }}
        />
    );
}

export default function ConceptMapPage({ user, selectedDocs, researchId }) {
    const [relationships, setRelationships] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [filterText, setFilterText] = useState("");

    useEffect(() => {
        if (researchId) {
            axios.get(`${API}/api/map/${encodeURIComponent(user.email)}/${researchId}`)
                .then(res => { if (res.data.relationships?.length) setRelationships(res.data.relationships); })
                .catch(() => { });
        }
    }, [researchId]);

    const generateMap = async () => {
        if (selectedDocs.length === 0) { setError("⚠️ Lütfen en az bir belge seçin."); return; }
        setLoading(true); setError(""); setRelationships([]);
        try {
            const res = await axios.post(`${API}/api/map/generate`, { email: user.email, selected_docs: selectedDocs });
            setRelationships(res.data.relationships);
            if (researchId) {
                axios.post(`${API}/api/map/save`, { email: user.email, research_id: researchId, relationships: res.data.relationships }).catch(() => { });
            }
        } catch (err) {
            setError("❌ " + (err.response?.data?.detail || err.message));
        }
        setLoading(false);
    };

    const filteredRels = filterText.trim()
        ? relationships.filter(r =>
            r.source?.toLowerCase().includes(filterText.toLowerCase()) ||
            r.target?.toLowerCase().includes(filterText.toLowerCase()) ||
            (r.relation || "").toLowerCase().includes(filterText.toLowerCase())
        )
        : relationships;

    const uniqueNodes = new Set(filteredRels.flatMap(r => [r.source, r.target]));

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
                <div>
                    <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#111827", margin: "0 0 4px" }}>🕸️ Kavram Haritası</h2>
                    <p style={{ color: "#6B7280", margin: 0, fontSize: "0.85rem" }}>
                        Nodlara tıklayıp sürükleyebilir, yakınlaştırıp uzaklaştırabilirsiniz.
                    </p>
                </div>
                <button
                    onClick={generateMap}
                    disabled={loading}
                    style={{ padding: "10px 22px", borderRadius: "8px", border: "none", background: "linear-gradient(135deg, #10B981, #059669)", color: "white", fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 8px rgba(16,185,129,0.3)", opacity: loading ? 0.7 : 1 }}
                >
                    {loading ? "⏳ Oluşturuluyor..." : relationships.length > 0 ? "🔁 Yenile" : "🗺️ Harita Oluştur"}
                </button>
            </div>

            {error && (
                <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", color: "#DC2626", borderRadius: "10px", padding: "12px 16px", marginBottom: "16px", fontWeight: 500 }}>
                    {error}
                </div>
            )}

            {loading && (
                <div style={{ textAlign: "center", padding: "60px", color: "#6B7280" }}>
                    <div style={{ fontSize: "3rem", marginBottom: "16px" }}>🕸️</div>
                    <p style={{ fontWeight: 600 }}>Kavramlar analiz ediliyor...</p>
                    <p style={{ fontSize: "0.85rem", color: "#9CA3AF" }}>Bu işlem 10-30 saniye sürebilir.</p>
                </div>
            )}

            {relationships.length > 0 && !loading && (
                <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
                        <div style={{ display: "flex", gap: "10px" }}>
                            <span style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "20px", padding: "4px 12px", fontSize: "0.78rem", fontWeight: 700, color: "#1E3A8A" }}>
                                🔵 {uniqueNodes.size} kavram
                            </span>
                            <span style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: "20px", padding: "4px 12px", fontSize: "0.78rem", fontWeight: 700, color: "#166534" }}>
                                🔗 {filteredRels.length} ilişki
                            </span>
                        </div>
                        <input
                            placeholder="Kavram veya ilişki ara…"
                            value={filterText}
                            onChange={e => setFilterText(e.target.value)}
                            style={{ flex: 1, maxWidth: "260px", padding: "7px 12px", borderRadius: "8px", border: "1px solid #D1D5DB", fontSize: "0.85rem", outline: "none" }}
                        />
                    </div>

                    <NetworkGraph relationships={filteredRels} />

                    <div style={{ marginTop: "14px" }}>
                        <p style={{ fontWeight: 700, fontSize: "0.85rem", color: "#374151", marginBottom: "10px" }}>📋 İlişki Listesi</p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                            {filteredRels.map((r, i) => (
                                <div key={i} style={{ background: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: "8px", padding: "6px 12px", fontSize: "0.78rem", display: "flex", alignItems: "center", gap: "6px" }}>
                                    <span style={{ fontWeight: 700, color: "#3B82F6" }}>{r.source}</span>
                                    <span style={{ color: "#9CA3AF" }}>→</span>
                                    <span style={{ fontStyle: "italic", color: "#6B7280" }}>{r.relation}</span>
                                    <span style={{ color: "#9CA3AF" }}>→</span>
                                    <span style={{ fontWeight: 700, color: "#10B981" }}>{r.target}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {relationships.length === 0 && !loading && (
                <div style={{ textAlign: "center", padding: "80px 24px", background: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: "16px" }}>
                    <div style={{ fontSize: "4rem", marginBottom: "16px" }}>🕸️</div>
                    <p style={{ fontSize: "1rem", fontWeight: 600, color: "#6B7280" }}>Belge seçip "Harita Oluştur" butonuna basın.</p>
                    <p style={{ fontSize: "0.85rem", color: "#9CA3AF", marginTop: "8px" }}>Kavramlar arası bağlantılar etkileşimli grafik olarak gösterilecektir.</p>
                </div>
            )}
        </div>
    );
}
