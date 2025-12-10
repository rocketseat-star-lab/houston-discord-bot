---
description: Create a git commit with staged changes
argument-hint: [commit message (optional)]
---

Follow the git commit protocol to create a commit:

1. Run git status to see current changes
2. Run git diff to review changes
3. If the user provided a commit message in $ARGUMENTS, use it. Otherwise, analyze the changes and create an appropriate commit message following the repository's commit style
4. Stage relevant files if needed
5. Create the commit with the message
6. Run git push

# Diretrizes para Commits

Ao criar commits neste projeto:

## O QUE INCLUIR:
- Mensagem clara e descritiva seguindo o padrão do repositório
- Prefixos convencionais: `feat:`, `fix:`, `chore:`, `docs:`, etc.
- Detalhes relevantes sobre as mudanças (quando necessário)

## O QUE NÃO INCLUIR:
- ❌ Menções sobre código gerado por IA ou Claude Code
- ❌ Co-autoria com Claude ou qualquer assistente
- ❌ Emojis (a menos que explicitamente solicitado)
- ❌ Rodapés automáticos de ferramentas

## Exemplo de commit CORRETO:
```
feat: Adiciona sistema de autenticação

- Implementa login com email e senha
- Adiciona validação de tokens JWT
- Cria middleware de autenticação
```

## Exemplo de commit INCORRETO:
```
feat: Adiciona sistema de autenticação

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

$ARGUMENTS