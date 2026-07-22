const IMAGE_EXT = new Set(["jpg", "jpeg", "png", "gif", "webp", "heic"]);

function isImageFile(fileName: string): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_EXT.has(ext);
}

export default function BoardAttachmentList({
  attachments,
}: {
  attachments: { id: string; file_name: string; url?: string }[];
}) {
  if (attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {attachments.map((a) =>
        isImageFile(a.file_name) && a.url ? (
          <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={a.url}
              alt={a.file_name}
              className="h-24 w-24 rounded-lg border border-border object-cover"
            />
          </a>
        ) : (
          <a
            key={a.id}
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground"
          >
            📎 {a.file_name}
          </a>
        )
      )}
    </div>
  );
}
