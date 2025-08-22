// src/lib/prompt.ts
export function buildPrompt({
    titre,
    synopsis,
    langue,
    mots_cles,
    genre,
    date,
    promptSurMesure,
  }: {
    titre: string
    synopsis?: string
    langue?: string
    mots_cles?: string
    genre?: string
    date?: number | string
    promptSurMesure?: string | null
  }) {
    const ifdate = date ? `datant des années ${date}` : ""
    const iflangue = langue ? `en ${langue}` : ""
    const g = genre || ""
  
    let prompt =
      `génère une affiche de film ${g} ${iflangue} ${ifdate} ` +
      `à la manière de Netflix dont le synopsis est le suivant : "${synopsis || ""}". ` +
      `Utilise la règle des tiers. Les mots clés sont : "${mots_cles || ""}". ` +
      `Le genre est "${g}. Le film s'appelle "${titre}". ` +
      `Pas de texte ni le titre du film sur l'affiche. `
  
    const promptSuite =
      "Scène ultra réaliste, style live-action, pas un dessin ou une illustration. Un décor réaliste."
  
    switch (g) {
      case "SERIE & TELENOVELAS":
      case "TV MOVIE":
      case "SPORT":
      case "DOCUMENTARY & TV REPORT":
      case "CINEMA":
      case "EDUTAINMENT":
      case "MUSIC & LIVE":
        prompt += promptSuite
        break
      case "ANIMATION":
        prompt += "Scène d'animation"
        break
      default:
        prompt += promptSuite
        break
    }
  
    if (promptSurMesure) {
      prompt += `Prend en compte ceci : ${promptSurMesure}`
    }
  
    return prompt
  }
  