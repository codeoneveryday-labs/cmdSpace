# Taste — Workflow

- Uses Conventional Commits; branch names must reference the issue number and never be sloppy ("nhớ conventional nha! không đặt tên nhánh bậy bạ!"). Confidence: 0.9
- Commits and pushes immediately when work is done; dislikes being asked permission for each git step ("commit thì push luôn sao cứ hỏi từng cái má"). Confidence: 0.8
- Leaves generated docs uncommitted for user review before a commit/PR, explicitly offering to commit only if asked ("Các file chưa commit (tôi để bạn review trước). Nếu muốn tôi commit + PR riêng cho đống docs này thì báo nhé" — user did not object and continued directing work). Confidence: 0.5
- Prefers the agent to drive the full loop autonomously — issue → PR → merge → release — and explicitly says not to wait for user confirmation; the task only counts as done once the release is actually out ("cứ merge release là xong task nha! không đợi nha!", "tự merge tự release nhaaaa!", "merge change rồi release luôn ! là done task"). When asked whether to merge or leave a docs PR for self-review, chose "Merge luôn" (PR #86). Confidence: 0.95
- Create issues first for features/fixes before implementing, with a separate issue per change. Confidence: 0.8
- Persists durable rules into markdown docs (AGENTS.md, commit_conventional.md) so future agents follow them; additions must match the existing file structure. Confidence: 1.0
- Requires explicit written permission before any file deletion (even files the agent itself created) or destructive git/fs commands (`git reset --hard`, `git clean -fd`, `rm -rf`); no guessing, safer alternatives first, restate the exact command + affected files, and document the authorization. Confidence: 1.0
- Fixes the current app directly rather than building prototypes or new projects ("không cần! làm trên dự án! tạo issue đi", "mình muốn sửa app hiện tại luôn!"). Confidence: 0.7
- Solicits the agent's own critique of the codebase and recommendations for new markdown docs that would make future work easier; wants suggestions grounded in real pain points from the session, not theory ("bạn thấy cần cải thiện coding chỗ nào không? cần thêm thì recommend mình nên tạo file md nào cho bạn dễ tìm"). Confidence: 0.5
 issue đi", "mình muốn sửa app hiện tại luôn!"). Confidence: 0.7
