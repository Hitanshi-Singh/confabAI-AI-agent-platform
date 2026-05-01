import Link  from "next/link";
import { Button } from "@/components/ui/button";
import "@stream-io/video-react-sdk/dist/css/embedded.css";



export const CallEnded = () => {

  return (
    <div className="flex flex-col items-center justify-center h-full bg-radial from-sidebar-accent to-accent">
      <div className="py-4 px-4 flex flex-1 items-center justify-center">
        <div className="flex flex-col gap-y-2 text-center">
          <h6 className="text-lg font-medium">You have ended the call</h6>
          <p className="text-sm">Summary will appear in a few minutes</p>
        </div>
       <Button asChild>
        <Link href={"/meetings"}>Back to Meetings</Link>
       </Button>
      
      </div>
    </div>
  );
};
