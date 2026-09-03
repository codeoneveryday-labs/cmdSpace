# cmdspace-shell-integration (zshrc)
#
# Emits OSC 7 (cwd) + OSC 133 A/B/C/D (prompt-start / prompt-end / pre-exec /
# command-done-with-exit-code) so the host can detect command boundaries and
# track cwd without re-parsing the prompt. `status` is a read-only special in
# zsh, so we shadow $? into `_cmdspace_ret`.

{
  _cmdspace_user_zdotdir="${CMDSPACE_USER_ZDOTDIR:-$HOME}"
  [ -f "$_cmdspace_user_zdotdir/.zshrc" ] && source "$_cmdspace_user_zdotdir/.zshrc"
  unset _cmdspace_user_zdotdir
}

# Re-source guard within a single shell (e.g. user runs `source ~/.zshrc`).
# This is NOT exported, so each nested zsh installs its own hooks — desired,
# since every interactive shell needs its own prompt integration.
if [[ -z "$__CMDSPACE_HOOKS_LOADED" ]]; then
  __CMDSPACE_HOOKS_LOADED=1
  autoload -Uz add-zsh-hook 2>/dev/null

  # URL-encode $PWD byte-wise so multi-byte paths stay valid in the `file://`
  # URI emitted via OSC 7. `no_multibyte` forces ${s[i]} to index bytes (not
  # code points), and LC_ALL=C keeps the [a-zA-Z0-9...] class single-byte.
  _cmdspace_urlencode() {
    emulate -L zsh
    setopt localoptions no_multibyte
    local LC_ALL=C s="$1" i byte
    for (( i=1; i<=${#s}; i++ )); do
      byte="${s[i]}"
      case "$byte" in
        [a-zA-Z0-9/._~-]) printf '%s' "$byte" ;;
        *) printf '%%%02X' "'$byte" ;;
      esac
    done
  }

  _cmdspace_precmd() {
    local _cmdspace_ret=$?
    printf '\e]133;D;%s\e\\' "$_cmdspace_ret"
    printf '\e]7;file://%s%s\e\\' "${HOST}" "$(_cmdspace_urlencode "$PWD")"
    # Re-inject prompt-end marker in case a framework rebuilt PS1 (p10k, starship).
    if [[ "$PS1" != *$'\e]133;B\e\\'* ]]; then
      PS1=$'%{\e]133;B\e\\%}'"$PS1"
    fi
    printf '\e]133;A\e\\'
  }

  _cmdspace_preexec() {
    printf '\e]133;C;%s\e\\' "$1"
  }

  if (( $+functions[add-zsh-hook] )); then
    add-zsh-hook precmd _cmdspace_precmd
    add-zsh-hook preexec _cmdspace_preexec
  fi

  _cmdspace_precmd
fi
:
