import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import "./QRScanner.css";

export default function QRScanner({
  open,
  onClose,
  onResult,
  title = "Scan QR",
  detectedHoldMs = 900,
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);

  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [detected, setDetected] = useState(false);
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    let alreadyDetected = false;

    async function start() {
      setErr("");
      setBusy(true);
      setDetected(false);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();

        tick();
      } catch (e) {
        setErr(e?.message || "Camera permission denied.");
      } finally {
        setBusy(false);
      }
    }

    function stop() {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;

      const stream = streamRef.current;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    }

    function tick() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      const w = video.videoWidth;
      const h = video.videoHeight;

      if (w && h) {
        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(video, 0, 0, w, h);

        const imageData = ctx.getImageData(0, 0, w, h);
        const code = jsQR(imageData.data, w, h);

        if (code?.data && !alreadyDetected) {
          alreadyDetected = true;

          const value = String(code.data).trim();
          setDetected(true);
          onResult(value);
          setTimeout(() => {
            stop();
            onClose();
          }, detectedHoldMs);

          return;
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    start();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      const stream = streamRef.current;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open, onClose, onResult, detectedHoldMs]);

  if (!open) return null;

  return (
    <div className="qrModal">
      <div className="qrSheet">
        <div className="qrHeader">
          <div className="qrTitle">{title}</div>
          <button className="btn" onClick={onClose} disabled={detected}>
            Close
          </button>
        </div>

        <div className="qrBody">
          {err ? (
            <div className="qrError">
              <div className="strong">Camera error</div>
              <div className="sub">{err}</div>
            </div>
          ) : (
            <>
              <div className="qrPreview">
                <video ref={videoRef} className="qrVideo" playsInline />
                <div className="qrFrame" />

                {detected && (
                  <div className="qrDetected">
                    <div className="qrDetectedTitle">Detected ✅</div>
                  </div>
                )}
              </div>

              <canvas ref={canvasRef} className="qrCanvas" />

              <div className="qrHint">
                Point the camera at the store QR code.{busy ? " Starting camera…" : ""}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
