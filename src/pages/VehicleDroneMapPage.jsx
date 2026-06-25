import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    APIProvider,
    Map,
    AdvancedMarker,
    InfoWindow,
    useMap,
} from "@vis.gl/react-google-maps";
import { supabase } from "../lib/supabaseClient";

const DEFAULT_CENTER = {
    lat: 40.6401,
    lng: 22.9444,
};

const GOOGLE_MAP_ID = process.env.REACT_APP_GOOGLE_MAP_ID;
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

export default function VehicleDroneMapPage() {
    const [assets, setAssets] = useState([]);
    const [selectedAsset, setSelectedAsset] = useState(null);
    const [loading, setLoading] = useState(true);
    const selectedAssetKeyRef = useRef(null);
    const autoFollowMobileRef = useRef(true);

    const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
    const [mapZoom, setMapZoom] = useState(13);
    const [autoFollowMobile, setAutoFollowMobile] = useState(true);

    useEffect(() => {
        autoFollowMobileRef.current = autoFollowMobile;
    }, [autoFollowMobile]);

    useEffect(() => {
        selectedAssetKeyRef.current = selectedAsset
            ? `${selectedAsset.asset_type}-${selectedAsset.asset_id}`
            : null;
    }, [selectedAsset]);

    const fetchAssets = useCallback(async ({ showLoading = true } = {}) => {
        if (showLoading) {
            setLoading(true);
        }

        const { data, error } = await supabase
            .from("latest_assets_positions")
            .select("*")
            .order("recorded_at", { ascending: false });

        if (error) {
            console.error("Latest assets fetch error:", error);
            alert("Σφάλμα φόρτωσης θέσεων οχημάτων/drones");
            setAssets([]);
            setLoading(false);
            return;
        }

        const validAssets = (data || []).filter(
            (item) =>
                item.latitude !== null &&
                item.longitude !== null &&
                !Number.isNaN(Number(item.latitude)) &&
                !Number.isNaN(Number(item.longitude))
        );

        setAssets(validAssets);

        const selectedKey = selectedAssetKeyRef.current;
        const refreshedSelectedAsset = selectedKey
            ? validAssets.find(
                (item) => `${item.asset_type}-${item.asset_id}` === selectedKey
            )
            : null;

        if (refreshedSelectedAsset) {
            setSelectedAsset(refreshedSelectedAsset);
        }

        if (validAssets.length > 0 && autoFollowMobileRef.current) {
            const latestMobileAsset =
                validAssets.find((item) => item.source === "mobile_app") || validAssets[0];

            const nextCenter = {
                lat: Number(latestMobileAsset.latitude),
                lng: Number(latestMobileAsset.longitude),
            };

            setMapCenter(nextCenter);
            setMapZoom(16);
            setSelectedAsset(latestMobileAsset);
        }

        setLoading(false);
    }, []);

    useEffect(() => {
        fetchAssets();

        const channel = supabase
            .channel("fleet-map-google-realtime")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "vehicle_positions",
                },
                () => fetchAssets({ showLoading: false })
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "drone_positions",
                },
                () => fetchAssets({ showLoading: false })
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchAssets]);

    const stats = useMemo(() => {
        return {
            total: assets.length,
            vehicles: assets.filter((a) => a.asset_type === "vehicle").length,
            drones: assets.filter((a) => a.asset_type === "drone").length,
            moving: assets.filter((a) =>
                ["moving", "flying", "working"].includes(a.status)
            ).length,
            offline: assets.filter((a) => a.status === "offline").length,
        };
    }, [assets]);

    function getMarkerIcon(asset) {
        return asset.asset_type === "drone" ? "🚁" : "🚜";
    }

    function getStatusLabel(status) {
        const labels = {
            available: "Διαθέσιμο",
            assigned: "Ανατεθειμένο",
            moving: "Σε κίνηση",
            working: "Εργάζεται",
            maintenance: "Συντήρηση",
            offline: "Offline",
            flying: "Πετάει",
            charging: "Φορτίζει",
        };

        return labels[status] || status || "-";
    }

    function getAssetTypeLabel(type) {
        if (type === "vehicle") return "Όχημα";
        if (type === "drone") return "Drone";
        return type || "-";
    }

    function formatDate(value) {
        if (!value) return "-";

        try {
            return new Date(value).toLocaleString("el-GR");
        } catch {
            return value;
        }
    }

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
                            Χάρτης Οχημάτων & Drones
                        </h1>
                        <p className="text-slate-600">
                            Google Maps προβολή τελευταίας γνωστής θέσης οχημάτων και drones.
                        </p>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={fetchAssets}
                            className="bg-emerald-700 text-white px-4 py-2 rounded-lg hover:bg-emerald-800"
                        >
                            Ανανέωση
                        </button>

                        <button
                            onClick={() => setAutoFollowMobile((prev) => !prev)}
                            className={`px-4 py-2 rounded-lg ${autoFollowMobile
                                ? "bg-blue-700 text-white hover:bg-blue-800"
                                : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                                }`}
                        >
                            {autoFollowMobile ? "Auto-follow GPS: ON" : "Auto-follow GPS: OFF"}
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <StatCard label="Σύνολο" value={stats.total} />
                    <StatCard label="Οχήματα" value={stats.vehicles} />
                    <StatCard label="Drones" value={stats.drones} />
                    <StatCard label="Σε κίνηση/πτήση" value={stats.moving} />
                    <StatCard label="Offline" value={stats.offline} />
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                    <div className="xl:col-span-3 bg-white rounded-2xl shadow overflow-hidden">
                        <div className="p-4 border-b flex items-center justify-between">
                            <div className="font-semibold">Google Live Map</div>
                            <div className="text-sm text-slate-500">
                                {loading ? "Φόρτωση..." : `${assets.length} assets`}
                            </div>
                        </div>

                        <div style={{ width: "100%", height: "650px" }}>
                            <Map
                                defaultCenter={mapCenter}
                                defaultZoom={mapZoom}
                                mapId={GOOGLE_MAP_ID}
                                mapTypeId="hybrid"
                                gestureHandling="greedy"
                                disableDefaultUI={false}
                                style={{ width: "100%", height: "100%" }}
                            >
                                <MapAutoFollow center={mapCenter} zoom={mapZoom} enabled={autoFollowMobile} />

                                {assets.map((asset) => {
                                    const position = {
                                        lat: Number(asset.latitude),
                                        lng: Number(asset.longitude),
                                    };

                                    return (
                                        <AdvancedMarker
                                            key={`${asset.asset_type}-${asset.asset_id}`}
                                            position={position}
                                            onClick={() => {
                                                setSelectedAsset(asset);
                                                setMapCenter(position);
                                                setMapZoom(16);
                                            }}
                                        >
                                            <div
                                                className={`w-11 h-11 rounded-full shadow flex items-center justify-center text-xl cursor-pointer border-2 ${asset.asset_type === "drone"
                                                    ? "bg-sky-100 border-sky-600"
                                                    : "bg-emerald-100 border-emerald-700"
                                                    }`}
                                                title={asset.asset_name}
                                            >
                                                {getMarkerIcon(asset)}
                                            </div>
                                        </AdvancedMarker>
                                    );
                                })}

                                {selectedAsset && (
                                    <InfoWindow
                                        position={{
                                            lat: Number(selectedAsset.latitude),
                                            lng: Number(selectedAsset.longitude),
                                        }}
                                        onCloseClick={() => setSelectedAsset(null)}
                                    >
                                        <div className="text-sm space-y-1 min-w-[220px]">
                                            <div className="font-bold text-slate-900">
                                                {getMarkerIcon(selectedAsset)}{" "}
                                                {selectedAsset.asset_name}
                                            </div>

                                            <div>
                                                <b>Τύπος:</b>{" "}
                                                {getAssetTypeLabel(selectedAsset.asset_type)}
                                            </div>

                                            <div>
                                                <b>Κωδικός:</b> {selectedAsset.asset_code || "-"}
                                            </div>

                                            <div>
                                                <b>Status:</b> {getStatusLabel(selectedAsset.status)}
                                            </div>

                                            <div>
                                                <b>Ταχύτητα:</b>{" "}
                                                {selectedAsset.speed == null
                                                    ? "-"
                                                    : `${selectedAsset.speed} ${selectedAsset.asset_type === "drone"
                                                        ? "m/s"
                                                        : "km/h"
                                                    }`}
                                            </div>

                                            {selectedAsset.asset_type === "drone" && (
                                                <div>
                                                    <b>Μπαταρία:</b>{" "}
                                                    {selectedAsset.battery_percent == null
                                                        ? "-"
                                                        : `${selectedAsset.battery_percent}%`}
                                                </div>
                                            )}

                                            <div>
                                                <b>Πηγή:</b> {selectedAsset.source || "-"}
                                            </div>

                                            <div>
                                                <b>Ώρα:</b> {formatDate(selectedAsset.recorded_at)}
                                            </div>

                                            <div className="text-xs text-slate-500 pt-1">
                                                Lat: {selectedAsset.latitude} / Lng:{" "}
                                                {selectedAsset.longitude}
                                            </div>
                                        </div>
                                    </InfoWindow>
                                )}
                            </Map>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow overflow-hidden">
                        <div className="p-4 border-b font-semibold">Assets</div>

                        {loading ? (
                            <div className="p-4 text-slate-500">Φόρτωση...</div>
                        ) : assets.length === 0 ? (
                            <div className="p-4 text-slate-500">
                                Δεν υπάρχουν διαθέσιμες θέσεις.
                            </div>
                        ) : (
                            <div className="divide-y max-h-[650px] overflow-y-auto">
                                {assets.map((asset) => (
                                    <button
                                        key={`list-${asset.asset_type}-${asset.asset_id}`}
                                        onClick={() => {
                                            setSelectedAsset(asset);
                                            setMapCenter({
                                                lat: Number(asset.latitude),
                                                lng: Number(asset.longitude),
                                            });
                                            setMapZoom(16);
                                        }}
                                        className="w-full text-left p-4 hover:bg-slate-50"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <div className="font-semibold">
                                                    {getMarkerIcon(asset)} {asset.asset_name}
                                                </div>
                                                <div className="text-xs text-slate-500">
                                                    {getAssetTypeLabel(asset.asset_type)} /{" "}
                                                    {asset.asset_code || "-"}
                                                </div>
                                            </div>

                                            <span className="text-xs bg-slate-100 rounded-full px-2 py-1">
                                                {getStatusLabel(asset.status)}
                                            </span>
                                        </div>

                                        <div className="mt-2 text-xs text-slate-600 space-y-1">
                                            <div>
                                                Θέση: {Number(asset.latitude).toFixed(5)},{" "}
                                                {Number(asset.longitude).toFixed(5)}
                                            </div>

                                            <div>Πηγή: {asset.source || "-"}</div>

                                            <div>Ώρα: {formatDate(asset.recorded_at)}</div>

                                            {asset.asset_type === "drone" && (
                                                <div>
                                                    Μπαταρία:{" "}
                                                    {asset.battery_percent == null
                                                        ? "-"
                                                        : `${asset.battery_percent}%`}
                                                </div>
                                            )}
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

function MapAutoFollow({ center, zoom, enabled }) {
    const map = useMap();

    useEffect(() => {
        if (!map || !enabled) return;

        map.panTo(center);
        map.setZoom(zoom);
    }, [center, enabled, map, zoom]);

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
