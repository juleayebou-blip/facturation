# Facturation

Application web installable (PWA) pour créer des **factures** et des **proformas**, les archiver, et imprimer le **détail des prix unitaires** d'un client. Elle fonctionne **sans internet** une fois ouverte une première fois, sur téléphone comme sur PC.

## Mettre l'application en ligne (GitHub Pages)

1. Créez un compte sur <https://github.com> si besoin, puis un **nouveau dépôt** (par exemple `facturation`), en **public** pour utiliser GitHub Pages gratuitement.
2. Envoyez-y tous les fichiers de ce dossier (bouton **Add file → Upload files**, glissez le contenu du dossier, pas le dossier lui-même, puis **Commit changes**).
3. Dans le dépôt : **Settings → Pages**. Sous *Build and deployment*, choisissez **Deploy from a branch**, branche **main**, dossier **/ (root)**, puis **Save**.
4. Après une à deux minutes, l'adresse apparaît en haut de la page : `https://VOTRE-NOM.github.io/facturation/`.

> Un dépôt public est visible de tous : le fichier `data/seed.json` contient votre liste de produits et vos prix. Si ces prix sont confidentiels, utilisez un dépôt privé (GitHub Pages sur dépôt privé demande un abonnement payant) ou un autre hébergement privé.

## Installer sur l'appareil

- **Android (Chrome)** : ouvrez l'adresse, menu ⋮ → *Installer l'application*.
- **iPhone / iPad (Safari)** : bouton Partager → *Sur l'écran d'accueil*.
- **PC (Chrome ou Edge)** : icône d'installation à droite de la barre d'adresse.

## Important : où sont les données ?

Les factures, produits et clients sont enregistrés **sur l'appareil** (dans le navigateur), pas sur GitHub. Chaque appareil a donc ses propres données.

- Faites une sauvegarde régulière : **Réglages → Exporter une sauvegarde**.
- Pour passer du téléphone au PC : exportez sur l'un, **Importer une sauvegarde** sur l'autre (cela remplace les données de l'appareil).
- Effacer les données du navigateur efface aussi les factures : gardez vos sauvegardes.

## Utilisation

- **Facture** : choisissez le type (facture ou proforma), le client, puis les produits. Le prix de facturation se remplit seul ; modifiez-le si besoin. Le n° (4 chiffres / mois / année sur 2 chiffres) et la date du jour sont automatiques. *Enregistrer* archive le document.
- **Archives** : recherche, aperçu et impression (PDF), modification, duplication, transformation d'une proforma en facture, suivi des paiements.
- **Détail prix** : choisissez une facture, les prix de vente unitaires du client s'affichent, corrigez-les si besoin, puis imprimez.
- **Produits** : trois prix par produit : le prix de vente du client (cabinet), votre prix de facturation et **votre prix d'achat chez le grossiste**. Le bouton *Saisir les prix d'achat* permet de les renseigner rapidement ; la marge s'affiche en direct.
- **Gain** : dans la facture, chaque ligne affiche son gain (prix de vente − prix d'achat) et le total ; *Archives* donne ventes, gain et reste à encaisser par mois. Les prix d'achat et gains ne figurent **jamais** sur les documents imprimés.
- **Imprimer / PDF** : dans l'aperçu, *Imprimer / PDF*, puis choisissez « Enregistrer au format PDF » pour envoyer le document.

## Mettre à jour

Remplacez les fichiers dans le dépôt. Pour forcer le renouvellement chez les utilisateurs, changez `VERSION` dans `sw.js`. Le changement de la liste de produits d'origine (`data/seed.json`) ne s'applique qu'à une installation neuve : sur un appareil déjà utilisé, modifiez les produits dans l'application.

## Contenu

`index.html`, `styles.css`, `app.js`, `lib.js` (calculs, montant en lettres, numérotation), `sw.js` (mode hors ligne), `manifest.webmanifest`, `data/seed.json`, `logo.png`, `icons/`.
