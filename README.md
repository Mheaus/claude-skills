# claude-skills

Skills Claude Code synchronisés entre le MacBook et le Mac mini (Tailscale).

Ce repo est cloné dans `~/.claude/skills` sur les deux machines.
Pour synchroniser : `cd ~/.claude/skills && git pull` (ou `git push` après ajout/modif d'un skill).

- `ar` → symlink relatif vers `apply-reviews`
- `test-feature` : version Mac mini (upload GIF PR/Linear)

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

### Scaleway
| Skill | Description |
|-------|-------------|
| [`scw`](scw/) | Execute Scaleway CLI (scw) commands — instances, k8s, serverless, databases, storage, networking, IAM, billing… |
| [`scw-ls`](scw-ls/) | List all running Scaleway resources (instances, k8s, serverless, databases, storage…). |
| [`scw-cost`](scw-cost/) | Scaleway billing summary — current-month spending, per-product breakdown, invoice history. |

### Divers
| Skill | Description |
|-------|-------------|
| [`release-upstream`](release-upstream/) | Pull main from origin, push to upstream (jexplore-co/frontend), and open a dated release PR (main → production). |
| [`chat`](chat/) | Read or post messages on the shared inter-agent chat channel used by Claude Code sessions on the same machine. |
