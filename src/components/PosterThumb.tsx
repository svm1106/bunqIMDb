// PosterThumb.tsx (exemple)
type Props = { url: string; title: string; width: number; height: number }

export default function PosterThumb({ url, title, width, height }: Props) {
  const isLocal = url.startsWith('blob:') || url.startsWith('data:')

  if (isLocal) {
    // 👉 Pas de resize server-side : affichage direct
    return (
      <img
        src={url}
        alt={title}
        width={width}
        height={height}
        style={{ objectFit: 'cover', borderRadius: 6, display: 'block' }}
      />
    )
  }

  // 👉 Cas normal (URL http/https ou ton /api/thumb) : ta logique existante
  // Exemple si tu avais un endpoint /api/thumb?src=...&w=...&h=...
  const thumbUrl = `/api/thumb?src=${encodeURIComponent(url)}&w=${width}&h=${height}&format=webp&fit=cover`
  return (
    <img
      src={thumbUrl}
      alt={title}
      width={width}
      height={height}
      style={{ objectFit: 'cover', borderRadius: 6, display: 'block' }}
    />
  )
}
