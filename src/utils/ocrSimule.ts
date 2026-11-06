// Simulation : aucune lecture réelle de l'image

export interface OcrResultatCIN {
  numero: string;
  cin: string;
  nom: string;
  confiance: number;
  statutValidite?: StatutValiditeCIN;
  controleEffectue?: boolean;
}

export type StatutValiditeCIN = 'valide' | 'illisible' | 'expiree';

/**
 * Lit de façon simulée une carte CIN à partir d'une image.
 * Délai : 800 ms.
 * Simulation déterministe :
 * - Lit le numéro saisi avec une confiance de 0.9.
 * - Si le champ est vide : confiance 0.5.
 */
export function lireCIN(image: string, cinCandidat?: string): Promise<OcrResultatCIN> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const cleanSaisi = cinCandidat ? cinCandidat.trim().toUpperCase() : '';
      if (cleanSaisi) {
        resolve({
          numero: cleanSaisi,
          cin: cleanSaisi,
          nom: 'EL FASSI Yassine',
          confiance: 0.9,
        });
      } else {
        const defaultCin = 'CD789123';
        resolve({
          numero: defaultCin,
          cin: defaultCin,
          nom: 'EL FASSI Yassine',
          confiance: 0.5,
        });
      }
    }, 800);
  });
}

/**
 * Vérification d'authenticité simulée.
 * verifierCIN(numero) → 'valide' | 'illisible' | 'expiree'
 */
export function verifierCIN(numero: string): StatutValiditeCIN {
  const clean = (numero || '').trim().toUpperCase();
  if (!clean || clean.length < 4 || !/^[A-Z]{1,2}[0-9]{5,6}$/.test(clean) || clean.includes('ILL')) {
    return 'illisible';
  }
  if (clean.endsWith('00') || clean.includes('EXP')) {
    return 'expiree';
  }
  return 'valide';
}

