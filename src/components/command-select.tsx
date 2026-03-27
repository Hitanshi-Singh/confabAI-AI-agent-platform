import { ReactNode, useState } from "react";
import { ChevronsUpDownIcon} from "lucide-react";

import {cn} from "@/lib/utils";

import {Button} from "@/components/ui/button";

import { CommandList, CommandEmpty, CommandInput, CommandItem , CommandResponsiveDialog} from "@/components/ui/command";

interface Props {
    options:Array<{
        id:string;
        value:string;
        children:ReactNode;
    }>;
    onSelect:(value:string)=>void;
    onSearch:(value:string)=>void;
    value:string;
    placeholder?:string;
    isSearchable?:boolean;
    className?:string;
}

export const CommandSelect = ({
    options,
    onSelect,
    onSearch,
    value,
    placeholder="Select an option",
   className,
}:Props)=>{
    const [open, setOpen] = useState(false);
    const selectedOption = options.find(option=>option.value === value);

    return( 
        <>
        <Button 
        variant="outline" 
        type="button"
        className={cn("h-9 font-normal px-2 justify-between", !selectedOption && "text-muted-foreground", className)} 
        onClick={()=>setOpen(true)}>
            <div>
            {selectedOption ? selectedOption.children : placeholder}
            </div>
            <ChevronsUpDownIcon  />
        </Button>
        <CommandResponsiveDialog
         shouldFilter={!onSearch}
        open={open} 
        onOpenChange={setOpen}>
            <CommandInput placeholder="Search..." onValueChange={onSearch}/>
            <CommandList>
                <CommandEmpty><span className="text-muted-foreground text-sm">No options found</span></CommandEmpty>

                {options.map(option=>(
                    <CommandItem key={option.id} onSelect={()=>{
                        onSelect(option.value);
                        setOpen(false);
                    }}>
                        {option.children}
                    </CommandItem>
                ))}
            </CommandList>
        </CommandResponsiveDialog>

        </>
    )}