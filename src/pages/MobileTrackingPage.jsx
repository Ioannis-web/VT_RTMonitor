import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function MobileTrackingPage() {
  const watchIdRef = useRef(null);
  const lastInsertAtRef = useRef(0);
  const autoStartAttemptedRef = useRef(false);

  const [vehicles, setVehicles] = useState([]);
  const [missions, setMissions] = useState([]);

  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [selectedMissionId, setSelectedMissionId] = useState("");
  const [trackerSimNumber, setTrackerSimNumber] = useState(() => {
    return window.localStorage.getItem("visionterra-tracker-sim") || "";
  });
  const [autoStartEnabled, setAutoStartEnabled] = useState(() => {
    return window.localStorage.getItem("visionterra-auto-start-gps") !== "false";
  });

  const [tracking, setTracking] = useState(false);
  const [status, setStatus] = useState("Ανενεργό");
  const [lastPosition, setLastPosition] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [insertCount, setInsertCount] = useState(0);
  const [savingMissionStatus, setSavingMissionStatus] = useState(false);

  const [settings, setSettings] = useState({
    minIntervalSeconds: 5,
    minAccuracyMeters: 100,
  });

  useEffect(() => {
    window.localStorage.setItem("visionterra-tracker-sim", trackerSimNumber);
  }, [trackerSimNumber]);

  useEffect(() => {
    window.localStorage.setItem(
      "visionterra-auto-start-gps",
      String(autoStartEnabled)
    );
  }, [autoStartEnabled]);

  useEffect(() => {
    if (!trackerSimNumber || vehicles.length === 0 || tracking) return;

    const matchedVehicle = vehicles.find((vehicle) =>
      phoneNumbersMatch(trackerSimNumber, vehicle.sim_number)
    );

    if (matchedVehicle) {
      setSelectedVehicleId(matchedVehicle.id);
      setErrorMessage("");
    } else {
      setErrorMessage(
        "Δεν βρέθηκε όχημα με αυτόν τον αριθμό SIM. Έλεγξε το SIM Number στην καρτέλα Οχήματα."
      );
    }
  }, [trackerSimNumber, tracking, vehicles]);

  useEffect(() => {
    if (!selectedVehicleId) return;

    const filtered = missions.filter((mission) => {
      return (
        !mission.assigned_vehicle_id ||
        mission.assigned_vehicle_id === selectedVehicleId
      );
    });

    if (
      selectedMissionId &&
      !filtered.some((mission) => mission.id === selectedMissionId)
    ) {
      setSelectedMissionId("");
    }
  }, [selectedVehicleId, missions, selectedMissionId]);

  const loadVehicles = useCallback(async () => {
    const { data, error } = await supabase
      .from("vehicles")
      .select("id, name, code, status, sim_number")
      .order("name", { ascending: true });

    if (error) {
      console.error("Vehicles fetch error:", error);
      setErrorMessage("Σφάλμα φόρτωσης οχημάτων.");
      return;
    }

    setVehicles(data || []);

    if (data?.length > 0) {
      setSelectedVehicleId((prev) => prev || data[0].id);
    }
  }, []);

  const loadMissions = useCallback(async () => {
    const { data, error } = await supabase
      .from("missions")
      .select(`
        id,
        title,
        mission_date,
        mission_type,
        status,
        priority,
        assigned_vehicle_id,
        actual_start,
        actual_end,
        vehicles:assigned_vehicle_id (
          id,
          name,
          code
        )
      `)
      .in("status", ["planned", "assigned", "accepted", "in_progress"])
      .order("mission_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Missions fetch error:", error);
      setErrorMessage("Σφάλμα φόρτωσης αποστολών.");
      return;
    }

    setMissions(data || []);
  }, []);

  const startMissionIfNeeded = useCallback(async (missionId) => {
    const mission = missions.find((item) => item.id === missionId);

    if (!mission) return;

    if (mission.status === "in_progress") return;

    setSavingMissionStatus(true);

    const payload = {
      status: "in_progress",
      actual_start: mission.actual_start || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("missions")
      .update(payload)
      .eq("id", missionId);

    if (error) {
      console.error("Mission start error:", error);
      setErrorMessage("Σφάλμα αλλαγής κατάστασης αποστολής σε in_progress.");
      setSavingMissionStatus(false);
      return;
    }

    setMissions((prev) =>
      prev.map((item) =>
        item.id === missionId
          ? {
              ...item,
              ...payload,
            }
          : item
      )
    );

    setSavingMissionStatus(false);
  }, [missions]);

  const handlePositionError = useCallback((error) => {
    console.error("Geolocation error:", error);

    const messages = {
      1: "Δεν δόθηκε άδεια GPS από τον χρήστη.",
      2: "Η θέση δεν είναι διαθέσιμη.",
      3: "Έληξε ο χρόνος αναμονής GPS.",
    };

    setErrorMessage(messages[error.code] || error.message || "Σφάλμα GPS.");
    setStatus("Σφάλμα GPS");
  }, []);

  const handlePositionSuccess = useCallback(async (position) => {
    const now = Date.now();
    const minIntervalMs = Number(settings.minIntervalSeconds) * 1000;

    if (now - lastInsertAtRef.current < minIntervalMs) {
      return;
    }

    const coords = position.coords;
    const accuracy = coords.accuracy ?? null;

    if (
      accuracy !== null &&
      Number(settings.minAccuracyMeters) > 0 &&
      accuracy > Number(settings.minAccuracyMeters)
    ) {
      setStatus(`Αγνόηση στίγματος: χαμηλή ακρίβεια ${Math.round(accuracy)}m`);
      return;
    }

    const payload = {
      vehicle_id: selectedVehicleId,
      mission_id: selectedMissionId || null,
      latitude: coords.latitude,
      longitude: coords.longitude,
      altitude_m: coords.altitude,
      speed_kmh:
        coords.speed == null ? null : Number((coords.speed * 3.6).toFixed(2)),
      heading: coords.heading,
      accuracy_m: accuracy,
      engine_on: null,
      ignition_on: null,
      source: "mobile_app",
      raw_payload: {
        timestamp: position.timestamp,
        altitudeAccuracy: coords.altitudeAccuracy,
        speed_ms: coords.speed,
        userAgent: navigator.userAgent,
      },
      recorded_at: new Date(position.timestamp || Date.now()).toISOString(),
    };

    const { error } = await supabase.from("vehicle_positions").insert(payload);

    if (error) {
      console.error("Position insert error:", error);
      setErrorMessage("Σφάλμα αποθήκευσης θέσης στο Supabase.");
      setStatus("Σφάλμα");
      return;
    }

    lastInsertAtRef.current = now;
    setLastPosition(payload);
    setInsertCount((prev) => prev + 1);
    setStatus("Τελευταία θέση αποθηκεύτηκε επιτυχώς");
  }, [
    selectedMissionId,
    selectedVehicleId,
    settings.minAccuracyMeters,
    settings.minIntervalSeconds,
  ]);

  const startTracking = useCallback(async () => {
    setErrorMessage("");

    if (watchIdRef.current !== null) {
      return;
    }

    if (!selectedVehicleId) {
      setErrorMessage("Επίλεξε όχημα.");
      return;
    }

    if (!("geolocation" in navigator)) {
      setErrorMessage("Το κινητό/browser δεν υποστηρίζει GPS geolocation.");
      return;
    }

    if (selectedMissionId) {
      await startMissionIfNeeded(selectedMissionId);
    }

    setStatus("Ζητείται άδεια GPS...");

    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePositionSuccess,
      handlePositionError,
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      }
    );

    setTracking(true);
    setStatus("Ενεργό tracking");
  }, [
    handlePositionError,
    handlePositionSuccess,
    selectedMissionId,
    selectedVehicleId,
    startMissionIfNeeded,
  ]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setTracking(false);
    setStatus("Ανενεργό");
  }, []);

  useEffect(() => {
    loadVehicles();
    loadMissions();

    return () => {
      stopTracking();
    };
  }, [loadMissions, loadVehicles, stopTracking]);

  useEffect(() => {
    const selectedVehicleForAutoStart = vehicles.find(
      (vehicle) => vehicle.id === selectedVehicleId
    );

    if (
      !autoStartEnabled ||
      autoStartAttemptedRef.current ||
      tracking ||
      !selectedVehicleId ||
      vehicles.length === 0 ||
      (trackerSimNumber &&
        !phoneNumbersMatch(trackerSimNumber, selectedVehicleForAutoStart?.sim_number))
    ) {
      return;
    }

    autoStartAttemptedRef.current = true;
    startTracking();
  }, [
    autoStartEnabled,
    selectedVehicleId,
    startTracking,
    tracking,
    trackerSimNumber,
    vehicles,
    vehicles.length,
  ]);

  async function completeMission() {
    setErrorMessage("");

    if (!selectedMissionId) {
      setErrorMessage("Δεν έχει επιλεγεί αποστολή.");
      return;
    }

    stopTracking();

    setSavingMissionStatus(true);

    const payload = {
      status: "completed",
      actual_end: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("missions")
      .update(payload)
      .eq("id", selectedMissionId);

    if (error) {
      console.error("Mission complete error:", error);
      setErrorMessage("Σφάλμα ολοκλήρωσης αποστολής.");
      setSavingMissionStatus(false);
      return;
    }

    setMissions((prev) =>
      prev.map((item) =>
        item.id === selectedMissionId
          ? {
              ...item,
              ...payload,
            }
          : item
      )
    );

    setStatus("Η αποστολή ολοκληρώθηκε.");
    setSavingMissionStatus(false);

    await loadMissions();
  }

  function handleSettingsChange(e) {
    const { name, value } = e.target;

    setSettings((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);

  const availableMissions = missions.filter((mission) => {
    if (!selectedVehicleId) return true;

    return (
      !mission.assigned_vehicle_id ||
      mission.assigned_vehicle_id === selectedVehicleId
    );
  });

  const selectedMission = missions.find((m) => m.id === selectedMissionId);

  return (
    <div className="min-h-screen bg-slate-100 p-4">
      <div className="max-w-xl mx-auto space-y-4">
        <div className="bg-white rounded-2xl shadow p-5">
          <h1 className="text-2xl font-bold text-slate-900">
            Mobile GPS Tracking
          </h1>
          <p className="text-slate-600 mt-1">
            Χρήση κινητού ως προσωρινό GPS tracker οχήματος και αποστολής.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Επιλογή οχήματος
            </label>

            <input
              value={trackerSimNumber}
              onChange={(e) => setTrackerSimNumber(e.target.value)}
              disabled={tracking}
              className="w-full border rounded-lg px-3 py-3 text-base mb-3"
              placeholder="Αριθμός SIM/κινητού που έχεις βάλει στο όχημα"
            />

            <select
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              disabled={tracking}
              className="w-full border rounded-lg px-3 py-3 text-base"
            >
              {vehicles.length === 0 ? (
                <option value="">Δεν υπάρχουν οχήματα</option>
              ) : (
                vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.name}
                    {vehicle.code ? ` — ${vehicle.code}` : ""}
                    {vehicle.sim_number ? ` — ${vehicle.sim_number}` : ""}
                  </option>
                ))
              )}
            </select>
          </div>

          {selectedVehicle && (
            <div className="bg-slate-50 rounded-xl p-3 text-sm">
              <div>
                <b>Όχημα:</b> {selectedVehicle.name}
              </div>
              <div>
                <b>Κωδικός:</b> {selectedVehicle.code || "-"}
              </div>
              <div>
                <b>Status:</b> {selectedVehicle.status || "-"}
              </div>
              <div>
                <b>SIM:</b> {selectedVehicle.sim_number || "-"}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">
              Επιλογή αποστολής
            </label>

            <select
              value={selectedMissionId}
              onChange={(e) => setSelectedMissionId(e.target.value)}
              disabled={tracking}
              className="w-full border rounded-lg px-3 py-3 text-base"
            >
              <option value="">Χωρίς σύνδεση με αποστολή</option>

              {availableMissions.map((mission) => (
                <option key={mission.id} value={mission.id}>
                  {mission.mission_date} — {mission.title} — {mission.status}
                </option>
              ))}
            </select>
          </div>

          {selectedMission && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm">
              <div className="font-semibold text-blue-900 mb-1">
                Επιλεγμένη αποστολή
              </div>

              <div>
                <b>Τίτλος:</b> {selectedMission.title}
              </div>

              <div>
                <b>Ημερομηνία:</b> {selectedMission.mission_date}
              </div>

              <div>
                <b>Τύπος:</b> {selectedMission.mission_type}
              </div>

              <div>
                <b>Status:</b> {selectedMission.status}
              </div>

              <div>
                <b>Προτεραιότητα:</b> {selectedMission.priority}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">
                Διάστημα/sec
              </label>

              <input
                name="minIntervalSeconds"
                value={settings.minIntervalSeconds}
                onChange={handleSettingsChange}
                type="number"
                min="2"
                className="w-full border rounded-lg px-3 py-2"
                disabled={tracking}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Ακρίβεια/m
              </label>

              <input
                name="minAccuracyMeters"
                value={settings.minAccuracyMeters}
                onChange={handleSettingsChange}
                type="number"
                min="0"
                className="w-full border rounded-lg px-3 py-2"
                disabled={tracking}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={autoStartEnabled}
              onChange={(e) => {
                autoStartAttemptedRef.current = false;
                setAutoStartEnabled(e.target.checked);
              }}
              disabled={tracking}
            />
            Αυτόματη εκκίνηση GPS όταν ανοίγει η σελίδα
          </label>

          {!tracking ? (
            <button
              onClick={startTracking}
              disabled={savingMissionStatus}
              className="w-full bg-emerald-700 text-white py-3 rounded-xl font-semibold hover:bg-emerald-800 disabled:opacity-50"
            >
              {savingMissionStatus
                ? "Ενημέρωση αποστολής..."
                : "Έναρξη αποστολής θέσης"}
            </button>
          ) : (
            <button
              onClick={stopTracking}
              className="w-full bg-red-600 text-white py-3 rounded-xl font-semibold hover:bg-red-700"
            >
              Διακοπή tracking
            </button>
          )}

          {selectedMissionId && (
            <button
              onClick={completeMission}
              disabled={savingMissionStatus}
              className="w-full bg-slate-900 text-white py-3 rounded-xl font-semibold hover:bg-black disabled:opacity-50"
            >
              {savingMissionStatus
                ? "Αποθήκευση..."
                : "Ολοκλήρωση αποστολής"}
            </button>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Κατάσταση</div>

            <span
              className={`text-sm rounded-full px-3 py-1 ${
                tracking
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {tracking ? "Ενεργό" : "Ανενεργό"}
            </span>
          </div>

          <div className="text-sm text-slate-700">{status}</div>

          <div className="text-sm">
            <b>Αποθηκευμένα στίγματα:</b> {insertCount}
          </div>

          {errorMessage && (
            <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 text-sm">
              {errorMessage}
            </div>
          )}
        </div>

        {lastPosition && (
          <div className="bg-white rounded-2xl shadow p-5 space-y-2 text-sm">
            <div className="font-semibold">Τελευταία θέση</div>

            <div>
              <b>Latitude:</b> {lastPosition.latitude}
            </div>

            <div>
              <b>Longitude:</b> {lastPosition.longitude}
            </div>

            <div>
              <b>Speed:</b>{" "}
              {lastPosition.speed_kmh == null
                ? "-"
                : `${lastPosition.speed_kmh} km/h`}
            </div>

            <div>
              <b>Heading:</b> {lastPosition.heading ?? "-"}
            </div>

            <div>
              <b>Accuracy:</b>{" "}
              {lastPosition.accuracy_m == null
                ? "-"
                : `${Math.round(lastPosition.accuracy_m)} m`}
            </div>

            <div>
              <b>Mission ID:</b> {lastPosition.mission_id || "-"}
            </div>

            <div>
              <b>Recorded at:</b>{" "}
              {new Date(lastPosition.recorded_at).toLocaleString("el-GR")}
            </div>
          </div>
        )}

        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 text-sm">
          Για να δουλέψει σωστά από κινητό, άνοιξε τη σελίδα μέσω HTTPS. Σε
          απλό HTTP από τοπικό δίκτυο μπορεί να μη δοθεί πρόσβαση GPS.
        </div>
      </div>
    </div>
  );
}

function normalizePhoneNumber(value) {
  return String(value || "").replace(/\D/g, "");
}

function phoneNumbersMatch(input, stored) {
  const inputNumber = normalizePhoneNumber(input);
  const storedNumber = normalizePhoneNumber(stored);

  if (!inputNumber || !storedNumber) return false;
  if (inputNumber === storedNumber) return true;

  const inputTail = inputNumber.slice(-10);
  const storedTail = storedNumber.slice(-10);

  return inputTail.length >= 10 && inputTail === storedTail;
}
