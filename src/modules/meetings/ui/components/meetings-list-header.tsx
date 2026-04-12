"use client";
import { DEFAULT_PAGE } from "@/constants";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { PlusIcon ,XCircleIcon} from "lucide-react";
import { NewMeetingDialog } from "./new-meeting-dialog";
import { useState } from "react";
import { MeetingsSearchFilter } from "./meetings-serach-filter";
import { StatusFilter } from "./status-filter";
import { AgentIdFilter } from "./agent-id-filter";
import { useMeetingsFilters } from "../../hooks/use-meetings-filters";

export const MeetingsListHeader = () => {
  const [filters, setFilters] = useMeetingsFilters();
  const [isDialogOpen, setIsDialogOpen] = useState(false);  

  const isAnyFilterModified = !!filters.search || !!filters.status || !!filters.agentId;

  const onClearFilters = () => {    setFilters({
      status:null,
      search: "",
      agentId: "",
      page: DEFAULT_PAGE,
    });
  }
 
  return (
    <>
    <NewMeetingDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}/>
      <div className="py-4 px-4 md:px-8 flex flex-col gap-y-4">
        <div className="flex items-center justify-between  ">
          <h5 className="font-medium text-xl">My Meetings</h5>
          <Button onClick={() => setIsDialogOpen(true)}>
            <PlusIcon />   
            New Meeting
          </Button>
        </div>
        <ScrollArea>
        <div className="flex items-center gap-x-2 p-1">
         <MeetingsSearchFilter />
         <StatusFilter />
         <AgentIdFilter />
         {
          isAnyFilterModified && (
            <Button variant="outline" size="icon" onClick={onClearFilters}>
              <XCircleIcon /> 
              Clear
            </Button>
          )
         }
        </div>
        <ScrollBar orientation="horizontal"/></ScrollArea>
      </div>
    </>
  );
};
