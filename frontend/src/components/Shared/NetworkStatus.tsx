import React from "react";
import { useAnnotation } from "../../context/AnnotationContext";
import "./NetworkStatus.css"; // เดี๋ยวสร้างไฟล์ CSS นี้

export const NetworkStatus: React.FC = () => {
  const { isOnline, pendingCount } = useAnnotation();

  // 1. กรณี Offline
  if (!isOnline) {
    return (
      <div className="network-badge offline">
        <span className="dot red"></span>
        Offline Mode (Saved Locally)
      </div>
    );
  }

  // 2. กรณี Online แต่มีของค้าง (กำลัง Sync)
  if (pendingCount > 0) {
    return (
      <div className="network-badge syncing">
        <span className="dot yellow"></span>
        Syncing... ({pendingCount} pending)
      </div>
    );
  }

  // 3. กรณี Online ปกติ
  return (
    <div className="network-badge online">
      <span className="dot green"></span>
      Online (All Saved)
    </div>
  );
};