//test

import { Row } from "exceljs";

// Fonction utilitaire pour extraire un ID IMDb ou un titre depuis une ligne Excel
export function getIMDbIdFromRow(row: Row): { imdbId: string | null; title: string | null } {
  let imdbId: string | null = null;
  let fallbackTitle: string | null = null;

  for (const cell of row.values as any[]) {
    if (typeof cell === "string") {
      // Cherche un pattern IMDb ID (tt suivi de 7 ou 8 chiffres)
      const match = cell.match(/tt\d{7,8}/);
      if (match) {
        imdbId = match[0];
      }

      // Sauvegarde un titre de secours si pas encore trouvé et que ce n’est pas un lien
      if (!fallbackTitle && cell.length > 2 && !cell.startsWith("http")) {
        fallbackTitle = cell.trim();
      }
    }

    // Si la cellule est un objet (ExcelJS gère les hyperliens ainsi)
    if (typeof cell === "object" && cell?.hyperlink) {
      const match = cell.hyperlink.match(/tt\d{7,8}/);
      if (match) {
        imdbId = match[0];
      }
    }

    if (imdbId) break; // On sort dès qu’on a trouvé un ID
  }

  return { imdbId, title: fallbackTitle };
}
