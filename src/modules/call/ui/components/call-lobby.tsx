import { LogInIcon } from "lucide-react";
import Link  from "next/link";
import {
  DefaultVideoPlaceholder,
  StreamVideoParticipant,
  ToggleAudioPreviewButton,
  ToggleVideoPreviewButton,
  useCallStateHooks,
  VideoPreview,
} from "@stream-io/video-react-sdk";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { generateAvatarUri } from "@/lib/avatar";

import "@stream-io/video-react-sdk/dist/css/embedded.css";

interface Props {
  onJoin: () => void;
}

const DisabledVideoPreview = () => {
  const { data } = authClient.useSession();
  return (
    <DefaultVideoPlaceholder
      participant={
        {
          name: data?.user.name ?? "",
          image:
            data?.user.image ??
            generateAvatarUri({
              seed: data?.user.name ?? "",
              variant: "initials",
            }),
        } as StreamVideoParticipant
      }
    />
  );
};

const AllowBrowserPermission = () => {
    return (
        <p className="text-sm">
            Please allow access to your camera and microphone to join the call.
        </p>
    )
}
export const CallLobby = ({ onJoin }: Props) => {
  const { useCameraState, useMicrophoneState } = useCallStateHooks();
  const { hasBrowserPermission: hasMicPermission } = useMicrophoneState();
  const { hasBrowserPermission: hasCameraPermission } = useCameraState();

  const hasBrowserMediaPermission = hasMicPermission && hasCameraPermission;

  return (
    <div className="flex flex-col items-center justify-center h-full bg-radial from-sidebar-accent to-accent">
      <div className="flex flex-col items-center gap-y-4 py-4 px-4">
        <div className="flex flex-col gap-y-2 text-center">
          <h6 className="text-lg font-medium">Ready to Join?</h6>
          <p className="text-sm">Set up your call before joining</p>
        </div>
        <VideoPreview
          DisabledVideoPreview={
            hasBrowserMediaPermission
              ? DisabledVideoPreview
              : AllowBrowserPermission
          }
        />
        <div className="flex gap-x-2">
          <ToggleAudioPreviewButton />
          <ToggleVideoPreviewButton />
        </div>
        <div className="flex gap-x-2 justify-between w-full">
          <Button asChild variant={"ghost"}>
            <Link href="/meetings">Cancel</Link>
          </Button>
          <Button onClick={onJoin}>
            <LogInIcon />
            Join Call
          </Button>
        </div>
      </div>
    </div>
  );
};
