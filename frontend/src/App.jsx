import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Navbar } from "./components/Navbar";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { Dashboard } from "./pages/Dashboard";
import { Contests } from "./pages/Contests";
import { ProblemDetails } from "./pages/ProblemDetails";

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex-center" style={{ minHeight: "100vh" }}>
        <div style={{ fontSize: "1.25rem", color: "var(--text-muted)" }}>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", minHeight: "100dvh" }}>
          <Navbar />
          <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <Routes>
              {/* Protected Client Pages */}
              <Route 
                path="/" 
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/contests" 
                element={
                  <ProtectedRoute>
                    <Contests />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/problem/:questionId" 
                element={
                  <ProtectedRoute>
                    <ProblemDetails />
                  </ProtectedRoute>
                } 
              />

              {/* Public Guest Pages */}
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />

              {/* Catch-all route */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
