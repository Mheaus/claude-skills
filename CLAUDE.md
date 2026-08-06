# Instructions — repo claude-skills

Ce repo est le contenu de `~/.claude/skills`, synchronisé entre plusieurs machines.

## Ce repo est PUBLIC

`Mheaus/claude-skills` est un dépôt public. Tout commit est visible de tous, et
l'historique git conserve ce qui y passe même après suppression du fichier.

**Avant tout commit ici, vérifie que rien de ce qui suit n'apparaît dans un fichier
suivi par git :**

- raison sociale, SIREN, SIRET, numéro de TVA, adresse
- IBAN, BIC, identifiant de compte bancaire, UUID de ressource
- email ou numéro de téléphone d'une personne, nom d'une personne
- nom d'un client, d'un fournisseur, d'un cabinet ou d'un prestataire
- montant réel, référence de facture, taux ou pratique fiscale ou comptable
- clé d'API, token, secret (même expiré)

Audit du contenu indexé :

```sh
git diff --cached | grep -inE \
  'FR[0-9]{2} ?[0-9]{4}|[0-9a-f]{8}-[0-9a-f]{4}-|[A-Za-z0-9._%+-]+@|\b[0-9]{9,}\b'
```

## Où vont les données spécifiques

Dans `<skill>/reference.local.md`, ignoré par le motif `*.local.md` du `.gitignore`.

Le `SKILL.md` reste générique :

- il décrit la **règle**, pas le cas particulier qui l'a fait découvrir ;
- quand il a besoin d'une donnée d'entité, il renvoie vers la référence locale au lieu
  de l'inscrire en dur ;
- il indique quoi demander à l'utilisateur si cette référence est absente.

`qonto-export-comptable` sert de modèle pour ce découpage.

Reformule un exemple concret en règle plutôt que de le supprimer. « Un encaissement de
plateforme freelance porte la facture client et la facture de commission » vaut mieux
qu'un nom de plateforme et qu'un nom de client, et se transpose ailleurs.

## Scripts livrés avec un skill

Un skill peut embarquer des scripts dans `<skill>/scripts/`. Ils doivent :

- prendre leur configuration par variables d'environnement ou par un fichier de travail,
  jamais par des constantes écrites dans le code ;
- offrir un mode `DRY=1` quand ils déplacent, renomment ou suppriment des fichiers ;
- refuser de tourner plutôt que de deviner, quand l'état sur le disque ne correspond pas
  à ce qu'ils attendent ;
- être testés avant d'être commités, y compris un second passage pour vérifier
  l'idempotence.

## Ajouter ou modifier un skill

Mets à jour le tableau du `Sommaire` dans `README.md`. Les commentaires de code suivent
les règles du `CLAUDE.md` global : nécessaires seulement, et en anglais technique
simplifié.
