import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function MissionTasksPage() {
  const [missions, setMissions] = useState([]);
  const [selectedMissionId, setSelectedMissionId] = useState("");
  const [tasks, setTasks] = useState([]);
  const [loadingMissions, setLoadingMissions] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    task_order: 1,
    task_type: "general",
    status: "pending",
    latitude: "",
    longitude: "",
    estimated_minutes: "",
  });

  const loadMissions = useCallback(async () => {
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
        vehicles:assigned_vehicle_id (
          name,
          code
        ),
        drones:assigned_drone_id (
          name,
          code
        )
      `)
      .order("mission_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Missions fetch error:", error);
      alert("Σφάλμα φόρτωσης αποστολών");
    } else {
      setMissions(data || []);

      if (!selectedMissionId && data?.length > 0) {
        setSelectedMissionId(data[0].id);
      }
    }

    setLoadingMissions(false);
  }, [selectedMissionId]);

  const loadTasks = useCallback(async (missionId) => {
    setLoadingTasks(true);

    const { data, error } = await supabase
      .from("mission_tasks")
      .select("*")
      .eq("mission_id", missionId)
      .order("task_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Mission tasks fetch error:", error);
      alert("Σφάλμα φόρτωσης βημάτων αποστολής");
    } else {
      setTasks(data || []);

      const nextOrder = (data?.length || 0) + 1;
      setForm((prev) => ({
        ...prev,
        task_order: nextOrder,
      }));
    }

    setLoadingTasks(false);
  }, []);

  useEffect(() => {
    loadMissions();
  }, [loadMissions]);

  useEffect(() => {
    if (selectedMissionId) {
      loadTasks(selectedMissionId);
    } else {
      setTasks([]);
    }
  }, [loadTasks, selectedMissionId]);

  function handleChange(e) {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!selectedMissionId) {
      alert("Επίλεξε αποστολή");
      return;
    }

    if (!form.title.trim()) {
      alert("Συμπλήρωσε τίτλο βήματος");
      return;
    }

    setSaving(true);

    const payload = {
      mission_id: selectedMissionId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      task_order: Number(form.task_order) || 1,
      task_type: form.task_type,
      status: form.status,
      latitude: form.latitude === "" ? null : Number(form.latitude),
      longitude: form.longitude === "" ? null : Number(form.longitude),
      estimated_minutes:
        form.estimated_minutes === "" ? null : Number(form.estimated_minutes),
    };

    const { error } = await supabase.from("mission_tasks").insert(payload);

    if (error) {
      console.error("Mission task insert error:", error);
      alert("Σφάλμα δημιουργίας βήματος αποστολής");
    } else {
      setForm({
        title: "",
        description: "",
        task_order: tasks.length + 2,
        task_type: "general",
        status: "pending",
        latitude: "",
        longitude: "",
        estimated_minutes: "",
      });

      await loadTasks(selectedMissionId);
    }

    setSaving(false);
  }

  async function updateTaskStatus(id, status) {
    const updates = { status };

    if (status === "completed") {
      updates.completed_at = new Date().toISOString();
    }

    if (status !== "completed") {
      updates.completed_at = null;
    }

    const { error } = await supabase
      .from("mission_tasks")
      .update(updates)
      .eq("id", id);

    if (error) {
      console.error("Task status update error:", error);
      alert("Σφάλμα αλλαγής κατάστασης βήματος");
    } else {
      await loadTasks(selectedMissionId);
    }
  }

  async function updateTaskOrder(id, task_order) {
    const value = Number(task_order);

    if (!value || value < 1) {
      alert("Η σειρά πρέπει να είναι αριθμός μεγαλύτερος από 0");
      return;
    }

    const { error } = await supabase
      .from("mission_tasks")
      .update({ task_order: value })
      .eq("id", id);

    if (error) {
      console.error("Task order update error:", error);
      alert("Σφάλμα αλλαγής σειράς");
    } else {
      await loadTasks(selectedMissionId);
    }
  }

  async function deleteTask(id) {
    const ok = window.confirm("Να διαγραφεί το βήμα αποστολής;");
    if (!ok) return;

    const { error } = await supabase.from("mission_tasks").delete().eq("id", id);

    if (error) {
      console.error("Task delete error:", error);
      alert("Σφάλμα διαγραφής βήματος");
    } else {
      await loadTasks(selectedMissionId);
    }
  }

  function getSelectedMission() {
    return missions.find((m) => m.id === selectedMissionId);
  }

  function getTaskTypeLabel(type) {
    const labels = {
      general: "Γενικό",
      navigate: "Μετάβαση",
      inspect: "Επιθεώρηση",
      capture_image: "Λήψη εικόνας",
      irrigate: "Άρδευση",
      spray: "Ψεκασμός",
      load: "Φόρτωση",
      unload: "Εκφόρτωση",
      measure: "Μέτρηση",
      return_base: "Επιστροφή στη βάση",
    };

    return labels[type] || type;
  }

  function getStatusLabel(status) {
    const labels = {
      pending: "Σε αναμονή",
      in_progress: "Σε εξέλιξη",
      completed: "Ολοκληρώθηκε",
      skipped: "Παραλείφθηκε",
      failed: "Απέτυχε",
    };

    return labels[status] || status;
  }

  const selectedMission = getSelectedMission();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Βήματα Αποστολών
        </h1>
        <p className="text-slate-600">
          Αναλυτικά βήματα εργασίας για κάθε αποστολή οχήματος ή drone.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            Επιλογή αποστολής
          </label>

          {loadingMissions ? (
            <div className="text-slate-500">Φόρτωση αποστολών...</div>
          ) : missions.length === 0 ? (
            <div className="text-slate-500">
              Δεν υπάρχουν αποστολές. Δημιούργησε πρώτα μία αποστολή.
            </div>
          ) : (
            <select
              value={selectedMissionId}
              onChange={(e) => setSelectedMissionId(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            >
              {missions.map((mission) => (
                <option key={mission.id} value={mission.id}>
                  {mission.mission_date} — {mission.title}
                  {mission.vehicles?.name
                    ? ` — Όχημα: ${mission.vehicles.name}`
                    : ""}
                  {mission.drones?.name
                    ? ` — Drone: ${mission.drones.name}`
                    : ""}
                </option>
              ))}
            </select>
          )}
        </div>

        {selectedMission && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm bg-slate-50 rounded-xl p-4">
            <div>
              <div className="text-slate-500">Τίτλος</div>
              <div className="font-medium">{selectedMission.title}</div>
            </div>

            <div>
              <div className="text-slate-500">Ημερομηνία</div>
              <div className="font-medium">{selectedMission.mission_date}</div>
            </div>

            <div>
              <div className="text-slate-500">Όχημα</div>
              <div className="font-medium">
                {selectedMission.vehicles?.name || "-"}
              </div>
            </div>

            <div>
              <div className="text-slate-500">Drone</div>
              <div className="font-medium">
                {selectedMission.drones?.name || "-"}
              </div>
            </div>
          </div>
        )}
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
            placeholder="π.χ. Μετάβαση στο χωράφι"
            disabled={!selectedMissionId}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Σειρά</label>
          <input
            name="task_order"
            value={form.task_order}
            onChange={handleChange}
            type="number"
            min="1"
            className="w-full border rounded-lg px-3 py-2"
            disabled={!selectedMissionId}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Τύπος</label>
          <select
            name="task_type"
            value={form.task_type}
            onChange={handleChange}
            className="w-full border rounded-lg px-3 py-2"
            disabled={!selectedMissionId}
          >
            <option value="general">Γενικό</option>
            <option value="navigate">Μετάβαση</option>
            <option value="inspect">Επιθεώρηση</option>
            <option value="capture_image">Λήψη εικόνας</option>
            <option value="irrigate">Άρδευση</option>
            <option value="spray">Ψεκασμός</option>
            <option value="load">Φόρτωση</option>
            <option value="unload">Εκφόρτωση</option>
            <option value="measure">Μέτρηση</option>
            <option value="return_base">Επιστροφή στη βάση</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Status</label>
          <select
            name="status"
            value={form.status}
            onChange={handleChange}
            className="w-full border rounded-lg px-3 py-2"
            disabled={!selectedMissionId}
          >
            <option value="pending">Σε αναμονή</option>
            <option value="in_progress">Σε εξέλιξη</option>
            <option value="completed">Ολοκληρώθηκε</option>
            <option value="skipped">Παραλείφθηκε</option>
            <option value="failed">Απέτυχε</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Latitude</label>
          <input
            name="latitude"
            value={form.latitude}
            onChange={handleChange}
            type="number"
            step="any"
            className="w-full border rounded-lg px-3 py-2"
            placeholder="40.6401"
            disabled={!selectedMissionId}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Longitude</label>
          <input
            name="longitude"
            value={form.longitude}
            onChange={handleChange}
            type="number"
            step="any"
            className="w-full border rounded-lg px-3 py-2"
            placeholder="22.9444"
            disabled={!selectedMissionId}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Εκτιμώμενα λεπτά
          </label>
          <input
            name="estimated_minutes"
            value={form.estimated_minutes}
            onChange={handleChange}
            type="number"
            min="0"
            className="w-full border rounded-lg px-3 py-2"
            placeholder="20"
            disabled={!selectedMissionId}
          />
        </div>

        <div className="md:col-span-3">
          <label className="block text-sm font-medium mb-1">Περιγραφή</label>
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            className="w-full border rounded-lg px-3 py-2"
            rows="2"
            placeholder="Προαιρετική περιγραφή βήματος"
            disabled={!selectedMissionId}
          />
        </div>

        <div className="md:col-span-3">
          <button
            type="submit"
            disabled={saving || !selectedMissionId}
            className="bg-emerald-700 text-white px-5 py-2 rounded-lg hover:bg-emerald-800 disabled:opacity-50"
          >
            {saving ? "Αποθήκευση..." : "Προσθήκη βήματος"}
          </button>
        </div>
      </form>

      <div className="bg-white rounded-2xl shadow overflow-hidden">
        <div className="p-4 border-b font-semibold">
          Βήματα επιλεγμένης αποστολής
        </div>

        {loadingTasks ? (
          <div className="p-4">Φόρτωση βημάτων...</div>
        ) : !selectedMissionId ? (
          <div className="p-4 text-slate-500">Επίλεξε αποστολή.</div>
        ) : tasks.length === 0 ? (
          <div className="p-4 text-slate-500">
            Δεν υπάρχουν βήματα για αυτή την αποστολή.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="text-left p-3">Σειρά</th>
                  <th className="text-left p-3">Βήμα</th>
                  <th className="text-left p-3">Τύπος</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Συντεταγμένες</th>
                  <th className="text-left p-3">Χρόνος</th>
                  <th className="text-left p-3">Ολοκλήρωση</th>
                  <th className="text-right p-3">Ενέργειες</th>
                </tr>
              </thead>

              <tbody>
                {tasks.map((task) => (
                  <tr key={task.id} className="border-t">
                    <td className="p-3">
                      <input
                        type="number"
                        min="1"
                        defaultValue={task.task_order}
                        onBlur={(e) =>
                          updateTaskOrder(task.id, e.target.value)
                        }
                        className="w-20 border rounded px-2 py-1"
                      />
                    </td>

                    <td className="p-3">
                      <div className="font-medium">{task.title}</div>
                      {task.description && (
                        <div className="text-xs text-slate-500 mt-1">
                          {task.description}
                        </div>
                      )}
                    </td>

                    <td className="p-3">
                      <div>{getTaskTypeLabel(task.task_type)}</div>
                      <div className="text-xs text-slate-500">
                        {task.task_type}
                      </div>
                    </td>

                    <td className="p-3">
                      <select
                        value={task.status}
                        onChange={(e) =>
                          updateTaskStatus(task.id, e.target.value)
                        }
                        className="border rounded px-2 py-1"
                      >
                        <option value="pending">Σε αναμονή</option>
                        <option value="in_progress">Σε εξέλιξη</option>
                        <option value="completed">Ολοκληρώθηκε</option>
                        <option value="skipped">Παραλείφθηκε</option>
                        <option value="failed">Απέτυχε</option>
                      </select>

                      <div className="text-xs text-slate-500 mt-1">
                        {getStatusLabel(task.status)}
                      </div>
                    </td>

                    <td className="p-3">
                      {task.latitude != null && task.longitude != null ? (
                        <div>
                          <div>Lat: {task.latitude}</div>
                          <div>Lng: {task.longitude}</div>
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>

                    <td className="p-3">
                      {task.estimated_minutes != null
                        ? `${task.estimated_minutes} λεπτά`
                        : "-"}
                    </td>

                    <td className="p-3">
                      {task.completed_at
                        ? new Date(task.completed_at).toLocaleString("el-GR")
                        : "-"}
                    </td>

                    <td className="p-3 text-right">
                      <button
                        onClick={() => deleteTask(task.id)}
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
