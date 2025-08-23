// src/components/PosterThumb.tsx
'use client'
import Image from 'next/image'

type Props = { url: string; title: string; width: number; height: number }

export default function PosterThumb({ url, title, width, height }: Props) {
  const isLocal = url.startsWith('blob:') || url.startsWith('data:')

  if (isLocal) {
    // Les blobs/data restent en <img>
    return (
      <img
        src={url}
        alt={title}
        width={width}
        height={height}
        style={{ objectFit: 'cover', borderRadius: 6, display: 'block' }}
        loading="lazy"
        decoding="async"
      />
    )
  }

  // URL http(s) → Next/Image (optimisé par Vercel)
  return (
    <Image
      src={url}
      alt={title}
      width={width}
      height={height}
      style={{ objectFit: 'cover', borderRadius: 6, display: 'block' }}
      sizes={`${width}px`}
      priority={false}
    />
  )
}
