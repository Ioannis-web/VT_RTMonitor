import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import DronesPage from "./pages/DronesPage";
import MissionsPage from "./pages/MissionsPage";
import Sidebar from "./pages/Sidebar";
import VehiclesPage from "./pages/Vehicles";
import MissionTasksPage from "./pages/MissionTasksPage";
import VehicleDroneMapPage from "./pages/VehicleDroneMapPage";
import MobileTrackingPage from "./pages/MobileTrackingPage";
import VehicleRouteHistoryPage from "./pages/VehicleRouteHistoryPage";
import MissionRouteHistoryPage from "./pages/MissionRouteHistoryPage";

function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <Sidebar />
        <main>
          <Routes>
            <Route path="/vehicles" element={<VehiclesPage />} />
            <Route path="/drones" element={<DronesPage />} />
            <Route path="/missions" element={<MissionsPage />} />
            <Route path="/mission-tasks" element={<MissionTasksPage />} />
            <Route path="/mission-route-history" element={<MissionRouteHistoryPage />} />
            <Route path="/fleet-map" element={<VehicleDroneMapPage />} />
            <Route path="/mobile-tracking" element={<MobileTrackingPage />} />
            <Route path="/vehicle-route-history" element={<VehicleRouteHistoryPage />} />
            <Route path="/" element={<Navigate to="/vehicles" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
