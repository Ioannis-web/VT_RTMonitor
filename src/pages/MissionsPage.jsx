import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function MissionsPage() {
  const [missions, setMissions] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [drones, setDrones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: "",
    mission_date: new Date().toISOString().slice(0, 10),
    mission_type: "field_work",
    priority: "normal",
    assigned_vehicle_id: "",
    assigned_drone_id: "",
    notes: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    const [missionsRes, vehiclesRes, dronesRes] = await Promise.all([
      supabase
        .from("missions")
        .select(`
          *,
          vehicles:assigned_vehicle_id (
            id,
            name,
            code,
            vehicle_type,
            status
          ),
          drones:assigned_drone_id (
            id,
            name,
            code,
            model,
            status
          )
        `)
        .order("mission_date", { ascending: false })
        .order("created_at", { ascending: false }),

      supabase
        .from("vehicles")
        .select("id, name, code, status, vehicle_type")
        .order("name", { ascending: true }),

      supabase
        .from("drones")
        .select("id, name, code, status, battery_percent")
        .order("name", { ascending: true }),
    ]);

    if (missionsRes.error) {
      console.error("Missions fetch error:", missionsRes.error);
      alert("Σφάλμα φόρτωσης αποστολών");
    } else {
      setMissions(missionsRes.data || []);
    }

    if (vehiclesRes.error) {
      console.error("Vehicles fetch error:", vehiclesRes.error);
    } else {
      setVehicles(vehiclesRes.data || []);
    }

    if (dronesRes.error) {
      console.error("Drones fetch error:", dronesRes.error);
    } else {
      setDrones(dronesRes.data || []);
    }

    setLoading(false);
  }

  function handleChange(e) {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!form.title.trim()) {
      alert("Συμπλήρωσε τίτλο αποστολής");
      return;
    }

    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const hasVehicle = Boolean(form.assigned_vehicle_id);
    const hasDrone = Boolean(form.assigned_drone_id);

    const payload = {
      title: form.title.trim(),
      mission_date: form.mission_date,
      mission_type: form.mission_type,
      priority: form.priority,
      status: hasVehicle || hasDrone ? "assigned" : "planned",
      assigned_vehicle_id: hasVehicle ? form.assigned_vehicle_id : null,
      assigned_drone_id: hasDrone ? form.assigned_drone_id : null,
      notes: form.notes.trim() || null,
      created_by: user?.id || null,
    };

    const { error } = await supabase.from("missions").insert(payload);

    if (error) {
      console.error("Mission insert error:", error);
      alert("Σφάλμα δημιουργίας αποστολής");
    } else {
      setForm({
        title: "",
        mission_date: new Date().toISOString().slice(0, 10),
        mission_type: "field_work",
        priority: "normal",
        assigned_vehicle_id: "",
        assigned_drone_id: "",
        notes: "",
      });

      await loadData();
    }

    setSaving(false);
  }

  async function updateMissionStatus(id, status) {
    const updates = { status };

    if (status === "in_progress") {
      updates.actual_start = new Date().toISOString();
    }

    if (status === "completed") {
      updates.actual_end = new Date().toISOString();
    }

    const { error } = await supabase
      .from("missions")
      .update(updates)
      .eq("id", id);

    if (error) {
      console.error("Mission status update error:", error);
      alert("Σφάλμα αλλαγής κατάστασης αποστολής");
    } else {
      await loadData();
    }
  }

  async function updateMissionPriority(id, priority) {
    const { error } = await supabase
      .from("missions")
      .update({ priority })
      .eq("id", id);

    if (error) {
      console.error("Mission priority update error:", error);
      alert("Σφάλμα αλλαγής προτεραιότητας");
    } else {
      await loadData();
    }
  }

  async function deleteMission(id) {
    const ok = window.confirm("Να διαγραφεί η αποστολή;");
    if (!ok) return;

    const { error } = await supabase.from("missions").delete().eq("id", id);

    if (error) {
      console.error("Mission delete error:", error);
      alert("Σφάλμα διαγραφής αποστολής");
    } else {
      await loadData();
    }
  }

  function getStatusLabel(status) {
    const labels = {
      planned: "Προγραμματισμένη",
      assigned: "Ανατεθειμένη",
      accepted: "Αποδεκτή",
      in_progress: "Σε εξέλιξη",
      completed: "Ολοκληρωμένη",
      cancelled: "Ακυρωμένη",
    };

    return labels[status] || status;
  }

  function getPriorityLabel(priority) {
    const labels = {
      low: "Χαμηλή",
      normal: "Κανονική",
      high: "Υψηλή",
      urgent: "Επείγουσα",
    };

    return labels[priority] || priority;
  }

  function getMissionTypeLabel(type) {
    const labels = {
      field_work: "Εργασία χωραφιού",
      inspection: "Επιθεώρηση",
      irrigation: "Άρδευση",
      spraying: "Ψεκασμός",
      transport: "Μεταφορά",
      drone_scan: "Drone scan",
      maintenance: "Συντήρηση",
      custom: "Άλλο",
    };

    return labels[type] || type;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Αποστολές</h1>
        <p className="text-slate-600">
          Ημερήσιες αποστολές για οχήματα και drones. Αργότερα αυτές θα
          δημιουργούνται αυτόματα από το AI Engine.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow p-5 grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        <div>
          <label className="block text-sm font-medium mb-1">Τίτλος *</label>
          <input
            name="title"
            value={form.title}
            onChange={handleChange}
            className="w-full border rounded-lg px-3 py-2"
            placeholder="π.χ. Επιθεώρηση αγροτεμαχίου"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Ημερομηνία</label>
          <input
            name="mission_date"
            value={form.mission_date}
            onChange={handleChange}
            type="date"
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Τύπος</label>
          <select
            name="mission_type"
            value={form.mission_type}
            onChange={handleChange}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="field_work">Εργασία χωραφιού</option>
            <option value="inspection">Επιθεώρηση</option>
            <option value="irrigation">Άρδευση</option>
            <option value="spraying">Ψεκασμός</option>
            <option value="transport">Μεταφορά</option>
            <option value="drone_scan">Drone scan</option>
            <option value="maintenance">Συντήρηση</option>
            <option value="custom">Άλλο</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Προτεραιότητα
          </label>
          <select
            name="priority"
            value={form.priority}
            onChange={handleChange}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="low">Χαμηλή</option>
            <option value="normal">Κανονική</option>
            <option value="high">Υψηλή</option>
            <option value="urgent">Επείγουσα</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Όχημα</label>
          <select
            name="assigned_vehicle_id"
            value={form.assigned_vehicle_id}
            onChange={handleChange}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="">Χωρίς όχημα</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.name}
                {vehicle.code ? ` — ${vehicle.code}` : ""}
                {vehicle.status ? ` — ${vehicle.status}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Drone</label>
          <select
            name="assigned_drone_id"
            value={form.assigned_drone_id}
            onChange={handleChange}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="">Χωρίς drone</option>
            {drones.map((drone) => (
              <option key={drone.id} value={drone.id}>
                {drone.name}
                {drone.code ? ` — ${drone.code}` : ""}
                {drone.status ? ` — ${drone.status}` : ""}
                {drone.battery_percent != null
                  ? ` — ${drone.battery_percent}%`
                  : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3">
          <label className="block text-sm font-medium mb-1">Σημειώσεις</label>
          <textarea
            name="notes"
            value={form.notes}
            onChange={handleChange}
            className="w-full border rounded-lg px-3 py-2"
            rows="2"
            placeholder="Προαιρετικές οδηγίες για την αποστολή"
          />
        </div>

        <div className="md:col-span-3">
          <button
            type="submit"
            disabled={saving}
            className="bg-emerald-700 text-white px-5 py-2 rounded-lg hover:bg-emerald-800 disabled:opacity-50"
          >
            {saving ? "Αποθήκευση..." : "Δημιουργία αποστολής"}
          </button>
        </div>
      </form>

      <div className="bg-white rounded-2xl shadow overflow-hidden">
        <div className="p-4 border-b font-semibold">Λίστα αποστολών</div>

        {loading ? (
          <div className="p-4">Φόρτωση...</div>
        ) : missions.length === 0 ? (
          <div className="p-4 text-slate-500">Δεν υπάρχουν αποστολές.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="text-left p-3">Ημερομηνία</th>
                  <th className="text-left p-3">Τίτλος</th>
                  <th className="text-left p-3">Τύπος</th>
                  <th className="text-left p-3">Προτεραιότητα</th>
                  <th className="text-left p-3">Όχημα</th>
                  <th className="text-left p-3">Drone</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">AI</th>
                  <th className="text-right p-3">Ενέργειες</th>
                </tr>
              </thead>

              <tbody>
                {missions.map((mission) => (
                  <tr key={mission.id} className="border-t">
                    <td className="p-3">{mission.mission_date}</td>

                    <td className="p-3">
                      <div className="font-medium">{mission.title}</div>
                      {mission.notes && (
                        <div className="text-xs text-slate-500 mt-1">
                          {mission.notes}
                        </div>
                      )}
                    </td>

                    <td className="p-3">
                      {getMissionTypeLabel(mission.mission_type)}
                    </td>

                    <td className="p-3">
                      <select
                        value={mission.priority}
                        onChange={(e) =>
                          updateMissionPriority(mission.id, e.target.value)
                        }
                        className="border rounded px-2 py-1"
                      >
                        <option value="low">Χαμηλή</option>
                        <option value="normal">Κανονική</option>
                        <option value="high">Υψηλή</option>
                        <option value="urgent">Επείγουσα</option>
                      </select>
                      <div className="text-xs text-slate-500 mt-1">
                        {getPriorityLabel(mission.priority)}
                      </div>
                    </td>

                    <td className="p-3">
                      {mission.vehicles?.name ? (
                        <div>
                          <div>{mission.vehicles.name}</div>
                          <div className="text-xs text-slate-500">
                            {mission.vehicles.code || "-"} /{" "}
                            {mission.vehicles.status || "-"}
                          </div>
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>

                    <td className="p-3">
                      {mission.drones?.name ? (
                        <div>
                          <div>{mission.drones.name}</div>
                          <div className="text-xs text-slate-500">
                            {mission.drones.code || "-"} /{" "}
                            {mission.drones.status || "-"}
                          </div>
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>

                    <td className="p-3">
                      <select
                        value={mission.status}
                        onChange={(e) =>
                          updateMissionStatus(mission.id, e.target.value)
                        }
                        className="border rounded px-2 py-1"
                      >
                        <option value="planned">Προγραμματισμένη</option>
                        <option value="assigned">Ανατεθειμένη</option>
                        <option value="accepted">Αποδεκτή</option>
                        <option value="in_progress">Σε εξέλιξη</option>
                        <option value="completed">Ολοκληρωμένη</option>
                        <option value="cancelled">Ακυρωμένη</option>
                      </select>

                      <div className="text-xs text-slate-500 mt-1">
                        {getStatusLabel(mission.status)}
                      </div>
                    </td>

                    <td className="p-3">
                      {mission.ai_generated ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs">
                          AI
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-slate-100 text-slate-600 text-xs">
                          Manual
                        </span>
                      )}

                      {mission.ai_score != null && (
                        <div className="text-xs text-slate-500 mt-1">
                          Score: {mission.ai_score}
                        </div>
                      )}
                    </td>

                    <td className="p-3 text-right">
                      <button
                        onClick={() => deleteMission(mission.id)}
                        className="text-red-600 hover:underline"
                      >
                        Διαγραφή
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}