import { createWorker, PSM } from 'tesseract.js';

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

export interface CinOcrOptions {
  autoOcrOnCameraCapture?: boolean;
  cameraSide?: 'recto' | 'verso';
}

export interface OcrWordInfo {
  text: string;
  confidence: number;
}

export interface OcrLineInfo {
  text: string;
  confidence: number;
  words?: OcrWordInfo[];
}

const MIN_TESSERACT_CONFIDENCE = 60;

const IGNORED_RECTO_PHRASES = [
  'CARTE DE DEMONSTRATION',
  'SPECIMEN TEST',
  'ROYAUME DU MAROC',
];

const NON_NAME_KEYWORDS =
  /^(NOM|PRENOM|PRE\s*NOM|N[EÉ]\(?E\)?|NE|NEE|DATE|VALABLE|EXPIR|CARTE|ROYAUME|CIN|IDENTITE|NATIONALE|MAROC|MAROCAINE|ADRESSE|SEXE|TAILLE)\b/;

const COMPOUND_PRENOM_PREFIXES = new Set([
  'MOHAMED',
  'MOHAMMED',
  'FATIMA',
  'ABDEL',
  'ABDOU',
  'SIDI',
  'MOULAY',
  'LALLA',
  'NOUR',
  'SALAH',
  'ALAE',
  'BAHAE',
  'SAIF',
  'CHAMS',
  'ZINE',
  'JEAN',
  'MARIE',
  'PIERRE',
  'ANNE',
  'PAUL',
]);

function stripAccentsUpper(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function isIgnoredRectoLine(line: string): boolean {
  const norm = stripAccentsUpper(line).replace(/\s+/g, ' ').trim();
  return IGNORED_RECTO_PHRASES.some((phrase) => norm.includes(phrase));
}

function isPrenomLabel(line: string): boolean {
  const norm = stripAccentsUpper(line);
  return /\bPRE\s*NOM\b/.test(norm);
}

function isNomLabel(line: string): boolean {
  const norm = stripAccentsUpper(line);
  return !/\bPRE\s*NOM\b/.test(norm) && /\bNOM\b/.test(norm);
}

function isAnyFieldLabel(line: string): boolean {
  const norm = stripAccentsUpper(line);
  return (
    isPrenomLabel(line) ||
    isNomLabel(line) ||
    /\bN[EÉ]\(?E\)?\b|\bNAISSANCE\b|\bVALABLE\b|\bEXPIR|\bCIN\b|\bN[°O.]\b/.test(norm)
  );
}

function fixDigitConfusionsInNameToken(token: string): string {
  // Corrections 0->O, 1->I, 5->S, 8->B uniquement à l'intérieur des noms (tokens contenant des lettres)
  if (!/[A-Z]/.test(token)) return token;
  if (/^[A-Z]{1,2}[0-9]{5,6}$/.test(token)) return token;
  return token
    .replace(/0/g, 'O')
    .replace(/1/g, 'I')
    .replace(/5/g, 'S')
    .replace(/8/g, 'B');
}

function isLikelyCompoundPrenom(wordA: string, wordB: string, rawInput: string): boolean {
  const lettersA = wordA.replace(/[^A-Z]/g, '');
  const lettersB = wordB.replace(/[^A-Z]/g, '');
  if (lettersA.length < 3 || lettersB.length < 3) return false;
  if (COMPOUND_PRENOM_PREFIXES.has(lettersA)) return true;
  const escapedA = lettersA.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedB = lettersB.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escapedA}\\s*-\\s*${escapedB}`).test(stripAccentsUpper(rawInput));
}

function cleanRectoNameValue(raw?: string, isPrenom = false): string | undefined {
  if (!raw) return undefined;
  if (isIgnoredRectoLine(raw)) return undefined;

  const withoutArabic = raw.replace(
    /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+/g,
    ' '
  );
  const asciiUpper = stripAccentsUpper(withoutArabic);

  const fixedTokens = asciiUpper
    .split(/\s+/)
    .filter(Boolean)
    .filter((tok) => !/^[A-Z]{1,2}[0-9]{5,6}$/.test(tok))
    .map(fixDigitConfusionsInNameToken);

  const cleaned = fixedTokens
    .join(' ')
    .replace(/[^A-Z\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s'-]+|[\s'-]+$/g, '')
    .trim();

  if (!cleaned) return undefined;
  if (NON_NAME_KEYWORDS.test(cleaned)) return undefined;
  if (IGNORED_RECTO_PHRASES.some((phrase) => cleaned.includes(phrase))) {
    return undefined;
  }

  // Découpe en mots : garde uniquement les mots d'au moins 3 lettres (supprime 1-2 lettres isolés)
  const words = cleaned
    .split(/\s+/)
    .map((w) => w.replace(/^['-]+|['-]+$/g, '').trim())
    .filter((w) => w && !NON_NAME_KEYWORDS.test(w))
    .filter((w) => w.replace(/[^A-Z]/g, '').length >= 3);

  if (words.length === 0) return undefined;
  if (words.length <= 2) {
    return words.join(' ');
  }

  // Plus de 2 mots : garde le dernier mot (ou les 2 derniers si prénom composé >= 3 lettres chacun)
  if (isPrenom && isLikelyCompoundPrenom(words[words.length - 2], words[words.length - 1], raw)) {
    return `${words[words.length - 2]} ${words[words.length - 1]}`;
  }
  return words[words.length - 1];
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

function normalizeCinWithPositionalFix(rawToken: string): string | undefined {
  const compact = rawToken.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (compact.length < 6 || compact.length > 8) return undefined;
  if (!/[A-Z]/.test(compact)) return undefined;

  const toLetter = (ch: string) => ch.replace(/0/g, 'O').replace(/1/g, 'I');
  const toDigit = (ch: string) => ch.replace(/O/g, '0').replace(/I/g, '1');

  let prefixCount = 1;
  if (compact.length === 8) {
    prefixCount = 2;
  } else if (compact.length === 7) {
    const ch1 = compact[1];
    prefixCount = /[A-HJ-NP-Z]/.test(ch1) ? 2 : 1;
  } else {
    prefixCount = 1;
  }

  const letters = toLetter(compact.slice(0, prefixCount));
  const digits = toDigit(compact.slice(prefixCount));
  const candidate = `${letters}${digits}`;
  return /^[A-Z]{1,2}[0-9]{5,6}$/.test(candidate) ? candidate : undefined;
}

export function parseCinRectoNumberZone(rawText: string, ocrLines?: OcrLineInfo[]): string | undefined {
  if (!rawText || !rawText.trim()) return undefined;

  const usableLines: OcrLineInfo[] =
    ocrLines && ocrLines.length > 0
      ? ocrLines
      : rawText
          .split(/\r?\n/)
          .map((t) => ({ text: t.trim(), confidence: 100 }))
          .filter((l) => Boolean(l.text));

  const extractFromLine = (lineInfo: OcrLineInfo, enforceConfidence: boolean): string | undefined => {
    if (enforceConfidence && lineInfo.confidence < MIN_TESSERACT_CONFIDENCE) {
      return undefined;
    }

    // Retire le libellé N° / NO / N et découpe autour des séparateurs / : |
    let text = stripAccentsUpper(lineInfo.text)
      .replace(/N\s*[°º]\s*[:/\\|-]?/g, ' ')
      .replace(/\bN[O.]?\b\s*[:/\\|-]+/g, ' ')
      .replace(/[/\\|:;]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!text) return undefined;

    // Cas où "N°" a été collé sans espace/symbole ou avec '/' lu comme 'I'/'1' (ex: NFA998877, N1FA998877)
    text = text
      .replace(/\bN[I1L]?([A-Z]{2}[0-9OI]{5,6})\b/g, '$1')
      .replace(/\bN([A-Z][0-9OI]{5,6})\b/g, '$1');

    // Cherche d'abord un motif collé ou avec espace interne (ex: FA 998877 ou FA998877)
    const patternMatches = text.match(/[A-Z0-9]{1,2}\s*[0-9OI]{5,6}/g) || [];
    for (const m of patternMatches) {
      const normalized = normalizeCinWithPositionalFix(m);
      if (normalized) {
        if (enforceConfidence && lineInfo.words && lineInfo.words.length > 0) {
          const matchingWords = lineInfo.words.filter((w) => {
            const wt = stripAccentsUpper(w.text).replace(/[^A-Z0-9]/g, '');
            return wt.length >= 2 && normalized.includes(wt.replace(/^N[I1L]?/, ''));
          });
          if (matchingWords.length > 0) {
            const avgConf =
              matchingWords.reduce((sum, w) => sum + w.confidence, 0) / matchingWords.length;
            if (avgConf < MIN_TESSERACT_CONFIDENCE) continue;
          }
        }
        return normalized;
      }
    }

    // Fallback par segment (ex: entre '/' et ':')
    for (const segment of text.split(/\s+/)) {
      const candidate = normalizeCinWithPositionalFix(segment);
      if (candidate) return candidate;
    }

    // Fallback sur la ligne entière compactée
    const wholeCandidate = normalizeCinWithPositionalFix(text);
    if (wholeCandidate) return wholeCandidate;

    return undefined;
  };

  // Passe 1 : privilégie les lignes avec confiance >= 60
  for (const lineInfo of usableLines) {
    const found = extractFromLine(lineInfo, true);
    if (found) return found;
  }

  // Passe 2 : dans la bande dédiée au N° de CIN, un motif strict [A-Z]{1,2}[0-9]{5,6} reste valide
  // même si la présence de '/', ':' ou du mot arabe 'الرقم' a abaissé la confiance de ligne Tesseract
  for (const lineInfo of usableLines) {
    const found = extractFromLine(lineInfo, false);
    if (found) return found;
  }

  return undefined;
}

function extractCinFromText(text: string): string | undefined {
  const match = text.match(/(?<![A-Za-z0-9])([A-Za-z]{1,2}\s*[0-9]{5,6})(?![A-Za-z0-9])/);
  if (match && match[1]) {
    const normalized = match[1].replace(/\s+/g, '').toUpperCase();
    if (/^[A-Z]{1,2}[0-9]{5,6}$/.test(normalized)) {
      return normalized;
    }
  }
  return undefined;
}

function fixMrzLetterZone(text: string): string {
  return text.replace(/0/g, 'O').replace(/1/g, 'I');
}

function fixMrzDigitZone(text: string): string {
  return text
    .replace(/O/g, '0')
    .replace(/I/g, '1')
    .replace(/S/g, '5')
    .replace(/B/g, '8');
}

export function computeMrzCheckDigit(input: string): number {
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    let val = 0;
    if (ch >= '0' && ch <= '9') {
      val = ch.charCodeAt(0) - 48;
    } else if (ch >= 'A' && ch <= 'Z') {
      val = ch.charCodeAt(0) - 55;
    }
    sum += val * weights[i % 3];
  }
  return sum % 10;
}

export function parseCinMrzText(rawText: string): CinOcrFields {
  const fields: CinOcrFields = {};
  if (!rawText || !rawText.trim()) return fields;

  // Découpe en lignes, ignore les lignes < 20 caractères, garde les 3 plus longues dans l'ordre
  const indexedLines = rawText
    .split(/\r?\n/)
    .map((l, idx) => ({
      idx,
      line: l.toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9<]/g, ''),
    }))
    .filter((item) => item.line.length >= 20);

  if (indexedLines.length === 0) return fields;

  const lines = [...indexedLines]
    .sort((a, b) => b.line.length - a.line.length)
    .slice(0, 3)
    .sort((a, b) => a.idx - b.idx)
    .map((item) => item.line);

  let line1Idx = -1;
  let line3Idx = -1;

  // Ligne 3 : contient "<<" avec uniquement des lettres A-Z et "<" (nom et prénom inchangés)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('<<') && /^[A-Z<]+$/.test(line)) {
      const sepIdx = line.indexOf('<<');
      const rawNom = line.slice(0, sepIdx);
      const rawPrenom = line.slice(sepIdx + 2);
      const nom = rawNom.replace(/<+/g, ' ').replace(/\s+/g, ' ').trim();
      const prenom = rawPrenom.replace(/<+/g, ' ').replace(/\s+/g, ' ').trim();

      if (nom.replace(/[^A-Z]/g, '').length >= 2) {
        fields.nom = nom;
      }
      if (prenom.replace(/[^A-Z]/g, '').length >= 2) {
        fields.prenom = prenom;
      }
      if (fields.nom || fields.prenom) {
        line3Idx = i;
        break;
      }
    }
  }

  // Ligne 1 : commence par "ID" (tolère "I0", "1D")
  for (let i = 0; i < lines.length; i++) {
    if (i === line3Idx) continue;
    const line = lines[i];
    if (/^(?:ID|I0|1D)M[A4]R/.test(line)) {
      line1Idx = i;
      const afterIdMar = line.replace(/^(?:ID|I0|1D)M[A4]R/, '');
      const rawBeforePad = afterIdMar.split('<')[0];
      if (rawBeforePad.length >= 7 && rawBeforePad.length <= 9) {
        const checkChar = fixMrzDigitZone(rawBeforePad.slice(-1));
        if (/^\d$/.test(checkChar)) {
          const cinBody = rawBeforePad.slice(0, -1);
          let prefixLen = 1;
          if (cinBody.length === 8) {
            prefixLen = 2;
          } else if (cinBody.length === 7) {
            prefixLen = /[A-Z]/.test(cinBody[1]) ? 2 : 1;
          }
          const letters = fixMrzLetterZone(cinBody.slice(0, prefixLen));
          const digits = fixMrzDigitZone(cinBody.slice(prefixLen));
          const candidate = `${letters}${digits}`;
          if (/^[A-Z]{1,2}[0-9]{5,6}$/.test(candidate)) {
            fields.cin = candidate;
          }
        }
      }
      break;
    }
  }

  // Ligne 2 : contient "MAR" et commence par 6 chiffres (avec tolérance O/I/S/B)
  for (let i = 0; i < lines.length; i++) {
    if (i === line3Idx || i === line1Idx) continue;
    const line = lines[i];
    if (!line.includes('MAR')) continue;
    const head6 = fixMrzDigitZone(line.slice(0, 6));
    if (!/^\d{6}$/.test(head6)) continue;

    const aa = Number(head6.slice(0, 2));
    const mm = head6.slice(2, 4);
    const jj = head6.slice(4, 6);
    const fullYear = aa > 30 ? 1900 + aa : 2000 + aa;
    const formatted = isValidBirthDate(jj, mm, String(fullYear));
    if (formatted) {
      fields.dateNaissance = formatted;
    }
    break;
  }

  return fields;
}

function getLineValueConfidence(lineInfo: OcrLineInfo, valueText?: string): number {
  if (!lineInfo.words || lineInfo.words.length === 0) {
    return lineInfo.confidence;
  }
  const latinWords = lineInfo.words.filter((w) => /[A-Z0-9]/.test(stripAccentsUpper(w.text)));
  if (latinWords.length === 0) {
    return lineInfo.confidence;
  }

  if (valueText) {
    const targetTokens = new Set(valueText.split(/\s+/).filter(Boolean));
    const matchedWords = latinWords.filter((w) => {
      const normW = stripAccentsUpper(w.text).replace(/[^A-Z0-9]/g, '');
      return targetTokens.has(normW) || [...targetTokens].some((t) => normW.includes(t) || t.includes(normW));
    });
    if (matchedWords.length > 0) {
      return matchedWords.reduce((sum, w) => sum + w.confidence, 0) / matchedWords.length;
    }
  }

  return latinWords.reduce((sum, w) => sum + w.confidence, 0) / latinWords.length;
}

function filterLowConfidenceWordsFromLine(lineInfo: OcrLineInfo): string {
  if (!lineInfo.words || lineInfo.words.length === 0) {
    return lineInfo.text;
  }
  const kept = lineInfo.words.filter((w) => w.confidence >= MIN_TESSERACT_CONFIDENCE);
  return kept.map((w) => w.text).join(' ').trim();
}

export function parseCinRectoText(rawText: string, ocrLines?: OcrLineInfo[]): CinOcrFields {
  const fields: CinOcrFields = {};
  if (!rawText || !rawText.trim()) return fields;

  const hasConfidenceData = Boolean(ocrLines && ocrLines.length > 0);
  const lineInfos: OcrLineInfo[] = hasConfidenceData
    ? ocrLines!.filter((l) => Boolean(l.text) && !isIgnoredRectoLine(l.text))
    : rawText
        .split(/\r?\n/)
        .map((l) => ({ text: l.trim(), confidence: 100 }))
        .filter((l) => Boolean(l.text) && !isIgnoredRectoLine(l.text));

  const extractNameForLabel = (index: number, isPrenom: boolean): string | undefined => {
    const lineInfo = lineInfos[index];
    if (lineInfo.text.includes(':')) {
      const afterColon = lineInfo.text.split(':').slice(1).join(':');
      const valSameLine = cleanRectoNameValue(afterColon, isPrenom);
      if (valSameLine) {
        if (!hasConfidenceData || getLineValueConfidence(lineInfo, valSameLine) >= MIN_TESSERACT_CONFIDENCE) {
          return valSameLine;
        }
        return undefined;
      }
    }

    const tryValueLine = (candidateInfo?: OcrLineInfo): string | undefined => {
      if (!candidateInfo || isAnyFieldLabel(candidateInfo.text)) return undefined;
      if (hasConfidenceData && candidateInfo.confidence < MIN_TESSERACT_CONFIDENCE) {
        // Vérifier s'il reste malgré tout des mots fiables (>= 60)
        const highConfText = filterLowConfidenceWordsFromLine(candidateInfo);
        if (!highConfText) return undefined;
        const valHigh = cleanRectoNameValue(highConfText, isPrenom);
        if (valHigh && getLineValueConfidence(candidateInfo, valHigh) >= MIN_TESSERACT_CONFIDENCE) {
          return valHigh;
        }
        return undefined;
      }
      const sourceText = hasConfidenceData ? filterLowConfidenceWordsFromLine(candidateInfo) : candidateInfo.text;
      const val = cleanRectoNameValue(sourceText, isPrenom);
      if (!val) return undefined;
      if (hasConfidenceData && getLineValueConfidence(candidateInfo, val) < MIN_TESSERACT_CONFIDENCE) {
        return undefined;
      }
      return val;
    };

    const next1 = lineInfos[index + 1];
    if (next1 && !isAnyFieldLabel(next1.text)) {
      const val1 = tryValueLine(next1);
      if (val1) return val1;

      // Si next1 est uniquement arabe/symboles sans aucune lettre latine, vérifier la ligne suivante
      if (!/[A-Za-z]/.test(stripAccentsUpper(next1.text))) {
        const next2 = lineInfos[index + 2];
        const val2 = tryValueLine(next2);
        if (val2) return val2;
      }
    }

    return undefined;
  };

  // 1. Libellé "NOM" (mot entier non précédé de "PRE")
  for (let i = 0; i < lineInfos.length; i++) {
    if (isNomLabel(lineInfos[i].text)) {
      const val = extractNameForLabel(i, false);
      if (val) {
        fields.nom = val;
        break;
      }
    }
  }

  // 2. Libellé "PRENOM" (mot entier)
  for (let i = 0; i < lineInfos.length; i++) {
    if (isPrenomLabel(lineInfos[i].text)) {
      const val = extractNameForLabel(i, true);
      if (val) {
        fields.prenom = val;
        break;
      }
    }
  }

  // 3. N° de CIN (si présent dans le texte fourni)
  for (let i = 0; i < lineInfos.length; i++) {
    const lineInfo = lineInfos[i];
    if (hasConfidenceData && lineInfo.confidence < MIN_TESSERACT_CONFIDENCE) continue;
    const norm = stripAccentsUpper(lineInfo.text);
    if (/\bN[°O.]?\b|\bCIN\b/.test(norm) || lineInfo.text.includes('N°')) {
      const foundSameLine = extractCinFromText(lineInfo.text);
      if (foundSameLine) {
        fields.cin = foundSameLine;
        break;
      }
      if (lineInfos[i + 1] && (!hasConfidenceData || lineInfos[i + 1].confidence >= MIN_TESSERACT_CONFIDENCE)) {
        const foundNextLine = extractCinFromText(lineInfos[i + 1].text);
        if (foundNextLine) {
          fields.cin = foundNextLine;
          break;
        }
      }
    }
  }

  if (!fields.cin) {
    const confidentText = lineInfos
      .filter((l) => !hasConfidenceData || l.confidence >= MIN_TESSERACT_CONFIDENCE)
      .map((l) => l.text)
      .join('\n');
    const fallbackCin = extractCinFromText(confidentText);
    if (fallbackCin) {
      fields.cin = fallbackCin;
    }
  }

  // 4. Date de naissance : JJ/MM/AAAA valide et non future
  const dateCandidates: { formatted: string; priority: number; sortKey: string }[] = [];
  const dateRegex = /\b(\d{2})[./-](\d{2})[./-](\d{4})\b/g;

  for (const lineInfo of lineInfos) {
    const hasWords = Boolean(lineInfo.words && lineInfo.words.length > 0);
    if (hasConfidenceData && !hasWords && lineInfo.confidence < MIN_TESSERACT_CONFIDENCE) continue;
    const norm = stripAccentsUpper(lineInfo.text);
    const isExpiryLine = /VALABLE|EXPIR/.test(norm);
    const isBirthLine = /\bNE\b|\bNEE\b|NAISSANCE/.test(norm);
    let m: RegExpExecArray | null;
    dateRegex.lastIndex = 0;
    while ((m = dateRegex.exec(lineInfo.text)) !== null) {
      const formatted = isValidBirthDate(m[1], m[2], m[3]);
      if (formatted) {
        if (hasConfidenceData && getLineValueConfidence(lineInfo, m[0]) < MIN_TESSERACT_CONFIDENCE) {
          continue;
        }
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

export function parseCinOcrText(rawText: string): CinOcrFields {
  const mrz = parseCinMrzText(rawText);
  if (mrz.nom || mrz.prenom || mrz.dateNaissance) {
    const recto = parseCinRectoText(rawText);
    return {
      nom: mrz.nom || recto.nom,
      prenom: mrz.prenom || recto.prenom,
      cin: mrz.cin || recto.cin,
      dateNaissance: mrz.dateNaissance || recto.dateNaissance,
    };
  }
  return parseCinRectoText(rawText);
}

function isOcrImageSource(source?: string): source is string {
  return Boolean(
    source &&
      typeof source === 'string' &&
      (source.startsWith('data:image') || /\.(png|jpe?g|webp|bmp|gif)(\?|$)/i.test(source))
  );
}

async function preprocessImageRegion(
  imageSource: string,
  leftRatio: number,
  topRatio: number,
  rightRatio: number,
  bottomRatio: number
): Promise<string> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return imageSource;
  }

  return new Promise((resolve) => {
    const img = new Image();
    if (!imageSource.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      try {
        const srcW = img.naturalWidth || img.width;
        const srcH = img.naturalHeight || img.height;
        if (!srcW || !srcH) {
          resolve(imageSource);
          return;
        }

        const cropX = Math.max(0, Math.min(srcW - 1, Math.floor(srcW * leftRatio)));
        const cropY = Math.max(0, Math.min(srcH - 1, Math.floor(srcH * topRatio)));
        const cropRight = Math.max(cropX + 1, Math.min(srcW, Math.ceil(srcW * rightRatio)));
        const cropBottom = Math.max(cropY + 1, Math.min(srcH, Math.ceil(srcH * bottomRatio)));
        const cropW = Math.max(1, cropRight - cropX);
        const cropH = Math.max(1, cropBottom - cropY);

        const canvas = document.createElement('canvas');
        canvas.width = cropW * 2;
        canvas.height = cropH * 2;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(imageSource);
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const len = data.length;

        let minLum = 255;
        let maxLum = 0;
        const lumBuffer = new Uint8Array(len / 4);

        for (let i = 0, p = 0; i < len; i += 4, p++) {
          const lum = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
          lumBuffer[p] = lum;
          if (lum < minLum) minLum = lum;
          if (lum > maxLum) maxLum = lum;
        }

        const range = maxLum - minLum;
        const contrastFactor = 1.85;

        for (let i = 0, p = 0; i < len; i += 4, p++) {
          let gray = lumBuffer[p];
          if (range > 12) {
            gray = Math.round(((gray - minLum) * 255) / range);
          }
          const enhanced = Math.max(
            0,
            Math.min(255, Math.round((gray - 128) * contrastFactor + 128))
          );
          data[i] = enhanced;
          data[i + 1] = enhanced;
          data[i + 2] = enhanced;
          data[i + 3] = 255;
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(imageSource);
      }
    };
    img.onerror = () => resolve(imageSource);
    img.src = imageSource;
  });
}

function extractOcrLines(page?: {
  blocks?: { paragraphs?: { lines?: { text?: string; confidence?: number; words?: { text?: string; confidence?: number }[] }[] }[] }[] | null;
  confidence?: number;
}): OcrLineInfo[] {
  const lines: OcrLineInfo[] = [];
  if (!page?.blocks) return lines;
  for (const block of page.blocks) {
    for (const para of block.paragraphs || []) {
      for (const line of para.lines || []) {
        const text = (line.text || '').trim();
        if (!text) continue;
        lines.push({
          text,
          confidence:
            typeof line.confidence === 'number' ? line.confidence : (page.confidence ?? 0),
          words: Array.isArray(line.words)
            ? line.words.map((w) => ({
                text: (w.text || '').trim(),
                confidence:
                  typeof w.confidence === 'number'
                    ? w.confidence
                    : typeof line.confidence === 'number'
                    ? line.confidence
                    : (page.confidence ?? 0),
              }))
            : undefined,
        });
      }
    }
  }
  return lines;
}

type TesseractWorker = Awaited<ReturnType<typeof createWorker>>;

let sharedWorkerPromise: Promise<TesseractWorker> | null = null;
let workerQueue: Promise<unknown> = Promise.resolve();

async function acquireOcrWorker(): Promise<TesseractWorker> {
  if (!sharedWorkerPromise) {
    sharedWorkerPromise = createWorker('fra').catch((err) => {
      sharedWorkerPromise = null;
      throw err;
    });
  }
  return sharedWorkerPromise;
}

function runWithOcrWorker<T>(task: (worker: TesseractWorker) => Promise<T>): Promise<T> {
  const next = workerQueue.then(async () => {
    const worker = await acquireOcrWorker();
    try {
      return await task(worker);
    } catch (err) {
      sharedWorkerPromise = null;
      try {
        await worker.terminate();
      } catch {
        // ignore termination errors
      }
      throw err;
    }
  });
  workerQueue = next.catch(() => undefined);
  return next;
}

export async function prechargerOcrCin(): Promise<void> {
  try {
    await acquireOcrWorker();
  } catch {
    // Préchargement silencieux : une tentative ultérieure réinitialisera le worker
  }
}

export async function lireCinLocalement(
  imageSource: string,
  options?: CinOcrOptions
): Promise<CinOcrResult> {
  if (options?.cameraSide === 'verso') {
    return lireCinDeuxFaces(undefined, imageSource, options);
  }
  return lireCinDeuxFaces(imageSource, undefined, options);
}

export async function declencherOcrCaptureCamera(
  imageSource: string,
  options?: CinOcrOptions
): Promise<CinOcrResult> {
  if (!options?.autoOcrOnCameraCapture) {
    return {
      success: false,
      fields: {},
      error: 'OCR automatique caméra désactivé',
    };
  }
  return lireCinLocalement(imageSource, options);
}

export async function lireCinDeuxFaces(
  rectoSource?: string,
  versoSource?: string,
  _options?: CinOcrOptions
): Promise<CinOcrResult> {
  const hasRecto = isOcrImageSource(rectoSource);
  const hasVerso = isOcrImageSource(versoSource);

  if (!hasRecto && !hasVerso) {
    if (!rectoSource && !versoSource) {
      return { success: false, fields: {}, error: 'Source absente' };
    }
    return { success: false, fields: {}, error: 'Format non pris en charge par OCR' };
  }

  try {
    return await runWithOcrWorker(async (worker) => {
      let mrzFields: CinOcrFields = {};
      if (hasVerso && versoSource) {
        await worker.setParameters({
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<',
          tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        });

        const croppedQuarter = await preprocessImageRegion(versoSource, 0, 0.75, 1, 1);
        const quarterRes = await worker.recognize(croppedQuarter);
        mrzFields = parseCinMrzText(quarterRes?.data?.text || '');

        // Secours si la carte verso possède une marge inférieure dans la photo
        if (!mrzFields.nom && !mrzFields.prenom && !mrzFields.dateNaissance) {
          const croppedLarger = await preprocessImageRegion(versoSource, 0, 0.6, 1, 1);
          const largerRes = await worker.recognize(croppedLarger);
          mrzFields = parseCinMrzText(largerRes?.data?.text || '');
        }
      }

      const needRectoIdentity =
        hasRecto &&
        Boolean(rectoSource) &&
        (!mrzFields.nom || !mrzFields.prenom || !mrzFields.dateNaissance);

      const needRectoCin = hasRecto && Boolean(rectoSource) && !mrzFields.cin;

      let rectoFields: CinOcrFields = {};
      if (needRectoIdentity && rectoSource) {
        await worker.setParameters({
          tessedit_char_whitelist: '',
          tessedit_pageseg_mode: PSM.AUTO,
        });
        // Colonne centrale-droite du recto (36 % à 88 % largeur, 28 % à 82 % hauteur : NOM, PRENOM, DATE DE NAISSANCE)
        const identityCrop = await preprocessImageRegion(rectoSource, 0.36, 0.28, 0.88, 0.82);
        const identityRes = await worker.recognize(identityCrop, {}, { text: true, blocks: true });
        const identityLines = extractOcrLines(identityRes?.data);
        rectoFields = parseCinRectoText(identityRes?.data?.text || '', identityLines);

        // Repli si la carte remplit tout le cadre sans marges (texte légèrement plus large)
        if (!rectoFields.nom || !rectoFields.prenom || !rectoFields.dateNaissance) {
          const wideCrop = await preprocessImageRegion(rectoSource, 0.45, 0.22, 1, 0.88);
          const wideRes = await worker.recognize(wideCrop, {}, { text: true, blocks: true });
          const wideLines = extractOcrLines(wideRes?.data);
          const wideFields = parseCinRectoText(wideRes?.data?.text || '', wideLines);
          rectoFields = {
            nom: rectoFields.nom || wideFields.nom,
            prenom: rectoFields.prenom || wideFields.prenom,
            cin: rectoFields.cin || wideFields.cin,
            dateNaissance: rectoFields.dateNaissance || wideFields.dateNaissance,
          };
        }
      }

      if (needRectoCin && rectoSource) {
        await worker.setParameters({
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789N°/: ',
          tessedit_pageseg_mode: PSM.AUTO,
        });
        // Bande sous la photo de profil (4 % à 46 % largeur, 78 % à 98 % hauteur)
        const cinCrop = await preprocessImageRegion(rectoSource, 0.04, 0.78, 0.46, 0.98);
        const cinRes = await worker.recognize(cinCrop, {}, { text: true, blocks: true });
        const cinLines = extractOcrLines(cinRes?.data);
        let cinNumber = parseCinRectoNumberZone(cinRes?.data?.text || '', cinLines);

        // Repli sur bande inférieure gauche élargie en mode bloc si non lu
        if (!cinNumber) {
          await worker.setParameters({
            tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789N°/: ',
            tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
          });
          const fallbackCinCrop = await preprocessImageRegion(rectoSource, 0, 0.82, 0.48, 1);
          const fallbackCinRes = await worker.recognize(
            fallbackCinCrop,
            {},
            { text: true, blocks: true }
          );
          const fallbackCinLines = extractOcrLines(fallbackCinRes?.data);
          cinNumber = parseCinRectoNumberZone(
            fallbackCinRes?.data?.text || '',
            fallbackCinLines
          );
        }

        if (cinNumber) {
          rectoFields.cin = cinNumber;
        }
      }

      // Priorité stricte à la MRZ en cas de contradiction avec le recto
      const merged: CinOcrFields = {};
      if (mrzFields.nom || rectoFields.nom) {
        merged.nom = mrzFields.nom || rectoFields.nom;
      }
      if (mrzFields.prenom || rectoFields.prenom) {
        merged.prenom = mrzFields.prenom || rectoFields.prenom;
      }
      if (mrzFields.cin || rectoFields.cin) {
        merged.cin = mrzFields.cin || rectoFields.cin;
      }
      if (mrzFields.dateNaissance || rectoFields.dateNaissance) {
        merged.dateNaissance = mrzFields.dateNaissance || rectoFields.dateNaissance;
      }

      const hasAnyField = Boolean(
        merged.nom || merged.prenom || merged.cin || merged.dateNaissance
      );
      return {
        success: hasAnyField,
        fields: merged,
      };
    });
  } catch (err) {
    return {
      success: false,
      fields: {},
      error: err instanceof Error ? err.message : 'Erreur OCR',
    };
  }
}
