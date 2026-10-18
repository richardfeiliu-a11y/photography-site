# Stage 2B1 — Red Team / Adversarial Architecture Review

审查人角色：独立架构审稿人（Red Team）。
审查范围：`stage2b/` 全部 8 个文件，交叉核对 `STAGE_2_EVIDENCE_SYNTHESIS.md` 与 `STAGE_2_EVIDENCE_LEDGER.md`。
约束：未进行新的 Web Research；不重新设计网站；只审查、定位问题、给出最小修改。

---

## 1. Executive Verdict

**Stage 2B1 总体可信，质量高于典型的阶段性产出。** 它做对了几件很难的事：诚实地标注证据边界（Place page 明确写 "evidence does not establish superiority"）、拒绝了固定数量阈值、把 Discovery 和 Viewing 分开决策、为每个决定记录了可逆性估计。

**值得进入 B2，但应先做一次小范围 Revision（Final Gate: B）。** 需要的不是重构，而是 3 处必须修改的状态澄清。这些修改都是一两段文字级别的工作，但如果不修，会直接污染 B2 的原型规格。

**最大 3 个风险：**

1. **Overview 的 MVP 状态自相矛盾。** `MVP_SCOPE` 和 `SUMMARY` 把它写成已确认 MVP 能力，`PROTOTYPE_TEST_PLAN` Test 3 却把它的去留交给测试结果。B2 若按前者做规格，Test 3 变成无效测试；若按后者做，MVP 边界文档失效。这是当前唯一会同时破坏 scope 定义与原型有效性的问题。
2. **两处模型承诺缺少被演练的需求：Photo reuse 和 Visit 的 "completely remove" 措辞。** 前者以 `Reversible: Expensive` 锁定了一个没有任何场景使用的能力（过早抽象）；后者从证据的 "Unresolved" 跳到"完全删除"，且措辞强于模型实际行为。
3. **伪精确阈值回潮。** Stage 2A 明确反对未经用户测试的硬阈值，但 `INFORMATION_ARCHITECTURE` 的 "300+ Galleries: add Search" 和 MVP_SCOPE 的 "by ~300 Galleries" 读起来像自动触发器，与 `MVP_SCOPE` 自己写的行为触发条件并存且不一致。

---

## 2. Critical Issues

### C1 — Overview 同时处于 "MVP 已确认" 和 "prototype-gated" 两种状态

**Issue:** 同一能力在 4 个文件中有两种互斥状态。

**Why it matters:** B2 的任务是产出原型规格。如果 Overview 是已确认 MVP，Test 3 只需测交互呈现；如果 Test 3 决定其去留，则 `MVP_SCOPE` 的 ✓ 是错的。两种状态并存意味着 B2 作者必然按其中一种理解执行，而另一种理解会在后续阶段被推翻——这正是返工的典型来源。

**Evidence boundary:** Stage 2A 对双模式的判断是 "双模式有成熟先例，但不构成每个 Gallery 必须双模式的最佳实践"（H10，Medium–High feasibility，无 superiority）。证据不支持"已确认"，只支持"有理由默认尝试"。

**Suggested minimal correction:** 统一为 **"Recommended default, prototype-gated"**。具体：`MVP_SCOPE` 表格中 Overview 一行从 `✓` 改为 `MVP default — gated by Test 3`；`STAGE_2B1_SUMMARY` 同步；`PRODUCT_DIRECTION` snapshot 已是 "Recommended default; prototype validation required"，无需改动；Test 3 的 decision rule 保持现状。

**Severity:** Critical
**Confidence:** High（文本冲突可直接核对）

---

### C2 — Homepage "latest" 规则在回填场景下未被裁决，"latest or deliberately selected" 语义模糊

**Issue:** 三个文件对首页第一项的定义互相叠加却不闭合：
- `CONTENT_MODEL`：date added/published 驱动 Home latest 排序；并明确写 "Backfilling a 2019 Gallery in 2026 … allowing it to appear among the latest additions on Home"。
- `INFORMATION_ARCHITECTURE`：首页优先 "one latest **or deliberately selected** Gallery"。
- `DECISION_LOG` D01：one **latest/selected** Gallery visually primary。

按现行规则，回填的 2019 Gallery 会成为首页第一项。这个后果被写下了，但没有被裁决为"可接受"还是"需要规避"。"or deliberately selected" 暗示存在人工干预机制，但没有任何文件定义该机制（谁选择、以什么状态、如何覆盖、是否显示）。

**Why it matters:** Test 1 的原型必须知道首页展示什么。如果作者按 "date added" 规格化原型，而摄影者实际预期是"首页永远是我最近拍的东西"，测试结果验证的是一个错误的默认。这是 IA 行为缺口，不是措辞问题。

**Evidence boundary:** Stage 2A 只证明 capture date 与 publish date 会分离（Germán、Daniel，Medium），没有证据证明首页应如何处理回填。此处无证据可依，纯属需要显式裁决的产品决定。

**Suggested minimal correction:** 二选一并写明：
- (a) 默认按 date added/published 降序，且接受回填占据首页；或
- (b) 同 (a)，但增加一个可选的、`Reversible: Easy` 的人工 featured/pin 覆盖状态。
推荐 (b)：成本极低（一个布尔状态），直接消除回填尴尬，且不需要改变任何排序逻辑。无论选哪个，删掉 "or deliberately selected" 这种悬空措辞。

**Severity:** Critical
**Confidence:** High

---

### C3 — Photo reuse（D13）作为 MVP 核心模型承诺，但没有任何场景演练它

**Issue:** `CONTENT_MODEL` 规定 "A Photo may appear in more than one Gallery"，`DECISION_LOG` D13 标注 `Reversible: Expensive`。然而：
- 场景验证 A–E 没有一个需要跨 Gallery 复用同一张照片（场景 C 的跨年合并是一个 Gallery 内保留多张照片各自的日期，不是复用）。
- `MVP_SCOPE` 没有任何 UI 能力依赖复用。
- 复用立刻引入真实的语义问题：caption ownership（文件承认需要 per-membership caption override）、cover 语义、被删除 Gallery 中照片的归属。

**Why it matters:** 这是典型的"可行性证据 → 模型承诺"跳跃。Stage 2A 确实有"同一照片日后进入另一作品"的证据，但那支持的是"未来允许"，不是"第一天锁定"。以 `Expensive` 的可逆性成本在 MVP 模型里锁定一个零演练的能力，等于把最贵的决定花在了最没有需求的地方。

**Evidence boundary:** 证据支持 reuse 在长期档案中会发生（feasibility）；证据不支持它是 MVP 需求。

**Suggested minimal correction:** D13 降级为：**"Reuse is allowed later, not an MVP requirement. MVP operates as if each Photo belongs to one Gallery; the stable Photo identity is preserved so reuse can be introduced without asset duplication when a concrete case appears."** 同时在 `CONTENT_MODEL` Photo 一节加上这句。这保留了未来能力（用户问题中要求的"不要立刻做实体、保留日后添加能力"的镜像处理），但移除了 MVP 的模型负担。

**Severity:** Critical（因为它进入核心 content model 且可逆性昂贵）
**Confidence:** Medium-High（若作者已有未写出的复用内容计划，此条可降级为 Important，但前提是补上具体场景）

---

## 3. Important Issues

### I1 — Visit 从 "Unresolved" 跳到 "Completely remove"，措辞超出模型实际行为

**Issue:** Stage 2A 的准确结论是两条：公开 Visit 层不必要（High against necessity）；**内部 metadata 保留与否 Unresolved（Low）**，且账本第 13 节明确写"不应该因为两组没有公开 Visit precedent 就删除内部 visit/trip/shoot metadata"。`CONTENT_MODEL` 写成 "Completely remove as an MVP product entity"，D06 写成 "neither public nor internal product entity"。

但同一文件实际上保留了后台价值载体：Photo 的 exact capture date/time（hidden but stored）、archive batch 作为 operational ingestion unit、EXIF 自动保留。也就是说模型行为是"不建模为实体、保留底层数据"，而文字说的是"完全删除"。

**Why it matters:** (1) 这是对证据边界的越界：从"未决"到"删除"需要产品理由，D06 给出的 YAGNI 理由成立，但结论措辞过度。(2) 实操风险：如果导入流程不保留任何拍摄会话的分组线索（哪怕只是导入批次时间戳），未来重建 trip/shoot 只能靠日期+启发式猜测；一旦原始文件组织被扁平化，这部分上下文不可恢复。

**Evidence boundary:** 公开层删除有强证据支持；内部层删除无证据支持，Stage 2A 显式反对由前端证据判处内部数据死刑。

**Suggested minimal correction:** 改写为：**"Visit is not modeled in MVP—no entity, fields, or UI. Capture date/time and import-batch context are preserved at data level. If a future ingestion/provenance workflow needs a trip/shoot record, it is introduced by a new decision."** 即用户建议的 "Do not model now, preserve ability to add later"。这与模型实际行为一致，且不需要新增任何实体。

**Severity:** Important
**Confidence:** High

---

### I2 — Search 数字阈值部分位置读起来像自动触发器

**Issue:** `MVP_SCOPE` Later triggers 同时包含行为条件（"Representative users cannot reliably retrieve a known Gallery"）和数字条件（"or the archive approaches Large scale (~300 Galleries)"）；`INFORMATION_ARCHITECTURE` 直接写 "300+ Galleries: add Search as a secondary retrieval tool"、"100+ Galleries: … add pagination"，无条件从句。

**Why it matters:** Stage 2A 的核心教训之一就是"不应该从没有用户测试的案例数推导硬阈值"。80/300 作为 **review checkpoint** 是合理的（给维护者一个"该回头看看了"的信号），作为 **automatic trigger** 则重演了 10–40 张规则的错误。两个文件目前给出了两种解读。

**Suggested minimal correction:** 统一为：行为触发条件是唯一的正式规则（"当代表性用户无法在合理路径内找回已知 Gallery 时"）；80/300 明确标注为 **review checkpoints, not automatic triggers**。改动量：两处各一句话。

**Severity:** Important
**Confidence:** High

---

### I3 — Place page 的 year grouping 在低数量时是无意义结构，IA 未定义低量行为

**Issue:** IA 把 "Galleries grouped by photographed year" 写成 Place page 的固定结构，并给出 Paris 3 个年份各 1–2 张卡的示例。但 MVP 起点是约 5 个 Place，单个 Place 通常只有 1–3 个 Gallery——此时每个年份标题下挂一张卡，结构只增加视觉噪声。Test 2 恰好会测 3/8/20 三档，但 IA 文本没有把低量行为交给测试。

**Why it matters:** 这是"可以推迟的复杂度"的典型案例：年份分组在 8+ Gallery 之前几乎没有方向收益。D05 `Reversible: Easy` 说得对，但 IA 应在 B2 之前就写明低量默认行为，否则原型会按满结构规格化。

**Suggested minimal correction:** IA Place page 一节加一句：**"At low volume (e.g., fewer than ~5 Galleries per Place) the page defaults to a flat reverse-chronological card list; year grouping appears when it earns its place—Test 2 decides the threshold behavior."** 注意：这里保留 80/300 同类教训——数字只作参考，行为判断优先。

**Severity:** Important
**Confidence:** Medium-High

---

### I4 — Test 4 变量混杂：方向混排 + caption + 结尾续看 + overview 负控制被捆在一个测试里

**Issue:** Test 4 Variant A 同时包含竖排序列、混合方向、可选 caption、结尾 continuation；Variant C（无 overview 无 continuation 的负控制）与 Test 3 的 Variable B 重叠。若 Variant A 胜出，无法区分贡献来自序列本身、结尾设计还是 caption 处理。

**Why it matters:** 混杂变量的测试能给出"整体行/不行"，不能告诉 B2 该保留哪个零件。Test 4 的 success criteria（overflow、方向可读、结尾识别、Back 行为）其实全部只依赖"竖排 + 结尾设计"两个因素。

**Suggested minimal correction:** 保持 Test 4 的 Variant A vs B（竖排 vs swipe-first）主对比不变，但明确：caption 与 overview 在 Test 4 中固定为常量（按 Test 3 结果或默认值），不作为被测试变量；Variant C 删除或标注"仅用于验证测试装置有效性，不参与结论"。

**Severity:** Important
**Confidence:** Medium-High

---

### I5 — 长 Gallery 的 mobile 内存/疲劳风险无法被轻量原型验证，测试计划未约束内容量

**Issue:** Stage 2A 的 mobile 证据等级是 Low（静态截图，交互未测）。Stage 2B1 正确地把它交给 Test 3/4，但没有规定原型必须使用**真实量级**的内容（例如一个 60–100 张、横竖混合的 Gallery）。如果原型只用 10 张图，那么浏览器内存、滚动疲劳、滚动恢复这些被点名的风险根本没有进入测试。

**Why it matters:** 这是"必须 prototype 的决定"清单里风险最高的一项，而当前测试设计允许用无法暴露问题的素材完成测试。

**Suggested minimal correction:** `PROTOTYPE_TEST_PLAN` Test 3/4 各加一行内容规格：**"Prototype must include at least one Gallery at realistic length (≥50 mixed-orientation photos) with real file weights; short-Gallery fixtures are not acceptance evidence for fatigue/memory claims."**

**Severity:** Important
**Confidence:** High

---

## 4. Minor Issues

- **M1 — Photo count 在 Gallery context 内是可疑的。** 在 Archive/Place 卡片上，count 有 Stage 1 的重复观察支持（Research B 反复出现），保留。但在 Gallery 观看语境里它主要是"还剩多少"的进度信号，价值弱、且偏向数据库感。建议 `MVP_SCOPE` 把 count 从 "Always visible" 收窄为：卡片必现，Gallery 内 contextual（可并入 overview）。
- **M2 — `/archive/{year}` 在 Small 规模无必要。** IA 已标 "Optional semantic year view"，无问题；仅提醒 B2 不要在 15 Gallery 时就构建它。
- **M3 — Gallery 定义略有循环。** "intends to be viewed together" 依赖意图本身。不建议加数量规则（证据明确反对），可选最小改进：加一个操作性编辑测试，例如"能给出标题、顺序有意义、能说出它何时结束"，作为发布前的自检问题。
- **M4 — canonical URL 结构没有 Decision Log 条目。** `/galleries/{slug}` 及全站 URL 方案是 `Expensive` 级别的不可逆决定，散落在 IA 的表格中，却没有对应的决策记录与可逆性标注。建议补一条 D14。
- **M5 — IA 与 MVP_SCOPE 的 pagination 触发不一致。** IA 写 "100+ Galleries: … add pagination"（数字触发），MVP_SCOPE 写 "becomes materially long"（行为触发）。按 I2 的方式统一。
- **M6 — `PRODUCT_DIRECTION` snapshot 的 Visit 行（"No Visit entity in MVP"）与 `CONTENT_MODEL` 的 "Completely remove" 措辞不一致。** 按 I1 统一后自然消除。
- **M7 — Places index 字段偏装饰。** 在 5 个 Place 的规模下，"representative cover, Gallery count, photographed year span" 中 count 与 year span 的信息价值接近零。不是错误，只是 B2 可以砍掉首批实现的字段。

---

## 5. Internal Contradictions

逐文件交叉核对结果（不只看 Summary）：

| # | 冲突 | 涉及文件 | 性质 |
|---|---|---|---|
| 1 | Overview：`✓ MVP`（MVP_SCOPE L19；SUMMARY L34/L52 "Gallery sequence + overview" 为 MVP 组成） vs "Keep overview in MVP **only if** it materially improves orientation"（TEST_PLAN Test 3 decision rule；D07 prototype needed: Yes） | MVP_SCOPE / SUMMARY vs TEST_PLAN / DECISION_LOG / PRODUCT_DIRECTION | **MVP 状态与 Prototype 状态直接冲突**。按 C1 修正。 |
| 2 | Test 4 Variant C（"no overview … negative control"）预设 overview 可被拿走，与 MVP_SCOPE 的 `✓` 不一致 | TEST_PLAN vs MVP_SCOPE | 冲突 1 的衍生症状。 |
| 3 | Visit：CONTENT_MODEL "Completely remove" / D06 "neither public nor internal" vs CONTENT_MODEL 自身保留 capture date/time、archive batch、EXIF | CONTENT_MODEL 内部 + 与 Stage 2A ledger 第 13 节 | 措辞强于模型行为；按 I1 修正。 |
| 4 | Search/pagination 触发：IA "100+/300+ Galleries: add…"（数字触发） vs MVP_SCOPE Later triggers（行为触发） | IA vs MVP_SCOPE | 同一能力的两套触发语义。 |
| 5 | Home："ordered by date added/published"（IA L80、CONTENT_MODEL） vs "latest **or deliberately selected**"（IA L56、D01 "latest/selected"） | IA / CONTENT_MODEL / DECISION_LOG | 悬空的 "selected" 无定义机制。按 C2 修正。 |
| 6 | PRODUCT_DIRECTION snapshot Visit 行 "No Visit entity in MVP" vs CONTENT_MODEL "Completely remove" | PRODUCT_DIRECTION vs CONTENT_MODEL | 措辞强度不一致，随 I1 消除。 |

未发现 IA 与 Content Model 在实体关系层面的矛盾（many-to-many、canonical URL、双日期模型在各文件中表述一致）。

---

## 6. Evidence-to-Decision Leaps

| Decision | Evidence actually supports | Stage 2B1 claims | Problem? | Correction |
|---|---|---|---|---|
| Latest-first Home | 图像主导首页常见（Medium）；latest vs archive 优先未决 | 产品决定，Confidence Medium，标注需 Test 1 | 无——标注诚实 | 仅需修 C2 的 latest 规则 |
| Archive = Chronology | Chronology 长期扩展性 High（可行性） | 产品决定，High confidence | 无——这是合理的项目选择 | 保持 |
| Place metadata | High | Yes（Layer A） | 无 | 保持 |
| Persistent Place entity | Medium feasibility；"是否需要取决于去重、别名和聚合需求" | Yes（Layer B） | 轻微——但被 Layer C/D（有 URL 的页面）事实上蕴含 | 保持，注明它由 C/D 派生 |
| Places 顶级导航 | Medium、类别依赖（"一般 personal archive 更适合 secondary/facet"） | 顶级导航，Confidence Medium | 中等跳跃 | 可接受（项目长期目标明确）；维持 Medium 标注即可 |
| Place page + year grouping | 直接 precedent Low（H7；账本 §13 明示不应据此确定 Place page 形态） | Yes，明确写 "evidence does not establish superiority, project-specific choice" | 无越界——标注是全套文件中最诚实的 | 保持；补 I3 低量行为 |
| Visit 完全删除 | 公开层不必要（High）；内部层 Unresolved | "Completely remove / neither public nor internal" | **是**——从 Unresolved 跳到删除 | 按 I1 改写 |
| Overview 进 MVP | 双模式 feasibility Medium–High，无 superiority | MVP `✓` + 需原型 | **是**——可行性被写成已确认 | 按 C1 改为 gated |
| Photo reuse | 长期档案中复用会发生（feasibility） | MVP 核心模型，Reversible: Expensive | **是**——无演练需求的模型锁定 | 按 C3 降级为 allowed later |
| Search ~80/~300 | Stage 2A：仅有单个 Interesting precedent；明确反对硬阈值 | 部分文本写成数字触发 | **是**——违背自家证据原则 | 按 I2 改为 checkpoint |
| Photo count 可见 | Research B 反复观察（title/date/place/count） | Always visible | 卡片上无问题；Gallery 内存疑 | 按 M1 收窄 |

---

## 7. Complexity Audit

| Element | User value | Complexity | MVP necessary? | Recommendation |
|---|---|---|---|---|
| Place metadata | 高（核心上下文） | 极低 | 是 | 保持 |
| Persistent Place entity | 中（由 Place 页面蕴含） | 低 | 是（若 Place 页面存在） | 保持 |
| Place landing page | 大规模中高；小规模低 | 低–中 | 边缘 | 保留但按 I3 简化低量形态；**Candidate for simplification**（砍装饰字段） |
| Places index 装饰字段（cover/count/year span） | 低 | 低 | 否 | **Candidate for simplification**：B2 首批可只做名称列表 |
| Overview | 未证实（待测） | 中（第二模式 + 跳转 + 滚动恢复） | 未定 | Prototype-gated（C1）；不通过即删 |
| Search | 大规模有价值 | 中 | 否（Later） | 保持 Later；改行为触发（I2） |
| Photo reuse | 当前为 0（无场景） | 中（成员语义、caption 归属） | **否** | **Candidate for simplification**：defer（C3） |
| Social links | 低–中 | 极低 | 是（成本≈0） | 保持；不值得争论 |
| Contact | 中（唯一联系路径） | 极低 | 是 | 保持 |
| Photo count | 卡片上中；观看内低 | 极低 | 卡片部分是 | 卡片保持；Gallery 内转 contextual（M1） |

"删掉它核心产品会不会坏"测试：删掉 Place 页面/Overview/Photo reuse/Social 均不破坏核心（观看一个被编辑过的 Gallery + 按时间找回）。但 Place 页面直接解决 repeated-place discovery 这一明确长期目标，复杂度也低，因此**不建议删除，只建议简化低量形态**——这正是"不为极简而极简"的边界。

---

## 8. Content Model Review

### Gallery — **Keep**
定义在证据支持的核心单元之上，场景验证 A–E 覆盖了 travel / repeated place / 跨年合并，双日期、cover、顺序等必要特征完整。唯一可选改进是操作性编辑自检（M3），不需要结构性改动。

### Place — **Keep（entity + metadata）/ Clarify（page 行为）**
四层拆分是这套文件最好的结构决策之一。Layer A/B 证据充分；Layer C/D 是合理的项目选择且标注诚实。需要澄清的只是低量页面行为（I3）和 index 装饰字段（M7）。

### Photo — **Simplify**
Photo 作为稳定图像对象的定义没问题；需要简化的是复用承诺（C3）：MVP 按单 Gallery 归属运作，保留稳定身份以便日后开放复用。

### Visit removal — **Clarify**
方向正确（不建模、不做公开层），措辞越界（I1）。改为 "not modeled now, preserve data-level context and the ability to add later"。不建议现在建实体，也不建议现在关死门。

### Project/Series omission — **Defer（同意现状）**
长期跨年工作已由"一个 Gallery + 日期区间 + ongoing 状态"承接（场景 C），`MVP_SCOPE` 也已定义 Project/Series 的行为触发条件。在出现真实的"多个子 Gallery 需要稳定父级"内容之前，不新增实体是正确的。Gallery 被迫同时承载小 Gallery 与长期 Project 的语义压力目前可控——两者的观看契约（标题、顺序、结尾）相同。

---

## 9. Prototype Plan Review

### Test 1 — Latest-first vs Archive-first：**Modify（小改）**
B1 已决定 Latest-first（D01），该测试的正确定位是**验证既定默认**而非重开产品方向。计划前言（"begins with the recommended default … not reopen the whole IA"）和 decision rule（"Keep Variant A unless…"）已经是这个定位，值得肯定。小改：Success criteria 第 1 条（产品身份描述）对 A/B 的区分度有限（两种首页都可能被描述为摄影站），建议把权重移到第 2、3 条（能否无指引开始最新 Gallery、能否到达完整 Archive），并明确"本测试验证 D01，不重新招标首页方向"。

### Test 2 — Repeated Place page：**Keep as-is**
三档内容量（3/8/20）、明确的误解检测（不得把年份组推断为 trip/Visit）、合理的 decision rule。这是四个测试里设计最干净的一个。配合 I3，把"低量默认扁平"交给它的结果即可。

### Test 3 — Sequence + Overview vs Sequence-only：**Modify**
问题不在测试本身而在它前置的状态冲突（C1）。修正 C1 后，本测试成为 Overview 进入 MVP 的正式闸门，decision rule 已写好，无需再改。若拒绝修正 C1，本测试与 MVP_SCOPE 互相作废。

### Test 4 — Mobile 混排 + 结尾：**Modify**
按 I4 解除变量混杂（caption/overview 固定为常量，Variant C 移出结论路径），按 I5 加入真实内容量规格。主对比（竖排 vs swipe-first）本身是对的：Stage 1 mobile 证据为 Low，竖排在移动端的长序列表现确实必须实测，不能宣称已验证。

---

## 10. Decisions I Agree With

以下决定证据充分、逻辑自洽、不值得重新打开：

1. **D02 Gallery 作为核心单元**（High 双边证据；拒绝固定数量规则正确）。
2. **D03 Archive = Chronology**（是简化而非强行合并；Archive 本来就是时间索引，Search 未来也作为工具加入而非替代结构）。
3. **D09 双日期模型**（回填场景被 Stage 1 直接观察到；分离拍摄时间与发布时间是唯一能同时保住"历史真实"与"编辑新近"的方案）。
4. **D10 导航预算**（四个稳定目的地；Gallery 不进顶级导航正确）。
5. **D11 最小 About**（可行性 High；个人档案语境下合理）。
6. **D12 Search Later / Map、Tags、Facets Not planned**（方向正确；证据对个人站适用性 Low；标签的 facet explosion 有直接反例）。
7. **D04 Layer A Place metadata**（High 证据）。
8. **Visit 不公开**（High against necessity；本审查只反对措辞，不反对决定）。
9. **模型不变式 1（单一 canonical URL）** 与 "one object, multiple discovery paths"。
10. **Place page year grouping 的诚实标注**（"evidence does not establish superiority / project-specific choice"）——产品 rationale（解决长期重复地点发现）足以弥补 precedent 不足，处理方式是全卷范本。
11. **Mobile 作为约束先行声明、验证留给原型**（"static screenshots are not acceptance evidence" 一句尤其正确）。
12. **双日期之外的内容模型关系**（Place↔Gallery many-to-many 有真实场景 E 支撑；多地点 Gallery 出现在各 Place 页但保持单一 URL，可接受）。

---

## 11. Recommended Corrections

### Must change before B2

1. **C1**：统一 Overview 状态为 "Recommended default, prototype-gated by Test 3"（改 `MVP_SCOPE` 与 `SUMMARY` 各一处）。
2. **C2**：写明首页规则——默认 date added/published 降序 + 可选人工 featured 覆盖（或明确接受回填占据首页）；删除 "or deliberately selected" 悬空措辞。
3. **C3**：D13 降级为 "Reuse allowed later, not an MVP requirement"；`CONTENT_MODEL` 同步。

### Should change before B2

4. **I1**：Visit 措辞改为 "not modeled now; preserve capture-level data; add later by new decision"。
5. **I2**：Search/pagination 数字统一为 review checkpoint，行为条件为唯一正式触发。
6. **I3**：IA 增加 Place page 低量默认行为（扁平倒序）。
7. **I4 + I5**：Test 4 解混杂；Test 3/4 增加真实内容量规格。

### Can defer

8. M1 photo count 在 Gallery 内转 contextual。
9. M3 Gallery 定义的操作性自检问题。
10. M4 为 URL 结构补 Decision Log 条目。
11. M7 Places index 首批实现砍装饰字段。

---

## 12. Final Gate

> ### B — Revise Stage 2B1 first, then proceed

理由：存在 3 个 Critical 问题，但全部属于**状态澄清与措辞修正**，不涉及架构重做。Overview 冲突若带入 B2 会使原型测试失效，Home 规则缺口会污染原型规格，两者都必须在 B2 之前关闭。修正工作量估计为半天以内的文档编辑。修正完成后，Stage 2B1 的架构质量足以支撑原型阶段。

不选 A：Critical 1 与 Critical 2 会直接传导进 B2 产出。
不选 C：无系统性问题——实体划分、日期模型、导航预算、证据纪律均成立，问题集中在少数状态标注与两处模型承诺上。

---

## 附：验收自查

- [x] 已读取全部 8 个 Stage 2B1 文件
- [x] 已读取 Stage 2A synthesis + ledger
- [x] 没有联网
- [x] 没有重做完整设计（无 "My preferred IA"，所有建议为最小修正）
- [x] 已检查 MVP vs Prototype 冲突（Critical 1，另见冲突表 #1/#2）
- [x] 已检查 Visit 删除是否过度（Important 1）
- [x] 已检查 Photo reuse 是否必要（Critical 3）
- [x] 已检查 Place page 是否过早复杂（Important 3 + 复杂度审计）
- [x] 已检查 Search 数字阈值（Important 2）
- [x] 已检查 Latest vs Selected（Critical 2）
- [x] 已检查 Mobile evidence boundary（Important 5 + 第 10 节 #11）
- [x] 已明确哪些决定无需重开（第 10 节，12 项）
- [x] 已给出 Final Gate（B）
