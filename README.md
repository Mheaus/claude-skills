# claude-skills

Skills Claude Code synchronisés entre le MacBook et le Mac mini (Tailscale).

Ce repo est cloné dans `~/.claude/skills` sur les deux machines.
Pour synchroniser : `cd ~/.claude/skills && git pull` (ou `git push` après ajout/modif d'un skill).

- `ar` → symlink relatif vers `apply-reviews`
- `test-feature` : version Mac mini (upload GIF PR/Linear)

## ⚠️ Ce repo est public — les skills restent génériques

Tout ce qui est commité ici est visible de tous, et l'historique git garde ce qui y
passe même après suppression. **Un `SKILL.md` ne doit contenir aucune donnée propre à
une entité.**

Ne jamais commiter : raison sociale, SIREN, TVA, IBAN, identifiant de compte bancaire,
UUID de ressource, email personnel, nom de client, de fournisseur, de cabinet ou de
personne, montant réel, référence de facture, pratique fiscale ou comptable.

Les données spécifiques vont dans `<skill>/reference.local.md`, ignoré par le motif
`*.local.md` du `.gitignore`. Le `SKILL.md` reste générique, décrit la **règle** plutôt
que le cas particulier, et commence par renvoyer vers la référence locale quand il en a
besoin. `qonto-export-comptable` sert de modèle.

Avant un commit, un audit rapide de ce qui va partir :

```sh
git diff --cached | grep -inE \
  'FR[0-9]{2} ?[0-9]{4}|[0-9a-f]{8}-[0-9a-f]{4}-|[A-Za-z0-9._%+-]+@|\b[0-9]{9,}\b'
```

## Sommaire

### Design & UI
| Skill | Description |
|-------|-------------|
| [`design`](design/) | Design and build new UI with the complete ui.sh design guideline system. |
| [`ui`](ui/) | Explore, build, and refine UI. |
| [`ideas`](ideas/) | Compare multiple UI options in-browser with the ui.sh picker. |
| [`componentize`](componentize/) | Extract and organize existing UI into reusable components with thoughtful APIs. |
| [`make-responsive`](make-responsive/) | Adapt existing UI across mobile, tablet, and desktop breakpoints. |
| [`markup-from-image`](markup-from-image/) | Convert screenshots, Figma exports, mockups, or wireframes into semantic unstyled markup. |
| [`add-dark-mode`](add-dark-mode/) | Add dark mode with colors, shadows, and surfaces handled the way a designer would. |
| [`dark-mode-image`](dark-mode-image/) | Create dark-mode variants of raster images for dark UI contexts. |
| [`canonicalize-tailwind`](canonicalize-tailwind/) | Sort, normalize, deduplicate, and resolve conflicting Tailwind utility classes. |
| [`brand-kit`](brand-kit/) | Generate a complete visual identity and marketing-site mockup board from a product idea. |

### PR & revue
| Skill | Description |
|-------|-------------|
| [`pr`](pr/) | Create a new branch from the current changes and open a pull request. |
| [`autopr`](autopr/) | Crée la branche et la PR sur l'org sakuga-software, attend tous les relecteurs (y compris les tardifs), distingue un refus pour quota d'une revue, répond aux bots et aux personnes, valide l'UI avec `/tfp` ou `/tf` (obligatoire après un changement d'UI significatif), puis notifie sous macOS. |
| [`apply-reviews`](apply-reviews/) | Lit les commentaires de **tous** les bots et des personnes sur la PR courante, applique ce qui est cohérent, anticipe le round suivant, commit, push et répond à chaque commentaire. Porte la règle partagée sur les quotas des relecteurs (`reviewer-availability.md`) et les scripts `pr-signals.sh` / `pr-watch.sh`. |
| [`ar`](apply-reviews/) | Raccourci → `apply-reviews`. |
| [`monitor-apply-reviews`](monitor-apply-reviews/) | Mène une PR jusqu'au vert : surveille chaque round de revue, chaque commentaire d'une personne et chaque check, applique les constats, corrige les checks rouges, relance un relecteur muet sans relancer un relecteur à court de quota (une fois, au moins une minute après l'heure de retour annoncée), et lève le `CHANGES_REQUESTED` resté en place. |
| [`mar`](monitor-apply-reviews/) | Raccourci → `monitor-apply-reviews`. |
| [`wn`](wn/) | What's next — PR mergée : sync main, liste les tâches Linear (Todo) du projet actif et recommande la meilleure. |
| [`next`](next/) | Comme `wn`, mais autonome : sync main, choisit la tâche, la réserve dans Linear (In Progress) pour qu'aucun autre agent ne la prenne, l'implémente, et enchaîne sur `autopr` sans demander. |
| [`autonext`](autonext/) | Enchaîne des `next` sans intervention : prend, réserve, construit et livre une tâche après l'autre, empile les PR quand une tâche dépend d'une PR non mergée, et s'arrête quand plus aucun ticket n'est prenable en autonomie ou que la PR suivante ne peut plus s'empiler. |
| [`simplify-comments`](simplify-comments/) | Réécrit les commentaires du changement en ASD-STE100 : phrases courtes, une idée chacune, voix active. Mesure avant de juger, fusionne les doublons, supprime ce qui redit le code, corrige ceux devenus faux. |
| [`sc`](simplify-comments/) | Raccourci → `simplify-comments`. |

### Tests
| Skill | Description |
|-------|-------------|
| [`test-feature`](test-feature/) | Test the current feature via Claude in Chrome (git diff → dev server → drive the app → GIF → upload PR/Linear). |
| [`tf`](tf/) | Raccourci → `test-feature`. |
| [`test-feature-pw`](test-feature-pw/) | Test the current feature via a Playwright script (no Chrome extension / no permission gate → dev server → run script → webm ≤5 Mo, sinon GIF → upload PR/Linear). |
| [`tfp`](tfp/) | Raccourci → `test-feature-pw`. |

### Scaleway
| Skill | Description |
|-------|-------------|
| [`scw`](scw/) | Execute Scaleway CLI (scw) commands — instances, k8s, serverless, databases, storage, networking, IAM, billing… |
| [`scw-ls`](scw-ls/) | List all running Scaleway resources (instances, k8s, serverless, databases, storage…). |
| [`scw-cost`](scw-cost/) | Scaleway billing summary — current-month spending, per-product breakdown, invoice history. |

### Gandi / DNS
| Skill | Description |
|-------|-------------|
| [`gandi`](gandi/) | Gandi Public API v5 — domaines, LiveDNS (A, CNAME, MX, TXT…), nameservers, glue records, redirections web, DNSSEC, autorenew, transferts, certificats SSL. Token lu depuis le keychain `gandi-api-key`. |

### Comptabilité / Qonto

Ces trois skills lisent une `reference.local.md` non commitée pour tout ce qui est
propre à une entité (compte, arborescence des documents, récurrences).

| Skill | Description |
|-------|-------------|
| [`qonto-attach`](qonto-attach/) | Attacher un ou plusieurs fichiers à des transactions Qonto via le flux d'upload du MCP (request → PUT présigné → attach). |
| [`qonto-justificatifs`](qonto-justificatifs/) | Rapprocher les transactions sans justificatif des fichiers d'un dossier de documents, les attacher, et rendre compte de ce qui reste. |
| [`qonto-export-comptable`](qonto-export-comptable/) | Assembler le dossier mensuel pour la comptable : relevé, justificatifs séparés ventes/achats, récap CSV qui tombe sur le relevé, note de cadrage. |

### Divers
| Skill | Description |
|-------|-------------|
| [`release`](release/) | Open a dated release PR (main → production) on the repo itself, for repos with no upstream remote. |
| [`release-upstream`](release-upstream/) | Pull main from origin, push it to the upstream remote, and open a dated release PR (main → production) on the upstream repo. |
| [`chat`](chat/) | Read or post messages on the shared inter-agent chat channel used by Claude Code sessions on the same machine. |
