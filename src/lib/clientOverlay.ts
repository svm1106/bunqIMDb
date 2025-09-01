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

/** Wrap sans limite de lignes (hard-break les mots trop longs si nécessaire) */
function wrapAll(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width <= maxW) {
      line = test
    } else {
      if (line) lines.push(line)
      if (ctx.measureText(w).width > maxW) {
        // hard-break des mots surdimensionnés
        let cur = ''
        for (const ch of w) {
          const t = cur + ch
          if (ctx.measureText(t).width <= maxW) cur = t
          else { lines.push(cur); cur = ch }
        }
        line = cur
      } else {
        line = w
      }
    }
  }
  if (line) lines.push(line)
  return lines
}

export async function applyTitleOverlayOnClient(opts: {
  baseImageBlob: Blob
  title: string
  category?: string
  genreHint?: string
  width?: number
  height?: number
  gradientRatio?: number  // 0..1
}): Promise<Blob> {
  const {
    baseImageBlob, title, category, genreHint,
    width = 1024, height = 1536, gradientRatio = 0.42
  } = opts

  // S'assurer que les fontes sont prêtes pour des mesures fiables
  if (typeof (document as any).fonts?.ready === 'object') {
    try { await (document as any).fonts.ready } catch {}
  }

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
  const topPadInsideGradient = Math.round(gradientH * 0.14) // petite marge en haut du dégradé
  const minFont = 28
  const lineHeightFactor = 1.14

  const cvs = document.createElement('canvas')
  cvs.width = W
  cvs.height = H
  const ctx = cvs.getContext('2d')!

  // Dessine l'image (cover)
  ctx.drawImage(img, 0, 0, W, H)

  // Dégradé noir → transparent (sans liseré) + flush bas
  const g = ctx.createLinearGradient(0, H, 0, H - gradientH)
  g.addColorStop(0.00, 'rgba(0,0,0,1)')
  g.addColorStop(0.65, 'rgba(0,0,0,0.45)')
  g.addColorStop(1.00, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, H - gradientH, W, gradientH)
  ctx.fillStyle = 'rgba(0,0,0,1)'
  ctx.fillRect(0, H - 2, W, 2)

  // ---- Auto-fit : réduit la taille jusqu’à ce que TOUT tienne au-dessus du bas ----
  const clean = sanitizeTitle(title)

  // Taille de départ heuristique selon la longueur
  let fontSizeStart = style.base
  const L = clean.length
  if (L > 28) fontSizeStart -= Math.min(24, Math.floor((L - 28) * 1.2))

  function fitText(): { fontSize: number; lines: string[]; lineHeight: number; yStart: number } {
    for (let font = Math.max(minFont, fontSizeStart); font >= minFont; font -= 2) {
      ctx.font = `800 ${font}px ${style.family}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'alphabetic'
      const lineH = Math.round(font * lineHeightFactor)

      const usableWidth = W - padX * 2
      const lines = wrapAll(ctx, clean, usableWidth)

      // marges bas selon nb de lignes
      const bottomMargin = lines.length >= 2 ? Math.round(gradientH * 0.22) : Math.round(gradientH * 0.15)
      const maxYBottom = H - bottomMargin
      const minYTop = H - gradientH + topPadInsideGradient

      const totalH = lines.length * lineH

      // placer le bloc au plus bas possible sans dépasser,
      // sinon remonter jusqu'au haut du dégradé si nécessaire
      let y = maxYBottom - totalH
      if (y < minYTop) y = minYTop

      const blockBottom = y + totalH
      if (blockBottom <= maxYBottom + 0.1) {
        return { fontSize: font, lines, lineHeight: lineH, yStart: y }
      }
    }

    // fallback taille mini
    const font = minFont
    ctx.font = `800 ${font}px ${style.family}`
    const lineH = Math.round(font * lineHeightFactor)
    const lines = wrapAll(ctx, clean, W - padX * 2)
    const bottomMargin = lines.length >= 2 ? Math.round(gradientH * 0.22) : Math.round(gradientH * 0.15)
    const maxYBottom = H - bottomMargin
    const minYTop = H - gradientH + topPadInsideGradient
    const totalH = lines.length * lineH
    let y = maxYBottom - totalH
    if (y < minYTop) y = minYTop
    return { fontSize: font, lines, lineHeight: lineH, yStart: y }
  }

  const fit = fitText()

  // Style texte
  ctx.font = `800 ${fit.fontSize}px ${style.family}`
  ctx.textAlign = 'center'
  ctx.fillStyle = '#fff'
  ctx.lineJoin = 'round'
  ctx.miterLimit = 2
  const strokeW = Math.max(1, Math.round(fit.fontSize * 0.08))
  ctx.strokeStyle = 'rgba(0,0,0,0.7)'
  ctx.shadowColor = 'rgba(0,0,0,0.78)'
  ctx.shadowBlur = 8
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 3

  // Dessin des lignes centrées, en partant de yStart (ne dépassera jamais en bas)
  let y = fit.yStart
  for (const line of fit.lines) {
    const tx = W / 2
    const ty = y + fit.lineHeight
    ctx.lineWidth = strokeW
    ctx.strokeText(line, tx, ty)
    ctx.fillText(line, tx, ty)
    y += fit.lineHeight
  }

  URL.revokeObjectURL(imgUrl)
  return await new Promise<Blob>((res) => cvs.toBlob((b) => res(b!), 'image/png'))
}
