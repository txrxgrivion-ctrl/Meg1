"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Mic,
  Paperclip,
  Power,
  Smartphone,
  CheckCheck,
  HelpCircle,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Video as VideoIcon,
  FileText,
  Volume2,
  Trash2,
  Sparkles,
  VolumeX,
  X,
  Plus
} from "lucide-react";

interface UserProfile {
  id: string;
  name: string;
  avatar: string;
  isOnline: boolean;
  lastSeen?: string;
}

interface Message {
  id: number;
  senderId: string;
  recipientId: string;
  content: string | null;
  mediaData: string | null;
  mediaType: string | null;
  fileName: string | null;
  isRead: boolean;
  createdAt: string;
}

export default function Home() {
  // Authentication & Session States
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [partnerUser, setPartnerUser] = useState<UserProfile | null>(null);
  const [authError, setAuthError] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [showAuthSuccessFlash, setShowAuthSuccessFlash] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Messaging States
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessageText, setNewMessageText] = useState("");
  const [attachedFile, setAttachedFile] = useState<{
    data: string; // base64 string
    type: string; // 'image' | 'video' | 'pdf' | 'audio'
    name: string;
  } | null>(null);

  // Audio Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordingTimer, setRecordingTimer] = useState<NodeJS.Timeout | null>(null);

  // UI Utilities
  const [isSending, setIsSending] = useState(false);
  const [pwaPrompt, setPwaPrompt] = useState<any>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // Audio Playback states for individual messages
  const [activeAudioId, setActiveAudioId] = useState<number | null>(null);

  // DOM Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chatScrollContainerRef = useRef<HTMLDivElement>(null);

  // 1. Initial configuration, local storage recovery, and PWA setup
  useEffect(() => {
    // Register PWA Service Worker
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("Service Worker registered successfully:", reg.scope);
        })
        .catch((err) => {
          console.error("Service Worker registration failed:", err);
        });
    }

    // Recover user from localStorage if it exists
    const storedUser = localStorage.getItem("etoile_crepuscule_user");
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setCurrentUser(parsed);
      } catch (e) {
        localStorage.removeItem("etoile_crepuscule_user");
      }
    }

    // Listen for PWA installation trigger
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setPwaPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Prompt user for notification permission on start
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  // 2. Play ambient romantic star chime on login/message
  const playChime = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      // Generate a beautiful, high-pitched space chime
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      osc1.type = "sine";
      osc1.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      osc1.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + 0.15); // E6 note

      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(440, audioCtx.currentTime); // A4
      osc2.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.2); // A6

      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      osc1.start();
      osc2.start();
      osc1.stop(audioCtx.currentTime + 0.6);
      osc2.stop(audioCtx.currentTime + 0.6);
    } catch (err) {
      console.log("Audio feedback error:", err);
    }
  };

  // 3. Heartbeat & Sync Loops
  useEffect(() => {
    if (!currentUser) return;

    // Run first sync immediately
    syncChat();

    // Setup polling every 1.5 seconds for instant feel
    const interval = setInterval(() => {
      syncChat();
    }, 1500);

    return () => clearInterval(interval);
  }, [currentUser]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Synchronize state with database
  const syncChat = async () => {
    if (!currentUser) return;
    try {
      const subscription = null; // Can bind real push endpoints if registered

      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          isOnline: true,
          pushSubscription: subscription,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          // Play a sound if a new message is received from the partner
          const currentCount = messages.length;
          const newCount = data.messages.length;

          if (currentCount > 0 && newCount > currentCount) {
            const lastNewMsg = data.messages[newCount - 1];
            if (lastNewMsg.senderId !== currentUser.id) {
              playChime();
              // Trigger local native browser notification if page is hidden
              if (document.hidden && "Notification" in window && Notification.permission === "granted") {
                const partnerName = currentUser.id === "wesley" ? "Mégane" : "Wesley";
                const bodyText = lastNewMsg.mediaType 
                  ? `📸 Envoyé un fichier: [${lastNewMsg.mediaType}]` 
                  : lastNewMsg.content || "Nouveau message";
                
                new Notification(`💖 ${partnerName}`, {
                  body: bodyText,
                  icon: "https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=192&h=192&q=80",
                });
              }
            }
          }

          setMessages(data.messages);
          if (data.otherUser) {
            setPartnerUser(data.otherUser);
          }
        }
      }
    } catch (err) {
      console.error("Failed to sync:", err);
    }
  };

  // 4. Vortex login Canvas Animation
  useEffect(() => {
    if (currentUser) return; // Only run when on login screen
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let width = (canvas.width = canvas.offsetWidth || 500);
    let height = (canvas.height = canvas.offsetHeight || 500);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth || 500;
      height = canvas.height = canvas.offsetHeight || 500;
    };
    window.addEventListener("resize", handleResize);

    // Particle class for the vortex
    class Particle {
      angle: number;
      radius: number;
      speed: number;
      color: string;
      size: number;
      distanceFactor: number;

      constructor() {
        this.angle = Math.random() * Math.PI * 2;
        this.radius = Math.random() * Math.min(width, height) * 0.45 + 10;
        this.speed = (0.01 + Math.random() * 0.015) * (Math.random() > 0.5 ? 1 : -1);
        this.size = Math.random() * 1.8 + 0.4;
        this.distanceFactor = Math.random() * 0.9 + 0.1;

        // Violet-magenta-cyan color spectrum for Kimi No Na Wa comet vibe
        const r = Math.random();
        if (r < 0.4) {
          this.color = `rgba(139, 92, 246, ${Math.random() * 0.6 + 0.4})`; // Violet
        } else if (r < 0.7) {
          this.color = `rgba(6, 182, 212, ${Math.random() * 0.6 + 0.4})`; // Cyan
        } else {
          this.color = `rgba(236, 72, 153, ${Math.random() * 0.5 + 0.3})`; // Pink
        }
      }

      update(isWarping: boolean) {
        // Spiral inwards
        const speedMultiplier = isWarping ? 8 : 1;
        this.angle += this.speed * speedMultiplier;

        if (isWarping) {
          // Rapidly suck particles into the center, then shoot them out
          this.radius -= 2.2;
          if (this.radius < 5) {
            this.radius = Math.min(width, height) * 1.5; // Explode out
            this.size = Math.random() * 4 + 1;
          }
        } else {
          this.radius -= 0.08 * this.distanceFactor;
          if (this.radius < 10) {
            this.radius = Math.min(width, height) * 0.45 + Math.random() * 30;
          }
        }
      }

      draw(context: CanvasRenderingContext2D) {
        const x = width / 2 + Math.cos(this.angle) * this.radius;
        const y = height / 2 + Math.sin(this.angle) * this.radius;

        context.beginPath();
        context.arc(x, y, this.size, 0, Math.PI * 2);
        context.fillStyle = this.color;
        context.shadowBlur = this.size * 3;
        context.shadowColor = this.color;
        context.fill();
        context.shadowBlur = 0; // Reset
      }
    }

    const particles: Particle[] = [];
    const particleCount = 280;
    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }

    // Dynamic rings representing gravity thresholds
    let ringAngle = 0;

    const render = () => {
      // Create trailing blur effect
      ctx.fillStyle = "rgba(6, 6, 12, 0.18)";
      ctx.fillRect(0, 0, width, height);

      // Draw interactive center glowing core
      const gradient = ctx.createRadialGradient(
        width / 2,
        height / 2,
        2,
        width / 2,
        height / 2,
        isAuthenticating ? 90 : 35
      );
      gradient.addColorStop(0, "#ffffff");
      gradient.addColorStop(0.15, "rgba(6, 182, 212, 0.8)"); // Cyan glow
      gradient.addColorStop(0.4, "rgba(139, 92, 246, 0.4)"); // Violet halo
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.beginPath();
      ctx.arc(width / 2, height / 2, isAuthenticating ? 100 : 40, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Draw subtle orbital rings
      ringAngle += 0.003;
      ctx.strokeStyle = "rgba(139, 92, 246, 0.06)";
      ctx.lineWidth = 1;
      
      // Ring 1
      ctx.beginPath();
      ctx.ellipse(width / 2, height / 2, 100, 70, ringAngle, 0, Math.PI * 2);
      ctx.stroke();

      // Ring 2
      ctx.beginPath();
      ctx.ellipse(width / 2, height / 2, 180, 110, -ringAngle * 1.5, 0, Math.PI * 2);
      ctx.stroke();

      // Update and draw particles
      particles.forEach((p) => {
        p.update(isAuthenticating);
        p.draw(ctx);
      });

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
    };
  }, [currentUser, isAuthenticating]);

  // 5. Authenticate action
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setAuthError("");
    setIsAuthenticating(true);

    // Give a small delay to speed up the vortex particles before validation
    await new Promise((r) => setTimeout(r, 900));

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        playChime();
        // Trigger fullscreen flashy expand
        setShowAuthSuccessFlash(true);
        await new Promise((r) => setTimeout(r, 1200));

        setCurrentUser(data.user);
        localStorage.setItem("etoile_crepuscule_user", JSON.stringify(data.user));
        setPassword("");
      } else {
        setAuthError(data.error || "Une erreur est survenue");
        setIsAuthenticating(false);
      }
    } catch (err) {
      setAuthError("Erreur lors de la connexion au serveur.");
      setIsAuthenticating(false);
    }
  };

  // 6. Logout action
  const handleLogout = async () => {
    if (!currentUser) return;
    try {
      // Mark as offline in DB
      await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          isOnline: false,
        }),
      });
    } catch (e) {
      console.log(e);
    }

    localStorage.removeItem("etoile_crepuscule_user");
    setCurrentUser(null);
    setPartnerUser(null);
    setMessages([]);
    setIsAuthenticating(false);
    setShowAuthSuccessFlash(false);
  };

  // 7. File Upload processing & Base64 conversions
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Support images, videos, and PDFs
    const fileType = file.type;
    let resolvedType: "image" | "video" | "pdf" | "audio" = "pdf";

    if (fileType.startsWith("image/")) resolvedType = "image";
    else if (fileType.startsWith("video/")) resolvedType = "video";
    else if (fileType.startsWith("audio/")) resolvedType = "audio";
    else if (fileType === "application/pdf") resolvedType = "pdf";

    // Constrain file size to 8MB in sandbox to avoid payload limitations
    if (file.size > 8 * 1024 * 1024) {
      alert("Le fichier est trop volumineux. Choisis un fichier de moins de 8 Mo pour garantir la fluidité.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setAttachedFile({
          data: reader.result,
          type: resolvedType,
          name: file.name,
        });
      }
    };
    reader.readAsDataURL(file);
  };

  // 8. Voice Recording Mechanics
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        const compiledBlob = new Blob(chunks, { type: "audio/webm" });
        setAudioBlob(compiledBlob);

        // Convert blob immediately to base64
        const fileReader = new FileReader();
        fileReader.onload = () => {
          if (typeof fileReader.result === "string") {
            setAttachedFile({
              data: fileReader.result,
              type: "audio",
              name: `vocal_${new Date().getTime()}.webm`,
            });
          }
        };
        fileReader.readAsDataURL(compiledBlob);

        // Stop all audio tracks to release microphone
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingDuration(0);

      const timer = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
      setRecordingTimer(timer);
    } catch (err) {
      alert("Impossible d'accéder au microphone. Veuillez vérifier les permissions de votre navigateur.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      if (recordingTimer) {
        clearInterval(recordingTimer);
        setRecordingTimer(null);
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorder && isRecording) {
      setIsRecording(false);
      if (recordingTimer) {
        clearInterval(recordingTimer);
        setRecordingTimer(null);
      }
      mediaRecorder.onstop = null; // discard recording
      mediaRecorder.stop();
    }
    setAudioBlob(null);
    setAttachedFile(null);
  };

  // 9. Send Message logic
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentUser) return;
    if (!newMessageText.trim() && !attachedFile) return;

    setIsSending(true);
    const partnerId = currentUser.id === "wesley" ? "megane" : "wesley";

    try {
      const response = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderId: currentUser.id,
          recipientId: partnerId,
          content: newMessageText.trim() || null,
          mediaData: attachedFile?.data || null,
          mediaType: attachedFile?.type || null,
          fileName: attachedFile?.name || null,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          playChime();
          // Clear inputs
          setNewMessageText("");
          setAttachedFile(null);
          setAudioBlob(null);
          // Sync immediately
          syncChat();
        }
      } else {
        alert("Une erreur s'est produite lors de l'envoi.");
      }
    } catch (err) {
      console.error(err);
      alert("Impossible de joindre le serveur de messagerie.");
    } finally {
      setIsSending(false);
    }
  };

  // Helper formatting for romantic/anime timestamps
  const formatAnimeTimestamp = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const hours = date.getHours().toString().padStart(2, "0");
      const minutes = date.getMinutes().toString().padStart(2, "0");
      const seconds = date.getSeconds();

      // Unique Kimi No Na Wa themes based on hour phases
      let phase = "Étoiles";
      const h = date.getHours();
      if (h >= 5 && h < 12) phase = "Aube";
      else if (h >= 12 && h < 17) phase = "Zénith";
      else if (h >= 17 && h < 21) phase = "Crépuscule"; // Tasogare-doki
      else phase = "Ciel Étoilé";

      return `${phase} • ${hours}:${minutes}`;
    } catch (e) {
      return "";
    }
  };

  // Custom audio node renderer helper to avoid browser tag memory leaks
  const handlePlayVoice = (id: number) => {
    if (activeAudioId === id) {
      setActiveAudioId(null);
    } else {
      setActiveAudioId(id);
    }
  };

  // Formatter for media display helper
  const getFileSizeEstimate = (base64String: string | null) => {
    if (!base64String) return "";
    const stringLength = base64String.length - (base64String.indexOf(",") + 1);
    const sizeInBytes = 4 * Math.ceil(stringLength / 3) * 0.5624896334383812; // Estimate
    const sizeInKb = sizeInBytes / 1024;
    if (sizeInKb > 1024) {
      return (sizeInKb / 1024).toFixed(1) + " Mo";
    }
    return sizeInKb.toFixed(0) + " Ko";
  };

  const triggerPwaInstall = async () => {
    if (pwaPrompt) {
      pwaPrompt.prompt();
      const { outcome } = await pwaPrompt.userChoice;
      if (outcome === "accepted") {
        console.log("PWA install accepted");
        setPwaPrompt(null);
      }
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-between overflow-hidden bg-[#06060c] stars twilight-bg">
      {/* Absolute Shooting Stars background layer */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="shooting-star"></div>
        <div className="shooting-star"></div>
        <div className="shooting-star"></div>
      </div>

      <AnimatePresence mode="wait">
        {!currentUser ? (
          // ==========================================
          // 1. HYPNOTIC VORTEX LOGIN SCREEN
          // ==========================================
          <motion.div
            key="login"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.8 }}
            className="flex flex-col items-center justify-center min-h-screen relative w-full px-4"
          >
            {/* Top thematic title */}
            <div className="text-center z-10 select-none mb-4 absolute top-12">
              <motion.h1
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 1 }}
                className="text-3xl md:text-5xl font-extrabold tracking-widest text-[#f3f4f6] text-glow-violet italic font-serif"
              >
                かたわれ時
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.7 }}
                transition={{ delay: 0.7, duration: 1 }}
                className="text-xs md:text-sm tracking-widest uppercase text-cyan-300 mt-2 font-mono"
              >
                — Étoile & Crépuscule —
              </motion.p>
            </div>

            {/* Interactive Vortex Canvas */}
            <div className="relative w-80 h-80 md:w-[450px] md:h-[450px] flex items-center justify-center">
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full rounded-full cursor-pointer transition-transform duration-500 hover:scale-[1.02]"
              />

              {/* Heartbeat of the central black hole core */}
              <div
                className={`absolute w-12 h-12 rounded-full bg-white opacity-80 filter blur-md transition-all duration-700 ${
                  isAuthenticating ? "scale-[4.5] bg-cyan-100" : "animate-pulse"
                }`}
              />
            </div>

            {/* Password input & controls inside a subtle glassmorphic card */}
            <div className="w-full max-w-sm z-10 -mt-6">
              <motion.form
                onSubmit={handleLogin}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.8 }}
                className="glassmorphism p-6 rounded-2xl relative overflow-hidden"
              >
                {/* Glowing neon top accent */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-500 via-pink-500 to-cyan-500 shadow-lg" />

                <h2 className="text-sm text-center text-gray-300 mb-4 tracking-wide font-medium">
                  Saisis ton mot de passe stellaire
                </h2>

                <div className="relative mb-4">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Entrer le mot secret..."
                    disabled={isAuthenticating}
                    className="w-full py-3 pl-4 pr-12 rounded-xl glassmorphism-input text-white transition-all text-center tracking-widest"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-cyan-400 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {authError && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-xs text-rose-400 text-center mb-3 font-semibold"
                  >
                    {authError}
                  </motion.p>
                )}

                <button
                  type="submit"
                  disabled={isAuthenticating || !password.trim()}
                  className={`w-full py-3 rounded-xl font-semibold tracking-wider uppercase text-xs text-white transition-all duration-300 ${
                    isAuthenticating
                      ? "bg-cyan-500 shadow-cyan-500/20 cursor-wait"
                      : "bg-violet-600 hover:bg-violet-500 shadow-violet-500/20 active:scale-95 cursor-pointer"
                  }`}
                >
                  {isAuthenticating ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Assoir l&apos;espace-temps...
                    </span>
                  ) : (
                    "S'immerger"
                  )}
                </button>

                {/* Subtitle helper trigger */}
                <div className="flex justify-between items-center mt-4 pt-4 border-t border-violet-500/10 text-xs">
                  <button
                    type="button"
                    onClick={() => setShowHelp(!showHelp)}
                    className="text-cyan-400/80 hover:text-cyan-300 flex items-center gap-1 mx-auto transition-colors"
                  >
                    <HelpCircle size={13} />
                    Besoin des mots secrets ?
                  </button>
                </div>

                {showHelp && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-3 bg-black/40 p-3 rounded-lg border border-cyan-500/20 text-xs text-cyan-200/90 leading-relaxed"
                  >
                    <p className="font-semibold mb-1">🔑 Mots secrets disponibles :</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Wesley : <code className="bg-violet-950/40 px-1 rounded text-pink-300 font-mono font-bold">cherche au fond de ton coeur</code> ou <code className="bg-violet-950/40 px-1 rounded text-pink-300 font-mono font-bold">pas?</code></li>
                      <li>Mégane : <code className="bg-violet-950/40 px-1 rounded text-cyan-300 font-mono font-bold">il est toujours près de toi</code> ou <code className="bg-violet-950/40 px-1 rounded text-cyan-300 font-mono font-bold">pas?</code></li>
                    </ul>
                    <p className="text-[10px] text-gray-400 mt-2 italic">
                      L&apos;application s&apos;ouvrira de son point de vue (messages à droite, ceux du partenaire à gauche) avec mise à jour du statut temps réel.
                    </p>
                  </motion.div>
                )}
              </motion.form>
            </div>

            {/* Tiny bottom footer */}
            <div className="absolute bottom-6 text-center text-[11px] text-gray-500 select-none">
              Un ciel pour deux, par-delà les comètes. Allégorie exclusive.
            </div>

            {/* Absolute Fullscreen Flash Cover for transition */}
            <AnimatePresence>
              {showAuthSuccessFlash && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.2, ease: "easeInOut" }}
                  className="fixed inset-0 bg-white z-50 flex items-center justify-center"
                >
                  <motion.div
                    initial={{ scale: 0.1, opacity: 0 }}
                    animate={{ scale: 30, opacity: 1 }}
                    transition={{ duration: 1.4, ease: "easeIn" }}
                    className="w-12 h-12 rounded-full bg-violet-100"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          // ==========================================
          // 2. EXCLUSIVE GLASSMORPHIC MESSAGING SCREEN
          // ==========================================
          <motion.div
            key="chat-interface"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 100, damping: 20 }}
            className="flex flex-col h-screen max-h-screen relative w-full overflow-hidden"
          >
            {/* Top cosmic twilight ribbon */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 z-30 shadow-md shadow-purple-500/20" />

            {/* Header Dashboard */}
            <header className="glassmorphism py-3 px-4 md:px-8 flex items-center justify-between z-20 relative border-b border-violet-950/30">
              {/* Brand and Logo */}
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-violet-600 to-pink-500 flex items-center justify-center font-bold text-white text-base text-glow-violet shadow-lg border border-white/10">
                    {currentUser.name[0]}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#06060c] border border-cyan-400 flex items-center justify-center text-[8px] text-cyan-300 font-mono">
                    {currentUser.id === "wesley" ? "W" : "M"}
                  </div>
                </div>

                <div>
                  <h1 className="text-sm md:text-base font-bold text-white flex items-center gap-1.5 font-serif tracking-wide">
                    <span>{currentUser.name}</span>
                    <span className="text-[10px] text-violet-400 font-sans tracking-tight font-normal hidden md:inline">
                      • Univers Privé
                    </span>
                  </h1>
                  <p className="text-[10px] text-gray-400 flex items-center gap-1 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Connecté
                  </p>
                </div>
              </div>

              {/* Partner presence details */}
              <div className="flex-1 max-w-xs md:max-w-md mx-4">
                <div className="glassmorphism-light rounded-xl px-3 py-1.5 flex items-center justify-between border border-violet-500/10">
                  {partnerUser ? (
                    <div className="flex items-center gap-2.5 w-full">
                      {/* Avatar */}
                      <div className="relative">
                        <img
                          src={partnerUser.avatar || "https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=80"}
                          alt={partnerUser.name}
                          className="w-7 h-7 rounded-full object-cover border border-violet-500/30 shadow-md"
                        />
                        {partnerUser.isOnline && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-[#06060c] animate-pulse" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="text-left overflow-hidden">
                        <p className="text-xs font-semibold text-gray-100 truncate font-serif">
                          {partnerUser.name}
                        </p>
                        <p className="text-[9px] text-gray-300 truncate font-mono">
                          {partnerUser.isOnline ? (
                            <span className="text-cyan-300 font-bold">Dans ton orbite (En ligne)</span>
                          ) : (
                            <span>
                              Dernière trace :{" "}
                              {partnerUser.lastSeen
                                ? new Date(partnerUser.lastSeen).toLocaleTimeString("fr-FR", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "Inconnue"}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 animate-pulse py-1">
                      <div className="w-5 h-5 rounded-full bg-gray-700" />
                      <div className="h-2 w-20 bg-gray-700 rounded" />
                    </div>
                  )}
                </div>
              </div>

              {/* Header Actions */}
              <div className="flex items-center gap-1.5 md:gap-3">
                {/* Sound control */}
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  title={soundEnabled ? "Muter les carillons" : "Activer les carillons"}
                  className="p-2 rounded-lg hover:bg-violet-950/40 text-gray-400 hover:text-white transition-all cursor-pointer"
                >
                  {soundEnabled ? <Volume2 size={17} className="text-cyan-400" /> : <VolumeX size={17} />}
                </button>

                {/* PWA Install Trigger */}
                {pwaPrompt && (
                  <button
                    onClick={triggerPwaInstall}
                    className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-400 hover:to-violet-400 text-white rounded-lg text-xs font-semibold glow-btn-cyan cursor-pointer transition-all"
                  >
                    <Smartphone size={14} />
                    Installer l&apos;App
                  </button>
                )}

                {/* Logout */}
                <button
                  onClick={handleLogout}
                  title="Retourner au vortex"
                  className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 rounded-lg border border-rose-500/20 transition-all flex items-center gap-1 cursor-pointer text-xs"
                >
                  <Power size={14} />
                  <span className="hidden sm:inline">Quitter</span>
                </button>
              </div>
            </header>

            {/* Chat Messages Area */}
            <div
              ref={chatScrollContainerRef}
              className="flex-1 overflow-y-auto px-4 py-6 space-y-4 relative bg-[#06060c]/40"
            >
              <div className="absolute inset-0 bg-cover bg-center pointer-events-none opacity-[0.03]" />

              {/* Cosmic intro message helper */}
              <div className="mx-auto max-w-sm text-center py-6 bg-violet-950/15 rounded-2xl border border-violet-500/10 backdrop-blur-sm shadow-xl p-4 mb-4 select-none">
                <Sparkles size={20} className="mx-auto text-pink-400 mb-2 animate-spin-slow" />
                <h3 className="text-xs font-bold text-gray-200 uppercase tracking-widest font-serif">
                  Orbite Temporelle Exclusive
                </h3>
                <p className="text-[10px] text-gray-400 mt-1 leading-relaxed font-sans">
                  Cet espace secret n&apos;existe que pour Wesley et Mégane. Vos messages de comètes sont instantanés, chiffrés sous l&apos;égide du crépuscule.
                </p>
                {/* Small install link for mobile */}
                {pwaPrompt && (
                  <button
                    onClick={triggerPwaInstall}
                    className="mt-3 mx-auto flex items-center gap-1 text-[10px] text-cyan-300 hover:underline cursor-pointer"
                  >
                    <Smartphone size={10} />
                    Installer sur mon écran d&apos;accueil
                  </button>
                )}
              </div>

              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-500 text-xs italic py-20">
                  <div className="w-12 h-12 rounded-full border border-dashed border-violet-500/30 flex items-center justify-center mb-3">
                    🌌
                  </div>
                  Le silence de l&apos;univers... Envoyez le premier mot doux !
                </div>
              ) : (
                messages.map((msg, index) => {
                  const isOwn = msg.senderId === currentUser.id;
                  const showFilePreview = msg.mediaData && msg.mediaType;

                  return (
                    <motion.div
                      key={msg.id || index}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${isOwn ? "justify-end" : "justify-start"} w-full`}
                    >
                      <div
                        className={`flex gap-2 max-w-[85%] md:max-w-[65%] ${
                          isOwn ? "flex-row-reverse" : "flex-row"
                        }`}
                      >
                        {/* Avatar */}
                        <div className="hidden sm:block flex-shrink-0">
                          <img
                            src={
                              isOwn
                                ? currentUser.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80"
                                : partnerUser?.avatar || "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=80"
                            }
                            alt=""
                            className="w-8 h-8 rounded-full object-cover border border-violet-500/30"
                          />
                        </div>

                        {/* Bubble */}
                        <div className="flex flex-col">
                          {/* Sender name for styled romance aesthetic */}
                          <span
                            className={`text-[10px] mb-0.5 px-2 text-glow-cyan font-serif tracking-wider font-bold ${
                              isOwn ? "text-right text-purple-300" : "text-left text-pink-300"
                            }`}
                          >
                            {isOwn ? "Moi" : partnerUser?.name || "Inconnu"}
                          </span>

                          <div
                            className={`rounded-2xl px-4 py-3 shadow-lg relative ${
                              isOwn
                                ? "bg-gradient-to-b from-indigo-950/65 to-violet-900/65 border border-cyan-500/20 rounded-tr-none text-white glassmorphism"
                                : "bg-gradient-to-b from-[#180a22]/70 to-[#220d31]/70 border border-pink-500/20 rounded-tl-none text-white glassmorphism"
                            }`}
                          >
                            {/* File / Media Preview */}
                            {showFilePreview && (
                              <div className="mb-2.5 overflow-hidden rounded-xl border border-white/5 bg-black/30 p-1">
                                {msg.mediaType === "image" && (
                                  <div className="relative group cursor-zoom-in">
                                    <img
                                      src={msg.mediaData!}
                                      alt={msg.fileName || "Image"}
                                      className="max-h-60 w-full object-contain rounded-lg transition-transform duration-300 group-hover:scale-[1.02]"
                                      onClick={() => setZoomedImage(msg.mediaData)}
                                    />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs text-white">
                                      Clique pour zoomer 🔍
                                    </div>
                                  </div>
                                )}

                                {msg.mediaType === "video" && (
                                  <video
                                    src={msg.mediaData!}
                                    controls
                                    className="max-h-60 w-full rounded-lg"
                                  />
                                )}

                                {msg.mediaType === "pdf" && (
                                  <div className="p-3 flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-rose-500/20 flex items-center justify-center text-rose-300">
                                      <FileText size={22} />
                                    </div>
                                    <div className="text-left flex-1 min-w-0">
                                      <p className="text-xs font-semibold text-gray-200 truncate">
                                        {msg.fileName || "document.pdf"}
                                      </p>
                                      <p className="text-[10px] text-gray-400">
                                        Fichier PDF • {getFileSizeEstimate(msg.mediaData)}
                                      </p>
                                    </div>
                                    <a
                                      href={msg.mediaData!}
                                      download={msg.fileName || "document.pdf"}
                                      className="px-3 py-1 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-medium cursor-pointer transition-colors"
                                    >
                                      Ouvrir
                                    </a>
                                  </div>
                                )}

                                {msg.mediaType === "audio" && (
                                  <div className="p-2.5 rounded-lg bg-black/40 border border-violet-500/15">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Volume2 size={13} className="text-pink-400 animate-pulse" />
                                      <span className="text-[10px] text-pink-300 font-mono tracking-widest uppercase">
                                        Message Vocal secret
                                      </span>
                                    </div>
                                    <audio
                                      src={msg.mediaData!}
                                      controls
                                      className="w-full h-8 custom-audio"
                                      preload="none"
                                    />
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Message Text Content */}
                            {msg.content && (
                              <p className="text-[13px] md:text-sm leading-relaxed whitespace-pre-wrap select-text break-words">
                                {msg.content}
                              </p>
                            )}

                            {/* Timestamp & Sync Status */}
                            <div className="flex items-center justify-end gap-1.5 mt-2">
                              <span className="text-[9px] text-gray-400/80 font-mono italic">
                                {formatAnimeTimestamp(msg.createdAt)}
                              </span>
                              {isOwn && (
                                <span className={msg.isRead ? "text-cyan-400" : "text-gray-500"} title={msg.isRead ? "Lu par l'autre" : "Délivré"}>
                                  <CheckCheck size={12} />
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Bottom attachment preview */}
            {attachedFile && (
              <div className="px-4 py-2 bg-[#120e24]/90 border-t border-violet-500/20 backdrop-blur-md z-20 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center text-violet-300">
                    {attachedFile.type === "image" && <ImageIcon size={20} className="text-cyan-400" />}
                    {attachedFile.type === "video" && <VideoIcon size={20} className="text-pink-400" />}
                    {attachedFile.type === "pdf" && <FileText size={20} className="text-red-400" />}
                    {attachedFile.type === "audio" && <Volume2 size={20} className="text-emerald-400 animate-pulse" />}
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-semibold text-gray-200 truncate max-w-xs md:max-w-md">
                      {attachedFile.name}
                    </p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-mono">
                      {attachedFile.type} pret à l&apos;envoi • {getFileSizeEstimate(attachedFile.data)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setAttachedFile(null)}
                  className="p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white cursor-pointer transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            )}

            {/* Live audio recording indicators */}
            {isRecording && (
              <div className="px-4 py-3 bg-red-950/40 border-t border-red-500/20 backdrop-blur-md z-20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
                  <span className="text-xs font-bold text-red-300 uppercase tracking-wider font-mono">
                    Enregistrement vocal en cours : {Math.floor(recordingDuration / 60)}:
                    {(recordingDuration % 60).toString().padStart(2, "0")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={cancelRecording}
                    className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={stopRecording}
                    className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-semibold cursor-pointer glow-btn-violet transition-colors"
                  >
                    Arrêter et attacher
                  </button>
                </div>
              </div>
            )}

            {/* Footer Input Area */}
            <footer className="glassmorphism p-3 md:p-4 z-20 relative border-t border-violet-950/40">
              <form onSubmit={handleSendMessage} className="flex items-center gap-2 max-w-7xl mx-auto">
                {/* Media Attachment trigger */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*,video/*,application/pdf,audio/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Ajouter un média (Photo, Vidéo, PDF)"
                  className="p-2.5 rounded-xl bg-violet-950/60 hover:bg-violet-900/60 border border-violet-500/20 text-cyan-300 hover:text-cyan-200 cursor-pointer active:scale-95 transition-all flex-shrink-0"
                >
                  <Paperclip size={18} />
                </button>

                {/* Voice Record Trigger */}
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  title="Enregistrer un message vocal"
                  className={`p-2.5 rounded-xl border transition-all active:scale-95 flex-shrink-0 cursor-pointer ${
                    isRecording
                      ? "bg-red-600 border-red-400 text-white animate-pulse"
                      : "bg-violet-950/60 hover:bg-violet-900/60 border-violet-500/20 text-pink-300 hover:text-pink-200"
                  }`}
                >
                  <Mic size={18} />
                </button>

                {/* Main Text Area Input */}
                <input
                  type="text"
                  value={newMessageText}
                  onChange={(e) => setNewMessageText(e.target.value)}
                  placeholder="Écris ton mot secret..."
                  disabled={isSending}
                  className="flex-1 py-3 px-4 rounded-xl glassmorphism-input text-sm text-white placeholder-gray-500 transition-all focus:border-cyan-400"
                />

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isSending || (!newMessageText.trim() && !attachedFile)}
                  className={`p-3 rounded-xl font-bold transition-all text-white active:scale-95 flex-shrink-0 cursor-pointer ${
                    !newMessageText.trim() && !attachedFile
                      ? "bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700/20"
                      : "bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 glow-btn-violet border border-violet-400/30"
                  }`}
                >
                  {isSending ? (
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <Send size={18} />
                  )}
                </button>
              </form>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lightbox / Zoomed image Modal */}
      <AnimatePresence>
        {zoomedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out"
            onClick={() => setZoomedImage(null)}
          >
            <button
              onClick={() => setZoomedImage(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all"
            >
              <X size={24} />
            </button>
            <motion.img
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              src={zoomedImage}
              alt="Zoomed attachment"
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl border border-white/10"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
