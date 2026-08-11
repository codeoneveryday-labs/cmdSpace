# Taste — Code style & implementation

- Never create mocks or sub-agents; reuse/copy logic already handled elsewhere in the codebase instead of reimplementing ("không cần mock! không tạo sub agent!... chỉ cần học copy qua canvas thôi", "đừng tạo agent nữa! tập trung fix thôi"). Confidence: 0.9
- When porting a feature, do not touch the existing working implementation ("đừng động standard! chỉ copy thôi"). Confidence: 0.8
- No hardcoding (e.g., fake search results, magic values); prefers constants consolidated into one file for maintainability ("check code base xem các const có được gom vào 1 file cho dễ maintain không?", "giờ nhìn như bãi rác ạ"). Confidence: 0.8
- Prioritizes smooth, non-laggy UI over RAM savings; accepts controlled extra memory usage ("ưu tiên app không lag, chấp nhận tốn RAM có kiểm soát"). Confidence: 0.8
- Cares deeply about visual polish and micro-UX (border radius, shadows, dashed-border animations, loading indicators, copy/selection feedback) and iterates on them repeatedly. Confidence: 0.7
- Missing CLIs/tools should be auto-installed (and auto-upgraded) rather than requiring manual installs; permission prompts should be skipped where possible. Confidence: 0.7
- When scope is clear, implement directly without previews/mocks; at times explicitly waives redundant tests ("không cần test kiểu đó! chỉ cần fix thôi"). Confidence: 0.6
