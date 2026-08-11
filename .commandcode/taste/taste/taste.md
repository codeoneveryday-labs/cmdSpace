# Taste
- Writes entirely in Vietnamese and expects the agent to communicate back in Vietnamese. Confidence: 0.8
- Dislikes being asked clarifying questions; expects the agent to use available skills/tools to figure things out independently ("đừng hỏi lại! bạn có thể dùng skill nào đó để tự hiểu!"). Confidence: 0.9
- When offered multiple options, prefers the agent to decide and execute the most valuable/best-fitting one instead of asking which to do first ("được làm đi! nào giá trị và phù hợp với dự án mình nhất"). Confidence: 0.8
- Wants a thorough codebase analysis + report before starting long work on a project ("phân tích codebase thật kỹ... bạn hay report sau khi hiểu code base", "học code base và viết một report về dự án và cách bạn hiểu về nó đi mình sẽ làm việc rất nhiều với nó"). Confidence: 1.0
- Explicitly separates analysis/planning phases from implementation ("trả lời trước khi code", "đừng code", "phân tích thôi nha", "trả lời không cần code") and expects direct answers without code when only asking a question. Confidence: 0.8
- Prefers the agent to self-diagnose (run the app, read logs) instead of asking the user to perform manual verification steps ("tự run app tự check log fix đi! mệt quá rồi"). Confidence: 0.7
- When stuck after repeated failed fix attempts, prefers copying the working reference implementation 100% over continued debugging ("học theo nó 100% đi", "thôi làm giống nó luôn đi! mệt quá!"). Confidence: 0.8
- Wants research of best practices / reference solutions before coding ("hãy học trước khi code", "nghiên cứu prompt chuẩn hiệu quả nhất hiện nay đi!"). Confidence: 0.8
- Requests structured read-only code reviews: findings ranked by severity with exact file/line evidence and a readiness assessment. Confidence: 0.8
- The user's explicit instruction overrides all stored rules/guidelines — the user is in charge (RULE 0: fundamental override prerogative). Confidence: 1.0
- Wants the agent to study reference repos' documentation architecture before writing project docs, and keeps asking to dig deeper into those doc patterns (COMPREHENSIVE_PLAN.md, CLAUDE.md, ADR templates, MERGE_BLOCKERS.md, topic-organized docs/ folders) so they can be applied to the project (e.g., eidetic_engine_cli). Confidence: 0.9
ocs/decisions as-is and create a new docs/adr/ instead of migrating. Confidence: 0.7
- Frequently communicates via screenshots: both to report bugs (expecting diagnosis from the image before code) and to show current application/setup state when asking what to do next. Confidence: 0.7
- Develops on macOS (Apple Silicon, 32GB RAM) and is comfortable with resource-heavy local setups such as VMs for cross-platform (e.g., Windows) testing. Confidence: 0.8
