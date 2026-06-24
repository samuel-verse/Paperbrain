import { useState, useCallback, useRef, useEffect } from "react";

const API_BASE = "/api";

// — Fonts —
const fontLink = document.createElement("link");
fontLink.href =
  "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=JetBrains+Mono:wght@400;500&display=swap";
fontLink.rel = "stylesheet";
document.head.appendChild(fontLink);

// ── Helpers ──
function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

async function apiFetch(path, token, options = {}) {
  const headers = { ...authHeaders(token), ...(options.headers || {}) };
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 401) throw new Error("__UNAUTHORIZED__");
  return res;
}

// ── StatusBadge ──
function StatusBadge({ status }) {
  const map = {
    idle: { label: "Ready", bg: "#e8f5e9", color: "#2e7d32", dot: "#43a047" },
    uploading: { label: "Indexing…", bg: "#fff8e1", color: "#f57f17", dot: "#fdd835" },
    success: { label: "Indexed", bg: "#e0f2f1", color: "#00695c", dot: "#26a69a" },
    error: { label: "Error", bg: "#fbe9e7", color: "#c62828", dot: "#ef5350" },
  };
  const s = map[status] || map.idle;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 99, fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", background: s.bg, color: s.color, letterSpacing: 0.3 }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.dot, animation: status === "uploading" ? "pulse 1.2s infinite" : "none" }} />
      {s.label}
    </span>
  );
}

// ── Icons ──
const Icons = {
  upload: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" /><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3" /></svg>,
  chat: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>,
  send: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>,
  file: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3949ab" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>,
  dropUpload: <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#9e9e9e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>,
  logout: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>,
  user: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
};


// ══════════════════════════════════════════
//  AUTH PAGE
// ══════════════════════════════════════════
function AuthPage({ onLogin }) {
  const [mode, setMode] = useState("login"); // login | register
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (!email.trim() || !password.trim()) { setError("Email and password are required."); return; }
    if (mode === "register" && !username.trim()) { setError("Username is required."); return; }
    setLoading(true);
    try {
    let res;
       if (mode === "login") {
           const formBody = new URLSearchParams();
            formBody.append("username", email.trim());  // OAuth2 utilise "username" même pour un email
            formBody.append("password", password);
            res = await fetch(`${API_BASE}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: formBody,
  });
} else {
  // register reste en JSON
  res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim(), username: username.trim(), password }),
  });
}
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Error ${res.status}`);
      }
      const data = await res.json();
      onLogin(data.access_token, data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => { if (e.key === "Enter") handleSubmit(); };

  return (
    <div style={st.authPage}>
      <div style={st.authCard}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <svg width="40" height="40" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="7" fill="#3949ab" />
            <path d="M8 10h12M8 14h8M8 18h10" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: "12px 0 4px", color: "#1a1a2e" }}>RAG Dashboard</h1>
          <p style={{ fontSize: 14, color: "#888", margin: 0 }}>
            {mode === "login" ? "Sign in to your account" : "Create a new account"}
          </p>
        </div>

        {/* Toggle */}
        <div style={st.authToggle}>
          <button onClick={() => { setMode("login"); setError(null); }} style={{ ...st.authToggleBtn, ...(mode === "login" ? st.authToggleActive : {}) }}>Sign In</button>
          <button onClick={() => { setMode("register"); setError(null); }} style={{ ...st.authToggleBtn, ...(mode === "register" ? st.authToggleActive : {}) }}>Sign Up</button>
        </div>

        {error && <div style={st.authError}>{error}</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={st.label}>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={handleKeyDown} placeholder="you@example.com" style={st.input} />
          </div>
          {mode === "register" && (
            <div style={{ animation: "fadeIn .2s ease" }}>
              <label style={st.label}>Username</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} onKeyDown={handleKeyDown} placeholder="johndoe" style={st.input} />
            </div>
          )}
          <div>
            <label style={st.label}>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={handleKeyDown} placeholder="••••••••" style={st.input} />
          </div>
          <button onClick={handleSubmit} disabled={loading} style={{ ...st.primaryBtn, marginTop: 6, opacity: loading ? 0.6 : 1 }}>
            {loading ? <span style={st.spinner} /> : null}
            {mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </div>
      </div>
    </div>
  );
}


// ══════════════════════════════════════════
//  INDEX PAGE
// ══════════════════════════════════════════
function IndexPage({ status, setStatus, token, onAuthError }) {
  const [file, setFile] = useState(null);
  const [contextTag, setContextTag] = useState("");
  const [metadataJson, setMetadataJson] = useState("");
  const [resetCollection, setResetCollection] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef();

  const fetchDocuments = async () => {
    try {
      const res = await apiFetch("/documents", token);
      if (!res.ok) return;
      const data = await res.json();
      setHistory(data);
    } catch (e) {
      if (e.message === "__UNAUTHORIZED__") return onAuthError();
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => { fetchDocuments(); }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(false);
    if (e.dataTransfer?.files?.[0]) setFile(e.dataTransfer.files[0]);
  }, []);

  const clearFile = () => { setFile(null); setResult(null); setError(null); setStatus("idle"); if (inputRef.current) inputRef.current.value = ""; };

  const handleDelete = async (id) => {
  try {
    const res = await apiFetch(`/documents/${id}`, token, { method: "DELETE" });
    if (!res.ok && res.status !== 204) throw new Error(`Erreur ${res.status}`);
    setHistory((prev) => prev.filter((d) => d.id !== id));   // retire le doc de la liste
  } catch (e) {
    if (e.message === "__UNAUTHORIZED__") return onAuthError();
    alert("Erreur : " + e.message);
  }
};

  const handleUpload = async () => {
    if (!file) return;
    setStatus("uploading"); setError(null); setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const params = new URLSearchParams();
      if (contextTag.trim()) params.set("context_tag", contextTag.trim());
      if (metadataJson.trim()) params.set("metadata_json", metadataJson.trim());
      if (resetCollection) params.set("reset_collection", "true");
      const url = `/index${params.toString() ? "?" + params.toString() : ""}`;
      const res = await apiFetch(url, token, { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Server returned ${res.status}`);
      }
      const data = await res.json();
      setResult(data); setStatus("success");
      setFile(null);                                  // vide la zone pour permettre un nouvel upload directement
      setContextTag("");                              // vide le champ Context Tag
      if (inputRef.current) inputRef.current.value = "";
      fetchDocuments();
    } catch (err) {
      if (err.message === "__UNAUTHORIZED__") return onAuthError();
      setError(err.message); setStatus("error");
    }
  };

  const formatSize = (b) => b < 1024 ? b + " B" : b < 1048576 ? (b / 1024).toFixed(1) + " KB" : (b / 1048576).toFixed(1) + " MB";
  const formatDate = (iso) => { try { return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };

  return (
    <div style={st.body}>
      <div style={st.uploadCol}>
        <div
          style={{ ...st.dropZone, borderColor: dragOver ? "#5c6bc0" : file ? "#a5d6a7" : "#d0d5dd", background: dragOver ? "#eef0fb" : file ? "#f6faf6" : "#fafbfc" }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !file && inputRef.current?.click()}
        >
          <input ref={inputRef} type="file" accept=".txt,.md,.pdf,.csv,.json,.html" onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])} style={{ display: "none" }} />
          {file ? (
            <div style={{ animation: "fadeIn .3s ease", textAlign: "center" }}>
              <div style={{ marginBottom: 8 }}>{Icons.file}</div>
              <p style={st.fileName}>{file.name}</p>
              <p style={st.fileSize}>{formatSize(file.size)}</p>
              <button style={st.removeBtn} onClick={(e) => { e.stopPropagation(); clearFile(); }}>Remove</button>
            </div>
          ) : (
            <div style={{ textAlign: "center" }}>
              <div style={{ marginBottom: 12, opacity: 0.5 }}>{Icons.dropUpload}</div>
              <p style={st.dropLabel}>Drop a file here or click to browse</p>
              <p style={st.dropHint}>.txt, .md, .pdf, .csv, .json, .html</p>
            </div>
          )}
        </div>

        <div style={st.optionsCard}>
          <h3 style={st.sectionTitle}>Indexing Options</h3>
          <label style={st.label}>Context Tag</label>
          <input type="text" placeholder="e.g. book, manual, faq" value={contextTag} onChange={(e) => setContextTag(e.target.value)} style={st.input} />
          <label style={{ ...st.label, marginTop: 14 }}>Metadata JSON <span style={st.optional}>(optional)</span></label>
          <textarea placeholder='{"author": "Jane Doe", "year": 2024}' value={metadataJson} onChange={(e) => setMetadataJson(e.target.value)} rows={3} style={{ ...st.input, resize: "vertical", fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5 }} />
          <label style={st.checkboxRow}>
            <input type="checkbox" checked={resetCollection} onChange={(e) => setResetCollection(e.target.checked)} style={st.checkbox} />
            <span>Reset collection before indexing</span>
            {resetCollection && <span style={st.warningChip}>destructive</span>}
          </label>
          <button style={{ ...st.primaryBtn, opacity: !file || status === "uploading" ? 0.5 : 1, cursor: !file || status === "uploading" ? "not-allowed" : "pointer" }} disabled={!file || status === "uploading"} onClick={handleUpload}>
            {status === "uploading" ? <><span style={st.spinner} />Indexing…</> : <>{Icons.upload} Index Document</>}
          </button>
        </div>

        {result && (
          <div style={{ ...st.resultCard, animation: "fadeIn .35s ease" }}>
            {result.status === "queued" ? (
              <>
                <h4 style={st.resultTitle}>Indexing Queued</h4>
                <p style={{ margin: 0, fontSize: 13.5, color: "#2e7d32", lineHeight: 1.6 }}>
                  « {result.filename} » est en cours d'indexation en arrière-plan par le worker. Il apparaîtra dans vos documents une fois traité — rafraîchissez la liste dans quelques secondes.
                </p>
              </>
            ) : (
              <>
                <h4 style={st.resultTitle}>Indexing Complete</h4>
                <div style={st.resultGrid}>
                  <div style={st.statBox}><span style={st.statNum}>{result.documents}</span><span style={st.statLabel}>Documents</span></div>
                  <div style={st.statBox}><span style={st.statNum}>{result.chunks}</span><span style={st.statLabel}>Chunks</span></div>
                  <div style={st.statBox}><span style={{ ...st.statNum, fontSize: 14, fontFamily: "'JetBrains Mono', monospace" }}>{result.collection}</span><span style={st.statLabel}>Collection</span></div>
                </div>
              </>
            )}
          </div>
        )}
        {error && <div style={{ ...st.errorCard, animation: "fadeIn .35s ease" }}><strong>Error:</strong> {error}</div>}
      </div>

      <div style={st.historyCol}>
        <h3 style={st.sectionTitle}>Your Documents <span style={st.historyCount}>{history.length}</span></h3>
        {historyLoading ? (
          <div style={st.emptyState}><span style={{ ...st.spinner, borderColor: "rgba(57,73,171,.2)", borderTopColor: "#3949ab" }} /><p style={{ color: "#aaa", marginTop: 12, fontSize: 14 }}>Loading…</p></div>
        ) : history.length === 0 ? (
          <div style={st.emptyState}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
            <p style={{ color: "#aaa", marginTop: 12, fontSize: 14 }}>No documents indexed yet</p>
          </div>
        ) : (
          <div style={st.historyList}>
            {history.map((item, i) => (
              <div key={item.id} style={{ ...st.historyItem, animation: `slideIn .3s ease ${i * 0.05}s both` }}>
                <div style={st.historyTop}>
                  <span style={st.historyFilename}>{item.filename}</span>
                  <span style={st.historyTime}>{formatDate(item.created_at)}</span>
                  <button onClick={() => handleDelete(item.id)} title="Delete Document"
                  style={{ border: "none", background: "transparent", cursor: "pointer", color: "#ff0000", display: "flex", alignItems: "center" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                  </svg>
                  </button>
                </div>
                <div style={st.historyMeta}>
                  <span>{item.chunks} chunks</span>
                  <span style={st.historyDot}>·</span>
                  <span>{formatSize(item.file_size)}</span>
                  {item.context_tag && (<><span style={st.historyDot}>·</span><span style={st.tagChip}>{item.context_tag}</span></>)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


// ══════════════════════════════════════════
//  CHAT PAGE
// ══════════════════════════════════════════
function ChatPage({ token, onAuthError }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [contextTag, setContextTag] = useState("");
  const [k, setK] = useState(14);
  const [minRelevance, setMinRelevance] = useState(0.7);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef();
  const inputRef = useRef();

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setMessages((prev) => [...prev, { role: "user", content: text, id: Date.now() }]);
    setInput(""); setLoading(true);
    try {
      const body = { query_text: text, k, min_relevance: minRelevance };
      if (contextTag.trim()) body.context_tag = contextTag.trim();
      const res = await apiFetch("/query", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Server returned ${res.status}`);
      }
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.response, sources: data.sources, id: Date.now() + 1 }]);
    } catch (err) {
      if (err.message === "__UNAUTHORIZED__") return onAuthError();
      setMessages((prev) => [...prev, { role: "error", content: err.message, id: Date.now() + 1 }]);
    } finally { setLoading(false); }
  };

  const handleKeyDown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  return (
    <div style={st.chatLayout}>
      <div style={st.chatMain}>
        <div style={st.chatMessages}>
          {messages.length === 0 && !loading && (
            <div style={st.chatEmpty}>
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#c5cae9" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
              <p style={st.chatEmptyTitle}>Ask your documents anything</p>
              <p style={st.chatEmptyHint}>Queries are matched against your indexed chunks using semantic search, then answered by the LLM.</p>
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} style={{ ...st.msgRow, justifyContent: msg.role === "user" ? "flex-end" : "flex-start", animation: "fadeIn .3s ease" }}>
              {msg.role === "user" ? (
                <div style={st.userBubble}>{msg.content}</div>
              ) : msg.role === "error" ? (
                <div style={st.errorBubble}><strong>Error: </strong>{msg.content}</div>
              ) : (
                <div style={st.assistantBubble}>
                  <div style={{ whiteSpace: "pre-wrap" }}>{msg.content}</div>
                  {msg.sources?.length > 0 && (
                    <div style={st.sourcesRow}>
                      <span style={st.sourcesLabel}>Sources:</span>
                      {[...new Set(msg.sources)].map((src, i) => <span key={i} style={st.sourceChip}>{src}</span>)}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div style={{ ...st.msgRow, justifyContent: "flex-start", animation: "fadeIn .2s ease" }}>
              <div style={st.assistantBubble}>
                <div style={st.typingDots}><span style={{ ...st.dot, animationDelay: "0s" }} /><span style={{ ...st.dot, animationDelay: "0.15s" }} /><span style={{ ...st.dot, animationDelay: "0.3s" }} /></div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div style={st.chatInputBar}>
          <div style={st.chatInputWrap}>
            <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Ask a question about your documents…" rows={1} style={st.chatInput} />
            <button onClick={handleSend} disabled={!input.trim() || loading} style={{ ...st.sendBtn, opacity: !input.trim() || loading ? 0.4 : 1, cursor: !input.trim() || loading ? "not-allowed" : "pointer" }}>{Icons.send}</button>
          </div>
        </div>
      </div>

      <div style={st.chatSidebar}>
        <h3 style={st.sectionTitle}>Query Settings</h3>
        <label style={st.label}>Context Tag Filter</label>
        <input type="text" placeholder="e.g. book" value={contextTag} onChange={(e) => setContextTag(e.target.value)} style={st.input} />
        <label style={{ ...st.label, marginTop: 14 }}>Results (k)</label>
        <input type="number" min={1} max={20} value={k} onChange={(e) => setK(Number(e.target.value))} style={{ ...st.input, fontFamily: "'JetBrains Mono', monospace" }} />
        <label style={{ ...st.label, marginTop: 14 }}>Min Relevance</label>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input type="range" min={0} max={1} step={0.05} value={minRelevance} onChange={(e) => setMinRelevance(Number(e.target.value))} style={{ flex: 1, accentColor: "#3949ab" }} />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "#555", minWidth: 36 }}>{minRelevance.toFixed(2)}</span>
        </div>
        <div style={{ marginTop: 24, borderTop: "1px solid #e8eaed", paddingTop: 18 }}>
          <button onClick={() => { setMessages([]); inputRef.current?.focus(); }} style={st.secondaryBtn}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg>
            Clear Chat
          </button>
        </div>
        <div style={st.chatTip}><strong>Tip:</strong> Use the same context tag you used when indexing to filter results to a specific document set.</div>

      </div>
    </div>
  );
}


// ══════════════════════════════════════════
//  MAIN APP
// ══════════════════════════════════════════
export default function RAGDashboard() {
  const [token, setToken] = useState(() => sessionStorage.getItem("rag_token"));
  const [user, setUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("rag_user")); } catch { return null; }
  });
  const [tab, setTab] = useState("index");
  const [indexStatus, setIndexStatus] = useState("idle");

  const handleLogin = (accessToken, userInfo) => {
    setToken(accessToken);
    setUser(userInfo);
    sessionStorage.setItem("rag_token", accessToken);
    sessionStorage.setItem("rag_user", JSON.stringify(userInfo));
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    sessionStorage.removeItem("rag_token");
    sessionStorage.removeItem("rag_user");
  };

  // If not logged in, show auth page
  if (!token) {
    return (
      <div style={st.page}>
        <style>{`
          @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
          @keyframes spin { to{transform:rotate(360deg)} }
          input:focus { outline:none; border-color:#5c6bc0 !important; box-shadow:0 0 0 3px rgba(92,107,192,.12); }
        `}</style>
        <AuthPage onLogin={handleLogin} />
      </div>
    );
  }

  return (
    <div style={st.page}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideIn { from{opacity:0;transform:translateX(-12px)} to{opacity:1;transform:translateX(0)} }
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-5px)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        input:focus, textarea:focus { outline:none; border-color:#5c6bc0 !important; box-shadow:0 0 0 3px rgba(92,107,192,.12); }
      `}</style>

      <header style={st.header}>
        <div style={st.headerLeft}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="7" fill="#3949ab" />
            <path d="M8 10h12M8 14h8M8 18h10" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <div>
            <h1 style={st.title}>RAG Dashboard</h1>
            <p style={st.subtitle}>Index documents · Query with AI</p>
          </div>
        </div>

        <div style={st.tabRow}>
          <button onClick={() => setTab("index")} style={{ ...st.tabBtn, ...(tab === "index" ? st.tabActive : {}) }}>{Icons.upload}<span>Index</span>{indexStatus === "success" && <span style={st.tabDot} />}</button>
          <button onClick={() => setTab("chat")} style={{ ...st.tabBtn, ...(tab === "chat" ? st.tabActive : {}) }}>{Icons.chat}<span>Chat</span></button>
        </div>

        <div style={st.userBar}>
          <div style={st.userAvatar}>{user?.username?.[0]?.toUpperCase() || "U"}</div>
          <span style={st.userName}>{user?.username}</span>
          <button onClick={handleLogout} style={st.logoutBtn} title="Sign out">{Icons.logout}</button>
        </div>
      </header>

      {tab === "index"
        ? <IndexPage status={indexStatus} setStatus={setIndexStatus} token={token} onAuthError={handleLogout} />
        : <ChatPage token={token} onAuthError={handleLogout} />
      }
    </div>
  );
}


// ══════════════════════════════════════════
//  STYLES
// ══════════════════════════════════════════
const st = {
  page: { minHeight: "100vh", fontFamily: "'DM Sans', sans-serif", background: "#f4f5f7", color: "#1a1a2e" },

  // Auth
  authPage: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "linear-gradient(135deg, #e8eaf6 0%, #f4f5f7 50%, #e3f2fd 100%)" },
  authCard: { width: "100%", maxWidth: 400, background: "#fff", borderRadius: 18, padding: "36px 32px", boxShadow: "0 8px 40px rgba(0,0,0,.08)", animation: "fadeIn .4s ease" },
  authToggle: { display: "flex", gap: 4, background: "#f0f1f4", borderRadius: 10, padding: 3, marginBottom: 22 },
  authToggleBtn: { flex: 1, padding: "9px 0", fontSize: 13.5, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", border: "none", borderRadius: 8, background: "transparent", color: "#777", cursor: "pointer", transition: "all .15s" },
  authToggleActive: { background: "#fff", color: "#3949ab", boxShadow: "0 1px 3px rgba(0,0,0,.08)" },
  authError: { background: "#fbe9e7", color: "#c62828", fontSize: 13, padding: "10px 14px", borderRadius: 8, marginBottom: 16, border: "1px solid #ffccbc" },

  // Header
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 32px", background: "#fff", borderBottom: "1px solid #e8eaed", gap: 16, flexWrap: "wrap" },
  headerLeft: { display: "flex", alignItems: "center", gap: 14 },
  title: { fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: -0.3 },
  subtitle: { fontSize: 13, color: "#7a7f8a", margin: 0, marginTop: 1 },

  // User bar
  userBar: { display: "flex", alignItems: "center", gap: 10 },
  userAvatar: { width: 32, height: 32, borderRadius: "50%", background: "#3949ab", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700 },
  userName: { fontSize: 13.5, fontWeight: 600, color: "#333" },
  logoutBtn: { display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, border: "1px solid #e8eaed", borderRadius: 8, background: "#fff", color: "#999", cursor: "pointer", transition: "all .15s" },

  // Tabs
  tabRow: { display: "flex", gap: 4, background: "#f0f1f4", borderRadius: 10, padding: 3 },
  tabBtn: { display: "flex", alignItems: "center", gap: 7, padding: "8px 18px", fontSize: 13.5, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", border: "none", borderRadius: 8, background: "transparent", color: "#777", cursor: "pointer", transition: "all .15s", position: "relative" },
  tabActive: { background: "#fff", color: "#3949ab", boxShadow: "0 1px 3px rgba(0,0,0,.08)" },
  tabDot: { width: 6, height: 6, borderRadius: "50%", background: "#43a047", position: "absolute", top: 6, right: 6 },

  // Index layout
  body: { display: "flex", gap: 28, padding: "28px 32px", maxWidth: 1120, margin: "0 auto", flexWrap: "wrap" },
  uploadCol: { flex: "1 1 420px", minWidth: 320, display: "flex", flexDirection: "column", gap: 18 },
  historyCol: { flex: "1 1 320px", minWidth: 280 },

  // Drop zone
  dropZone: { border: "2px dashed #d0d5dd", borderRadius: 14, padding: "44px 24px", textAlign: "center", cursor: "pointer", transition: "all .2s ease" },
  dropLabel: { fontSize: 15, fontWeight: 500, color: "#444", margin: "0 0 4px" },
  dropHint: { fontSize: 12.5, color: "#999", margin: 0 },
  fileName: { fontSize: 15, fontWeight: 600, margin: "0 0 2px", color: "#1a1a2e" },
  fileSize: { fontSize: 12.5, color: "#888", margin: 0 },
  removeBtn: { marginTop: 10, padding: "5px 14px", fontSize: 12, fontWeight: 500, fontFamily: "'DM Sans', sans-serif", border: "1px solid #ddd", borderRadius: 6, background: "#fff", color: "#c62828", cursor: "pointer" },

  // Forms
  optionsCard: { background: "#fff", borderRadius: 14, padding: "22px 24px", border: "1px solid #e8eaed" },
  sectionTitle: { fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: "#555", marginTop: 0, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 },
  label: { display: "block", fontSize: 13, fontWeight: 600, color: "#333", marginBottom: 5 },
  optional: { fontWeight: 400, color: "#aaa", fontSize: 12 },
  input: { width: "100%", padding: "9px 12px", fontSize: 13.5, fontFamily: "'DM Sans', sans-serif", border: "1px solid #dde0e5", borderRadius: 8, background: "#fafbfc", color: "#1a1a2e", boxSizing: "border-box", transition: "border-color .15s, box-shadow .15s" },
  checkboxRow: { display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, marginTop: 16, cursor: "pointer", color: "#444" },
  checkbox: { width: 16, height: 16, accentColor: "#3949ab", cursor: "pointer" },
  warningChip: { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#c62828", background: "#fbe9e7", padding: "2px 8px", borderRadius: 4 },
  primaryBtn: { marginTop: 20, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 20px", fontSize: 14, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", color: "#fff", background: "#3949ab", border: "none", borderRadius: 10, cursor: "pointer", transition: "opacity .15s" },
  spinner: { width: 16, height: 16, border: "2px solid rgba(255,255,255,.3)", borderTop: "2px solid #fff", borderRadius: "50%", animation: "spin 0.8s linear infinite", display: "inline-block" },

  // Result
  resultCard: { background: "#e8f5e9", borderRadius: 14, padding: "18px 22px", border: "1px solid #c8e6c9" },
  resultTitle: { margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: "#2e7d32" },
  resultGrid: { display: "flex", gap: 14, flexWrap: "wrap" },
  statBox: { flex: 1, minWidth: 80, background: "rgba(255,255,255,.7)", borderRadius: 10, padding: "12px 14px", textAlign: "center", display: "flex", flexDirection: "column", gap: 2 },
  statNum: { fontSize: 22, fontWeight: 700, color: "#1b5e20" },
  statLabel: { fontSize: 11.5, color: "#4caf50", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 },
  errorCard: { background: "#fbe9e7", borderRadius: 14, padding: "16px 20px", border: "1px solid #ffccbc", fontSize: 13.5, color: "#c62828" },

  // History
  historyCount: { background: "#e8eaed", color: "#555", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99 },
  emptyState: { textAlign: "center", padding: "60px 20px", background: "#fff", borderRadius: 14, border: "1px solid #e8eaed" },
  historyList: { display: "flex", flexDirection: "column", gap: 10 },
  historyItem: { background: "#fff", borderRadius: 12, padding: "14px 18px", border: "1px solid #e8eaed" },
  historyTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  historyFilename: { fontSize: 14, fontWeight: 600, color: "#1a1a2e" },
  historyTime: { fontSize: 12, color: "#999" },
  historyMeta: { fontSize: 12.5, color: "#888", display: "flex", alignItems: "center", gap: 6 },
  historyDot: { color: "#ccc" },
  tagChip: { fontSize: 11, fontWeight: 600, background: "#eef0fb", color: "#3949ab", padding: "1px 8px", borderRadius: 4 },

  // Chat
  chatLayout: { display: "flex", height: "calc(100vh - 65px)" },
  chatMain: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 },
  chatMessages: { flex: 1, overflowY: "auto", padding: "28px 32px", display: "flex", flexDirection: "column", gap: 16 },
  chatInputBar: { padding: "16px 32px 20px", borderTop: "1px solid #e8eaed", background: "#fff" },
  chatInputWrap: { display: "flex", alignItems: "flex-end", gap: 10, maxWidth: 800, margin: "0 auto" },
  chatInput: { flex: 1, padding: "12px 16px", fontSize: 14, fontFamily: "'DM Sans', sans-serif", border: "1px solid #dde0e5", borderRadius: 12, background: "#fafbfc", color: "#1a1a2e", boxSizing: "border-box", transition: "border-color .15s, box-shadow .15s", lineHeight: 1.5, resize: "none" },
  sendBtn: { width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center", border: "none", borderRadius: 10, background: "#3949ab", color: "#fff", transition: "opacity .15s", flexShrink: 0 },
  chatSidebar: { width: 280, borderLeft: "1px solid #e8eaed", background: "#fff", padding: "24px 22px", overflowY: "auto", flexShrink: 0 },
  secondaryBtn: { width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 16px", fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", color: "#c62828", background: "#fff", border: "1px solid #eee", borderRadius: 8, cursor: "pointer" },
  chatTip: { marginTop: 20, padding: "14px 16px", borderRadius: 10, background: "#f5f6fb", fontSize: 12.5, color: "#666", lineHeight: 1.6 },
  chatEmpty: { margin: "auto", textAlign: "center", padding: 40, maxWidth: 400 },
  chatEmptyTitle: { fontSize: 18, fontWeight: 700, color: "#333", margin: "16px 0 8px" },
  chatEmptyHint: { fontSize: 14, color: "#999", margin: 0, lineHeight: 1.6 },
  msgRow: { display: "flex" },
  userBubble: { maxWidth: "65%", padding: "12px 18px", borderRadius: "18px 18px 4px 18px", background: "#3949ab", color: "#fff", fontSize: 14, lineHeight: 1.6, wordBreak: "break-word" },
  assistantBubble: { maxWidth: "75%", padding: "14px 20px", borderRadius: "18px 18px 18px 4px", background: "#fff", border: "1px solid #e8eaed", fontSize: 14, lineHeight: 1.7, color: "#1a1a2e", wordBreak: "break-word" },
  errorBubble: { maxWidth: "65%", padding: "12px 18px", borderRadius: "18px 18px 18px 4px", background: "#fbe9e7", border: "1px solid #ffccbc", fontSize: 13.5, color: "#c62828" },
  sourcesRow: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10, paddingTop: 10, borderTop: "1px solid #f0f0f0", alignItems: "center" },
  sourcesLabel: { fontSize: 11.5, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: 0.5 },
  sourceChip: { fontSize: 11, fontWeight: 500, background: "#eef0fb", color: "#3949ab", padding: "2px 10px", borderRadius: 6, fontFamily: "'JetBrains Mono', monospace" },
  typingDots: { display: "flex", gap: 5, padding: "4px 0" },
  dot: { width: 7, height: 7, borderRadius: "50%", background: "#bbb", animation: "bounce .8s infinite" },
};
