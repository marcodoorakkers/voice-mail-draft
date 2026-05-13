"use client";

import { useState, useRef } from "react";

type Step = "idle" | "recording" | "processing" | "preview" | "sending" | "done" | "error";

export default function Home() {
  const [step, setStep] = useState<Step>("idle");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [transcript, setTranscript] = useState("");
  const [showTranscript, setShowTranscript] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder.current = new MediaRecorder(stream);
    audioChunks.current = [];

    mediaRecorder.current.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.current.push(e.data);
    };

    mediaRecorder.current.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const audioBlob = new Blob(audioChunks.current, { type: "audio/webm" });
      await processAudio(audioBlob);
    };

    mediaRecorder.current.start();
    setStep("recording");
  }

  function stopRecording() {
    mediaRecorder.current?.stop();
    setStep("processing");
  }

  async function processAudio(audioBlob: Blob) {
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");

      const transcribeRes = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });
      const { text, error: transcribeError } = await transcribeRes.json();
      if (transcribeError) throw new Error(transcribeError);
      setTranscript(text);

      const generateRes = await fetch("/api/generate-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: text }),
      });
      const { subject: s, body: b, error: generateError } = await generateRes.json();
      if (generateError) throw new Error(generateError);

      setSubject(s);
      setBody(b);
      setStep("preview");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Er is iets misgegaan");
      setStep("error");
    }
  }

  async function sendDraft() {
    setStep("sending");
    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: email, subject, body }),
      });
      const { error } = await res.json();
      if (error) throw new Error(error);
      setStep("done");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Versturen mislukt");
      setStep("error");
    }
  }

  function reset() {
    setStep("idle");
    setSubject("");
    setBody("");
    setErrorMsg("");
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Voice Mail Draft</h1>
        <p className="text-gray-500 mb-6 text-sm">
          Spreek in wat je wilt versturen — de app maakt er een concept mail van.
        </p>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Jouw e-mailadres
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jij@example.com"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {(step === "idle" || step === "recording") && (
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={step === "idle" ? startRecording : stopRecording}
              disabled={!email}
              className={`w-24 h-24 rounded-full text-white font-semibold text-sm shadow-md transition-all
                ${step === "recording"
                  ? "bg-red-500 hover:bg-red-600 animate-pulse"
                  : "bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
                }`}
            >
              {step === "recording" ? "Stop" : "Inspreken"}
            </button>
            {step === "recording" && (
              <p className="text-sm text-red-500">Opname bezig... klik op Stop als je klaar bent.</p>
            )}
          </div>
        )}

        {step === "processing" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Bezig met verwerken...</p>
          </div>
        )}

        {step === "preview" && (
          <div className="flex flex-col gap-4">
            <div>
              <button
                onClick={() => setShowTranscript(!showTranscript)}
                className="text-xs text-blue-500 hover:underline mb-2"
              >
                {showTranscript ? "Verberg transcriptie" : "Toon ruwe transcriptie"}
              </button>
              {showTranscript && (
                <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3 border border-gray-200 whitespace-pre-wrap">{transcript}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Onderwerp</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bericht</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={8}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={sendDraft}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 text-sm font-medium transition-colors"
              >
                Stuur concept naar mijn mailbox
              </button>
              <button
                onClick={reset}
                className="px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg py-2 text-sm font-medium transition-colors"
              >
                Opnieuw
              </button>
            </div>
          </div>
        )}

        {step === "sending" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Mail wordt verstuurd...</p>
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-3xl">
              ✓
            </div>
            <p className="text-gray-700 font-medium">Concept mail verstuurd naar {email}!</p>
            <p className="text-sm text-gray-500">Controleer je inbox en pas de mail aan voor je hem verstuurt.</p>
            <button
              onClick={reset}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-6 py-2 text-sm font-medium transition-colors"
            >
              Nieuw bericht inspreken
            </button>
          </div>
        )}

        {step === "error" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-3xl">!</div>
            <p className="text-red-600 font-medium">Er is iets misgegaan</p>
            <p className="text-sm text-gray-500">{errorMsg}</p>
            <button
              onClick={reset}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg px-6 py-2 text-sm font-medium transition-colors"
            >
              Probeer opnieuw
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
