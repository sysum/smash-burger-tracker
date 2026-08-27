import { useEffect, useState } from "react";
import { repository } from "@/lib/repository";

/**
 * Render a stored photo blob.
 *
 * Blobs need an object URL to be displayed, and every created URL pins its blob
 * in memory until revoked — so the effect revokes on cleanup. The `cancelled`
 * flag covers the case where the component unmounts while the async read is
 * still in flight, which would otherwise leak a URL that nothing ever revokes.
 */
export function BurgerPhoto({ photoId, alt }: { photoId: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let created: string | null = null;

    repository.getPhoto(photoId).then((blob) => {
      if (cancelled || !blob) return;
      created = URL.createObjectURL(blob);
      setUrl(created);
    });

    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [photoId]);

  if (!url) return <div className="photo" aria-hidden="true" />;
  return <img className="photo" src={url} alt={alt} />;
}
