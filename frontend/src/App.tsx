// src/App.tsx
import React, { useEffect, useState } from "react";
import { useAnnotation } from "./context/AnnotationContext";
import LoginPage from "./pages/Login/LoginPage";
import MainLayout from "./components/Layout/MainLayout";
import { Modal } from "./components/Shared/Modal";
import { RotateCw } from "lucide-react";
import { CatGameProvider } from './context/CatGameContext';
import { CatSystem } from './components/CatSystem';
import { CatHUD } from './components/CatHUD';
import "./App.css";

const App: React.FC = () => {
  const { employeeId, isLoading, loadingMsg, hasStarted, setHasStarted, audioFiles } = useAnnotation();
  const [showReloadModal, setShowReloadModal] = useState(false);

  useEffect(() => {
    const wasUnloading = sessionStorage.getItem("_isUnloading") === "true";
    sessionStorage.removeItem("_isUnloading");
    sessionStorage.setItem("_pageJustLoaded", "true");

    if (wasUnloading && hasStarted) {
      setShowReloadModal(true);
    } else if (hasStarted && audioFiles.length === 0) {
      setShowReloadModal(true);
    }
  }, []);

  const handleConfirmReload = () => {
    setShowReloadModal(false);
    setHasStarted(false);
  };

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasStarted && audioFiles.length > 0) {
        e.preventDefault();
        e.returnValue = ""; 
      }
    };
    const handleUnload = () => {
      sessionStorage.setItem("_isUnloading", "true");
    };

    if (hasStarted && audioFiles.length > 0) {
      window.addEventListener("beforeunload", handleBeforeUnload);
      window.addEventListener("unload", handleUnload);
      return () => {
        window.removeEventListener("beforeunload", handleBeforeUnload);
        window.removeEventListener("unload", handleUnload);
      };
    }
  }, [hasStarted, audioFiles.length]);

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "var(--bg-app)", flexDirection: "column", gap: "1rem" }}>
        <div style={{ fontSize: "2rem", color: "var(--primary)" }}>
          <RotateCw className="animate-spin" size={40} />
        </div>
        <span style={{ color: "var(--text-light)" }}>{loadingMsg || "Loading..."}</span>
      </div>
    );
  }

  return (
    <>
      {/* *** แก้ไขตรงนี้: ส่ง employeeId เข้าไปที่ Provider *** */}
      <CatGameProvider userId={employeeId || 'guest'}>
        <CatHUD />
        <CatSystem />
        
        <Modal
          isOpen={showReloadModal}
          type="warning"
          title="Page Refreshed"
          message="จะต้องกลับไปอัปโหลด metadata และ ไฟล์เสียงใหม่"
          closeButton={false}
          actions={[{ label: "Go to Upload", onClick: handleConfirmReload, variant: "primary" }]}
        />

        {!employeeId ? (
          <LoginPage />
        ) : (
          <MainLayout />
        )}
      </CatGameProvider>
    </>
  );
};

export default App;