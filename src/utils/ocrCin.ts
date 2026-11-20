import { createWorker } from 'tesseract.js';

export interface CinOcrFields {
  nom?: string;
  prenom?: string;
  cin?: string;
  dateNaissance?: string;
}

export interface CinOcrResult {
  success: boolean;
  fields: CinOcrFields;
  error?: string;
}

function cleanNameLine(line?: string): string | undefined {
  if (!line) return undefined;
  const cleaned = line
    .replace(/^[^A-Za-zÀ-ÖØ-öø-ÿ]+/, '')
    .replace(/[^A-Za-zÀ-ÖØ-öø-ÿ\s'-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned || cleaned.length < 2) return undefined;
  if (/^(NOM|PR[EÉ]NOM|N[EÉ]\(?E\)?|DATE|VALABLE|CARTE|ROYAUME|CIN|IDENTIT[EÉ])\b/i.test(cleaned)) {
    return undefined;
  }
  // Exige au moins deux lettres consécutives pour éviter les artefacts OCR isolés
  if (!/[A-Za-zÀ-ÖØ-öø-ÿ]{2,}/.test(cleaned)) return undefined;
  return cleaned;
}

function isValidBirthDate(dayStr: string, monthStr: string, yearStr: string): string | undefined {
  const day = Number(dayStr);
  const month = Number(monthStr);
  const year = Number(yearStr);

  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) {
    return undefined;
  }

  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
    return undefined;
  }

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const birthStr = `${yearStr}-${monthStr.padStart(2, '0')}-${dayStr.padStart(2, '0')}`;
  if (birthStr > todayStr) {
    return undefined;
  }

  return `${dayStr.padStart(2, '0')}/${monthStr.padStart(2, '0')}/${yearStr}`;
}

export function parseCinOcrText(rawText: string): CinOcrFields {
  const fields: CinOcrFields = {};
  if (!rawText || !rawText.trim()) return fields;

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // 1. Nom : ligne après "NOM" (hors "PRENOM")
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/PR[EÉ]NOM/i.test(line) && /\bNOM\b/i.test(line)) {
      const nextVal = cleanNameLine(lines[i + 1]);
      if (nextVal) {
        fields.nom = nextVal;
        break;
      }
      const sameLineAfterColon = line.split(/[:]/)[1];
      const sameVal = cleanNameLine(sameLineAfterColon);
      if (sameVal) {
        fields.nom = sameVal;
        break;
      }
    }
  }

  // 2. Prénom : ligne après "PRENOM"
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/\bPR[EÉ]NOM\b/i.test(line)) {
      const nextVal = cleanNameLine(lines[i + 1]);
      if (nextVal) {
        fields.prenom = nextVal;
        break;
      }
      const sameLineAfterColon = line.split(/[:]/)[1];
      const sameVal = cleanNameLine(sameLineAfterColon);
      if (sameVal) {
        fields.prenom = sameVal;
        break;
      }
    }
  }

  // 3. N° de CIN : 1 ou 2 lettres suivies de 5 ou 6 chiffres
  const cinMatch = rawText.match(/\b([A-Za-z]{1,2}\s*[0-9]{5,6})\b/);
  if (cinMatch && cinMatch[1]) {
    const normalizedCin = cinMatch[1].replace(/\s+/g, '').toUpperCase();
    if (/^[A-Z]{1,2}[0-9]{5,6}$/.test(normalizedCin)) {
      fields.cin = normalizedCin;
    }
  }

  // 4. Date de naissance : JJ/MM/AAAA valide et non future
  const dateCandidates: { formatted: string; priority: number; sortKey: string }[] = [];
  const dateRegex = /\b(\d{2})[./-](\d{2})[./-](\d{4})\b/g;

  for (const line of lines) {
    const isExpiryLine = /VALABLE|EXPIR/i.test(line);
    const isBirthLine = /N[EÉ]\(?E\)?|NAISSANCE/i.test(line);
    let m: RegExpExecArray | null;
    dateRegex.lastIndex = 0;
    while ((m = dateRegex.exec(line)) !== null) {
      const formatted = isValidBirthDate(m[1], m[2], m[3]);
      if (formatted) {
        const sortKey = `${m[3]}-${m[2]}-${m[1]}`;
        const priority = isBirthLine ? 0 : isExpiryLine ? 2 : 1;
        dateCandidates.push({ formatted, priority, sortKey });
      }
    }
  }

  if (dateCandidates.length > 0) {
    dateCandidates.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.sortKey.localeCompare(b.sortKey);
    });
    fields.dateNaissance = dateCandidates[0].formatted;
  }

  return fields;
}

function isOcrImageSource(source?: string): source is string {
  return Boolean(
    source &&
    typeof source === 'string' &&
    (source.startsWith('data:image') || /\.(png|jpe?g|webp|bmp|gif)(\?|$)/i.test(source))
  );
}

export async function lireCinLocalement(imageSource: string): Promise<CinOcrResult> {
  return lireCinDeuxFaces(imageSource);
}

export async function lireCinDeuxFaces(
  rectoSource?: string,
  versoSource?: string
): Promise<CinOcrResult> {
  const sources = [rectoSource, versoSource].filter(isOcrImageSource);

  if (sources.length === 0) {
    if (!rectoSource && !versoSource) {
      return { success: false, fields: {}, error: 'Source absente' };
    }
    return { success: false, fields: {}, error: 'Format non pris en charge par OCR' };
  }

  let worker: Awaited<ReturnType<typeof createWorker>> | null = null;
  try {
    worker = await createWorker('fra');
    const textes: string[] = [];
    const merged: CinOcrFields = {};

    for (const src of sources) {
      const result = await worker.recognize(src);
      const rawText = result?.data?.text || '';
      if (rawText.trim()) {
        textes.push(rawText);
      }
      const parsed = parseCinOcrText(rawText);
      if (!merged.nom && parsed.nom) merged.nom = parsed.nom;
      if (!merged.prenom && parsed.prenom) merged.prenom = parsed.prenom;
      if (!merged.cin && parsed.cin) merged.cin = parsed.cin;
      if (!merged.dateNaissance && parsed.dateNaissance) merged.dateNaissance = parsed.dateNaissance;
    }

    if (textes.length > 1) {
      const combinedParsed = parseCinOcrText(textes.join('\n'));
      if (!merged.nom && combinedParsed.nom) merged.nom = combinedParsed.nom;
      if (!merged.prenom && combinedParsed.prenom) merged.prenom = combinedParsed.prenom;
      if (!merged.cin && combinedParsed.cin) merged.cin = combinedParsed.cin;
      if (!merged.dateNaissance && combinedParsed.dateNaissance) {
        merged.dateNaissance = combinedParsed.dateNaissance;
      }
    }

    const hasAnyField = Boolean(
      merged.nom || merged.prenom || merged.cin || merged.dateNaissance
    );
    return {
      success: hasAnyField,
      fields: merged,
    };
  } catch (err) {
    return {
      success: false,
      fields: {},
      error: err instanceof Error ? err.message : 'Erreur OCR',
    };
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch {
        // ignore termination errors
      }
    }
  }
}
