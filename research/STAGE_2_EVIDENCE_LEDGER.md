# Stage 2A — Detailed Evidence Ledger

## 1. Scope and method

本账本把两套 Stage 1 当作两个独立研究团队：

- **Research A / Deep report**：[`deep-research-reportfromgpt5.6solhigh.md`](./deep-research-reportfromgpt5.6solhigh.md)，29 个案例；约 13 个 personal archive / diary、10 个 artist/project、6 个 institution/community。
- **Research B / Ox Alpha corpus**：[`CASE_INDEX.md`](./CASE_INDEX.md)、[`PATTERN_NOTES.md`](./PATTERN_NOTES.md)、[`ANTI_PATTERNS.md`](./ANTI_PATTERNS.md)、[`GAPS.md`](./GAPS.md)、[`STAGE_1_SUMMARY.md`](./STAGE_1_SUMMARY.md)、[`cases/`](./cases/) 与 [`screenshots/`](./screenshots/)，30 个案例；最新状态为 43 PNG，38 个有效 render，覆盖 17 个站点。

没有重新联网搜索。综合过程为：观察事实对齐 → 案例与类别覆盖 → agreement / conflict → 证据强度 → bias 折扣 → 设计含义边界。研究者的 UX/IA 推断不当作网页事实。

### Evidence strength rubric

| 等级 | 本账本采用的含义 |
|---|---|
| **High** | A、B 各自有多个合适类别的真实案例，独立复现同一模式；或两边共同提供强直接反证。 |
| **Medium** | 只有一组有多个直接案例；或两组收敛但关键证据来自不同类别、适用范围需折扣。 |
| **Low** | 单案例、间接证据、未验证交互、研究者 interpretation，或证据只证明 feasibility。单案例一律称 **Interesting precedent**。 |

“没有找到”只支持“不能宣称为成熟惯例”，不自动证明内部数据模型不该存在。

## 2. Coverage comparison

| 研究面向 | Research A | Research B | 综合评价 |
|---|---|---|---|
| Personal archive / visual diary | 多个长期 diary、year-first、place-first、daily 项目 | Haarkon、Jatenk、Folker、Terragalleria、Logbuch、Yoshimoto、James Maher 等 | 双边覆盖；A 更强调 visual diary，B 更强调可抓取的个人 archive。 |
| Artist project / authored work | Rinko、Alec、Simon Roberts、Furuya、Vanessa、Mark Power 等 | Rinko、Alec、Meyerowitz、Todd Hido、Sternfeld、Kereszi 等 | 双边强；会放大 famous-photographer / project-first 模式。 |
| Institution / community | Photogrammar、ICP、Tokyo、PhotoHouse、Fortepan 等 | ICP、Magnum、LOC、Tuchong、Fengniao 等 | 足以证明规模与能力，不足以证明个人站应复制复杂度。 |
| Chronology | Year/month/day、时间桶、timeline 多种 | Year archive、era bucket、reverse chronology | 双边多案例。 |
| Places / repeated place | Permanent Place、facet、project absorption | Deep hierarchy、tag、sibling cards、merge/split 混合 | 双边多案例；没有统一 repeated-place 规则。 |
| Gallery / viewer | Sequence、light table、slideshow、contact sheet、object viewer | Gallery/Index、slideshow、thumbnail strip、vertical post | 可证明多种模式可行；交互质量缺少统一实测。 |
| Mobile | 大多 Unknown | 有静态 mobile captures，但交互未测；部分捕获显示裁切/错误 | 只能判断部分布局呈现，不能判断 swipe、keyboard fallback、性能与完成路径。 |
| Map / search | 地图强证据集中于十万级 archive | 个人 map-primary 未找到；一个 per-post OSM、一个 search-first archive | Map 对本项目 Low；search 是 Interesting precedent / 后期规模选项。 |
| Anti-pattern | 单轴 silo、facet overload、metadata overload、map/data-first | commerce-first、长 nav、JS-only、desktop-only、maintenance blank | 双边互补且方向一致。 |
| Cultural coverage | 欧洲/北美占主，含日本、中文站和东京机构 | 欧洲/北美占主；中国主要是社区平台，日本个人案例有限 | Western web bias 仍显著。 |

## 3. Exact website overlap

两套研究共同选中 **4 个网站/机构**。共同选择本身提高可信度，但只有当双方观察的是同一子系统时才算事实复现。

| Overlap | 两边为何选择 | Findings overlap | Differences / additional evidence | Interpretation check |
|---|---|---|---|---|
| **Alec Soth** | 检验 Project-first、sequencing、place 是否需要成为 IA | 两边都确认 Project/Book 是主单元，地点只在 title/caption，非 Place navigation | A 提供地点 caption 与 authored sequence 证据；B 补充 Gallery/Index toggle 及 `Paris / Minnesota` 截图 | 一致：证明 project integrity；不能证明大规模个人 archive 的检索方案。 |
| **Rinko Kawauchi** | 检验 Series + year metadata、弱地点结构 | 两边都确认 Works/Series + year，无 Place axis | A 将其作为 project-first 强反例；B 补充双语、Biography/CV 与小规模 flat Works list | 一致：year 可是 metadata 而非 timeline；不能外推数百 Gallery。 |
| **Joel Meyerowitz** | 检验 theme/series 与职业身份层 | 两边都确认 place/era 融入 work title、无 place/time index、商业/身份层较重 | B 截图直接显示 hero + 长侧栏/课程 CTA；A 补充 homepage pattern 与重复地点未聚合的含义 | 观察一致；“15–20 项后停止扩展”只是 heuristic，不是用户测试事实。 |
| **ICP** | 机构规模参照 | 都确认结构化日期/metadata 可支撑长期机构 archive | A 研究 Collections/object metadata；B 研究 700+ Past Exhibitions 的 card + date range + Load More | 非冲突：是同一机构的两个子系统；只证明机构级可行性，需强折扣。 |

## 4. Findings found by only one research

“单边发现”不等于低质量；是否可提升权重取决于案例数、证据直接性和类别适配。

| 单边贡献 | 直接证据 | Evidence strength | 综合处理 |
|---|---|---|---|
| **A-only：现实 visits 与公开 Project 的强数量反例** | Mark Power 的 *Dome* 100+ visits、波兰项目约 20 visits，仍各自归入 Project | **Medium–High**：单一作者但两个长期项目、官方文字直接且与问题高度相关 | 与双边“无成熟公开 Visit layer”收敛后，足以形成 **High against necessity**；仍不能否定内部 visit metadata。 |
| **A-only：capture date 与 publish date 可能分离** | Germán、Daniel 的长期回填/发布证据 | **Medium**：多案例、直接相关 | 进入 data/operation 的后续问题，不据此设计前台 IA。 |
| **A-only：十万级 map/timeline/search 的组合能力** | Photogrammar、Fortepan | **Medium–High for capability**，但 institution/community 折扣显著 | 证明能力上限；对个人站适用性保持 **Low**。 |
| **A-only：公开 Gallery 数量跨度的细化数据** | Simon Roberts、Furuya、Daniel 等 25–239 张 | **High within A**：多个直接案例 | B 的 26/44/50/60+ 进一步独立支持，因此最终成为固定 10–40 的 High 反证。 |
| **B-only：接近本项目规模语境的个人 dual-axis 实例** | Haarkon 430 posts、Places + Archive + Search；桌面/移动截图 | **Medium–High**：单站但多页面直接证据 | 证明 feasibility，不证明 city aggregation 或双轴 superiority。 |
| **B-only：同一站内五种 repeated-place 处理** | Folker 的 merge、special trip、non-adjacent merge、year cluster、theme split | **Medium**：单站多内容，直接结构证据 | 标记为 **Interesting precedent with internal replication**；说明 uniform rule 可能不符合内容，而非鼓励无规则。 |
| **B-only：低成本 tag + per-post map 折中** | Logbuch35mm 的 60+ tags/counts 与 OSM embed | **Low**：单案例 | **Interesting precedent**；同时暴露 facet explosion，不能称最佳实践。 |
| **B-only：personal search-first** | James Maher 1163 photos / 2003–present，搜索与 category/color filters 截图 | **Low–Medium**：单案例且商业/单城市语境 | **Interesting precedent**；仅作为规模增长后的 secondary/later 候选。 |
| **B-only：长期韧性负例的直接截图/状态证据** | desktop-only archive、JS-only blank、TLS error、under-construction placeholder | **Medium**：多个不同 failure cases | 进入实现阶段的 resilience/accessibility guardrails，不决定 Stage 2B IA。 |

## 5. Cross-research findings matrix

证据引用格式：`A:Cxx` 为 Deep report 案例；`B:nnn` 为 Ox Alpha case。

| 综合命题 | Research A evidence | Research B evidence | Evidence strength | 允许得出的结论／不能越过的边界 |
|---|---|---|---|---|
| Project/Series/Gallery 是稳定内容单元 | A:C13–C22 多个 project-first 作者站 | B:006–009、015、018–019、023、028 | **High** | 作品单元应由摄影/编辑意义界定。不能推出所有 Gallery 都应 book-scale，也不能把导入批次等同作品。 |
| Chronology 能长期扩展 | A:C02、C04、C05、C27、C28、C29 | B:001、002、016、018 | **High** | Year/month/era/reverse chronology 都可行；没有证据证明 chronology 必须 primary。 |
| Place hierarchy/facet 能扩展 | A:C01、C06、C23、C25、C26、C28 | B:001、003、005、010、022 | **High feasibility / Medium applicability** | Place 可承担检索；大型机构和 place-specialist 样本不能证明个人 authored archive 应 place-first。 |
| Time + Place 可指向同一内容而不复制 | A:C01、C23、C26、C28 | B:001；B:011 以 tag + chronology 指向同一 post | **High feasibility** | 多入口是成熟信息检索机制；是否值得做、入口可见度多高仍是产品选择。 |
| 公开 Visit 层不是必要条件 | A:C20 的 100+ / 20+ visits 被 Project 吸收；A 全样本无稳定公开 Visit | B:001、002、003、005、011、012 均以 card/time/tag/merge/pair 处理，无独立 Visit | **High against necessity** | 不把 Visit 设为必需 UI。对 `visit_id`、拍摄批次或旅行记录的内部用途，证据为 **Low / Unresolved**。 |
| Repeated Place 没有单一规则 | A:permanent bucket、time bucket、project absorption、theme 多模式 | B:003 单站即有 merge/split/year-cluster/theme 五种；另有 002/005/012 | **High** | 冲突来自内容语义与用户任务，不是事实矛盾。不能建立全局“一次访问一 Gallery”规则。 |
| Gallery 不存在 10–40 最佳数量 | A:25、56、75、81、99、163、239 等 | B:006≈44、007≈26、008≈50、009≈60，002 月度单元可更长 | **High counter-evidence** | 删除固定阈值。数量只能是编辑、认知负荷、移动体验与性能的联合约束。 |
| Sequence 与 overview 服务不同观看任务 | A:C19 light table/slideshow、C16 contact sheet、C18 slideshow、C28 object viewer | B:006 Gallery/Index、003 hero+thumbs、009 slideshow（文本证据） | **Medium–High** | 双模式有成熟先例，但不构成每个 Gallery 必须双模式的最佳实践。 |
| Minimal About 可行 | A:C01、C05、C06、C12；反例为完整 artist context | B:001、002、011、012；反例 B:006–008 | **High feasibility** | About 可弱化；轻重取决于个人 archive 还是职业艺术家身份任务，不能删成硬规则。 |
| 核心 visible metadata 可保持精简 | A:Project title、year/date、location 高频；器材字段和 accession ID 属少数/机构 | B:title、date/range、place、count 反复出现 | **High** | 先讨论 title/date/place/count 的可见层级；EXIF/GPS/器材不是当前核心原则。 |
| Map 能承担大库空间检索 | A:C23、C28，均为 170k/200k+；A:C20 仅 project context | B 无 personal map-primary；B:011 per-post OSM 为 **Interesting precedent** | **High large-archive feasibility / Low personal applicability** | 不能把机构 map 成功外推为个人站 MVP；map 更适合 secondary discovery/context，而非 authored viewing。 |
| Search 可成为规模化第三轴 | A 的 faceted/search archive 有多例但多为机构 | B:010 是唯一明确 personal search-first（1163 photos） | **Medium capability / Low superiority** | James Maher 是 **Interesting precedent**，不是 personal archive best practice；搜索可作为后期规模工具。 |
| Image-led homepage/index 常见 | A hero、project grid、archive-first 均存在 | B 001/005/012/015 等；也有 text-only 004 | **Medium** | 图像显著性有直接截图支持，但 homepage 应优先 latest、project 或 archive discovery 仍未决。 |
| 长 flat nav 和商业层可能稀释作品 | A:C15、C21 等显示 CMS/职业层竞争 | B:008、010、019、020 等，008 截图直接支持 | **Medium–High** | 是本项目风险边界；“超过 15–20 就失效”的具体阈值仅为 Low heuristic。 |

## 6. Conflict analysis

只记录会影响总体结论的问题。

| 表面冲突 | 类型 | 重新分析 | 是否改变总体结论 |
|---|---|---|---|
| Chronology-first vs Project-first | **不同用户任务** | 前者优化旧内容 discovery；后者保护 authored work。两者都由双边多案例支持。 | 不改变；转化为 Stage 2B 的权重选择。 |
| Permanent Place vs no Place node | **样本类别差异** | Personal/institutional archive 常需横向检索；artist project 可把地点留在 title/caption。 | 不改变；支持“Place 角色分级”，不支持全局强制。 |
| Repeated visit 应 merge 还是 split | **内容语义差异** | physical trip、shoot、editorial project、index item 不是同一实体；同一站也可因作品不同采用多种规则。 | 改变原假设：删除统一规则。 |
| Place page 应返回 photos 还是 galleries | **覆盖不足** | A 强例多为 Place→photos/objects；B 有 sibling cards/tag lists/place-subject pages，但成熟 `Paris→year→Gallery` 仍少。 | 保持 **Unresolved**；不制造结论。 |
| Slideshow vs grid/contact sheet | **互补任务** | 强顺序与快速 overview 各有成熟案例，不是事实矛盾。 | 不改变；进入 viewer 原型测试。 |
| Rich vs minimal metadata | **公开角色差异** | 机构管理字段、器材研究与作品观看是不同任务。 | 改变原表述：字段可存在，不等于必须公开。 |
| Heavy vs minimal About | **身份任务差异** | 个人 diary 可由作品建立身份；职业艺术家需要 CV/institutional context。 | 不改变；只支持“克制可行”，不支持“越少越好”。 |
| B 的截图数量与状态文字不一致 | **同一研究的版本漂移** | `CASE_INDEX.md` 头部保留旧状态；`GAPS.md`、截图 README 和文件系统是较新证据。 | 不改变模式，只降低对摘要计数的信任，采用最新可核查状态。 |
| Todd Hido 文本称 slideshow，mobile screenshot 为证书错误 | **证据介质不一致** | viewer 结论来自页面/代码文字证据，不是该截图；截图只能证明当前 mobile URL 失败。 | 降低视觉/移动结论，不否定站点曾有 slideshow 结构。 |

## 7. H1–H11 reassessment

原粘贴正文没有提供独立的 H1–H11 名称，仓库内也无编号清单。下表是依据正文明确列出的假设、两套 Stage 1 的“current hypotheses / Questions for Stage 2”所做的**工作性重建**。若存在另一份原始 H1–H11，编号应重新映射，不能把本表冒充原始命名。

| ID | 工作性假设 | 状态 | Confidence | Evidence strength | 更新后的边界 |
|---|---|---|---|---|---|
| **H1** | 摄影作品应是绝对主体，About 应尽量弱 | **方向成立，但原表述过强或结构需要调整。** | **High** | **High** | “作品主体”强；“About 必须弱”只证明可行，职业身份场景可更重。 |
| **H2** | Gallery 是基本策展/观看内容单元 | **证据较强，应该进入 Stage 2B。** | **High** | **High** | Gallery 与 raw archive bucket、shoot、trip、import batch 分开定义。 |
| **H3** | Chronology 应是重要发现维度 | **方向成立，但原表述过强或结构需要调整。** | **High** | **High** | 作为 index/facet 很稳；是否 primary navigation 由项目目标决定。 |
| **H4** | `Paris` 应是持久 Place，而非 `Paris 2019/2022/2026` 三个互不相关地点 | **方向成立，但原表述过强或结构需要调整。** | **Medium** | **Medium–High** | 持久地点语义有支持；并不自动要求用户可见 Place node 或城市主页。 |
| **H5** | 同一 Gallery 可由 Chronology 与 Places 访问而不复制 | **证据较强，应该进入 Stage 2B。** | **High** | **High（可行性）** | 成熟 facet/tag/dual-index 支持；是否两入口都公开、谁 primary 仍未决。 |
| **H6** | 公开 IA 应为 `Place → Visit → Gallery → Photo` | **当前证据明显反对。** | **High** | **High（反对必要性）** | Visit 不应默认成为 primary/secondary navigation；内部 metadata 保持 Unresolved。 |
| **H7** | Place page 应以 year/visit 分组并返回 Galleries | **有一定价值，但证据不足以成为核心原则。** | **Low** | **Low** | 有理论清晰度，缺成熟个人 precedent；需 prototype，不应由网页样本强行补齐。 |
| **H8** | Gallery 应约 10–40 张 | **当前证据明显反对。** | **High** | **High（反证）** | 改为内容与观看约束，不设统一数字规则。 |
| **H9** | `DISCOVERY → CONTENT UNIT → VIEWING` 是总体抽象 | **方向成立，但原表述过强或结构需要调整。** | **High** | **High（模式复现）** | 是研究者对多站点路径的有效抽象，不是网站共同声明的标准，也不预设最终页面数。 |
| **H10** | Gallery 需要 sequence + overview 两种观看模式 | **有一定价值，但证据不足以成为核心原则。** | **Medium** | **Medium–High** | 双模式有多案例支持，纯 sequence 同样成立；应由 prototype 验证本档案是否值得复杂度。 |
| **H11** | Map 应成为个人档案的重要发现入口 | **有一定价值，但证据不足以成为核心原则。** | **Low** | **Low（本项目适用性）** | 大库可行性强，个人站 superiority 未证；默认降为 later/optional。 |

## 8. Place / Visit / Gallery layers must not be conflated

### 四层 Place 命题

| 命题 | 当前支持 | 合适角色 |
|---|---|---|
| `gallery.place = Paris`：Gallery 带有地点属性 | **High** | **metadata**；可供未来 filter/index 使用。 |
| `Place(id=paris)`：数据中有规范化 Paris 实体 | **Medium feasibility**；前端不能证明内部 schema | **internal organization / optional facet**；是否需要取决于去重、别名和聚合需求。 |
| `Places → Paris`：用户看见 Place 导航 | **Medium、类别依赖** | place-led archive 可为 primary；一般 personal archive 更适合 **secondary navigation / archive facet**。 |
| `Paris → Galleries`：Paris 页返回 Gallery cards | **Low** | **prototype candidate**；当前强例更多是 photos/objects、tag list 或 sibling cards。 |

### 五种现实/内容单位

| 单位 | 是否等同 Gallery | 证据允许的判断 |
|---|---|---|
| 一次拍摄行为 | 不一定 | Daily 项目会把许多拍摄聚成一个 Project；一次拍摄也可能只产生 metadata。 |
| 一次现实旅行 | 不一定 | Mark Power 多次/上百次旅行可被一个 Project 吸收。 |
| 方便记录的一组照片 | 不一定 | Archive bucket 可为写入便利存在，但不必成为公开观看单元。 |
| 摄影师认为应一起观看的作品 | **最接近 Gallery** | 双边 project/series 案例给出最强支持。 |
| Index 中的一个 item | 不一定 | 它可能是 Gallery、Place、Year、tag、single photo、exhibition 或 search result。 |

### 角色分级

| 维度 | Primary navigation | Secondary navigation | Archive facet / index | Metadata only |
|---|---|---|---|---|
| **Time** | 对 diary/chronology-led archive 有强可行性 | **普遍有力** | **强支持** | 几乎总可保留 date/year |
| **Place** | 只对 place-led practice 有中强支持 | **中强支持** | **强可行性** | **强支持** |
| **Visit** | **不支持设为默认** | 证据弱 | 可选 editorial grouping，证据弱 | 可保留内部 trip/shoot metadata，是否需要未决 |
| **Search** | 只有一个 personal **Interesting precedent** | 规模增长后可考虑 | 中等能力证据 | 不适用 |
| **Map** | 个人站不支持默认 | 机构大库强、个人站弱 | 可选 geospatial facet | GPS 可内部保留，但公开价值未证 |

## 9. Validation of `DISCOVERY → CONTENT UNIT → VIEWING`

这个抽象**方向成立，但属于跨案例分析模型，不是被案例直接声明的行业标准**。

- **Direct observations**：A 的 Germán/PhotoHouse/Fortepan/Photogrammar 与 B 的 Haarkon/Logbuch/James Maher 都把 filter/index/search 与具体对象或 post 分开；A 的 Alec/Furuya/Vanessa/Simon 与 B 的 Alec/Folker/Todd Hido 又把 Project/Gallery 与具体 viewer mode 分开。
- **Independent convergence**：两边都出现 `index/list/facet → project/gallery/object → sequence/grid/slideshow/fullscreen` 的路径。
- **Interpretation boundary**：案例没有证明必须存在三个页面、必须叫 Gallery，或 discovery 与 viewing 不能在同页。它只说明“找什么”和“怎么看”是两类任务，适合在 Stage 2B 分别决策。

因此它的正确状态是：**Evidence supports the analytical separation, not a unique IA.**

## 10. Institutional and artist evidence discount

| 证据类别 | 可以证明 | 不能直接证明 | 折扣后用途 |
|---|---|---|---|
| Fortepan / Photogrammar / ICP / museum / community archive | metadata schema、facet/search/map 能运行、十万级 scalability、object viewer 能力 | 50–300 Gallery 的个人站需要同等字段、地图或操作密度 | 能力上限、later-phase pattern、字段候选；不能决定 MVP。 |
| Alec Soth / Rinko / Mark Power / Furuya / artist project sites | project integrity、sequencing、minimal visible metadata、authored viewing | 长期个人记忆、跨年地点发现、数百 Gallery retrieval 已解决 | Gallery/viewer 与作品边界证据；不能单独决定 archive index。 |
| Personal diary / archive | 长期写入、时间/地点索引、低维护结构 | 作品级 sequencing 或机构级规模一定成立 | 对本项目权重最高，但样本数量、文化与用户测试仍有限。 |

Research B 中“Place hierarchy 是唯一被验证的 500+ 路径”“flat list 在 15–20/30–50 必然失效”等语句应降级：它们是基于观察的合理 heuristic，不是对照研究或 usability test。

## 11. Screenshot-led checks

截图只用于可见视觉事实，不用来猜交互或内部结构。

| 结论 | Screenshot observation | Evidence adjustment |
|---|---|---|
| Haarkon 双入口 | `001-home/archive/places` 直接显示 Places、Search、year cards、counts 与同一视觉卡片体系 | 提高 dual-index **可行性**；但 428 places / 430 posts 与 Kyoto sibling cards不支持城市聚合页。 |
| Haarkon mobile | `001-home-mobile` 保留双列大卡；`001-archive-mobile` 标题和正文出现水平裁切 | 只能证明 render，不证明 mobile quality；降低“responsive 成熟”推断。 |
| Alec authored viewing | `006-paris-mn` 首屏几乎只有单一 book image、Back、Gallery/Index | 强化 image prominence 与 Gallery/Index 直接事实；不证明数百 Gallery archive。 |
| Joel Meyerowitz identity/nav competition | `008-home` 显示大图主体，同时左侧长 nav 与顶部课程 CTA | 支持“作品与职业/商业层竞争”的观察；不提供具体失效阈值。 |
| ICP archive density | `016-past` 显示 4-column cover cards、title、date range、Load More、机构 CTA | 支持 card/date/pagination 的机构级事实；必须 institution-discount。 |
| Folker viewer | `003-iceland` 显示 hero、caption、左右箭头、thumbnail overview | 支持 sequence + overview 的 feasibility；页面视觉与商业/award homepage 不能代表极简 personal archive。 |
| James Maher search | `010-search-desktop` 显示 1163 photos、search、category/color filters 与密集结果 grid | 证明 search-first capability；商业导航和单城市素材库语境降低适用性。 |
| Logbuch tag density | `011-tags` 显示 60+ 混合 place/theme/camera tags 与 counts | 证明低成本 facet；也直接显示 facet explosion 风险。 |
| Yoshimoto repeated place | `012-home` 显示 1984↔2026 配对、区域索引与大量侧栏 | **Interesting precedent**：place-across-time 概念成立；不是通用 Visit IA。 |
| Todd Hido mobile | `009-homes-mobile` 仅显示 TLS certificate error | 不得用该截图证明 slideshow/mobile；仅保留非视觉页面证据并降低 confidence。 |

## 12. Bias audit

| Bias | 影响 | Confidence adjustment |
|---|---|---|
| **Selection / SEO candidate bias** | 可搜索、可抓取、长期在线的网站更易入样；JS-only、失效或非英文个人站更易被排除 | 对“行业频率”一律降级；可判断存在/可行，不精确估计普及率。 |
| **Confirmation bias** | brief 原本偏向 Time/Place/Visit，可能促使研究者优先寻找这些结构 | 两组都独立找到强反例和无 Visit 结论，部分缓解；Place/Chronology 的“重要性”仍不等于应 primary。 |
| **Famous-photographer bias** | Alec/Rinko/Mark/Furuya 等提高 Project-first 比例，且常把档案职能交给机构/出版物 | Project integrity 结论保留；对 personal archive retrieval 的适用性降为类别限定。 |
| **Institution bias** | Map、rich metadata、facet 与超大规模成功主要来自机构 | capability 保留；对本项目 UI/MVP 的 confidence 降至 Low。 |
| **Western web bias** | 最强 personal archive 证据集中于欧洲/英文网站 | 不把视觉/IA 习惯称为跨文化 best practice；非西方 personal archive 仍是 research gap。 |
| **Archive-vs-portfolio category confusion** | 把找对象和看作品的成功模式混合会制造假冲突 | 所有结论按 discovery / viewing 与 case type 分开加权。 |
| **Screenshot availability bias** | B 只有 17 个站点有效 render；可截图者更容易获得视觉判断 | 截图只提升具体可见事实；无图不作为结构反证。 |
| **Mobile capture bias** | 静态 375px 截图不测试 swipe、loading、sticky nav、end state | Mobile interaction 仍为 Low，转入 prototype testing。 |

## 13. Evidence boundaries

| 当前证据允许 | Evidence strength |
|---|---|
| Gallery/Project 可作为主要观看内容单元，但需定义与 raw archive bucket 的区别。 | **High** |
| Time/Place 可是同一内容的独立 metadata 和发现入口，无需复制内容。 | **High feasibility** |
| Chronology 在长期 archive 中耐久；是否一级导航取决于 archive vs authored viewing。 | **High** |
| Place metadata 很有价值；Place entity / visible Place page / Place→Galleries 必须分开决策。 | **High / Medium / Low 分层** |
| Visit 不应因现实旅行存在而自动成为公开 IA；内部用途不可由前端 precedent 判死刑。 | **High / Low 分层** |
| Gallery 数量阈值不能由案例归纳为 10–40。 | **High counter-evidence** |
| Sequence、overview、search、map 均有 feasibility；没有 superiority 证据。 | **Medium–Low，按类别** |
| About 可克制，公开 metadata 可分层。 | **High feasibility** |

### 当前证据不允许

- 不应该因为 Germán/PhotoHouse 的 Place 成功就确定本项目某种 Place page。
- 不应该因为两组没有公开 Visit precedent 就删除内部 visit/trip/shoot metadata。
- 不应该因为 Fortepan/Photogrammar 的地图成功就给个人站上地图。
- 不应该把 artist project 的极简 metadata 外推为长期个人 archive 不需要检索字段。
- 不应该把静态 mobile screenshot 当作响应式交互通过。
- 不应该用单个 James Maher/Yoshimoto/Logbuch 案例宣称 search-first、visit-pair 或 per-post map 是 best practice。
- 不应该从没有用户测试的案例数推导 15–20、30–50 或 10–40 的硬阈值。

## 14. Consolidated gaps

### A. 仍值得小范围继续搜索

1. **成熟个人案例：`Place → Galleries grouped by year`**。这是当前最直接、尚未被两组覆盖的结构问题；只值得做定向补证，不做新一轮大规模 research。
2. **非西方长期个人 archive**，尤其中文、日文、韩文环境下同时公开 chronology/place 的站点；目的在于校正 Western web bias。
3. **50–300 Gallery 个人 archive 的真实 map/search 使用**。只有在 Stage 2B 仍把 map/search 列为候选时才继续。

### B. 更适合 prototype testing，不值得继续网页搜索

1. Homepage：latest galleries vs archive discovery 的首屏优先级。
2. Chronology primary / secondary；Place secondary index / facet / metadata only。
3. Place result：Gallery cards vs photos，以及是否按 year grouping。
4. Gallery：sequence-only vs sequence + overview；gallery end、previous/next gallery。
5. Mobile：横竖图尺寸、swipe/keyboard fallback、sticky navigation、长 Gallery 疲劳与返回路径。
6. Map 是否产生空间发现价值，还是形成 travel-tracker / data-first 感。
7. Flat tags vs controlled Place hierarchy 的理解成本。

### C. 后续实现阶段处理

1. CMS/database schema、Place alias、capture date vs publish date 的存储方式。
2. Responsive images、lazy loading、AVIF/WebP、内存与长序列性能。
3. Keyboard、screen reader、focus、reduced motion 与无 JS resilience。
4. 写入流程、Gallery count 自动计算、搜索索引与地图数据维护成本。

## 15. Questions for Stage 2B — do not answer here

1. Homepage should prioritize latest Galleries or archive discovery?
2. What exactly makes a set of photos one Gallery rather than a shoot, trip, import batch, or long-term Project?
3. Should Chronology be primary navigation, secondary navigation, or an archive index only?
4. Should Place be visible navigation, a secondary index/facet, or metadata only?
5. If a Place page exists, should it return Galleries or Photos, and should time grouping be visible?
6. Should Visit exist only as internal metadata, as an optional editorial grouping, or not at all?
7. Does a Gallery need sequence + overview modes, and what is the mobile/end-of-gallery continuation model?
8. Which metadata and discovery capabilities belong in MVP, and which—search, map, rich facets—are later-phase only?

**Ready for Stage 2B decision.**
