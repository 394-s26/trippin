import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { LastViewedTripProvider } from './contexts/LastViewedTripContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppHeader from './components/AppHeader';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import TripPage from './pages/TripPage';
import MapPage from './pages/MapPage';
import MiscPage from './pages/MiscPage';
import ProfilePage from './pages/ProfilePage';
import LoginPage from './pages/LoginPage';
import './index.css';

const AppLayout = () => (
  <ProtectedRoute>
    <LastViewedTripProvider>
      <AppHeader /> {/* Fixed header inside here */}
      <main className="pt-20">
        <Outlet />
      </main>
      <Navbar />
    </LastViewedTripProvider>
  </ProtectedRoute>
);

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AppLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/trip/:id" element={<TripPage />} />
            <Route path="/trip/:id/map" element={<MapPage />} />
            <Route path="/trip/:id/misc" element={<MiscPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
