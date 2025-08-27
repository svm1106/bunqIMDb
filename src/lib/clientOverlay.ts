// src/lib/clientOverlay.ts
// Overlay titre + dégradé, exécuté dans le navigateur (Canvas)

export type Category =
  | 'ANIMATION' | 'CINEMA' | 'DOCUMENTARY & TV REPORT' | 'MUSIC & LIVE'
  | 'SERIE & TELENOVELAS' | 'SPORT' | 'TV MOVIE' | 'TV SHOW' | 'EDUTAINMENT' | 'OTHER'

function sanitizeTitle(raw: string) {
  let s = (raw || '').trim()
  s = s.replace(/\s*\(\s*(?:s(?:ea)?son|sais?on|temporada)\s*([ivxlcdm]+|\d+)\s*\)\s*$/i, '')
  s = s.replace(/\s*[-–—]\s*(?:s(?:ea)?son|sais?on|temporada)\s*([ivxlcdm]+|\d+)\s*$/i, '')
  return s.trim()
}

function normCat(c?: string): Category {
  const k = (c || '').toUpperCase().trim()
  const ALL: Category[] = [
    'ANIMATION','CINEMA','DOCUMENTARY & TV REPORT','MUSIC & LIVE',
    'SERIE & TELENOVELAS','SPORT','TV MOVIE','TV SHOW','EDUTAINMENT','OTHER'
  ]
  if (ALL.includes(k as Category)) return k as Category
  if (/anime|anim|kids|cartoon/i.test(k)) return 'ANIMATION'
  if (/film|cin[eé]ma|movie|feature/i.test(k)) return 'CINEMA'
  if (/docu|report/i.test(k)) return 'DOCUMENTARY & TV REPORT'
  if (/music|live|concert/i.test(k)) return 'MUSIC & LIVE'
  if (/s[eé]rie|series|telenovela/i.test(k)) return 'SERIE & TELENOVELAS'
  if (/sport/i.test(k)) return 'SPORT'
  if (/tv\s?movie/i.test(k)) return 'TV MOVIE'
  if (/show|tv show|entertainment/i.test(k)) return 'TV SHOW'
  if (/edu|edutain/i.test(k)) return 'EDUTAINMENT'
  return 'OTHER'
}

function styleByCategory(cat: Category) {
  switch (cat) {
    case 'ANIMATION':               return { family: "Baloo, 'Comic Sans MS', Arial, sans-serif", base: 140 }
    case 'CINEMA':                  return { family: "Oswald, 'Arial Black', Arial, sans-serif", base: 150 }
    case 'DOCUMENTARY & TV REPORT': return { family: "Inter, Arial, sans-serif", base: 132 }
    case 'MUSIC & LIVE':            return { family: "Bebas Neue, Oswald, Arial, sans-serif", base: 160 }
    case 'SERIE & TELENOVELAS':     return { family: "Inter, Arial, sans-serif", base: 140 }
    case 'SPORT':                   return { family: "Anton, 'Arial Black', Arial, sans-serif", base: 156 }
    case 'TV MOVIE':                return { family: "Montserrat, Arial, sans-serif", base: 138 }
    case 'TV SHOW':                 return { family: "Oswald, Arial, sans-serif", base: 148 }
    case 'EDUTAINMENT':             return { family: "Nunito Sans, Inter, Arial, sans-serif", base: 136 }
    default:                        return { family: "Inter, Arial, sans-serif", base: 140 }
  }
}

function measureWrapped(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, lineHeight: number) {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width <= maxWidth) {
      line = test
    } else {
      if (line) lines.push(line)
      // hard-break les mots trop longs
      if (ctx.measureText(w).width > maxWidth) {
        let cur = ''
        for (const ch of w) {
          const t = cur + ch
          if (ctx.measureText(t).width <= maxWidth) cur = t
          else { lines.push(cur); cur = ch }
          if (lines.length >= 3) break
        }
        line = cur
      } else {
        line = w
      }
    }
    if (lines.length >= 3) break
  }
  if (line && lines.length < 3) lines.push(line)
  const height = lines.length * lineHeight
  return { lines, height }
}

export async function applyTitleOverlayOnClient(opts: {
  baseImageBlob: Blob
  title: string
  category?: string
  genreHint?: string
  width?: number
  height?: number
  gradientRatio?: number  // 0..1 (hauteur du dégradé)
}): Promise<Blob> {
  const { baseImageBlob, title, category, genreHint, width = 1024, height = 1536, gradientRatio = 0.42 } = opts
  const cat = normCat(category || genreHint)
  const style = styleByCategory(cat)

  const imgUrl = URL.createObjectURL(baseImageBlob)
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image()
    i.onload = () => res(i)
    i.onerror = rej
    i.src = imgUrl
  })

  const W = width
  const H = height
  const gradientH = Math.round(H * gradientRatio)
  const padX = Math.round(W * 0.07)

  const cvs = document.createElement('canvas')
  cvs.width = W
  cvs.height = H
  const ctx = cvs.getContext('2d')!

  // Dessine l'image source (cover)
  // On assume que le PNG IA est déjà 1024x1536. Sinon, on ajuste pour cover:
  ctx.drawImage(img, 0, 0, W, H)

  // Dégradé noir → transparent (sans liseré) + flush bas
  const g = ctx.createLinearGradient(0, H, 0, H - gradientH)
  g.addColorStop(0.00, 'rgba(0,0,0,1)')
  g.addColorStop(0.65, 'rgba(0,0,0,0.45)')
  g.addColorStop(1.00, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, H - gradientH, W, gradientH)
  // Flush bas (2px)
  ctx.fillStyle = 'rgba(0,0,0,1)'
  ctx.fillRect(0, H - 2, W, 2)

  // Titre — auto-fit jusqu’à 3 lignes, jamais hors image
  const clean = sanitizeTitle(title)
  let fontSize = style.base
  const minFont = 48
  const lineHeightFactor = 1.14

  // essaie de fit ↓ jusqu’à 3 lignes
  let lines: string[] = []
  let lineHeight = 0
  while (fontSize >= minFont) {
    ctx.font = `800 ${fontSize}px ${style.family}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    const lh = Math.round(fontSize * lineHeightFactor)
    const wrap = measureWrapped(ctx, clean, W - padX * 2, lh)
    if (wrap.lines.length <= 3) {
      lines = wrap.lines
      lineHeight = lh
      break
    }
    fontSize -= 2
  }
  if (lines.length === 0) {
    fontSize = minFont
    ctx.font = `800 ${fontSize}px ${style.family}`
    const lh = Math.round(fontSize * lineHeightFactor)
    const wrap = measureWrapped(ctx, clean, W - padX * 2, lh)
    lines = wrap.lines.slice(0, 3)
    lineHeight = lh
  }

  const totalTextHeight = Math.max(lineHeight, lines.length * lineHeight)
  const bottomMargin = lines.length >= 2 ? Math.round(gradientH * 0.22) : Math.round(gradientH * 0.15)
  const textBottomY = H - bottomMargin
  const minTopInsideGradient = H - gradientH + Math.round(gradientH * 0.14)
  let y = Math.max(minTopInsideGradient, textBottomY - totalTextHeight)

  // Style texte
  ctx.font = `800 ${fontSize}px ${style.family}`
  ctx.textAlign = 'center'
  ctx.fillStyle = '#fff'
  ctx.lineJoin = 'round'
  ctx.miterLimit = 2
  const strokeW = Math.max(1, Math.round(fontSize * 0.08))
  ctx.strokeStyle = 'rgba(0,0,0,0.7)'
  ctx.shadowColor = 'rgba(0,0,0,0.78)'
  ctx.shadowBlur = 8
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 3

  // Dessin des lignes (centrées)
  for (const line of lines) {
    const tx = W / 2
    const ty = y + lineHeight
    // stroke + fill pour la lisibilité
    ctx.lineWidth = strokeW
    ctx.strokeText(line, tx, ty)
    ctx.fillText(line, tx, ty)
    y += lineHeight
  }

  URL.revokeObjectURL(imgUrl)

  // PNG final
  return await new Promise<Blob>((res) => cvs.toBlob((b) => res(b!), 'image/png'))
}
