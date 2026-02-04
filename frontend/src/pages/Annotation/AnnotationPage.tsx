import React, { useState, useEffect, useRef } from "react";
import {
  Check,
  X,
  Play,
  Pause,
  Trash2,
  FastForward,
  Loader2,
  Megaphone,
  Zap,
  Layers,
  RotateCcw, 
} from "lucide-react";

import { useAnnotation } from "../../context/AnnotationContext";
import { WaveformPlayer } from "../../components/AudioPlayer/WaveformPlayer";
import { TokenizedText } from "../../components/Tokenizer/TokenizedText";
import { Pagination } from "../../components/Shared/Pagination";
import { audioService } from "../../api/audioService";
import { Modal } from "../../components/Shared/Modal";
import { GuidelinePanel } from "../../components/GuidelinePanel";
import "./AnnotationPage.css";

const ITEMS_PER_PAGE = 10;

const AnnotationPage: React.FC = () => {
  const {
    pendingItems,
    handleDecision,
    playAudio,
    playingFile,
    tokenCache,
    setAudioFiles,
    broadcastMessage,
    incomingAnnouncement,
    dismissAnnouncement,
    employeeId,
    inspectText,
    suggestions,
  } = useAnnotation();

  const [page, setPage] = useState(1);
  const [isGuideOpen, setIsGuideOpen] = useState(true);

  // --- State ---
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [savingFiles, setSavingFiles] = useState<Record<string, boolean>>({});

  // Tokens
  const [liveTokens, setLiveTokens] = useState<Record<string, string[]>>({});
  const [batchTokens, setBatchTokens] = useState<Record<string, string[]>>({});
  const [smartEdits, setSmartEdits] = useState<
    Record<string, Record<number, string>>
  >({});

  // Loading & Refs
  const [isTokenizing, setIsTokenizing] = useState<Record<string, boolean>>({});
  const isManualTyping = useRef<boolean>(false);

  // --- Automation ---
  const [autoPlay, setAutoPlay] = useState(() =>
    JSON.parse(localStorage.getItem("anno_autoPlay") || "false"),
  );
  const [autoTokenize, setAutoTokenize] = useState(() =>
    JSON.parse(localStorage.getItem("anno_autoTokenize") || "true"),
  );

  // --- Batch Mode (Cut All) ---
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [isBatchLoading, setIsBatchLoading] = useState(false);

  const [itemToDelete, setItemToDelete] = useState<any | null>(null);
  const lastAutoPlayedRef = useRef<string | null>(null);
  const [isAnnounceModalOpen, setIsAnnounceModalOpen] = useState(false);
  const [announceText, setAnnounceText] = useState("");

  const totalPages = Math.ceil(pendingItems.length / ITEMS_PER_PAGE);
  const items = pendingItems.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE,
  );
  const firstItem = items[0];

  // --- Effects ---
  useEffect(() => {
    localStorage.setItem("anno_autoPlay", JSON.stringify(autoPlay));
  }, [autoPlay]);

  useEffect(() => {
    localStorage.setItem("anno_autoTokenize", JSON.stringify(autoTokenize));
  }, [autoTokenize]);

  // Reset State on Page Change
  useEffect(() => {
    setEdits({});
    setIsBatchMode(false);
    setLiveTokens({});
    setBatchTokens({});
    setSmartEdits({});
  }, [page]);

  // Auto Fetch on Mount
  useEffect(() => {
    const fetchInitialTokens = async () => {
      // ✅ แก้คืน: ให้โหลด Token ของ "ทุก Item" ในหน้านี้ (ถ้ายังไม่มีใน Cache)
      // ไม่ต้องรอ autoTokenize หรือเช็คว่าเป็นตัวแรก
      const itemsToFetch = items.filter(
        (item) => !tokenCache.has(item.text) && !batchTokens[item.filename]
      );

      if (itemsToFetch.length === 0) return;

      try {
        const texts = itemsToFetch.map((i) => i.text);
        const { results } = await audioService.tokenizeBatch(texts);
        const newTokens: Record<string, string[]> = {};
        itemsToFetch.forEach((item, idx) => {
          if (results[idx]) newTokens[item.filename] = results[idx];
        });
        setBatchTokens((prev) => ({ ...prev, ...newTokens }));
      } catch (err) {
        console.error("Initial fetch failed", err);
      }
    };

    fetchInitialTokens();
  }, [items, tokenCache]); // เอา autoTokenize ออกจาก dependency

  // Real-time Tokenizer (Typing)
  useEffect(() => {
    const handler = setTimeout(async () => {
      if (!isManualTyping.current) return;

      const filesToUpdate = Object.keys(edits).filter((filename) => {
        const currentText = edits[filename];
        if (!currentText) return false;
        const currentTokens = liveTokens[filename] || batchTokens[filename];
        if (currentTokens && currentTokens.join("") === currentText)
          return false;
        return true;
      });

      if (filesToUpdate.length === 0) return;

      const loadingState = { ...isTokenizing };
      filesToUpdate.forEach((f) => (loadingState[f] = true));
      setIsTokenizing(loadingState);

      try {
        const texts = filesToUpdate.map((f) => edits[f]);
        const { results } = await audioService.tokenizeBatch(texts);
        const newLiveTokens: Record<string, string[]> = {};

        filesToUpdate.forEach((filename, idx) => {
          if (results[idx]) newLiveTokens[filename] = results[idx];
        });

        setLiveTokens((prev) => ({ ...prev, ...newLiveTokens }));

        setSmartEdits((prev) => {
          const next = { ...prev };
          filesToUpdate.forEach((f) => delete next[f]);
          return next;
        });
      } catch (err) {
        console.error(err);
      } finally {
        setIsTokenizing({});
        isManualTyping.current = false;
      }
    }, 800);

    return () => clearTimeout(handler);
  }, [edits]);

  // Auto Play
  useEffect(() => {
    if (!firstItem) return;
    const isNewFile = firstItem.filename !== lastAutoPlayedRef.current;
    if (isNewFile) {
      lastAutoPlayedRef.current = firstItem.filename;
      if (autoPlay) {
        setTimeout(() => {
          if (playingFile !== firstItem.filename) playAudio(firstItem);
        }, 300);
      }
    }
  }, [firstItem, autoPlay, playingFile, playAudio]);

  // --- Handlers ---

  const toggleBatchMode = async () => {
    if (isBatchMode) {
      setIsBatchMode(false);
    } else {
      setIsBatchLoading(true);
      try {
        const texts = items.map((i) => edits[i.filename] || i.text);
        const { results } = await audioService.tokenizeBatch(texts);
        const newBatch: Record<string, string[]> = {};
        items.forEach((item, idx) => {
          if (results[idx]) newBatch[item.filename] = results[idx];
        });
        setBatchTokens((prev) => ({ ...prev, ...newBatch }));
        setIsBatchMode(true);
      } catch (error) {
        console.error("Batch failed", error);
      } finally {
        setIsBatchLoading(false);
      }
    }
  };

  const handleTextChange = (filename: string, newText: string) => {
    isManualTyping.current = true;
    setEdits((prev) => ({ ...prev, [filename]: newText }));
  };

  // ✅ ฟังก์ชัน Reset กลับเป็นค่าเดิม
  const handleReset = (filename: string) => {
    // 1. ลบข้อมูลการแก้ไข (Text)
    setEdits((prev) => {
      const n = { ...prev };
      delete n[filename];
      return n;
    });
    // 2. ลบ Token ที่เกิดจากการพิมพ์ (Live Token)
    setLiveTokens((prev) => {
      const n = { ...prev };
      delete n[filename];
      return n;
    });
    // 3. ลบ Smart Edits (การแก้รายคำ)
    setSmartEdits((prev) => {
      const n = { ...prev };
      delete n[filename];
      return n;
    });
    // 4. Reset สถานะการพิมพ์
    isManualTyping.current = false;
  };

  const handleSmartCorrection = (
    filename: string,
    idx: number,
    newWord: string | null,
    baseTokens: string[],
  ) => {
    isManualTyping.current = false;
    setSmartEdits((prev) => {
      const fileEdits = { ...(prev[filename] || {}) };
      if (newWord === null) delete fileEdits[idx];
      else fileEdits[idx] = newWord;

      const newTokens = baseTokens.map((token, i) =>
        fileEdits[i] !== undefined ? fileEdits[i] : token,
      );
      const finalText = newTokens.filter((t) => t !== "").join("");
      
      setEdits((prevEdits) => ({ ...prevEdits, [filename]: finalText }));

      if (Object.keys(fileEdits).length === 0) {
        const next = { ...prev };
        delete next[filename];
        return next;
      }
      return { ...prev, [filename]: fileEdits };
    });
  };

  // ✅ Fix Logic Save: ใช้ itemToSave แทนการแก้ที่ Backend โดยตรง
  const handleCorrect = async (item: any) => {
    const editedText = edits[item.filename];
    const finalText = (editedText !== undefined) ? editedText : item.text;
    const itemToSave = { ...item, text: finalText };

    if (editedText !== undefined && editedText !== item.text) {
      setAudioFiles((prev) =>
        prev.map((f) =>
          f.filename === item.filename ? { ...f, text: editedText } : f,
        ),
      );
    }

    const fileSmartEdits = smartEdits[item.filename];
    handleDecision(itemToSave, "correct", fileSmartEdits);

    // Cleanup
    setEdits((prev) => {
      const n = { ...prev };
      delete n[item.filename];
      return n;
    });
    setLiveTokens((prev) => {
      const n = { ...prev };
      delete n[item.filename];
      return n;
    });
    setSmartEdits((prev) => {
      const n = { ...prev };
      delete n[item.filename];
      return n;
    });
  };

  const handleIncorrect = (item: any) => {
    handleDecision(item, "incorrect");
  };

  const shouldExpand = (idx: number) => {
    if (isBatchMode) return true;
    if (autoTokenize && idx === 0) return true;
    return false;
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLTextAreaElement &&
        e.ctrlKey &&
        e.code === "Enter" &&
        firstItem
      ) {
        e.preventDefault();
        handleCorrect(firstItem);
        return;
      }

      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if (!firstItem) return;

      if (e.code === "Space") {
        e.preventDefault();
        playAudio(firstItem);
      }
      if (e.code === "Enter") {
        e.preventDefault();
        handleCorrect(firstItem);
      }
      if (e.code === "Backspace") {
        e.preventDefault();
        handleIncorrect(firstItem);
      }
      if (e.code === "Slash" && e.ctrlKey) setIsGuideOpen((prev) => !prev);
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [firstItem, playAudio, edits, smartEdits]);

  if (pendingItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in text-slate-400">
        <div className="w-16 h-16 bg-green-50 text-green-400 rounded-full flex items-center justify-center mb-4 shadow-sm">
          <Check size={32} />
        </div>
        <h3 className="text-xl font-semibold text-slate-600">All caught up!</h3>
        <p>No pending items to review.</p>
      </div>
    );
  }

  return (
    <div className="anno-container animate-fade-in">
      <div className="anno-toolbar">
        <div className="toolbar-left">
          <h2 className="toolbar-title">Annotation</h2>
          <label className="toggle-switch-wrapper">
            <input
              type="checkbox"
              checked={autoPlay}
              onChange={(e) => setAutoPlay(e.target.checked)}
            />
            <span className="toggle-slider"></span>
            <span className="toggle-label">
              <FastForward
                size={14}
                className={autoPlay ? "text-indigo-600" : ""}
              />{" "}
              Auto Play
            </span>
          </label>

          <label className="toggle-switch-wrapper">
            <input
              type="checkbox"
              checked={autoTokenize}
              onChange={(e) => setAutoTokenize(e.target.checked)}
              disabled={isBatchMode}
            />
            <span className={`toggle-slider ${isBatchMode ? "disabled" : ""}`}></span>
            <span className={`toggle-label ${isBatchMode ? "opacity-50" : ""}`}>
              <Zap
                size={14}
                className={autoTokenize && !isBatchMode ? "text-orange-500" : ""}
              />{" "}
              Auto Cut
            </span>
          </label>
        </div>

        <div className="toolbar-right">
          <button
            onClick={toggleBatchMode}
            disabled={isBatchLoading}
            className={`btn-batch-toggle ${isBatchMode ? "active" : ""}`}
            style={{ marginRight: "8px" }}
          >
            {isBatchLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Layers size={16} />
            )}
            <span>Cut All {isBatchMode ? "(ON)" : "(OFF)"}</span>
          </button>

          {employeeId === "TN680058" && (
            <button
              className="btn-batch-toggle"
              onClick={() => setIsAnnounceModalOpen(true)}
              style={{
                backgroundColor: "#fdf2f8",
                color: "#db2777",
                borderColor: "#fce7f3",
              }}
            >
              <Megaphone size={16} /> <span>Announce</span>
            </button>
          )}
        </div>
      </div>

      <div className="anno-layout">
        <div className="main-panel">
          <table className="custom-table">
            <thead>
              <tr>
                <th className="w-[25%]">Audio</th>
                <th className="w-auto">Transcript</th>
                <th className="w-[140px] text-center">Decision</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const isPlaying = playingFile === item.filename;
                const displayText =
                  edits[item.filename] !== undefined
                    ? edits[item.filename]
                    : item.text;
                const isSaving = savingFiles[item.filename];
                const isDirty =
                  edits[item.filename] !== undefined &&
                  edits[item.filename] !== item.text;

                const tokens =
                  liveTokens[item.filename] ||
                  batchTokens[item.filename] ||
                  tokenCache.get(item.text);

                const fileSmartEdits = smartEdits[item.filename] || {};
                const isRefreshing = isTokenizing[item.filename];
                const isExpanded = shouldExpand(idx);

                return (
                  <tr key={item.filename}>
                    <td className="align-top py-3">
                      <div className="audio-cell-content">
                        <div className="filename-badge" title={item.filename}>
                          {item.filename}
                        </div>
                        <button
                          onClick={() => playAudio(item)}
                          className={`btn-play-hero ${isPlaying ? "playing" : ""}`}
                        >
                          {isPlaying ? (
                            <Pause size={20} fill="currentColor" />
                          ) : (
                            <Play
                              size={20}
                              fill="currentColor"
                              className="ml-1"
                            />
                          )}
                        </button>
                        {item.audioPath && (
                          <div className="w-full px-2 mt-2">
                            <WaveformPlayer
                              audioUrl={item.audioPath}
                              isPlaying={isPlaying}
                              onPlayChange={(p) =>
                                !p && isPlaying && playAudio(item)
                              }
                              progressColor="#818cf8"
                              height="h-1"
                            />
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="align-top py-3">
                      <div className="flex flex-col gap-3">
                        <div className="relative">
                          <textarea
                            className={`transcript-textarea ${isDirty ? "dirty" : ""}`}
                            value={displayText}
                            onChange={(e) =>
                              handleTextChange(item.filename, e.target.value)
                            }
                            placeholder="Transcribe here..."
                            rows={2}
                            disabled={isSaving}
                          />
                          {isDirty && (
                                    <>
                                      {/* Badge: เปลี่ยนมาใช้ Class .badge-edited */}
                                      <div className="badge-edited">
                                        <span>
                                          {isRefreshing ? "CUTTING..." : "EDITED"}
                                        </span>
                                      </div>
                                      
                                      {/* Button: เปลี่ยนมาใช้ Class .btn-reset-input */}
                                      <button
                                        onClick={() => handleReset(item.filename)}
                                        className="btn-reset-input"
                                        title="Reset to Original"
                                      >
                                        <RotateCcw size={12} />
                                      </button>
                                    </>
                                  )}
                                </div>

                        <div
                          className={`token-view-wrapper ${isRefreshing ? "opacity-50" : ""}`}
                        >
                          <div className="flex justify-between items-center mb-1">
                            <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider"></div>
                            {(isRefreshing || (!tokens && isBatchLoading && isExpanded)) && (
                              <Loader2
                                size={10}
                                className="animate-spin text-slate-400"
                              />
                            )}
                          </div>

                          {tokens ? (
                            <TokenizedText
                              text={item.text}
                              onInspect={inspectText}
                              tokens={tokens}
                              isExpanded={isExpanded}
                              suggestions={suggestions}
                              appliedEdits={fileSmartEdits}
                              onApplyCorrection={(i, word) =>
                                handleSmartCorrection(
                                  item.filename,
                                  i,
                                  word,
                                  tokens,
                                )
                              }
                            />
                          ) : (
                             isExpanded && isBatchLoading ? (
                                <div className="text-sm text-slate-400 italic p-2">
                                  Loading cutter...
                                </div>
                             ) : null
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="align-top py-3">
                      <div className="action-wrapper h-full justify-start pt-1">
                        <button
                          className="btn-trash-float"
                          onClick={(e) => {
                            e.stopPropagation();
                            setItemToDelete(item);
                          }}
                        >
                          <Trash2 size={12} />
                        </button>

                        <div className="decision-group flex-col gap-2 w-full">
                          <button
                            onClick={() => handleCorrect(item)}
                            disabled={isSaving}
                            className={`btn-action correct w-full justify-center ${isSaving ? "opacity-50" : ""}`}
                            title="Save & Correct (Enter)"
                          >
                            {isSaving ? (
                              <Loader2 size={20} className="animate-spin" />
                            ) : (
                              <Check size={20} strokeWidth={3} />
                            )}
                            <span className="ml-1 text-sm">
                            </span>
                          </button>

                          <button
                            onClick={() => handleIncorrect(item)}
                            disabled={isSaving}
                            className="btn-action incorrect w-full justify-center"
                            title="Incorrect (Backspace)"
                          >
                            <X size={20} strokeWidth={3} />
                            <span className="ml-1 text-sm"></span>
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="flex justify-center mt-6">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        </div>

        <aside
          className={`guideline-panel ${!isGuideOpen ? "collapsed" : ""}`}
          onClick={() => !isGuideOpen && setIsGuideOpen(true)}
        >
          <GuidelinePanel
            isOpen={isGuideOpen}
            onToggle={setIsGuideOpen}
            type="annotation"
          />
        </aside>
      </div>

      <Modal
        isOpen={!!itemToDelete}
        type="confirm"
        title="Confirm Deletion"
        message={`Move "${itemToDelete?.filename}" to trash?`}
        onClose={() => setItemToDelete(null)}
        actions={[
          {
            label: "Cancel",
            onClick: () => setItemToDelete(null),
            variant: "secondary",
          },
          {
            label: "Delete",
            onClick: async () => {
              await audioService.appendTsv("trash.tsv", itemToDelete);
              setAudioFiles((prev) =>
                prev.filter((f) => f.filename !== itemToDelete.filename),
              );
              setItemToDelete(null);
            },
            variant: "danger",
          },
        ]}
      />

      <Modal
        isOpen={isAnnounceModalOpen}
        type="confirm"
        title="Broadcast Announcement"
        message={
          <textarea
            className="w-full border rounded p-2"
            rows={3}
            value={announceText}
            onChange={(e) => setAnnounceText(e.target.value)}
          />
        }
        onClose={() => setIsAnnounceModalOpen(false)}
        actions={[
          {
            label: "Cancel",
            onClick: () => setIsAnnounceModalOpen(false),
            variant: "secondary",
          },
          {
            label: "Broadcast",
            onClick: async () => {
              await broadcastMessage(announceText);
              setIsAnnounceModalOpen(false);
            },
            variant: "danger",
          },
        ]}
      />

      <Modal
        isOpen={!!incomingAnnouncement}
        type="alert"
        title={`📢 Message`}
        message={
          <div className="text-center py-4">{incomingAnnouncement?.text}</div>
        }
        onClose={dismissAnnouncement}
        actions={[
          { label: "Got it", onClick: dismissAnnouncement, variant: "primary" },
        ]}
      />
    </div>
  );
};

export default AnnotationPage;