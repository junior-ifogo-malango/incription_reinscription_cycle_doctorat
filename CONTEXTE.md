# CONTEXTE GCD (à lire avant chaque tâche)

## CONTEXTE
- Plateforme de Gestion du Cycle Doctoral, USMBA Fès, année 2026/2027. Réimplémentation qui corrige les défauts de la version officielle. Mobile d'abord. Peu de fonctions, bien faites.
- Priorité : la charge ne doit pas peser sur ceux qui ne la feront pas, et on ne redemande pas ce que l'université possède déjà.
- Le papier signé reste l'original. La plateforme prépare, suit et trace. Signature 100 % manuelle. Aucune signature électronique. Apogée, OCR, SMS et e-mails sont simulés.
- Données en localStorage (démo) : propres à chaque navigateur. Interface en français.

## RÔLES
- Candidat : compte e-mail + mot de passe. Consultation des sujets sans compte.
- Directeur de thèse : rattaché à une structure. Compte validé par la Scolarité.
- Structure : id technique 'ced', libellé "Structure". Représente le seul niveau de validation de la démo (⚠ le guide en compte trois : Structure, CED, Pôle).
- Scolarité : administrateur système (profil système, pas métier). Valide les comptes directeur et Structure (refus avec motif de 5 caractères minimum), consulte le journal.
- Le rôle est déduit du compte, jamais affiché. Toute création de compte = Candidat. Cumul de rôles non géré. Agent guichet : RETIRÉ DÉFINITIVEMENT.
- Comptes de test : etudiant@gmail.com, directeurthese@gmail.com, directeurstructure@gmail.com, admin@gmail.com.

## DONNÉES
- Sujet : titre, domaine, directeur, structure, établissement, description, statutValidation (en_validation | publie | refuse), motifRefus, dateValidation, archivé.
- Dossier du candidat : 4 pièces obligatoires (CIN, Diplôme, Relevés, CV), CNE facultatif.
- Vœux (anciennement panier), Candidature, Créneau, Réservation, Séance (date, lieu, 2 membres), Évaluation (4 critères /5, total /20, décision), PV (un par candidat, référence PV-AAAA-MM-JJ-CODE-N, QR individuel), Notification (info | action), Journal (logEvent).

## RÈGLES MÉTIER
- Sujets : un sujet proposé par un directeur est validé par la Structure avant publication. Seuls les sujets publiés sont visibles. Quota de 5 sujets par directeur (⚠ démo). Supprimer si aucune candidature ni vœu, Retirer si des vœux, Archiver si des candidatures.
- Candidature : 3 sujets validés (⚠ démo).
- Dossier : 4 pièces à téléverser (image ou PDF, 1,5 Mo max, caméra ou fichier). Dossier incomplet = délai, jamais rejet. Le directeur ne valide qu'un dossier complet. "Demander de compléter" envoie une notification 'action'.
- Parcours du candidat en 5 étapes : Candidature, Validée, Entretien (créneau confirmé), Résultat (PV publié), Inscription (toujours grisée). Retard affiché en rouge, jamais bloquant. Date du jour modifiable par la Scolarité (menu Compte).
- Entretiens : le directeur publie des créneaux ; le candidat validé réserve (un seul actif) puis confirme. Non confirmé depuis plus de 48 h = exception pour la Structure (⚠ seuil).
- Commission : une carte par séance. Notes sur 4 critères /5, total /20 calculé, décision Favorable | Liste d'attente | Défavorable (avis motivé obligatoire si défavorable).
- PV : généré par candidat, imprimé et signé sur papier, scan déposé par le directeur, "Envoyer à la Structure" obligatoire (statut 'envoye'). La Structure (filtrée par SA structure) vérifie la conformité puis "Publier" (irréversible) ou "Refuser le scan" (motif obligatoire).
- Résultat : visible du seul candidat concerné, sans la note. Jamais de liste publique (loi 09-08 ⚠).
- Notifications de 2 types : 'info' et 'action'. Relances préparées par WhatsApp et e-mail (simulées).
- Jamais de suppression silencieuse : le journal est immuable (qui, quoi, quand).
- Valeurs calculées, jamais stockées : retard, dossier complet, étape de progression.
- Donnée absente : "Non renseigné", jamais inventée.

## ERGONOMIE
- Peu de texte : une seule ligne d'aide par écran. Tout bouton grisé a sa raison écrite dessous. Jamais la couleur seule : texte + icône.
- Dates en JJ/MM/AAAA. Noms complets, jamais d'identifiants bruts. Erreurs écrites sous le champ concerné.
- Mobile : barre du bas de 5 onglets maximum.
- Menus : Directeur = Candidatures, Créneaux, Commission, Sujets, Compte. Structure = Séances, Réinscriptions, Tableau d'exceptions.
- Catalogue : cartes colorées par domaine (icône + filière), titre cliquable, fenêtre de détail (directeur, structure, établissement). Vocabulaire "vœux", plus "panier".
- Impression du PV : tester dans un nouvel onglet (window.print est souvent bloqué dans l'aperçu).

## PRÉVU, PAS ENCORE IMPLÉMENTÉ (ne pas coder sans demande explicite)
- Création de compte réduite à e-mail + mot de passe, puis Google réel (Firebase Authentication).
- Période de saisie des sujets et compteur de sujets restants.
- Tableau d'exceptions épuré ; séances sans PV (délai de 4 jours ⚠), empêchement du directeur, séance non tenue.
- Historique des prolongations de la date de fin de candidature.

## HORS PÉRIMÈTRE (perspectives)
Réinscription des doctorants (le code existe, ne pas le développer), API Apogée réelle (CNE vers cursus), signature électronique, OCR de la CIN, SMS réel, niveaux Centre et Pôle, PV global, arabe/RTL, remplacement du directeur absent, cumul de rôles.

## RÈGLES DE CODE
- Modifie uniquement les fichiers demandés. Ne réécris aucun fichier entier. Ne renomme rien (variables, clés de stockage).
- Ne modifie JAMAIS vite.config.ts. Pas de nouvelle dépendance sauf demande explicite.
- Tous les textes dans i18n/fr.ts. Si un élément existe déjà, ne le change pas. Ne change aucune règle métier sans demande.

## MÉTHODE
1. Avant de modifier : résumé de 5 lignes maximum de ce que tu vas faire, puis attends ma validation.
2. Après ma validation seulement : applique, puis réponds en 5 lignes maximum (ce qui change) + test rapide en 3 étapes.
