# cmdspace-shell-integration (zprofile)
#
# See zshenv.zsh for the rationale on the trailing `:`.
{
  _cmdspace_user_zdotdir="${CMDSPACE_USER_ZDOTDIR:-$HOME}"
  [ -f "$_cmdspace_user_zdotdir/.zprofile" ] && source "$_cmdspace_user_zdotdir/.zprofile"
  unset _cmdspace_user_zdotdir
}
:
