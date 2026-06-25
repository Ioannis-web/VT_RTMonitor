import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function DronesPage() {
  const [drones, setDrones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    code: "",
    drone_type: "multirotor",
    manufacturer: "",
    model: "",
    serial_number: "",
    api_provider: "manual",
    battery_percent: "",
    max_flight_minutes: "",
    camera_type: "",
    initial_latitude: "",
    initial_longitude: "",
    initial_altitude_m: "",
    notes: "",
  });

  useEffect(() => {
    fetchDrones();
  }, []);

  async function fetchDrones() {
    setLoading(true);

    const { data, error } = await supabase
      .from("drones")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Drones fetch error:", error);
      alert("Σφάλμα φόρτωσης drones");
    } else {
      setDrones(data || []);
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

    if (!form.name.trim()) {
      alert("Συμπλήρωσε όνομα drone");
      return;
    }

    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const payload = {
      name: form.name.trim(),
      code: form.code.trim() || null,
      drone_type: form.drone_type,
      manufacturer: form.manufacturer.trim() || null,
      model: form.model.trim() || null,
      serial_number: form.serial_number.trim() || null,
      api_provider: form.api_provider,
      battery_percent:
        form.battery_percent === "" ? null : Number(form.battery_percent),
      max_flight_minutes:
        form.max_flight_minutes === "" ? null : Number(form.max_flight_minutes),
      camera_type: form.camera_type.trim() || null,
      notes: form.notes.trim() || null,
      created_by: user?.id || null,
    };

    const { data: insertedDrone, error } = await supabase
      .from("drones")
      .insert(payload)
      .select("id")
      .single();

    if (error) {
      console.error("Drone insert error:", error);
      alert("Σφάλμα αποθήκευσης drone");
    } else {
      const hasInitialPosition =
        form.initial_latitude !== "" && form.initial_longitude !== "";

      if (hasInitialPosition) {
        const { error: positionError } = await supabase
          .from("drone_positions")
          .insert({
            drone_id: insertedDrone.id,
            latitude: Number(form.initial_latitude),
            longitude: Number(form.initial_longitude),
            altitude_m:
              form.initial_altitude_m === ""
                ? null
                : Number(form.initial_altitude_m),
            source: "manual",
            recorded_at: new Date().toISOString(),
          });

        if (positionError) {
          console.error("Initial drone position insert error:", positionError);
          alert(
            "Το drone αποθηκεύτηκε, αλλά δεν αποθηκεύτηκε η αρχική θέση του."
          );
        }
      }

      setForm({
        name: "",
        code: "",
        drone_type: "multirotor",
        manufacturer: "",
        model: "",
        serial_number: "",
        api_provider: "manual",
        battery_percent: "",
        max_flight_minutes: "",
        camera_type: "",
        initial_latitude: "",
        initial_longitude: "",
        initial_altitude_m: "",
        notes: "",
      });

      await fetchDrones();
    }

    setSaving(false);
  }

  async function deleteDrone(id) {
    const ok = window.confirm("Να διαγραφεί το drone;");
    if (!ok) return;

    const { error } = await supabase.from("drones").delete().eq("id", id);

    if (error) {
      console.error("Drone delete error:", error);
      alert("Σφάλμα διαγραφής drone");
    } else {
      await fetchDrones();
    }
  }

  async function updateDroneStatus(id, status) {
    const { error } = await supabase
      .from("drones")
      .update({ status })
      .eq("id", id);

    if (error) {
      console.error("Drone status update error:", error);
      alert("Σφάλμα αλλαγής κατάστασης");
    } else {
      await fetchDrones();
    }
  }

  async function updateDroneBattery(id, battery_percent) {
    const value =
      battery_percent === "" || battery_percent == null
        ? null
        : Number(battery_percent);

    const { error } = await supabase
      .from("drones")
      .update({ battery_percent: value })
      .eq("id", id);

    if (error) {
      console.error("Drone battery update error:", error);
      alert("Σφάλμα αλλαγής μπαταρίας");
    } else {
      await fetchDrones();
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Drones</h1>
        <p className="text-slate-600">
          Διαχείριση drones για επιθεωρήσεις, φωτογραφίσεις, αποστολές AI και
          real-time tracking.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow p-5 grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        <div>
          <label className="block text-sm font-medium mb-1">Όνομα *</label>
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            className="w-full border rounded-lg px-3 py-2"
            placeholder="π.χ. Drone 1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Κωδικός</label>
          <input
            name="code"
            value={form.code}
            onChange={handleChange}
            className="w-full border rounded-lg px-3 py-2"
            placeholder="DR-001"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Τύπος</label>
          <select
            name="drone_type"
            value={form.drone_type}
            onChange={handleChange}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="multirotor">Multirotor</option>
            <option value="fixed_wing">Fixed Wing</option>
            <option value="hybrid">Hybrid</option>
            <option value="other">Άλλο</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Κατασκευαστής
          </label>
          <input
            name="manufacturer"
            value={form.manufacturer}
            onChange={handleChange}
            className="w-full border rounded-lg px-3 py-2"
            placeholder="DJI"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Μοντέλο</label>
          <input
            name="model"
            value={form.model}
            onChange={handleChange}
            className="w-full border rounded-lg px-3 py-2"
            placeholder="Mavic 3 Enterprise"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Serial Number</label>
          <input
            name="serial_number"
            value={form.serial_number}
            onChange={handleChange}
            className="w-full border rounded-lg px-3 py-2"
            placeholder="SN-TEST-001"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">API Provider</label>
          <select
            name="api_provider"
            value={form.api_provider}
            onChange={handleChange}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="manual">Manual</option>
            <option value="dji">DJI</option>
            <option value="mavlink">MAVLink</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Μπαταρία %</label>
          <input
            name="battery_percent"
            value={form.battery_percent}
            onChange={handleChange}
            type="number"
            min="0"
            max="100"
            className="w-full border rounded-lg px-3 py-2"
            placeholder="90"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Μέγιστη πτήση λεπτά
          </label>
          <input
            name="max_flight_minutes"
            value={form.max_flight_minutes}
            onChange={handleChange}
            type="number"
            min="0"
            className="w-full border rounded-lg px-3 py-2"
            placeholder="35"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Κάμερα</label>
          <input
            name="camera_type"
            value={form.camera_type}
            onChange={handleChange}
            className="w-full border rounded-lg px-3 py-2"
            placeholder="RGB / Multispectral / Thermal"
          />
        </div>

        <div className="md:col-span-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Αρχικό Latitude
              </label>
              <input
                name="initial_latitude"
                value={form.initial_latitude}
                onChange={handleChange}
                type="number"
                step="any"
                className="w-full border rounded-lg px-3 py-2"
                placeholder="40.6401"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Αρχικό Longitude
              </label>
              <input
                name="initial_longitude"
                value={form.initial_longitude}
                onChange={handleChange}
                type="number"
                step="any"
                className="w-full border rounded-lg px-3 py-2"
                placeholder="22.9444"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Αρχικό ύψος/m
              </label>
              <input
                name="initial_altitude_m"
                value={form.initial_altitude_m}
                onChange={handleChange}
                type="number"
                step="any"
                className="w-full border rounded-lg px-3 py-2"
                placeholder="0"
              />
            </div>
          </div>
        </div>

        <div className="md:col-span-3">
          <label className="block text-sm font-medium mb-1">Σημειώσεις</label>
          <textarea
            name="notes"
            value={form.notes}
            onChange={handleChange}
            className="w-full border rounded-lg px-3 py-2"
            rows="2"
            placeholder="Προαιρετικές σημειώσεις"
          />
        </div>

        <div className="md:col-span-3">
          <button
            type="submit"
            disabled={saving}
            className="bg-emerald-700 text-white px-5 py-2 rounded-lg hover:bg-emerald-800 disabled:opacity-50"
          >
            {saving ? "Αποθήκευση..." : "Προσθήκη drone"}
          </button>
        </div>
      </form>

      <div className="bg-white rounded-2xl shadow overflow-hidden">
        <div className="p-4 border-b font-semibold">Λίστα drones</div>

        {loading ? (
          <div className="p-4">Φόρτωση...</div>
        ) : drones.length === 0 ? (
          <div className="p-4 text-slate-500">Δεν υπάρχουν drones.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="text-left p-3">Όνομα</th>
                  <th className="text-left p-3">Κωδικός</th>
                  <th className="text-left p-3">Μοντέλο</th>
                  <th className="text-left p-3">API</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Μπαταρία</th>
                  <th className="text-left p-3">Κάμερα</th>
                  <th className="text-right p-3">Ενέργειες</th>
                </tr>
              </thead>

              <tbody>
                {drones.map((d) => (
                  <tr key={d.id} className="border-t">
                    <td className="p-3 font-medium">{d.name}</td>
                    <td className="p-3">{d.code || "-"}</td>
                    <td className="p-3">{d.model || "-"}</td>
                    <td className="p-3">{d.api_provider}</td>
                    <td className="p-3">
                      <select
                        value={d.status}
                        onChange={(e) =>
                          updateDroneStatus(d.id, e.target.value)
                        }
                        className="border rounded px-2 py-1"
                      >
                        <option value="available">Διαθέσιμο</option>
                        <option value="assigned">Ανατεθειμένο</option>
                        <option value="flying">Πετάει</option>
                        <option value="charging">Φορτίζει</option>
                        <option value="maintenance">Συντήρηση</option>
                        <option value="offline">Offline</option>
                      </select>
                    </td>

                    <td className="p-3">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        defaultValue={
                          d.battery_percent == null ? "" : d.battery_percent
                        }
                        onBlur={(e) =>
                          updateDroneBattery(d.id, e.target.value)
                        }
                        className="w-20 border rounded px-2 py-1"
                      />
                      <span className="ml-1">%</span>
                    </td>

                    <td className="p-3">{d.camera_type || "-"}</td>

                    <td className="p-3 text-right">
                      <button
                        onClick={() => deleteDrone(d.id)}
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
