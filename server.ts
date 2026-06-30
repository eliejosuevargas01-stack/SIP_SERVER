import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";

interface RecordingMetadata {
  id: string;
  filename: string;
  number: string;
  duration: string;
  timestamp: string;
  fileSize: string;
  notes?: string;
}

const PORT = 3000;
const RECORDINGS_DIR = path.join(process.cwd(), "recordings");
const METADATA_FILE = path.join(RECORDINGS_DIR, "metadata.json");

// Ensure recordings directory exists
if (!fs.existsSync(RECORDINGS_DIR)) {
  fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
}

// Ensure metadata file exists
if (!fs.existsSync(METADATA_FILE)) {
  fs.writeFileSync(METADATA_FILE, JSON.stringify([], null, 2));
}

// Read recordings list
function readMetadata(): RecordingMetadata[] {
  try {
    if (fs.existsSync(METADATA_FILE)) {
      const data = fs.readFileSync(METADATA_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error reading metadata file:", error);
  }
  return [];
}

// Write recordings list
function writeMetadata(data: RecordingMetadata[]) {
  try {
    fs.writeFileSync(METADATA_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error writing metadata file:", error);
  }
}

async function startServer() {
  const app = express();

  // Parse JSON payloads with increased limit for Base64 audio blobs
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // --- API Endpoints ---

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Get all recordings
  app.get("/api/recordings", (req, res) => {
    const list = readMetadata();
    res.json(list);
  });

  // Save a new recording
  app.post("/api/recordings", (req, res) => {
    try {
      const { audioData, number, duration, notes } = req.body;

      if (!audioData) {
        return res.status(400).json({ error: "No audioData provided" });
      }

      // Generate recording info
      const id = `rec_${Date.now()}`;
      const filename = `${id}.webm`;
      const filePath = path.join(RECORDINGS_DIR, filename);

      // Convert Base64 data to binary buffer
      const base64Data = audioData.replace(/^data:audio\/\w+;base64,/, "");
      const audioBuffer = Buffer.from(base64Data, "base64");

      // Save file
      fs.writeFileSync(filePath, audioBuffer);

      // Calculate file size in MB or KB
      const sizeBytes = audioBuffer.length;
      const sizeStr =
        sizeBytes > 1024 * 1024
          ? `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`
          : `${(sizeBytes / 1024).toFixed(1)} KB`;

      // Create metadata entry
      const newRecording: RecordingMetadata = {
        id,
        filename,
        number: number || "Desconhecido",
        duration: duration || "00:00",
        timestamp: new Date().toLocaleString("pt-BR"),
        fileSize: sizeStr,
        notes: notes || "",
      };

      const list = readMetadata();
      list.unshift(newRecording); // add to top
      writeMetadata(list);

      console.log(`Saved recording: ${filename} (${sizeStr}) for number ${newRecording.number}`);
      res.status(201).json(newRecording);
    } catch (error: any) {
      console.error("Error saving recording:", error);
      res.status(500).json({ error: "Failed to save recording: " + error.message });
    }
  });

  // Stream a specific recording audio file
  app.get("/api/recordings/audio/:id", (req, res) => {
    const id = req.params.id;
    const list = readMetadata();
    const item = list.find((r) => r.id === id);

    if (!item) {
      return res.status(404).json({ error: "Recording not found" });
    }

    const filePath = path.join(RECORDINGS_DIR, item.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Audio file not found on disk" });
    }

    res.setHeader("Content-Type", "audio/webm");
    res.sendFile(filePath);
  });

  // --- WebRTC signaling HTTP Polling Endpoint ---
  interface SignalMessage {
    type: "offer" | "answer" | "candidate";
    sender: string;
    payload: any;
  }
  const rooms: Record<string, { signals: SignalMessage[]; lastSeen: Record<string, number> }> = {};

  // Join a signaling room
  app.post("/api/webrtc/join", (req, res) => {
    const { roomId, peerId } = req.body;
    if (!roomId || !peerId) {
      return res.status(400).json({ error: "roomId and peerId are required" });
    }
    if (!rooms[roomId]) {
      rooms[roomId] = { signals: [], lastSeen: {} };
    }
    rooms[roomId].lastSeen[peerId] = Date.now();
    // Clean old signals of this peer
    rooms[roomId].signals = rooms[roomId].signals.filter(s => s.sender !== peerId);
    console.log(`[WebRTC] Peer ${peerId} joined Room ${roomId}`);
    res.json({ success: true });
  });

  // Send a signal (offer, answer, or candidate)
  app.post("/api/webrtc/signal", (req, res) => {
    const { roomId, peerId, type, payload } = req.body;
    if (!roomId || !peerId || !type || !payload) {
      return res.status(400).json({ error: "Missing required signal parameters" });
    }
    if (!rooms[roomId]) {
      rooms[roomId] = { signals: [], lastSeen: {} };
    }
    rooms[roomId].signals.push({ type, sender: peerId, payload });
    rooms[roomId].lastSeen[peerId] = Date.now();
    res.json({ success: true });
  });

  // Poll signals for a peer
  app.get("/api/webrtc/poll/:roomId/:peerId", (req, res) => {
    const { roomId, peerId } = req.params;
    if (!rooms[roomId]) {
      return res.json({ signals: [] });
    }
    rooms[roomId].lastSeen[peerId] = Date.now();
    // Get signals sent by OTHER peers
    const pending = rooms[roomId].signals.filter(s => s.sender !== peerId);
    // Clear the polled signals so we don't fetch them again
    rooms[roomId].signals = rooms[roomId].signals.filter(s => s.sender === peerId);
    res.json({ signals: pending });
  });

  // Delete a recording
  app.delete("/api/recordings/:id", (req, res) => {
    try {
      const id = req.params.id;
      const list = readMetadata();
      const index = list.findIndex((r) => r.id === id);

      if (index === -1) {
        return res.status(404).json({ error: "Recording not found" });
      }

      const item = list[index];
      const filePath = path.join(RECORDINGS_DIR, item.filename);

      // Delete file from disk
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Remove from metadata
      list.splice(index, 1);
      writeMetadata(list);

      console.log(`Deleted recording: ${item.filename}`);
      res.json({ message: "Recording deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting recording:", error);
      res.status(500).json({ error: "Failed to delete recording: " + error.message });
    }
  });

  // --- Vite Dev & Production Middleware ---

  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode with Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Comutador SIP Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
