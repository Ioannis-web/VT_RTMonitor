import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    code: "",
    plate_number: "",
    vehicle_type: "tractor",
    manufacturer: "",
    model: "",
    gps_device_id: "",
    sim_number: "",
    fuel_percent: "",
    notes: "",
  });

  useEffect(() => {
    fetchVehicles();
  }, []);

  async function fetchVehicles() {
    setLoading(true);

    const { data, error } = await supabase
      .from("vehicles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Vehicles fetch error:", error);
      alert("Σφάλμα φόρτωσης οχημάτων");
    } else {
      setVehicles(data || []);
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
      alert("Συμπλήρωσε όνομα οχήματος");
      return;
    }

    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const payload = {
      name: form.name.trim(),
      code: form.code.trim() || null,
      plate_number: form.plate_number.trim() || null,
      vehicle_type: form.vehicle_type,
      manufacturer: form.manufacturer.trim() || null,
      model: form.model.trim() || null,
      gps_device_id: form.gps_device_id.trim() || null,
      sim_number: form.sim_number.trim() || null,
      fuel_percent: form.fuel_percent === "" ? null : Number(form.fuel_percent),
      notes: form.notes.trim() || null,
      created_by: user?.id || null,
    };

    const { error } = await supabase.from("vehicles").insert(payload);

    if (error) {
      console.error("Vehicle insert error:", error);
      alert("Σφάλμα αποθήκευσης οχήματος");
    } else {
      setForm({
        name: "",
        code: "",
        plate_number: "",
        vehicle_type: "tractor",
        manufacturer: "",
        model: "",
        gps_device_id: "",
        sim_number: "",
        fuel_percent: "",
        notes: "",
      });

      await fetchVehicles();
    }

    setSaving(false);
  }

  async function deleteVehicle(id) {
    const ok = window.confirm("Να διαγραφεί το όχημα;");
    if (!ok) return;

    const { error } = await supabase.from("vehicles").delete().eq("id", id);

    if (error) {
      console.error("Vehicle delete error:", error);
      alert("Σφάλμα διαγραφής οχήματος");
    } else {
      await fetchVehicles();
    }
  }

  async function updateVehicleStatus(id, status) {
    const { error } = await supabase
      .from("vehicles")
      .update({ status })
      .eq("id", id);

    if (error) {
      console.error("Vehicle status update error:", error);
      alert("Σφάλμα αλλαγής κατάστασης");
    } else {
      await fetchVehicles();
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Οχήματα</h1>
        <p className="text-slate-600">
          Διαχείριση στόλου οχημάτων για AI αποστολές και real-time tracking.
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
            placeholder="π.χ. Tractor 1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Κωδικός</label>
          <input
            name="code"
            value={form.code}
            onChange={handleChange}
            className="w-full border rounded-lg px-3 py-2"
            placeholder="VH-001"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Πινακίδα</label>
          <input
            name="plate_number"
            value={form.plate_number}
            onChange={handleChange}
            className="w-full border rounded-lg px-3 py-2"
            placeholder="ABC-1234"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Τύπος</label>
          <select
            name="vehicle_type"
            value={form.vehicle_type}
            onChange={handleChange}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="tractor">Τρακτέρ</option>
            <option value="pickup">Pickup</option>
            <option value="truck">Φορτηγό</option>
            <option value="sprayer">Ψεκαστικό</option>
            <option value="irrigation_unit">Μονάδα άρδευσης</option>
            <option value="other">Άλλο</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Κατασκευαστής</label>
          <input
            name="manufacturer"
            value={form.manufacturer}
            onChange={handleChange}
            className="w-full border rounded-lg px-3 py-2"
            placeholder="John Deere"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Μοντέλο</label>
          <input
            name="model"
            value={form.model}
            onChange={handleChange}
            className="w-full border rounded-lg px-3 py-2"
            placeholder="Model"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">GPS Device ID</label>
          <input
            name="gps_device_id"
            value={form.gps_device_id}
            onChange={handleChange}
            className="w-full border rounded-lg px-3 py-2"
            placeholder="GPS-001"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">SIM Number</label>
          <input
            name="sim_number"
            value={form.sim_number}
            onChange={handleChange}
            className="w-full border rounded-lg px-3 py-2"
            placeholder="+3069..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Καύσιμο %</label>
          <input
            name="fuel_percent"
            value={form.fuel_percent}
            onChange={handleChange}
            type="number"
            min="0"
            max="100"
            className="w-full border rounded-lg px-3 py-2"
            placeholder="80"
          />
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
            {saving ? "Αποθήκευση..." : "Προσθήκη οχήματος"}
          </button>
        </div>
      </form>

      <div className="bg-white rounded-2xl shadow overflow-hidden">
        <div className="p-4 border-b font-semibold">Λίστα οχημάτων</div>

        {loading ? (
          <div className="p-4">Φόρτωση...</div>
        ) : vehicles.length === 0 ? (
          <div className="p-4 text-slate-500">Δεν υπάρχουν οχήματα.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="text-left p-3">Όνομα</th>
                  <th className="text-left p-3">Κωδικός</th>
                  <th className="text-left p-3">Πινακίδα</th>
                  <th className="text-left p-3">Τύπος</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Καύσιμο</th>
                  <th className="text-right p-3">Ενέργειες</th>
                </tr>
              </thead>

              <tbody>
                {vehicles.map((v) => (
                  <tr key={v.id} className="border-t">
                    <td className="p-3 font-medium">{v.name}</td>
                    <td className="p-3">{v.code || "-"}</td>
                    <td className="p-3">{v.plate_number || "-"}</td>
                    <td className="p-3">{v.vehicle_type}</td>
                    <td className="p-3">
                      <select
                        value={v.status}
                        onChange={(e) =>
                          updateVehicleStatus(v.id, e.target.value)
                        }
                        className="border rounded px-2 py-1"
                      >
                        <option value="available">Διαθέσιμο</option>
                        <option value="assigned">Ανατεθειμένο</option>
                        <option value="moving">Σε κίνηση</option>
                        <option value="working">Εργάζεται</option>
                        <option value="maintenance">Συντήρηση</option>
                        <option value="offline">Offline</option>
                      </select>
                    </td>
                    <td className="p-3">
                      {v.fuel_percent == null ? "-" : `${v.fuel_percent}%`}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => deleteVehicle(v.id)}
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