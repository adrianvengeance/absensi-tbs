import React, { useState, useEffect } from "react";
import { getHardwareFingerprint, calculateDistance, isWithinWorkingHoursClient, getFormattedDate, getFormattedTime } from "./utils/helper";
import "./app.css";

const API_URL = import.meta.env.VITE_API_URL;
const MAX_RADIUS_METER = 50;

const RealtimeClock = () => {
  const [timeStr, setTimeStr] = useState(getFormattedTime());
  const [dateStr, setDateStr] = useState(getFormattedDate());

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeStr(getFormattedTime());
      setDateStr(getFormattedDate());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="clock-container">
      <div className="clock-date">📅 {dateStr}</div>
      <div className="clock-time">🕰️ {timeStr}</div>
    </div>
  );
};

const AlertMessage = ({ message }) => {
  if (!message.text) return null;
  const alertClass = message.type === "error" ? "alert-error" : "alert-success";
  return <div className={`alert-box ${alertClass}`}>{message.text}</div>;
};

const SuccessScreen = ({ currentUser, statusAbsen }) => (
  <div className="app-container">
    <div className="app-card app-card-center">
      <div className="success-icon">✅</div>
      <h2 className="success-title">Absensi Berhasil!</h2>
      <p className="success-user">{currentUser?.nama}</p>
      <p className="success-desc">Anda telah berhasil mencatatkan kehadiran ({statusAbsen}) untuk hari ini. Terima kasih!</p>
    </div>
  </div>
);

const LoginForm = ({ inputPin, setInputPin, handleLogin, loadingLogin }) => (
  <form onSubmit={handleLogin} className="app-form">
    <div className="input-group">
      <label className="input-label">Masukkan PIN Anda:</label>
      <input type="password" value={inputPin} onChange={(e) => setInputPin(e.target.value)} placeholder="****" maxLength={6} className="input-control" disabled={loadingLogin} required />
    </div>
    <button type="submit" disabled={loadingLogin} className="btn-primary">
      {loadingLogin ? "Memproses..." : "Masuk Aplikasi"}
    </button>
  </form>
);

const AttendanceForm = ({ currentUser, distanceMeter, loadingGps, fetchGPSLocation, statusAbsen, setStatusAbsen, keterangan, setKeterangan, handleSubmitAttendance, submitting, isBlocked }) => {
  const isNeedLocationValidation = statusAbsen === "Hadir";
  const isLocationInvalid = isNeedLocationValidation && (distanceMeter === null || distanceMeter > MAX_RADIUS_METER);
  const isKeteranganMissing = statusAbsen !== "Hadir" && !keterangan.trim();

  const isSubmitDisabled = submitting || isLocationInvalid || isKeteranganMissing || isBlocked;

  return (
    <div className="app-form">
      <div className="profile-box">
        <h3 className="profile-name">{currentUser.nama}</h3>
        <p className="profile-role">{currentUser.jabatan}</p>
      </div>

      <div className="input-group">
        <label className="input-label">Status Kehadiran:</label>
        <select value={statusAbsen} onChange={(e) => setStatusAbsen(e.target.value)} disabled={submitting || isBlocked} className="select-control">
          <option value="Hadir">Hadir</option>
          <option value="Sakit">Sakit</option>
          <option value="Izin">Izin</option>
          <option value="Tugas Luar">Tugas Luar</option>
        </select>
      </div>

      {statusAbsen !== "Hadir" && (
        <div className="input-group">
          <label className="input-label">
            Keterangan ({statusAbsen}) <span style={{ color: "red" }}>*</span>:
          </label>
          <input type="text" value={keterangan} onChange={(e) => setKeterangan(e.target.value)} placeholder={`Alasan/Keterangan ${statusAbsen}...`} className="input-control" disabled={submitting || isBlocked} required />
        </div>
      )}

      <div className="gps-box">
        <div className="gps-header">
          <span className="gps-title">Info Lokasi GPS:</span>
          <button type="button" onClick={fetchGPSLocation} disabled={loadingGps || isBlocked} className="btn-refresh">
            {loadingGps ? "Memperbarui..." : "🔄 Perbarui Lokasi"}
          </button>
        </div>

        <div className="gps-status-container">
          {distanceMeter !== null ? (
            <p className={`gps-distance-text ${distanceMeter <= MAX_RADIUS_METER ? "gps-distance-in" : "gps-distance-out"}`}>
              Jarak dari Kantor: {distanceMeter} meter
              {statusAbsen === "Hadir" ? (distanceMeter <= MAX_RADIUS_METER ? " (Di dalam Radius)" : " (Terlalu Jauh)") : " (Abaikan Jarak)"}
            </p>
          ) : (
            <p className="gps-loading-text">{loadingGps ? "Mencari lokasi GPS..." : "Lokasi belum terdeteksi."}</p>
          )}
        </div>
      </div>

      <button onClick={handleSubmitAttendance} disabled={isSubmitDisabled} className="btn-primary">
        {submitting ? "Mengirim Data..." : isBlocked ? "Akses Absensi Ditolak" : "Kirim Absensi"}
      </button>
    </div>
  );
};

function App() {
  const [configData, setConfigData] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  const [inputPin, setInputPin] = useState("");
  const [statusAbsen, setStatusAbsen] = useState("Hadir");
  const [keterangan, setKeterangan] = useState("");
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

    if (!isWithinWorkingHoursClient()) {
      setMessage({
        type: "error",
        text: "Aplikasi Absensi saat ini TUTUP. Jam operasional: 07:00 - 17:00.",
      });
      setIsBlocked(true);
    }
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
    if (!currentUser || isBlocked) return;

    if (!isWithinWorkingHoursClient()) {
      setMessage({
        type: "error",
        text: "Absensi ditolak! Aplikasi hanya dapat diakses pada pukul 07:00 - 17:00.",
      });
      setIsBlocked(true);
      return;
    }

    if (statusAbsen === "Hadir" && (distanceMeter === null || distanceMeter > MAX_RADIUS_METER)) {
      setMessage({
        type: "error",
        text: `Jarak Anda (${distanceMeter}m) melebihi batas lokasi kantor (${MAX_RADIUS_METER}m).`,
      });
      return;
    }

    if (statusAbsen !== "Hadir" && !keterangan.trim()) {
      setMessage({ type: "error", text: "Tolong isi Keterangan/Alasan terlebih dahulu!" });
      return;
    }

    setSubmitting(true);
    setMessage({ type: "", text: "" });

    const payload = {
      nama: currentUser.nama,
      statusAbsen: statusAbsen,
      keterangan: statusAbsen !== "Hadir" ? keterangan.trim() : "",
      hardwareFingerprint: hardwareFp,
      lat: userLocation ? userLocation.lat : 0,
      lng: userLocation ? userLocation.lng : 0,
      distance: distanceMeter || 0,
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
      <div className="app-container">
        <div className="app-card">
          <p className="app-card-center">Memuat konfigurasi aplikasi...</p>
        </div>
      </div>
    );
  }

  if (isSubmitted) {
    return <SuccessScreen currentUser={currentUser} statusAbsen={statusAbsen} />;
  }

  return (
    <div className="app-container">
      <div className="app-card">
        <h2 className="app-title">PT. TRIKORA BANGKEP SEJAHTERA</h2>
        <p className="app-subtitle">Absensi Digital</p>

        <RealtimeClock />

        <AlertMessage message={message} />

        {!currentUser ? (
          <LoginForm inputPin={inputPin} setInputPin={setInputPin} handleLogin={handleLogin} loadingLogin={loadingLogin} />
        ) : (
          <AttendanceForm
            currentUser={currentUser}
            distanceMeter={distanceMeter}
            loadingGps={loadingGps}
            fetchGPSLocation={fetchGPSLocation}
            statusAbsen={statusAbsen}
            setStatusAbsen={setStatusAbsen}
            keterangan={keterangan}
            setKeterangan={setKeterangan}
            handleSubmitAttendance={handleSubmitAttendance}
            submitting={submitting}
            isBlocked={isBlocked}
          />
        )}
      </div>
    </div>
  );
}

export default App;
