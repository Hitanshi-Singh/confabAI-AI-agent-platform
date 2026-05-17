"use client"

import { LoaderIcon } from "lucide-react";
import {useEffect, useState} from "react";
import {useMutation} from "@tanstack/react-query";
import {
    Call,
    CallingState,
    StreamCall,
    StreamVideo,
    StreamVideoClient
} from "@stream-io/video-react-sdk";

import {useTRPC} from "@/trpc/client";
import { CallUI } from "./call-ui";


interface Props{
    meetingId: string;
    meetingName: string;
    userId: string;
    userName: string;
    userImage: string;
}

export const CallConnect = ({
    meetingId, meetingName, userId, userName, userImage
}: Props) => {

    const trpc = useTRPC();
    const {mutateAsync: generateToken} = useMutation(trpc.meetings.generateToken.mutationOptions());

const [client, setClient] = useState<StreamVideoClient>();
    useEffect(() => {
        // getOrCreateInstance returns a shared, registry-managed client and
        // dedupes under React StrictMode's double-mount. generateToken is
        // intentionally NOT a dependency: its mutateAsync reference is not
        // stable, and having it here rebuilt the client on incidental
        // re-renders. The tokenProvider closure still sees a current
        // generateToken.
        const _client = StreamVideoClient.getOrCreateInstance({
            apiKey: process.env.NEXT_PUBLIC_STREAM_VIDEO_API_KEY!,
            user: {
                id: userId,
                name: userName,
                image: userImage,
            },
            tokenProvider: generateToken,
        });

        setClient(_client);

        // The SDK registry owns this shared instance's lifecycle, so the
        // cleanup must NOT call disconnectUser() — that would disconnect a
        // client another mount may still hold. Only clear local state.
        return () => {
            setClient(undefined);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, userName, userImage]);

    const [call, setCall] = useState<Call>();

    useEffect(() => {
        if (!client) return;
        const _call = client.call("default",meetingId);
        _call.camera.disable();
        _call.microphone.disable();
        setCall(_call);
        return () => {
            // Only leave() a call that is actually joined — calling leave()
            // in IDLE/UNKNOWN/etc. throws. The previous `!== LEFT` guard let
            // those states through.
            if (_call.state.callingState === CallingState.JOINED) {
                _call.leave();
            }
            setCall(undefined);
        };
    }, [client, meetingId]);

    if(!client || !call){
        return (
            <div className="flex h-screen items-center justify-center bg-radial from-sidebar-accent to-sidebar">
                <LoaderIcon className="animate-spin size-6 text-white" />
            </div>
        )
    }

    return (
        
        <StreamVideo client={client}>
            <StreamCall call={call}>
                <CallUI meetingId={meetingId} meetingName={meetingName} />
            </StreamCall>
        </StreamVideo>
    )
}