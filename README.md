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
| [`autopr`](autopr/) | Create a branch + PR on the sakuga-software org, wait for a Copilot/Claude-agent review, apply the suggestions, reply to each comment, then play a macOS notification when done. |
| [`apply-reviews`](apply-reviews/) | Read GitHub Copilot's review comments on the current PR, apply coherent fixes, commit, push, and reply to each comment. |
| [`ar`](apply-reviews/) | Raccourci → `apply-reviews`. |
| [`wn`](wn/) | What's next — PR mergée : sync main, liste les tâches Linear (Todo) du projet actif et recommande la meilleure. |
| [`next`](next/) | Comme `wn`, mais autonome : sync main, choisit la tâche, l'implémente, et enchaîne sur `autopr` sans demander. |

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
