"use client";

import Link from "next/link";
import Image from "next/image";
import { LogOutIcon, MicIcon, MicOffIcon, SendIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
    SpeakerLayout,
    ToggleVideoPublishingButton
} from "@stream-io/video-react-sdk";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
    onLeave:()=>void;
    meetingId:string;
    meetingName:string;
}

interface ChatMessage {
    role: "user" | "assistant";
    content: string;
}

interface SpeechRecognitionLike {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: ((e: { results: { length: number; [i: number]: { isFinal: boolean; 0: { transcript: string } } } }) => void) | null;
    onerror: ((e: { error?: string }) => void) | null;
    onend: (() => void) | null;
    start: () => void;
    stop: () => void;
}

const stripMarkdown = (s: string): string =>
    s
        .replace(/```[\s\S]*?```/g, "")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/\*([^*]+)\*/g, "$1")
        .replace(/_([^_]+)_/g, "$1")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/^#+\s*/gm, "")
        .replace(/^[-*+]\s+/gm, "")
        .replace(/\n+/g, ". ")
        .replace(/\s+/g, " ")
        .trim();

export const CallActive = ({onLeave, meetingId, meetingName}: Props) => {
    const [chat, setChat] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
    const [recording, setRecording] = useState(false);
    const [voiceError, setVoiceError] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const recRef = useRef<SpeechRecognitionLike | null>(null);

    const sendToAgent = async (userText: string) => {
        if (!userText || sending) return;
        setSending(true);
        setChat((c) => [...c, { role: "user", content: userText }]);

        try {
            const res = await fetch("/api/agent-chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ meetingId, userText }),
            });
            if (!res.ok) {
                const body = await res.text();
                console.error("[chat] /api/agent-chat", res.status, body);
                setChat((c) => [...c, { role: "assistant", content: `Error ${res.status}: ${body}` }]);
                return;
            }
            const { text } = (await res.json()) as { text: string };
            setChat((c) => [...c, { role: "assistant", content: text }]);
            try {
                const utter = new SpeechSynthesisUtterance(stripMarkdown(text));
                window.speechSynthesis.speak(utter);
            } catch {}
        } catch (err) {
            console.error("[chat] fetch failed", err);
            setChat((c) => [...c, { role: "assistant", content: "Network error — see console" }]);
        } finally {
            setSending(false);
            requestAnimationFrame(() => {
                scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
            });
        }
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        const userText = input.trim();
        if (!userText) return;
        setInput("");
        await sendToAgent(userText);
    };

    const startRecording = () => {
        const SR =
            (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ||
            (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
        if (!SR) {
            setVoiceError("Voice not supported in this browser. Use Chrome or Edge.");
            return;
        }

        setVoiceError(null);
        const rec = new SR();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = "en-IN";

        rec.onresult = (e) => {
            const last = e.results[e.results.length - 1];
            if (!last?.isFinal) return;
            const transcript = last[0].transcript.trim();
            console.log("[voice] heard:", transcript);
            setRecording(false);
            if (transcript) sendToAgent(transcript);
        };
        rec.onerror = (e) => {
            console.warn("[voice] error", e);
            setVoiceError(e?.error || "Voice error");
            setRecording(false);
        };
        rec.onend = () => {
            setRecording(false);
        };

        try {
            rec.start();
            recRef.current = rec;
            setRecording(true);
        } catch (err) {
            console.warn("[voice] start failed", err);
            setVoiceError("Couldn't start mic");
        }
    };

    const stopRecording = () => {
        try {
            recRef.current?.stop();
        } catch {}
        setRecording(false);
    };

    useEffect(() => {
        return () => {
            try {
                recRef.current?.stop();
            } catch {}
            window.speechSynthesis.cancel();
        };
    }, []);

    return (
        <div className="flex flex-col h-full p-4 text-white gap-4">
            <div className="bg-[#101213] rounded-full p-4 flex items-center gap-4">
                <Link href={"/"} className="flex items-center justify-center p-1 bg-white/10 rounded-full w-fit">
                    <Image src="/logo.svg" alt="Logo" width={22} height={22} />
                </Link>
                <h4 className="text-base">{meetingName}</h4>
                <span className="ml-auto text-xs text-white/70">AI agent ready — type or hold the mic</span>
            </div>

            <div className="flex-1 flex gap-4 min-h-0">
                <div className="flex-1 min-w-0">
                    <SpeakerLayout/>
                </div>
                <aside className="w-96 bg-[#101213] rounded-lg p-4 flex flex-col gap-3 min-h-0">
                    <h5 className="text-sm font-medium border-b border-white/10 pb-2">Chat with AI</h5>
                    <div ref={scrollRef} className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1">
                        {chat.length === 0 ? (
                            <p className="text-xs text-white/50">Type a message below or click the mic to talk.</p>
                        ) : (
                            chat.map((m, i) => (
                                <div key={i} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                                    <span className="text-[10px] uppercase tracking-wide text-white/40">{m.role === "user" ? "You" : "Agent"}</span>
                                    <div className={`px-3 py-2 rounded-lg text-sm max-w-[85%] whitespace-pre-wrap ${m.role === "user" ? "bg-blue-600" : "bg-white/10"}`}>
                                        {m.content}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    {recording && (
                        <p className="text-xs text-red-400 animate-pulse">🔴 Listening… click mic again to stop.</p>
                    )}
                    {voiceError && !recording && (
                        <p className="text-xs text-amber-400">{voiceError}</p>
                    )}
                    <form onSubmit={handleSend} className="flex gap-2">
                        <Button
                            type="button"
                            variant={recording ? "destructive" : "secondary"}
                            onClick={recording ? stopRecording : startRecording}
                            disabled={sending}
                            title={recording ? "Stop recording" : "Click and speak"}
                        >
                            {recording ? <MicOffIcon className="size-4" /> : <MicIcon className="size-4" />}
                        </Button>
                        <Input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask the agent…"
                            disabled={sending || recording}
                            className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                        />
                        <Button type="submit" disabled={sending || recording || !input.trim()}>
                            <SendIcon className="size-4" />
                        </Button>
                    </form>
                </aside>
            </div>

            <div className="bg-[#101213] rounded-full px-4 py-2 flex items-center justify-center gap-2">
                <ToggleVideoPublishingButton />
                <Button variant="destructive" onClick={onLeave}>
                    <LogOutIcon /> Leave
                </Button>
            </div>
        </div>
    );
};
