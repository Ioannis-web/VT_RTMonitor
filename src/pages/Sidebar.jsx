import { NavLink } from "react-router-dom";

export default function Sidebar() {
    return (
        <nav className="sidebar" aria-label="Κύρια πλοήγηση">
            <a className="sidebar-brand" href="/vehicles" aria-label="VisionTerra αρχική">
                <img
                    src="/assets/visionterra-logo.png"
                    alt="VisionTerra"
                    className="sidebar-logo"
                />
            </a>

            <div className="sidebar-menu">
                <NavLink
                    to="/vehicles"
                    className={({ isActive }) =>
                        isActive ? "active-menu-link" : "menu-link"
                    }
                >
                    Οχήματα
                </NavLink>

                <NavLink
                    to="/drones"
                    className={({ isActive }) =>
                        isActive ? "active-menu-link" : "menu-link"
                    }
                >
                    Drones
                </NavLink>

                <NavLink
                    to="/missions"
                    className={({ isActive }) =>
                        isActive ? "active-menu-link" : "menu-link"
                    }
                >
                    Αποστολές
                </NavLink>

                <NavLink
                    to="/mission-tasks"
                    className={({ isActive }) =>
                        isActive ? "active-menu-link" : "menu-link"
                    }
                >
                    Βήματα Αποστολών
                </NavLink>

                <NavLink
                    to="/fleet-map"
                    className={({ isActive }) =>
                        isActive ? "active-menu-link" : "menu-link"
                    }
                >
                    Χάρτης Στόλου
                </NavLink>

                <NavLink
                    to="/mobile-tracking"
                    className={({ isActive }) =>
                        isActive ? "active-menu-link" : "menu-link"
                    }
                >
                    Mobile GPS
                </NavLink>

                <NavLink
                    to="/vehicle-route-history"
                    className={({ isActive }) =>
                        isActive ? "active-menu-link" : "menu-link"
                    }
                >
                    Ιστορικό Διαδρομής
                </NavLink>

                <NavLink
                    to="/mission-route-history"
                    className={({ isActive }) =>
                        isActive ? "active-menu-link" : "menu-link"
                    }
                >
                    Διαδρομή Αποστολής
                </NavLink>
            </div>
        </nav>
    );
}
