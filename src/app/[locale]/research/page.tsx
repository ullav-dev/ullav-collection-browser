import ResearchPage from "@/components/ResearchPage";

interface Props {
  searchParams: Promise<{
    objectId?: string;
    noteId?: string;
    new?: string;
  }>;
}

export default async function Page({ searchParams }: Props) {
  const params = await searchParams;
  return (
    <ResearchPage
      objectId={params.objectId}
      noteId={params.noteId}
      isNew={params.new === "1"}
    />
  );
}
