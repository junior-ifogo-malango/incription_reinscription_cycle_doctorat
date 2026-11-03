// Simulation : aucune lecture réelle de l'image

export interface OcrResultatCIN {
  nom: string;
  cin: string;
  confiance: number;
}

/**
 * Lit de façon simulée une carte CIN à partir d'un dataUrl d'image.
 * Si la longueur de dataUrl est paire : confiance 0.93 et CIN exact.
 * Si la longueur de dataUrl est impaire : confiance 0.58 et un caractère du CIN modifié.
 */
export function lireCIN(dataUrl: string, cinCandidat?: string): Promise<OcrResultatCIN> {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Base CIN du candidat ou valeur par défaut
      const baseCin = (cinCandidat && cinCandidat.trim().toUpperCase()) || 'CD789123';
      const isEven = dataUrl.length % 2 === 0;

      if (isEven) {
        resolve({
          nom: 'EL FASSI Yassine',
          cin: baseCin,
          confiance: 0.93,
        });
      } else {
        // Un caractère du CIN modifié (le dernier chiffre/caractère)
        const lastChar = baseCin.slice(-1);
        const alteredLast = !isNaN(Number(lastChar))
          ? String((parseInt(lastChar, 10) + 1) % 10)
          : lastChar === 'Z' ? 'A' : 'Z';
        const cinModifie = baseCin.slice(0, -1) + alteredLast;

        resolve({
          nom: 'EL FASSI Yassine',
          cin: cinModifie,
          confiance: 0.58,
        });
      }
    }, 1500);
  });
}
