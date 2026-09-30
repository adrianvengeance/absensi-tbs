import React, { useState, useEffect } from "react";

const API_URL = import.meta.env.VITE_API_URL;
const MAX_RADIUS_METER = 50;

const getHardwareFingerprint = () => {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
  let debugInfo = "";

  if (gl) {
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    if (ext) {
      debugInfo = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
    }
  }

  const rawId = [screen.width, screen.height, screen.colorDepth, navigator.hardwareConcurrency || 1, navigator.deviceMemory || 0, debugInfo, navigator.platform].join("|");

  let hash = 0;
  for (let i = 0; i < rawId.length; i++) {
    const char = rawId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return "HW-" + Math.abs(hash).toString(16);
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
};

function App() {
  const [configData, setConfigData] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  const [inputPin, setInputPin] = useState("");
  const [statusAbsen, setStatusAbsen] = useState("Hadir");
  const [userLocation, setUserLocation] = useState(null);
  const [distanceMeter, setDistanceMeter] = useState(null);
  const [hardwareFp, setHardwareFp] = useState("");

  const [loadingConfig, setLoadingConfig] = useState(true);
  const [loadingLogin, setLoadingLogin] = useState(false);
  const [loadingGps, setLoadingGps] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    setHardwareFp(getHardwareFingerprint());
    fetchGPSLocation();
    fetchConfig();
  }, []);

  useEffect(() => {
    if (userLocation && configData?.kantorLocation) {
      const dist = calculateDistance(userLocation.lat, userLocation.lng, configData.kantorLocation.lat, configData.kantorLocation.lng);
      setDistanceMeter(dist);
    }
  }, [userLocation, configData]);

  const fetchConfig = async () => {
    try {
      const res = await fetch(`${API_URL}?action=getInitialConfig`);
      const result = await res.json();
      if (result.status === "success") {
        setConfigData(result.data);
      } else {
        setMessage({ type: "error", text: result.message });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Gagal mengambil data konfigurasi dari server." });
    } finally {
      setLoadingConfig(false);
    }
  };

  const fetchGPSLocation = () => {
    if (!navigator.geolocation) {
      setMessage({ type: "error", text: "Browser/HP Anda tidak mendukung Geolocation." });
      return;
    }

    setLoadingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setLoadingGps(false);
      },
      (err) => {
        setLoadingGps(false);
        setMessage({
          type: "error",
          text: "Gagal mengambil lokasi. Pastikan GPS/Akses Lokasi aktif!",
        });
      },
      { enableHighAccuracy: true },
    );
  };

  const handleLogin = (e) => {
    e.preventDefault();
    setLoadingLogin(true);
    setMessage({ type: "", text: "" });

    setTimeout(() => {
      if (!configData || !configData.employees) {
        setMessage({ type: "error", text: "Data konfigurasi belum siap. Coba lagi." });
        setLoadingLogin(false);
        return;
      }

      const matched = configData.employees.find((emp) => String(emp.pin) === String(inputPin).trim());

      if (matched) {
        setCurrentUser(matched);
        setMessage({ type: "", text: "" });
      } else {
        setMessage({ type: "error", text: "PIN Salah! Periksa kembali PIN Anda." });
        setLoadingLogin(false);
      }
    }, 400);
  };

  const handleSubmitAttendance = async () => {
    if (!currentUser || !userLocation || distanceMeter === null || isBlocked) return;

    if (distanceMeter > MAX_RADIUS_METER) {
      setMessage({
        type: "error",
        text: `Jarak Anda (${distanceMeter}m) melebihi batas lokasi kantor (${MAX_RADIUS_METER}m).`,
      });
      return;
    }

    setSubmitting(true);
    setMessage({ type: "", text: "" });

    const payload = {
      nama: currentUser.nama,
      statusAbsen: statusAbsen,
      hardwareFingerprint: hardwareFp,
      lat: userLocation.lat,
      lng: userLocation.lng,
      distance: distanceMeter,
    };

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();

      if (result.status === "success") {
        setIsSubmitted(true);
      } else {
        setMessage({ type: "error", text: result.message });

        const errText = result.message.toLowerCase();
        if (errText.includes("sudah") || errText.includes("terikat") || errText.includes("tidak ditemukan")) {
          setIsBlocked(true);
        }
      }
    } catch (err) {
      setMessage({ type: "error", text: "Gagal mengirim data absensi. Periksa koneksi." });
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingConfig) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <p style={{ textAlign: "center" }}>Memuat konfigurasi aplikasi...</p>
        </div>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div style={styles.container}>
        <div style={{ ...styles.card, textAlign: "center" }}>
          <div style={{ fontSize: "50px", marginBottom: "10px" }}>✅</div>
          <h2 style={{ color: "#28a745", margin: "0 0 10px 0" }}>Absensi Berhasil!</h2>
          <p style={{ fontSize: "15px", color: "#333", fontWeight: "bold" }}>{currentUser?.nama}</p>
          <p style={{ fontSize: "14px", color: "#6c757d", marginBottom: "20px" }}>Anda telah berhasil mencatatkan kehadiran ({statusAbsen}) untuk hari ini. Terima kasih!</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>PT. TRIKORA BANGKEP SEJAHTERA</h2>
        <p style={styles.subtitle}>Sistem Absensi Digital</p>

        {message.text && (
          <div
            style={{
              ...styles.alert,
              backgroundColor: message.type === "error" ? "#f8d7da" : "#d4edda",
              color: message.type === "error" ? "#721c24" : "#155724",
            }}
          >
            {message.text}
          </div>
        )}

        {!currentUser ? (
          <form onSubmit={handleLogin} style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Masukkan PIN Anda:</label>
              <input type="password" value={inputPin} onChange={(e) => setInputPin(e.target.value)} placeholder="****" maxLength={6} style={styles.input} disabled={loadingLogin} required />
            </div>
            <button
              type="submit"
              disabled={loadingLogin}
              style={{
                ...styles.button,
                backgroundColor: loadingLogin ? "#cccccc" : "#1F4E78",
                cursor: loadingLogin ? "not-allowed" : "pointer",
              }}
            >
              {loadingLogin ? "Memproses..." : "Masuk Aplikasi"}
            </button>
          </form>
        ) : (
          <div style={styles.form}>
            <div style={styles.profileBox}>
              <h3 style={{ margin: 0, color: "#1F4E78" }}>{currentUser.nama}</h3>
              <p style={{ margin: "2px 0 0 0", color: "#6c757d", fontSize: "14px" }}>{currentUser.jabatan}</p>
            </div>

            <div style={styles.gpsBox}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "13px", fontWeight: "bold" }}>Info Lokasi GPS:</span>
                <button
                  type="button"
                  onClick={fetchGPSLocation}
                  disabled={loadingGps || isBlocked}
                  style={{
                    ...styles.refreshBtn,
                    backgroundColor: loadingGps || isBlocked ? "#ccc" : "#6c757d",
                    cursor: loadingGps || isBlocked ? "not-allowed" : "pointer",
                  }}
                >
                  {loadingGps ? "Refreshing..." : "🔄 Refresh Lokasi"}
                </button>
              </div>

              <div style={{ marginTop: "8px" }}>
                {distanceMeter !== null ? (
                  <p
                    style={{
                      margin: 0,
                      fontWeight: "bold",
                      fontSize: "15px",
                      color: distanceMeter <= MAX_RADIUS_METER ? "#28a745" : "#dc3545",
                    }}
                  >
                    Jarak dari Kantor: {distanceMeter} meter
                    {distanceMeter <= MAX_RADIUS_METER ? " (Di dalam Radius)" : " (Terlalu Jauh)"}
                  </p>
                ) : (
                  <p style={{ margin: 0, fontSize: "13px", color: "#6c757d" }}>{loadingGps ? "Mencari lokasi GPS..." : "Lokasi belum terdeteksi."}</p>
                )}
              </div>
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Status Kehadiran:</label>
              <select value={statusAbsen} onChange={(e) => setStatusAbsen(e.target.value)} disabled={submitting || isBlocked} style={styles.select}>
                <option value="Hadir">Hadir</option>
                <option value="Sakit">Sakit</option>
                <option value="Izin">Izin</option>
                <option value="Tugas Luar">Tugas Luar</option>
              </select>
            </div>

            {/* SUBMIT BUTTON (Disabled jika jarak > 50m ATAU submitting ATAU isBlocked) */}
            <button
              onClick={handleSubmitAttendance}
              disabled={submitting || distanceMeter === null || distanceMeter > MAX_RADIUS_METER || isBlocked}
              style={{
                ...styles.button,
                backgroundColor: !isBlocked && distanceMeter !== null && distanceMeter <= MAX_RADIUS_METER && !submitting ? "#1F4E78" : "#cccccc",
                cursor: !isBlocked && distanceMeter !== null && distanceMeter <= MAX_RADIUS_METER && !submitting ? "pointer" : "not-allowed",
              }}
            >
              {submitting ? "Mengirim Data..." : isBlocked ? "Akses Absensi Ditolak" : "Kirim Absensi"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#f4f6f9",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    fontFamily: "Arial, sans-serif",
  },
  card: {
    backgroundColor: "#ffffff",
    width: "100%",
    maxWidth: "400px",
    padding: "25px",
    borderRadius: "12px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
  },
  title: {
    fontSize: "18px",
    fontWeight: "bold",
    textAlign: "center",
    color: "#1F4E78",
    margin: "0 0 5px 0",
  },
  subtitle: {
    fontSize: "14px",
    textAlign: "center",
    color: "#6c757d",
    margin: "0 0 20px 0",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "15px",
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
  },
  label: {
    fontSize: "14px",
    fontWeight: "bold",
    color: "#333",
  },
  input: {
    padding: "12px",
    fontSize: "16px",
    borderRadius: "6px",
    border: "1px solid #ccc",
    textAlign: "center",
  },
  select: {
    padding: "12px",
    fontSize: "15px",
    borderRadius: "6px",
    border: "1px solid #ccc",
  },
  button: {
    padding: "12px",
    fontSize: "16px",
    fontWeight: "bold",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    transition: "background-color 0.2s",
  },
  alert: {
    padding: "12px",
    borderRadius: "6px",
    fontSize: "14px",
    marginBottom: "15px",
    textAlign: "center",
  },
  profileBox: {
    padding: "12px",
    backgroundColor: "#eef2f7",
    borderRadius: "8px",
    textAlign: "center",
  },
  gpsBox: {
    padding: "12px",
    border: "1px solid #e0e0e0",
    borderRadius: "8px",
    backgroundColor: "#fafafa",
  },
  refreshBtn: {
    padding: "4px 8px",
    fontSize: "12px",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
  },
};

export default App;
