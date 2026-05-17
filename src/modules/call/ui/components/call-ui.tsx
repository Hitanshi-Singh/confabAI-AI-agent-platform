import { useState } from "react";
import { CallingState, StreamTheme,useCall } from "@stream-io/video-react-sdk";
import { CallLobby } from "./call-lobby";
import { CallActive } from "./call-active";
import { CallEnded } from "./call-ended";

interface Props{
    meetingId:string;
    meetingName:string;
}

export const CallUI = ({meetingId, meetingName}:Props) => {

    const call = useCall();
    const [show,setShow] = useState<"lobby" | "call" | "ended">("lobby");
    const [joining, setJoining] = useState(false);

    const handleJoin = async ()=>{
        if(!call) return;
        if(joining) return;
        if(call.state.callingState === CallingState.JOINED || call.state.callingState === CallingState.JOINING){
            setShow("call");
            return;
        }

        setJoining(true);
        try {
            // The Stream call is already created server-side in
            // meetings.create — join() without create:true.
            await call.join();
            setShow("call");
        } finally {
            setJoining(false);
        }
    }

    const handleLeave = async () => {
        if (!call) return;
        try {
            await call.endCall();
        } catch (err) {
            console.error("[call-ui] endCall failed:", err);
        }
        setShow("ended");
    };
    return(
       <StreamTheme className="h-full">
        {show === "lobby" &&  <CallLobby onJoin={handleJoin} />}
        {show === "call" &&  <CallActive onLeave={handleLeave} meetingId={meetingId} meetingName={meetingName}/>}
        {show === "ended" &&  <CallEnded/>}
       </StreamTheme>
    )
}

