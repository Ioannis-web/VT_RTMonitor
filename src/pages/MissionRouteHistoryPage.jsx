import { useEffect, useMemo, useState } from "react";
import {
  APIProvider,
  Map,
  Marker,
  InfoWindow,
  useMap,
} from "@vis.gl/react-google-maps";
import { supabase } from "../lib/supabaseClient";

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

const DEFAULT_CENTER = {
  lat: 40.6401,
  lng: 22.9444,
};

export default function MissionRouteHistoryPage() {
  const [missions, setMissions] = useState([]);
  const [selectedMissionId, setSelectedMissionId] = useState("");
  const [mission, setMission] = useState(null);
  const [routePoints, setRoutePoints] = useState([]);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [loadingMissions, setLoadingMissions] = useState(true);
  const [loadingRoute, setLoadingRoute] = useState(false);

  useEffect(() => {
    loadMissions();
  }, []);

  useEffect(() => {
    if (selectedMissionId) {
      loadMissionRoute(selectedMissionId);
    }
  }, [selectedMissionId]);

  async function loadMissions() {
    setLoadingMissions(true);

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
        assigned_drone_id,
        actual_start,
        actual_end,
        planned_start,
        planned_end,
        vehicles:assigned_vehicle_id (
          id,
          name,
          code,
          plate_number,
          vehicle_type
        ),
        drones:assigned_drone_id (
          id,
          name,
          code,
          model
        )
      `)
      .order("mission_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Missions fetch error:", error);
      alert("Σφάλμα φόρτωσης αποστολών");
      setLoadingMissions(false);
      return;
    }

    setMissions(data || []);

    if (data?.length > 0) {
      setSelectedMissionId(data[0].id);
    }

    setLoadingMissions(false);
  }

  async function loadMissionRoute(missionId) {
    setLoadingRoute(true);
    setSelectedPoint(null);

    const selected = missions.find((m) => m.id === missionId);
    setMission(selected || null);

    const { data, error } = await supabase
      .from("vehicle_positions")
      .select(`
        id,
        mission_id,
        vehicle_id,
        latitude,
        longitude,
        altitude_m,
        speed_kmh,
        heading,
        accuracy_m,
        source,
        recorded_at
      `)
      .eq("mission_id", missionId)
      .order("recorded_at", { ascending: true });

    if (error) {
      console.error("Mission route fetch error:", error);
      alert("Σφάλμα φόρτωσης διαδρομής αποστολής");
      setRoutePoints([]);
      setLoadingRoute(false);
      return;
    }

    const validPoints = (data || []).filter(
      (p) =>
        p.latitude !== null &&
        p.longitude !== null &&
        !Number.isNaN(Number(p.latitude)) &&
        !Number.isNaN(Number(p.longitude))
    );

    setRoutePoints(validPoints);
    setLoadingRoute(false);
  }

  const path = useMemo(() => {
    return routePoints.map((p) => ({
      lat: Number(p.latitude),
      lng: Number(p.longitude),
    }));
  }, [routePoints]);

  const routeStats = useMemo(() => {
    if (routePoints.length === 0) {
      return {
        points: 0,
        distanceKm: 0,
        maxSpeed: null,
        avgSpeed: null,
        startTime: null,
        endTime: null,
      };
    }

    let distanceMeters = 0;

    for (let i = 1; i < routePoints.length; i += 1) {
      distanceMeters += haversineMeters(
        Number(routePoints[i - 1].latitude),
        Number(routePoints[i - 1].longitude),
        Number(routePoints[i].latitude),
        Number(routePoints[i].longitude)
      );
    }

    const speeds = routePoints
      .map((p) => p.speed_kmh)
      .filter((speed) => speed !== null && !Number.isNaN(Number(speed)))
      .map(Number);

    const maxSpeed = speeds.length > 0 ? Math.max(...speeds) : null;

    const avgSpeed =
      speeds.length > 0
        ? speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length
        : null;

    return {
      points: routePoints.length,
      distanceKm: distanceMeters / 1000,
      maxSpeed,
      avgSpeed,
      startTime: routePoints[0]?.recorded_at || null,
      endTime: routePoints[routePoints.length - 1]?.recorded_at || null,
    };
  }, [routePoints]);

  const mapCenter = path.length > 0 ? path[0] : DEFAULT_CENTER;
  const startPoint = routePoints[0] || null;
  const endPoint = routePoints[routePoints.length - 1] || null;

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4">
          Δεν έχει οριστεί Google Maps API key. Πρόσθεσε στο <b>.env</b>:
          <pre className="mt-3 bg-white p-3 rounded">
            REACT_APP_GOOGLE_MAPS_API_KEY=YOUR_KEY
          </pre>
          Μετά κάνε restart το React development server.
        </div>
      </div>
    );
  }

  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
      <div className="p-6 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Route History ανά Αποστολή
            </h1>
            <p className="text-slate-600">
              Διαδρομή οχήματος για συγκεκριμένη αποστολή.
            </p>
          </div>

          <button
            onClick={() => loadMissionRoute(selectedMissionId)}
            disabled={!selectedMissionId || loadingRoute}
            className="bg-emerald-700 text-white px-4 py-2 rounded-lg hover:bg-emerald-800 disabled:opacity-50"
          >
            {loadingRoute ? "Φόρτωση..." : "Ανανέωση"}
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">
              Επιλογή αποστολής
            </label>

            {loadingMissions ? (
              <div className="text-slate-500">Φόρτωση αποστολών...</div>
            ) : (
              <select
                value={selectedMissionId}
                onChange={(e) => setSelectedMissionId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              >
                {missions.length === 0 ? (
                  <option value="">Δεν υπάρχουν αποστολές</option>
                ) : (
                  missions.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.mission_date} — {m.title} — {m.status}
                      {m.vehicles?.name ? ` — ${m.vehicles.name}` : ""}
                    </option>
                  ))
                )}
              </select>
            )}
          </div>

          <div className="bg-slate-50 rounded-xl p-3 text-sm">
            <div className="font-semibold mb-1">Στοιχεία αποστολής</div>
            <div>{mission?.title || "-"}</div>
            <div className="text-slate-500">
              {mission?.mission_date || "-"} / {mission?.status || "-"}
            </div>
            <div className="text-slate-500">
              Όχημα: {mission?.vehicles?.name || "-"}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <StatCard label="Στίγματα" value={routeStats.points} />
          <StatCard
            label="Απόσταση"
            value={`${routeStats.distanceKm.toFixed(2)} km`}
          />
          <StatCard
            label="Μέγ. ταχύτητα"
            value={
              routeStats.maxSpeed == null
                ? "-"
                : `${routeStats.maxSpeed.toFixed(1)} km/h`
            }
          />
          <StatCard
            label="Μέση ταχύτητα"
            value={
              routeStats.avgSpeed == null
                ? "-"
                : `${routeStats.avgSpeed.toFixed(1)} km/h`
            }
          />
          <StatCard
            label="Πηγή"
            value={routePoints[routePoints.length - 1]?.source || "-"}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          <div className="xl:col-span-3 bg-white rounded-2xl shadow overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <div className="font-semibold">
                Χάρτης διαδρομής — {routePoints.length} σημεία
              </div>

              <div className="text-sm text-slate-500">
                {routeStats.startTime
                  ? `${formatDate(routeStats.startTime)} → ${formatDate(
                      routeStats.endTime
                    )}`
                  : "Χωρίς διαδρομή"}
              </div>
            </div>

            <div style={{ width: "100%", height: "650px" }}>
              <Map
                defaultCenter={mapCenter}
                defaultZoom={14}
                mapTypeId="hybrid"
                gestureHandling="greedy"
                disableDefaultUI={false}
                style={{ width: "100%", height: "100%" }}
              >
                <RoutePolyline path={path} />

                {startPoint && (
                  <Marker
                    position={{
                      lat: Number(startPoint.latitude),
                      lng: Number(startPoint.longitude),
                    }}
                    onClick={() => setSelectedPoint(startPoint)}
                  >
                    <div className="w-10 h-10 rounded-full bg-emerald-100 border-2 border-emerald-700 shadow flex items-center justify-center text-lg cursor-pointer">
                      🟢
                    </div>
                  </Marker>
                )}

                {endPoint && (
                  <Marker
                    position={{
                      lat: Number(endPoint.latitude),
                      lng: Number(endPoint.longitude),
                    }}
                    onClick={() => setSelectedPoint(endPoint)}
                  >
                    <div className="w-10 h-10 rounded-full bg-red-100 border-2 border-red-700 shadow flex items-center justify-center text-lg cursor-pointer">
                      🔴
                    </div>
                  </Marker>
                )}

                {routePoints.map((point, index) => {
                  const isStart = index === 0;
                  const isEnd = index === routePoints.length - 1;

                  if (isStart || isEnd) return null;

                  return (
                    <Marker
                      key={point.id}
                      position={{
                        lat: Number(point.latitude),
                        lng: Number(point.longitude),
                      }}
                      onClick={() => setSelectedPoint(point)}
                    >
                      <div className="w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow cursor-pointer" />
                    </Marker>
                  );
                })}

                {selectedPoint && (
                  <InfoWindow
                    position={{
                      lat: Number(selectedPoint.latitude),
                      lng: Number(selectedPoint.longitude),
                    }}
                    onCloseClick={() => setSelectedPoint(null)}
                  >
                    <div className="text-sm space-y-1 min-w-[220px]">
                      <div className="font-bold">Στίγμα αποστολής</div>

                      <div>
                        <b>Ώρα:</b> {formatDate(selectedPoint.recorded_at)}
                      </div>

                      <div>
                        <b>Ταχύτητα:</b>{" "}
                        {selectedPoint.speed_kmh == null
                          ? "-"
                          : `${selectedPoint.speed_kmh} km/h`}
                      </div>

                      <div>
                        <b>Heading:</b> {selectedPoint.heading ?? "-"}
                      </div>

                      <div>
                        <b>Accuracy:</b>{" "}
                        {selectedPoint.accuracy_m == null
                          ? "-"
                          : `${Math.round(selectedPoint.accuracy_m)} m`}
                      </div>

                      <div>
                        <b>Πηγή:</b> {selectedPoint.source || "-"}
                      </div>

                      <div className="text-xs text-slate-500 pt-1">
                        Lat: {selectedPoint.latitude} / Lng:{" "}
                        {selectedPoint.longitude}
                      </div>
                    </div>
                  </InfoWindow>
                )}
              </Map>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow overflow-hidden">
            <div className="p-4 border-b font-semibold">Στίγματα</div>

            {loadingRoute ? (
              <div className="p-4 text-slate-500">Φόρτωση...</div>
            ) : routePoints.length === 0 ? (
              <div className="p-4 text-slate-500">
                Δεν υπάρχουν στίγματα για αυτή την αποστολή.
              </div>
            ) : (
              <div className="divide-y max-h-[650px] overflow-y-auto">
                {routePoints.map((point, index) => (
                  <button
                    key={point.id}
                    onClick={() => setSelectedPoint(point)}
                    className="w-full text-left p-4 hover:bg-slate-50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold">
                        #{index + 1}{" "}
                        {index === 0
                          ? "Αρχή"
                          : index === routePoints.length - 1
                          ? "Τέλος"
                          : "Στίγμα"}
                      </div>

                      <span className="text-xs bg-slate-100 rounded-full px-2 py-1">
                        {point.source || "-"}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 mt-2">
                      {formatDate(point.recorded_at)}
                    </div>

                    <div className="text-xs text-slate-600">
                      {Number(point.latitude).toFixed(5)},{" "}
                      {Number(point.longitude).toFixed(5)}
                    </div>

                    <div className="text-xs text-slate-600">
                      Speed:{" "}
                      {point.speed_kmh == null
                        ? "-"
                        : `${point.speed_kmh} km/h`}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </APIProvider>
  );
}

function RoutePolyline({ path }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !window.google || path.length < 2) return;

    const polyline = new window.google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: "#2563eb",
      strokeOpacity: 1,
      strokeWeight: 5,
    });

    polyline.setMap(map);

    const bounds = new window.google.maps.LatLngBounds();

    path.forEach((point) => {
      bounds.extend(point);
    });

    map.fitBounds(bounds);

    return () => {
      polyline.setMap(null);
    };
  }, [map, path]);

  return null;
}

function StatCard({ label, value }) {
  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
    </div>
  );
}

function formatDate(value) {
  if (!value) return "-";

  try {
    return new Date(value).toLocaleString("el-GR");
  } catch {
    return value;
  }
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const earthRadiusMeters = 6371000;

  const toRad = (value) => (value * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMeters * c;
}
