// src/lib/prompt.ts
export function buildPrompt({
  titre,
  synopsis,
  langue,            // conservé pour compatibilité, non utilisé dans le texte
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
  const g = genre || ""

  // Aligné sur le script Python :
  // - "à la manière d'une plateforme de broadcast"
  // - pas de mention de la langue
  // - "Aucun texte, aucun titre et aucun logo..."
  // - règle des tiers + mots-clés + genre + titre
  let prompt =
    `génère une affiche de film ${g} ${ifdate} ` +
    `à la manière d'une plateforme de broadcast dont le synopsis est le suivant : "${synopsis || ""}". ` +
    `Utilise la règle des tiers. Les mots clés sont : "${mots_cles || ""}". ` +
    `Le genre est "${g}". Le film s'appelle "${titre}". ` +
    `Aucun texte, aucun titre et aucun logo ne doivent figurer sur l'affiche.`

  const promptSuite =
    "Scène ultra réaliste, style live-action, pas un dessin ou une illustration. Un décor réaliste."

  switch (g) {
    case "ANIMATION":
      prompt += " Scène d'animation"
      break
    case "SERIE & TELENOVELAS":
    case "TV MOVIE":
    case "SPORT":
    case "DOCUMENTARY & TV REPORT":
    case "CINEMA":
    case "EDUTAINMENT":
    case "MUSIC & LIVE":
    default:
      prompt += " " + promptSuite
      break
  }

  if (promptSurMesure) {
    prompt += ` Prend en compte ceci : ${promptSurMesure}`
  }

  return prompt
}
