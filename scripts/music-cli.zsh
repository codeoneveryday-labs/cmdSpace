unalias mcli 2>/dev/null
unset -f mcli 2>/dev/null

MUSIC_CLI_STATE_FILE="$HOME/.cmdspace/music-cli.state"
MUSIC_CLI_DATABASE_FILE="$HOME/.cmdspace/music-cli.sqlite"
MUSIC_CLI_RECENT_LIMIT=20

cmdspace_sql_quote() {
  local value="$1"
  value="$(printf "%s" "$value" | sed "s/'/''/g")"
  printf "'%s'" "$value"
}

cmdspace_music_history_init() {
  mkdir -p "${MUSIC_CLI_DATABASE_FILE:h}" || return 1
  sqlite3 "$MUSIC_CLI_DATABASE_FILE" \
    'CREATE TABLE IF NOT EXISTS recent_tracks (
      url TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      selected_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS recent_tracks_selected_at
      ON recent_tracks(selected_at DESC);' >/dev/null
}

cmdspace_music_save_recent() {
  local title="$1" url="$2" quoted_title quoted_url

  command -v sqlite3 >/dev/null 2>&1 || return 0
  cmdspace_music_history_init || return 0
  quoted_title="$(cmdspace_sql_quote "$title")"
  quoted_url="$(cmdspace_sql_quote "$url")"
  sqlite3 "$MUSIC_CLI_DATABASE_FILE" \
    "INSERT INTO recent_tracks (url, title, selected_at)
     VALUES ($quoted_url, $quoted_title,
       CAST((julianday('now') - 2440587.5) * 86400000000 AS INTEGER))
     ON CONFLICT(url) DO UPDATE SET
       title = excluded.title,
       selected_at = excluded.selected_at;" >/dev/null
}

cmdspace_music_recent() {
  local results choice entry title url index

  if ! command -v sqlite3 >/dev/null 2>&1; then
    printf "Recent music requires sqlite3.\n"
    return 127
  fi
  cmdspace_music_history_init || {
    printf "Could not open recent music history.\n"
    return 1
  }

  results="$(sqlite3 -separator $'\t' "$MUSIC_CLI_DATABASE_FILE" \
    "SELECT replace(replace(title, char(10), ' '), char(9), ' '), url
     FROM recent_tracks
     ORDER BY selected_at DESC
     LIMIT $MUSIC_CLI_RECENT_LIMIT;")"
  if [[ -z "$results" ]]; then
    printf "No recently played music yet. Choose a song with mcli first.\n"
    return 0
  fi

  printf "RECENTLY PLAYED\n"
  index=1
  while IFS=$'\t' read -r title url; do
    printf "%d. %s\n" "$index" "$title"
    index=$((index + 1))
  done <<< "$results"

  printf "Choose a number (0 cancels): "
  if ! read -r choice; then
    printf "\nSelection cancelled.\n"
    return 130
  fi
  case "$choice" in
    0|"") return 0 ;;
    <->) ;;
    *) printf "Invalid selection.\n"; return 2 ;;
  esac

  entry="$(printf "%s\n" "$results" | sed -n "${choice}p")"
  if [[ -z "$entry" ]]; then
    printf "Invalid selection.\n"
    return 2
  fi
  IFS=$'\t' read -r title url <<< "$entry"
  cmdspace_music_play "$title" "$url"
}

cmdspace_clear_music_state() {
  local worker_pid="$1" saved_pid

  [[ -r "$MUSIC_CLI_STATE_FILE" ]] || return 0
  IFS=$'\t' read -r saved_pid _ < "$MUSIC_CLI_STATE_FILE"
  [[ "$saved_pid" == "$worker_pid" ]] && rm -f "$MUSIC_CLI_STATE_FILE"
}

cmdspace_music_state() {
  local worker_pid title

  [[ -r "$MUSIC_CLI_STATE_FILE" ]] || return 1
  IFS=$'\t' read -r worker_pid title < "$MUSIC_CLI_STATE_FILE"
  [[ "$worker_pid" == <-> && -n "$title" ]] || return 1

  if ! kill -0 "$worker_pid" 2>/dev/null; then
    cmdspace_clear_music_state "$worker_pid"
    return 1
  fi

  printf '%s\t%s\n' "$worker_pid" "$title"
}

cmdspace_music_status() {
  local state worker_pid title

  state="$(cmdspace_music_state)" || {
    printf "Nothing is playing.\n"
    return 0
  }
  IFS=$'\t' read -r worker_pid title <<< "$state"
  printf "NOW PLAYING: %s\n" "$title"
}

cmdspace_music_stop() {
  local state worker_pid title

  state="$(cmdspace_music_state)" || {
    printf "Nothing is playing.\n"
    return 0
  }
  IFS=$'\t' read -r worker_pid title <<< "$state"
  kill -TERM "$worker_pid" 2>/dev/null || true
  cmdspace_clear_music_state "$worker_pid"
  printf "Stopped: %s\n" "$title"
}

cmdspace_render_player_ui() {
  printf '\n%s\n\n' "$1"
}

cmdspace_music_player() {
  local url="$1" title="$2" parent_pid worker_pid
  shift 2
  local -a cookie_args=("$@")

  cmdspace_music_stop >/dev/null 2>&1 || true
  mkdir -p "${MUSIC_CLI_STATE_FILE:h}" || return 1
  parent_pid="$$"

  (
    local player_pid
    trap 'kill -TERM "$player_pid" 2>/dev/null || true; wait "$player_pid" 2>/dev/null; cmdspace_clear_music_state "$$"; exit 0' HUP INT TERM

    yt-dlp "${cookie_args[@]}" --quiet --no-progress --no-playlist -f ba -o - "$url" 2>/dev/null |
      ffmpeg -nostdin -hide_banner -loglevel error -i pipe:0 -f mp3 pipe:1 2>/dev/null |
      mpg123 --no-control -o coreaudio -q - 2>/dev/null &
    player_pid="$!"

    while kill -0 "$parent_pid" 2>/dev/null && kill -0 "$player_pid" 2>/dev/null; do
      sleep 1
    done

    kill -TERM "$player_pid" 2>/dev/null || true
    wait "$player_pid" 2>/dev/null
    cmdspace_clear_music_state "$$"
  ) &!
  worker_pid="$!"
  printf '%s\t%s\n' "$worker_pid" "$title" > "$MUSIC_CLI_STATE_FILE"
}

cmdspace_music_play() {
  local title="$1" url="$2"
  local -a cookie_args

  if ! command -v ffmpeg >/dev/null 2>&1 || ! command -v mpg123 >/dev/null 2>&1; then
    printf "Music playback requires ffmpeg and mpg123. Install missing tools with: brew install ffmpeg mpg123\n"
    return 127
  fi

  if [[ -d "$HOME/Library/Application Support/Google/Chrome" ]]; then
    cookie_args=(--cookies-from-browser chrome)
  fi

  # A track enters history only after the user explicitly selects it to play.
  cmdspace_music_save_recent "$title" "$url"
  cmdspace_render_player_ui "$title"
  cmdspace_music_player "$url" "$title" "${cookie_args[@]}"
}

cmdspace_mcli() {
  local query="$*" results choice entry title url index search_status attempt relaxed_query
  local -a cookie_args

  case "${1:-}" in
    "status") cmdspace_music_status; return ;;
    "stop") cmdspace_music_stop; return ;;
    "recent") cmdspace_music_recent; return ;;
  esac

  if [[ -z "$query" ]]; then
    printf "Search song or artist: "
    if ! read -r query; then
      printf "\nSearch cancelled.\n"
      return 130
    fi
    if [[ -z "$query" ]]; then
      printf "Search cancelled.\n"
      return 0
    fi
  fi

  # PTY/IME input can leave control bytes or repeated spaces after cancellation.
  query="${query//$'\r'/}"
  query="${query//$'\n'/ }"
  query="${query//$'\t'/ }"
  query="${(j: :)${(s: :)query}}"

  if ! command -v yt-dlp >/dev/null 2>&1; then
    printf "yt-dlp is required. Install it with: brew install yt-dlp\n"
    return 127
  fi

  # Use the signed-in browser session for consistent YouTube search results.
  if [[ -d "$HOME/Library/Application Support/Google/Chrome" ]]; then
    cookie_args=(--cookies-from-browser chrome)
  fi

  for attempt in 1 2; do
    results="$(yt-dlp "${cookie_args[@]}" --flat-playlist --no-warnings --no-playlist --extractor-retries 2 --retries 2 --socket-timeout 15 --print '%(title)s::CMDSPACE_URL::%(webpage_url)s' "ytsearch10:$query")"
    search_status="$?"
    [[ -n "$results" ]] && break
    [[ "$attempt" -eq 1 ]] && sleep 1
  done

  # Retry without browser cookies when YouTube returns an empty catalog.
  if [[ -z "$results" && ${#cookie_args[@]} -gt 0 ]]; then
    results="$(yt-dlp --flat-playlist --no-warnings --no-playlist --extractor-retries 2 --retries 2 --socket-timeout 15 --print '%(title)s::CMDSPACE_URL::%(webpage_url)s' "ytsearch10:$query")"
    search_status="$?"
  fi

  # Long queries can be over-constrained by YouTube's search endpoint.
  if [[ -z "$results" && "$query" == *" "* ]]; then
    for relaxed_query in "${query#* }" "${query% *}"; do
      [[ -n "$relaxed_query" && "$relaxed_query" != "$query" ]] || continue
      results="$(yt-dlp --flat-playlist --no-warnings --no-playlist --extractor-retries 2 --retries 2 --socket-timeout 15 --print '%(title)s::CMDSPACE_URL::%(webpage_url)s' "ytsearch10:$relaxed_query")"
      search_status="$?"
      [[ -n "$results" ]] && {
        printf "No exact match. Showing close matches.\n"
        break
      }
    done
  fi

  if [[ "$search_status" -ne 0 && -z "$results" ]]; then
    printf "Search failed. Please try again.\n"
    return "$search_status"
  fi

  if [[ -z "$results" ]]; then
    printf "No results found.\n"
    return 1
  fi

  index=1
  while IFS= read -r entry; do
    title="${entry%%::CMDSPACE_URL::*}"
    printf "%d. %s\n" "$index" "$title"
    index=$((index + 1))
  done <<< "$results"

  printf "Choose a number (0 cancels): "
  if ! read -r choice; then
    printf "\nSelection cancelled.\n"
    return 130
  fi
  case "$choice" in
    0|"") return 0 ;;
    <->) ;;
    *) printf "Invalid selection.\n"; return 2 ;;
  esac

  entry="$(printf "%s\n" "$results" | sed -n "${choice}p")"
  if [[ -z "$entry" ]]; then
    printf "Invalid selection.\n"
    return 2
  fi

  url="${entry#*::CMDSPACE_URL::}"
  title="${entry%%::CMDSPACE_URL::*}"
  cmdspace_music_play "$title" "$url"
}

mcli() {
  cmdspace_mcli "$@"
}
# Remove the one-line source command that initialized this Music tab.
printf "\033[1A\033[2K\rMusic CLI ready. Type: mcli <song or artist>\n\nVIBECODE PICKS\n  Lo-fi focus:      mcli \"Lofi Girl beats to relax study to\"\n  Synthwave flow:   mcli \"synthwave mix coding\"\n  Deep work:        mcli \"deep focus electronic music coding\"\n\nCONTROLS\n  Now playing:      mcli status\n  Recently played:  mcli recent\n  Stop playback:    mcli stop\n\n"
