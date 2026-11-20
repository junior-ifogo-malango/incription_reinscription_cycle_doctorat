import { fr } from './i18n/fr';
import { isEmailValide } from './utils/messages';

export const emailConfig = {
  serviceId: '[COLLE]',
  templateId: '[COLLE]',
  publicKey: '[COLLE]',
};

export interface AdmissionEmailParams {
  toEmail: string;
  toName: string;
  message: string;
}

export interface AdmissionEmailResult {
  ok: boolean;
  error?: string;
}

function isConfiguredValue(val: string | undefined): boolean {
  if (!val) return false;
  const trimmed = val.trim();
  return Boolean(trimmed && trimmed !== '[COLLE]');
}

/**
 * Envoie un e-mail réel via l'API REST d'EmailJS.
 * Ne retourne ok: true qu'en cas de réponse HTTP positive de l'API.
 */
export async function sendAdmissionEmail(
  params: AdmissionEmailParams
): Promise<AdmissionEmailResult> {
  if (
    !isConfiguredValue(emailConfig.serviceId) ||
    !isConfiguredValue(emailConfig.templateId) ||
    !isConfiguredValue(emailConfig.publicKey)
  ) {
    return { ok: false, error: fr.cedSeances.emailConfigMissing };
  }

  if (!params.toEmail || !params.toEmail.trim()) {
    return { ok: false, error: fr.messages.missingEmail };
  }

  if (!isEmailValide(params.toEmail)) {
    return { ok: false, error: fr.messages.invalidEmail };
  }

  try {
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        service_id: emailConfig.serviceId.trim(),
        template_id: emailConfig.templateId.trim(),
        user_id: emailConfig.publicKey.trim(),
        template_params: {
          to_email: params.toEmail.trim(),
          to_name: (params.toName || '').trim() || params.toEmail.trim(),
          message: params.message,
        },
      }),
    });

    if (response.ok) {
      return { ok: true };
    }

    let detail = '';
    try {
      detail = (await response.text()).trim();
    } catch {
      detail = '';
    }
    const shortReason = detail
      ? detail.slice(0, 80)
      : `HTTP ${response.status}`;

    return { ok: false, error: shortReason };
  } catch (err: unknown) {
    const msg =
      err instanceof Error && err.message
        ? err.message.trim().slice(0, 80)
        : fr.cedSeances.emailNetworkError;
    return { ok: false, error: msg || fr.cedSeances.emailNetworkError };
  }
}
