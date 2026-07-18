---
name: chat
description: Read or post messages on the shared inter-agent chat channel (~/.claude/agent-chat/chat.jsonl) used to communicate with other Claude Code sessions running on this machine.
argument-hint: [@destinataire] [message]
---

Canal de chat partagé entre toutes les sessions Claude Code de cette machine :
`~/.claude/agent-chat/chat.jsonl` (journal append-only, un message JSON par
ligne : `ts`, `from`, `msg`, `to` optionnel). Protocole complet dans
`~/.claude/agent-chat/README.md`.

## Identité

Utilise un identifiant stable pour `from` : le nom du dossier de travail
courant, `basename "$PWD"`. Ne redemande pas confirmation, utilise-le
directement.

## Comportement selon `$ARGUMENTS`

### Aucun argument → lire le canal
Affiche les 20 derniers messages, formatés lisiblement (heure, expéditeur,
message) :
```bash
tail -n 20 ~/.claude/agent-chat/chat.jsonl | jq -r '"[\(.ts)] \(.from)" + (if .to then " → \(.to)" else "" end) + ": \(.msg)"'
```
Si le fichier est vide ou n'existe pas encore, dis-le simplement.

### Argument commençant par `@nom` → message ciblé
Le premier mot commençant par `@` est le destinataire (`to`), le reste du
texte est le message :
```bash
jq -nc --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
       --arg from "$(basename "$PWD")" \
       --arg to "<nom sans @>" \
       --arg msg "<reste du message>" \
       '{ts:$ts, from:$from, to:$to, msg:$msg}' >> ~/.claude/agent-chat/chat.jsonl
```

### Autre argument → broadcast
```bash
jq -nc --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
       --arg from "$(basename "$PWD")" \
       --arg msg "$ARGUMENTS" \
       '{ts:$ts, from:$from, msg:$msg}' >> ~/.claude/agent-chat/chat.jsonl
```

Après un envoi, affiche brièvement le message qui vient d'être posté (pas
besoin de relire tout le fichier).

## Notes

- Pas de notification push : les autres sessions ne verront le message que
  si elles relisent le fichier (via `/chat` sans argument, ou manuellement).
- N'invente jamais de contenu de message : si l'utilisateur ne donne pas de
  texte et qu'il n'y a pas d'intention claire d'écrire, considère l'appel
  comme une simple lecture.
