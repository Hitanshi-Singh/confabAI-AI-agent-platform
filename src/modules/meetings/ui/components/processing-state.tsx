import { EmptyState } from "@/components/empty-state";


export const ProcessingState = () => {
  return (
    <div className="bg-white rounded-lg px-4 py-5 flex flex-col gap-y-8 items-center justify-center">
      <EmptyState
        title="Meeting is processing"
        description="The meeting was completed, the summary will appear here shortly."

        image="/processing.svg"
      />
     
    </div>
  );
};
