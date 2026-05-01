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
            await call.join({ create: true });
            setShow("call");
        } finally {
            setJoining(false);
        }
    }

    const handleLeave = ()=>{
        if(!call) return;
        call.endCall();
        setShow("ended");
    }
    return(
       <StreamTheme className="h-full">
        {show === "lobby" &&  <CallLobby onJoin={handleJoin} />}
        {show === "call" &&  <CallActive onLeave={handleLeave} meetingId={meetingId} meetingName={meetingName}/>}
        {show === "ended" &&  <CallEnded/>}
       </StreamTheme>
    )
}

