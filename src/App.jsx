import React, { useState, useEffect } from "react";
import FingerprintJS from "@fingerprintjs/fingerprintjs";

const API_URL = import.meta.env.VITE_API_URL;

function App() {
  // States
  const [pin, setPin] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [fingerprint, setFingerprint] = useState("");
  const [location, setLocation] = useState(null);

  // UI & Loading States
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [showModal, setShowModal] = useState(false);

  // 1. Inisialisasi FingerprintJS saat aplikasi dimuat
  useEffect(() => {
    const initFingerprint = async () => {
      const fp = await FingerprintJS.load();
      const result = await fp.get();
      setFingerprint(result.visitorId);
    };
    initFingerprint();
  }, []);

  // 2. Handler Verifikasi PIN
  const handlePinSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const response = await fetch(`${API_URL}?action=getInitialData&pin=${pin}`);
      const result = await response.json();

      if (result.status === "success") {
        setIsAuthenticated(true);
        setEmployees(result.data.employees);
      } else {
        setMessage({ type: "error", text: result.message });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Gagal terhubung ke server. Periksa koneksi internet." });
    } finally {
      setLoading(false);
    }
  };

  // 3. Handler Mengambil Lokasi GPS
  const requestLocationAndConfirm = () => {
    if (!selectedEmployee) {
      setMessage({ type: "error", text: "Pilih nama karyawan terlebih dahulu!" });
      return;
    }

    if (!navigator.geolocation) {
      setMessage({ type: "error", text: "Browser/HP Anda tidak mendukung Geolocation." });
      return;
    }

    setLoading(true);
    setMessage({ type: "", text: "" });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLoading(false);
        setShowModal(true);
      },
      (error) => {
        setLoading(false);
        setMessage({
          type: "error",
          text: "Gagal mengambil lokasi GPS. Izinkan/Aktifkan Akses Lokasi (GPS) di HP Anda.",
        });
      },
      { enableHighAccuracy: true },
    );
  };

  // 4. Handler Kirim Absensi
  const handleSubmitAttendance = async () => {
    setShowModal(false);
    setLoading(true);

    const payload = {
      pin: pin,
      nama: selectedEmployee,
      fingerprint: fingerprint,
      lat: location.lat,
      lng: location.lng,
    };

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.status === "success") {
        setMessage({ type: "success", text: result.message });
        setSelectedEmployee("");
      } else {
        setMessage({ type: "error", text: result.message });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Terjadi kesalahan saat mengunduh/mengirim data." });
    } finally {
      setLoading(false);
    }
  };

  // Fungsi pembentuk Hardware ID (Tetap sama walau ganti browser di HP yang sama)
  const getHardwareFingerprint = () => {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    let debugInfo = "";

    if (gl) {
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      if (ext) {
        debugInfo = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL); // Mengambil Chipset GPU HP (misal: Adreno 610 / Mali-G57)
      }
    }

    // Gabungkan atribut fisik hardware HP
    const rawId = [
      screen.width,
      screen.height,
      screen.colorDepth,
      navigator.hardwareConcurrency || 1, // Jumlah Core CPU
      navigator.deviceMemory || 0, // Ukuran RAM
      debugInfo, // Chipset Graphics GPU
      navigator.platform, // OS Platform (Linux armv8l / iPhone, dll)
    ].join("|");

    // Simple Hash Function ke String Hexadecimal
    let hash = 0;
    for (let i = 0; i < rawId.length; i++) {
      const char = rawId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return "HW-" + Math.abs(hash).toString(16);
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>PT. TRIKORA BANGKEP SEJAHTERA</h2>
        <p style={styles.subtitle}>Sistem Absensi Digital Karyawan</p>

        {/* BACAAN ALERT / MESSAGE */}
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

        {/* TAMPILAN 1: LAYAR LOCK PIN */}
        {!isAuthenticated ? (
          <form onSubmit={handlePinSubmit} style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Masukkan PIN Aplikasi:</label>
              <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="****" maxLength={6} style={styles.input} required />
            </div>
            <button type="submit" disabled={loading} style={styles.button}>
              {loading ? "Verifikasi..." : "Masuk App"}
            </button>
          </form>
        ) : (
          /* TAMPILAN 2: DASHBOARD ABSENSI */
          <div style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Pilih Nama Karyawan:</label>
              <select value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)} style={styles.select}>
                <option value="">-- Pilih Nama Anda --</option>
                {employees.map((emp, idx) => (
                  <option key={idx} value={emp.nama}>
                    {emp.nama} ({emp.jabatan})
                  </option>
                ))}
              </select>
            </div>

            <button onClick={requestLocationAndConfirm} disabled={loading} style={{ ...styles.button, backgroundColor: "#1F4E78" }}>
              {loading ? "Mengambil GPS..." : "Kirim Absensi"}
            </button>
          </div>
        )}
      </div>

      {/* POP-UP MODAL KONFIRMASI INTEGRITAS */}
      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h3>Konfirmasi Kehadiran</h3>
            <p>
              Saya menyatakan dengan sungguh-sungguh bahwa saya adalah <strong>{selectedEmployee}</strong> dan hadir secara fisik di lokasi kantor saat ini.
            </p>
            <div style={styles.modalActions}>
              <button onClick={() => setShowModal(false)} style={{ ...styles.modalButton, backgroundColor: "#6c757d" }}>
                Batal
              </button>
              <button onClick={handleSubmitAttendance} style={{ ...styles.modalButton, backgroundColor: "#28a745" }}>
                Ya, Saya Menandatangani
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline Styling
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
    backgroundColor: "#007bff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
  },
  alert: {
    padding: "12px",
    borderRadius: "6px",
    fontSize: "14px",
    marginBottom: "15px",
    textAlign: "center",
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
  },
  modalContent: {
    backgroundColor: "#fff",
    padding: "20px",
    borderRadius: "10px",
    maxWidth: "350px",
    width: "100%",
    textAlign: "center",
  },
  modalActions: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    marginTop: "20px",
  },
  modalButton: {
    flex: 1,
    padding: "10px",
    border: "none",
    borderRadius: "6px",
    color: "#fff",
    fontWeight: "bold",
    cursor: "pointer",
  },
};

export default App;
