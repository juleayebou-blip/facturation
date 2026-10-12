# Facturation

Application web installable (PWA) pour créer des **factures** et des **proformas**, les archiver, et imprimer le **détail des prix unitaires** d'un client. Elle fonctionne **sans internet** une fois ouverte une première fois, sur téléphone comme sur PC.

## Mettre l'application en ligne (GitHub Pages)

1. Créez un compte sur <https://github.com> si besoin, puis un **nouveau dépôt** (par exemple `facturation`), en **public** pour utiliser GitHub Pages gratuitement.
2. Envoyez-y tous les fichiers de ce dossier (bouton **Add file → Upload files**, glissez le contenu du dossier, pas le dossier lui-même, puis **Commit changes**).
3. Dans le dépôt : **Settings → Pages**. Sous *Build and deployment*, choisissez **Deploy from a branch**, branche **main**, dossier **/ (root)**, puis **Save**.
4. Après une à deux minutes, l'adresse apparaît en haut de la page : `https://VOTRE-NOM.github.io/facturation/`.

> Un dépôt public est visible de tous : le fichier `seed.js` contient votre liste de produits et vos prix. Si ces prix sont confidentiels, utilisez un dépôt privé (GitHub Pages sur dépôt privé demande un abonnement payant) ou un autre hébergement privé.

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

- **Facture** : choisissez le type (facture ou proforma), le client, puis les produits. Le prix de facturation se remplit seul ; modifiez-le si besoin. Le n° (3 chiffres croissants dans le mois, puis mois, puis année sur 2 chiffres : 001/10/26, 002/10/26…, la série repart à 001 chaque mois) et la date du jour sont automatiques. *Enregistrer* archive le document.
- **Archives** : recherche, aperçu et impression (PDF), modification, duplication, transformation d'une proforma en facture, suivi des paiements.
- **Détail prix** : choisissez une facture, les prix de vente unitaires du client s'affichent, corrigez-les si besoin, puis imprimez.
- **Produits** : trois prix par produit : le prix de vente du client (cabinet), votre prix de facturation et **votre prix d'achat chez le grossiste**. Le bouton *Saisir les prix d'achat* permet de les renseigner rapidement ; la marge s'affiche en direct.
- **Gain** : dans la facture, chaque ligne affiche son gain (prix de vente − prix d'achat) et le total ; *Archives* donne ventes, gain et reste à encaisser par mois. Les prix d'achat et gains ne figurent **jamais** sur les documents imprimés.
- **Imprimer / PDF** : dans l'aperçu, *Imprimer / PDF*, puis choisissez « Enregistrer au format PDF » pour envoyer le document.

## Numérotation

*Réglages → Numérotation des factures* : mode « croissante irrégulière » (006, 009, 011…) ou « strictement continue » (001, 002, 003…). Dans les deux cas : 3 chiffres croissants dans le mois, puis /mois/année, et la série repart à chaque mois.

## Utilisation sans internet

L'application garde ses fichiers en mémoire dans le navigateur : une fois ouverte avec internet, elle s'ouvre ensuite sans connexion. *Réglages → Utilisation sans internet* indique si elle est prête. Les mises à jour de GitHub sont prises en compte à l'ouverture suivante.

## PDF et dossiers

Dans l'aperçu d'une facture, d'une proforma ou du détail des prix, **Enregistrer en PDF** crée le fichier sans aucune mention d'adresse web, nommé `Facture_Client_N°.pdf`, `Proforma_Client_N°.pdf` ou `Prix_Client_N°.pdf`. Au premier enregistrement, l'application demande le dossier (par exemple `D:\GMC FAC\Facture` et `D:\GMC FAC\Prix`) puis l'utilise ensuite automatiquement ; ce choix se change dans *Réglages → Dossiers des PDF*. Chrome ou Edge sur PC sont nécessaires ; sinon le PDF est téléchargé.

## Mot de passe

*Réglages → Mot de passe* : active un mot de passe demandé à l'ouverture de l'application et à l'entrée dans les Réglages. Il ne peut pas être récupéré s'il est oublié. Il protège l'accès à l'application, mais ne chiffre pas les données du navigateur.

## Mettre à jour

Remplacez les fichiers dans le dépôt. Pour forcer le renouvellement chez les utilisateurs, changez `VERSION` dans `sw.js`. Le changement de la liste de produits d'origine (`seed.js`) ne s'applique qu'à une installation neuve : sur un appareil déjà utilisé, modifiez les produits dans l'application.

## Contenu

`index.html`, `styles.css`, `app.js`, `pdfgen.js` et `pdf-lib.min.js` (création des PDF), `lib.js` (calculs, montant en lettres, numérotation), `sw.js` (mode hors ligne), `manifest.webmanifest`, `seed.js`, `logo.png`, `icon-*.png`.
