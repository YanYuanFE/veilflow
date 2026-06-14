# Season 3 · TokenOps Special Bounty — 构建计划 v0.1

> **赛题**: Zama Developer Program Mainnet Season 3 — Special Bounty Track × TokenOps
>
> **目标**: 用 **TokenOps SDK** 构建"the best confidential token distribution experience"
>
> **奖励**: 2,500 cUSDT,**1 名**获胜者
>
> **截止**: 2026-07-07 23:59 AOE(今天 2026-05-29,约 5.5 周)
>
> **部署**: Sepolia 测试网(默认)或以太坊主网
>
> **产品决策**: **统一机密分发控制台**——一个 dApp,创建时选类型(Airdrop / Disperse / Vesting),共享一套向导 + 领取/仪表盘 UX。

---

## 0. 摘要

赛题强制要求用 TokenOps SDK,而 SDK 已提供三个 OpenZeppelin 审计过的机密分发产品(Airdrop / Disperse / Vesting,均 FHE + ERC-7984)。**因此获胜轴不是密码学,而是"体验"**:UX、场景覆盖、完整 pitch。

我们做一个**统一控制台**:发行方连钱包 → "创建分发" → 选类型 → 类型化配置向导(共享接收方录入)→ 注资 + 启动 → 仪表盘(默认加密、按需揭示);接收方连钱包 → 只看到自己的额度(客户端解密)→ 领取(支持 gas 代付的走代付)。Vesting 额外提供**选择性披露**(授予审计/监管只读)。

**为什么这样赢**:一个 dApp 跑通 SDK 全部模块(评委是 TokenOps,覆盖度即说服力)+ 统一 UX 让它像一个真正的产品而非三个 demo + 选择性披露贴合 TokenOps 的合规 GTM 叙事(Nomura/BlackRock)。

---

## 1. 赛题对齐(逐条)

| 要求 | 我们的交付 |
|---|---|
| 用 TokenOps SDK 的功能性 dApp | 统一控制台,前端调 `@tokenops/sdk` 三模块 |
| 智能合约 + 前端代码库 | 部署 SDK 审计合约(经 factory clients)+ 一个薄的自有 `DistributionRegistry`(跨类型索引 + 元数据)|
| 部署到网站的可用 demo | Vercel 部署前端 + Sepolia 合约 |
| 3 分钟**真人** pitch 视频 | ⚠️ 真人出镜/真人配音,**禁 AI 视频/配音**——脚本见 §11 |
| X thread / 文章 | 介绍产品 + 演示 GIF + 合约地址,大纲见 §11 |

---

## 2. 产品概念:统一机密分发控制台

**一句话**:任何形态的机密发币——空投、批量发放、线性解锁——一个控制台,创建时选类型。

```
连接钱包
   │
   ├─ 创建分发 ──► 选类型 ──► [Airdrop] / [Disperse] / [Vesting]
   │                              │ 共享:接收方录入(CSV/手动)、明文金额(SDK 加密)、预览
   │                              ▼
   │                          注资 + 启动(调对应 SDK factory client)
   │
   ├─ 我的分发(仪表盘)──► 列表(来自 DistributionRegistry + SDK 事件)
   │                          状态 / 加密总额(仅我/审计可解密)/ 操作
   │
   └─ 接收方视图 ──► "你有一笔待领" ──► 只看到自己的额度(用户解密)
                                       ──► 领取(gas 代付优先)
                                       ──► [Vesting] 解锁曲线 + 时间线
```

**类型差异(创建向导分支)**:

| 类型 | 适用 | 创建时填 | 领取 |
|---|---|---|---|
| **Airdrop** | 大规模、签名授权 | token、起止时间、可否延长、admin | EIP-712 签名 + 加密 handle,单次 |
| **Disperse** | 一次性批量发放 | token、模式、(地址, 金额)[] | 直接到账(无需领取动作)|
| **Vesting** | 投资人/团队、分期解锁 | recipient、amount、cliff/interval/初始解锁 bps、可撤销 | 按曲线增量领,gas 代付,可选择性披露 |

---

## 3. SDK 模块映射(实际调用)

> 以下函数名取自 TokenOps SDK 文档;⚠️ 标注的签名细节在动手时需对文档逐一核对。

### 3.1 Airdrop — `@tokenops/sdk/fhe-airdrop`

```ts
// admin 侧
const factory = createConfidentialAirdropFactoryClient({ publicClient, walletClient, encryptor });
const { airdrop } = await factory.createConfidentialAirdrop({
  params: { token, startTimestamp, endTimestamp, canExtendClaimWindow, admin },
  userSalt,
});
// 对每个 recipient:加密金额(绑定 recipient)+ EIP-712 签名
const { handle, inputProof } = await encryptUint64({ encryptor, contractAddress: airdrop, userAddress: recipient, value });
const signature = await signClaimAuthorization({ walletClient, airdropAddress: airdrop, recipient, encryptedAmountHandle: handle });

// recipient 侧
const client = createConfidentialAirdropClient({ publicClient, walletClient, address: airdrop });
await client.claim({ signature, encryptedInput: { handle, inputProof } });
const amount = await client.getClaimAmount();   // 解密自己的额度
```
模型:admin 加密金额**绑定 recipient 地址**、EIP-712 签 `(airdropAddress, chainId, recipient, handle)`;合约验签防重放后 `FHE.fromExternal`。CREATE3 跨链同地址。**无 merkle,纯签名授权**。

### 3.2 Vesting — `@tokenops/sdk/fhe-vesting`

```ts
const factory = createConfidentialVestingFactoryClient({ ... });   // 每 token 一个 manager 实例
const manager = createConfidentialVestingManagerClient({ ... });
const { vestingId } = await manager.createVesting({
  recipient, amount,                       // 明文 bigint,SDK 加密
  startTimestamp, endTimestamp,
  cliffSeconds, releaseIntervalSecs, timelockSeconds,
  initialUnlockBps, cliffAmountBps,
  isRevocable,
});                                          // 触发 VestingCreated(vestingId: bytes32)
// 后续:claim / split / 选择性披露 都用 vestingId
```
独有能力:**选择性第三方披露**(授审计/监管只读)、批量创建、gas 代付领取、可撤销。**这是三者里差异化最强的——重点演示。**

### 3.3 Disperse — `@tokenops/sdk/fhe-disperse`

```ts
await register(token);                       // 每用户部署一次 ERC-1167 钱包对
const pre = await preflightDisperse({ user, token, recipients, amounts, mode });
await disperse({ token, mode, recipients, amounts });   // 批量,SDK 批量加密单 KMS proof
// 善后
await recoverFromWallets({ token, to });
```
模式:wallet-mode(ETH 付费)/ BPS token-fee wallet-mode / direct sender mode。批量加密 + 单 KMS proof 是亮点(gas 效率)。

### 3.4 共享 — `@tokenops/sdk/fhe`

加密 / ACL 工具(`encryptUint64`、encryptor 等),三模块共用;前端只传明文 `bigint`。

---

## 4. 架构

```
┌─────────────────────────────────────────────────────────────┐
│ Frontend SPA (React + Vite + shadcn/ui + wagmi + zama react-sdk)│
│  创建向导 / 仪表盘 / 接收方领取 / 披露面板                    │
│  ★ FHE 加密在浏览器内完成,明文金额永不离开客户端 ★          │
└───┬──────────────────────┬──────────────────────┬───────────┘
    │ @tokenops/sdk         │ 读写自有合约           │ fetch('/api/...') 同域
    ▼                       ▼                       ▼
┌────────────────────┐ ┌────────────────────┐ ┌──────────────────────────┐
│ TokenOps SDK 合约   │ │ DistributionRegistry│ │ Vercel /api functions      │
│ Airdrop / Vesting   │ │ (自有,可选)        │ │ (CMS+索引+密文投递,同仓)  │
│ / Disperse(审计)   │ │ slug→地址 可信锚点  │ │ - 项目元数据/slug/主题     │
└─────────┬──────────┘ └────────────────────┘ │ - 草稿 + 状态机/SIWE 校验  │
          ▼                                    │ - 密文工件(handle/sig)    │
   ┌──────────────────────────────┐            │ ✗ 绝不存明文金额           │
   │ Zama fhEVM (Sepolia)         │            └─────────────┬────────────┘
   │ ERC-7984 / FHE / ACL / KMS   │              ┌───────────▼────────────┐
   └──────────────────────────────┘              │ Postgres(Neon/Vercel)+ │
                                                 │ Blob(logo)             │
                                                 └────────────────────────┘
   ★ 前端静态 + /api functions 同一个 Vercel 项目/部署/域名 ★
```

### 4.1 三层职责与信任边界

| 层 | 放什么 | 关键约束 |
|---|---|---|
| **链上(真相源)** | SDK 分发合约、资金托管、领取授权与执行、加密金额/余额 | 钱不可窃、领取由合约验签 |
| **后端(便利层)** | 项目元数据、slug、主题、草稿、状态、**密文工件**(handle/proof/签名)、地址 | **绝不存明文金额;无法伪造领取** |
| **仅客户端** | 明文金额(SDK 当场加密)、接收方对自己额度的解密视图 | 明文不出浏览器 |

> **红线**:加密在浏览器完成,后端只见密文 + 地址 + 签名。最坏被攻破 → 改品牌 / DoS 便利层 / 泄露 `(地址, 密文, 签名)`,但**金额不泄露、钱偷不走**。这句话是 pitch 的核心隐私叙事("后端从不接触明文金额")。

### 4.2 自有合约 `DistributionRegistry`(可选,但建议保留极小版)

后端已能索引"我的全部分发",故 Registry 非必需。但保留一个极小的链上 registry 有两个价值:① 给"原创 smart contract"交付项加分;② 提供 slug→地址的**不可篡改**锚点(后端可改,链上不可改)。分工:**链上 = 可信指针,后端 = CMS**。记录 `(creator, type, instanceAddr/vestingId, metadataURI)` + 发事件。⚠️ 动手前确认 SDK 工厂事件是否已够索引。

---

## 5. 用户流程

### 5.1 发行方:创建(确定的线性顺序)

分两阶段:**先建项目+部署合约,拿到地址后再加人**。这个顺序是 SDK 决定的——加密绑定合约地址(`encryptUint64({ contractAddress, ... })`),所以必须先有合约地址才能加密 recipient 金额。

```
Phase 1 — 建项目 + 部署
  1. 填基本信息:name、slug、theme、token、类型、时间
  2. POST 后端 → 建草稿项目(status=draft)
  3. 客户端钱包交易:调对应 SDK factory 部署合约
       airdrop: createConfidentialAirdrop / vesting: vesting factory / disperse: register(token)
  4. PATCH 后端 → 回写 { contractAddress, txHash },status=deployed(configuring)

Phase 2 — 加人 + 规则 + 上线(在项目详情页)
  5. 录入接收方(CSV/手动)+ 类型化规则(§2 表)
  6. 浏览器加密(绑定已知合约地址)+ 签名/createVesting/批量;明文金额不出浏览器
  7. 密文工件入后端(handle/proof/签名 + 地址)
  8. 注资:ERC-7984 转入/授权 → status=funded
  9. 发布 → status=live;接收方可在 /claim/slug 领取
```

**状态机**:`draft → deploying → deployed(configuring) → funded → live →(completed / revoked)`

**两次写对账**(后端写 → 链上部署 → 后端回写,中间会断,必须处理):
- 部署交易失败/放弃 → 后端留 `draft`(无地址),可重试部署或清理
- 部署成功但回写失败 → 合约在链上、后端不知道 → 用 `txHash` 幂等回写,并可从工厂事件兜底重建

**disperse 的差异**:`register(token)` 是**每用户一次性**(跨 token 复用钱包对),不是每项目一个合约。所以对 disperse,Phase 1 步骤 3 实为"确保已 register",真正发放是 Phase 2 的一次性 `disperse` 批量交易;"项目"对 disperse 更像一次计划好的批量。数据模型需容下此差异。

### 5.2 接收方:领取(核心体验)
1. 连钱包 → 控制台识别"你有待领"(从 Registry/事件反查)
2. **只看到自己的额度**(客户端用户解密;别人看不到)
3. 领取:
   - Airdrop:提交签名 + 加密 handle
   - Vesting:看解锁曲线/时间线,领已解锁部分(gas 代付优先)
   - Disperse:已直接到账,展示机密余额
4. 领取后展示进入自己的 ERC-7984 机密余额

### 5.3 审计/监管:选择性披露(Vesting)
1. 发行方对某 `vestingId` 调 `discloseToParty({ vestingId, party, disclosureType })` 授予审计地址只读
2. 审计连钱包 → relayer `userDecrypt` 查看被授权的分配 → 导出合规报告
3. 叙事:满足 Basel/MiFID 式披露而不公开市场
> ⚠️ 披露**不可撤销**(ACL append-only)——UI 文案与合规叙事只说"可授予",不承诺"可撤销"。授权前给二次确认。

---

## 6. 共享 UX 层(真正决定胜负的部分)

- **统一接收方管理**:CSV 拖拽上传 + 地址/金额校验 + 重复检测 + 预览,三类型共用
- **统一"私密领取"页**:接收方永远只看到自己的数,客户端解密,默认隐藏
- **加密优先仪表盘**:总额/分配默认显示 🔒,"reveal" 才解密(有权限者)
- **状态可视化**:Vesting 解锁曲线、Airdrop 领取进度、Disperse 批次状态
- **一致设计系统**:克制、机构感(贴合 TokenOps 合规定位),非 degen 风
- **空/加载/错误态打磨**:这些细节是"experience"评分点

---

## 7. 智能合约交付

| 合约 | 来源 | 说明 |
|---|---|---|
| Airdrop clone | SDK | 经 `createConfidentialAirdrop` 部署(CREATE3)|
| Vesting manager | SDK | 经 vesting factory 部署(每 token 一个)|
| Disperse 钱包对 | SDK | 经 `register(token)` 部署(ERC-1167)|
| `DistributionRegistry` | **自有** | 跨类型索引 + 元数据 + 事件;Foundry 写 + 测 + 部署 Sepolia |

`DistributionRegistry` 保持极小(一个 struct + 一个 mapping + 一个 emit),用 Foundry 测试覆盖,作为"原创合约"交付项,同时不碰 FHE(FHE 全交 SDK)。

---

## 8. 技术栈 & 部署

- **前端**:**React + Vite + shadcn/ui(Tailwind)** + wagmi + viem + `@zama-fhe/react-sdk@^3` + `@tanstack/react-query`(纯 SPA,无 SSR——钱包/FHE 全客户端,反而更简单)
- **后端(前后端一体)**:**Vercel serverless functions(`/api` 目录,框架无关)** + 托管 Postgres(Neon / Vercel Postgres,带连接池)+ Blob(logo)。前端 `fetch('/api/...')` 同域,无独立服务。鉴权 **SIWE 在函数内校验 → session JWT**。状态/进度优先从链上事件读,Postgres 做缓存/索引
  - 备选:Supabase 直连(不写 API 层,最省代码;靠 RLS + SIWE→Supabase session)
  - ⚠️ 本地开发用 `vercel dev` 跑 `/api` 函数(Vite dev server 不跑函数)
- **SDK**:`@tokenops/sdk` + `@zama-fhe/sdk@^3`;**Node 22+**
- **合约**:Foundry(仅 `DistributionRegistry`,可选)
- **链**:Sepolia(demo 默认)
- **部署**:**Vite 静态 + `/api` functions 同一个 Vercel 项目**(前后端一体,一次部署一个域名);Postgres 托管;合约 Sepolia;录 demo 用真实 testnet 交易
- **包管理**:pnpm(与 SDK 文档一致)

> 后端保持轻形态是为了不拖垮 7/7 deadline(simplicity-first):Vercel functions 同仓、托管 DB、能读链上就不自己存。
> ✅ 澄清:Vite **工具**没有服务端运行时,但 **Vercel 平台**给任何前端提供 `/api` serverless functions——所以 Vite+React 在 Vercel 上**可以**前后端一体,不需要 Next.js。

---

## 9. 差异化 / 为什么能赢

1. **覆盖度**:唯一一个跑通 SDK 全部三模块的提交(评委 = TokenOps,直接命中)
2. **统一体验**:一个产品而非三个脚本;共享向导 + 私密领取 + 加密仪表盘
3. **选择性披露**:贴 TokenOps 合规 GTM(Nomura/BlackRock),airdrop-only 的竞品给不出
4. **机构级设计语言**:与赛题"institutional-grade"定位同频
5. **真实可用**:Sepolia 真交易 + 部署站点 + 真人 pitch

---

## 10. 里程碑(→ 7/7)

**降风险原则**:先用最易集成的类型在 Sepolia 跑通端到端(证明 SDK + FHE 链路),再加差异化的 Vesting,最后补 Disperse。任何时间点都有一个可演示的完整产品。

| 周 | 目标 | 验证 |
|---|---|---|
| **第 0 步(本周内)** | 起项目,装 SDK,在 Sepolia 跑通**一个** end-to-end(建议 Airdrop:创建→加密→签名→领取→解密) | 截图一笔真实 testnet 领取成功 |
| W1 (~6/5) | 统一外壳 + 后端项目模型:连钱包、创建向导骨架(类型选择)、Postgres schema、Phase 1 两阶段流程(建草稿→部署→回写)+ 状态机 + 两次写对账 | 能建项目、部署 Airdrop、地址回写后端、详情页可见 |
| W2 (~6/12) | Vesting 全流程 + 选择性披露 | 创建 vesting、领取、审计披露在 Sepolia 跑通 |
| W3 (~6/19) | Disperse 全流程 + `DistributionRegistry`(可选)| 批量发放成功;仪表盘列出"我的全部分发" |
| W4 (~6/26) | 私密领取页(/claim/slug,防枚举)+ **自定义主题/slug** + 仪表盘打磨 + 空/错态 | 接收方只见自己额度;品牌化领取页可配置 |
| W5 (~7/3) | 部署 Vercel、录 3 分钟真人视频、写 X thread | 站点可访问;视频/thread 定稿 |
| Buffer (~7/6) | 修 bug、最终演练 | 提交 |

⚠️ **第 0 步是阻塞性的**:必须先确认 SDK 在 Sepolia 能端到端跑通(加密→链上→解密),再投入 UI。

---

## 11. Pitch 资产

### 3 分钟真人视频(脚本大纲)
1. **0:00–0:30 痛点**:公链泄露金额——空投被女巫/抢跑、投资人持仓暴露、薪资公开
2. **0:30–1:00 方案**:一个控制台,任何机密分发,创建时选类型,基于 TokenOps SDK + Zama FHE
3. **1:00–2:15 现场 demo**:创建一个加密 vesting → 投资人只看到自己的 → 审计被授权后可解密 → 接收方 gas-free 领取(全程 Sepolia 真交易)
4. **2:15–2:45 覆盖度**:快速带过 airdrop / disperse 同一控制台
5. **2:45–3:00 收尾**:合约地址 + 站点 + "机密是机构上公链的前提"
> 真人出镜口述,屏幕录制 demo;禁 AI 配音/换脸。

### X thread 大纲
1. Hook:"链上发币还在裸奔泄露金额" + 一张产品图
2. 三类型一个控制台(GIF)
3. 选择性披露:隐私 + 合规两全(贴 TokenOps 故事)
4. 隐私架构:**加密在你的浏览器完成,我们的后端从不接触明文金额**——比纯链上更值得信
5. 技术:TokenOps SDK + Zama FHE + ERC-7984,Sepolia 可玩
6. CTA:站点链接 + 视频 + GitHub

---

## 12. SDK 细节核对结果(2026-05-29 查文档)

### ✅ 已确认

| # | 问题 | 结论 |
|---|---|---|
| 1 | Sepolia 地址 / relayer | 自动按 chainId 解析。Airdrop 工厂 `0xbE6A3B78B36684fFee48De77d47Bc3393F5Acd4c`、Vesting 工厂 `0xA87701CE9A52D43681600583a99c85b50DbE3150`、Disperse 单例 `0x710dD9885Cc9986EfD234E7719483147a6d8DBb4`(主网地址见附录 D)。**需要 Zama relayer**(encryptor 就是个 RelayerNode)|
| 2 | encryptor 初始化 | `new RelayerNode({ transports: { [SepoliaConfig.chainId]: {...SepoliaConfig, network: rpcUrl} }, getChainId })`,来自 `@zama-fhe/sdk/node`(浏览器用 react-sdk 变体,见 ❓)|
| 3 | Vesting 选择性披露 | `manager.discloseToParty({ vestingId, party, disclosureType: DisclosureType.TotalAllocation })`。⚠️ **不可撤销**(ACL append-only,授了收不回)|
| 4 | gas 代付/费率领取 | `const {feeType, fee} = await manager.getFeeInfo()` → `claim({vestingId, feeType, value: fee})`。费率类型(`FeeType.Gas` 等)固化在每个 manager 字节码里 |
| 5 | airdrop/disperse 是否有披露 | **仅 Vesting** 有第三方披露。airdrop 的"披露"只是 admin-加密-绑定-recipient,不是第三方授权 |
| 6 | 索引"我的分发" | 各 client 创建时返回地址(airdrop `{airdrop}`、vesting `{manager}`+`VestingCreated(vestingId)`、disperse `{wallets}`)。跨类型索引由**后端**记录即可,链上 Registry 仍可选 |
| 7 | Disperse 费率 + recover | 三模式 `"wallet"`(ETH/人)/`"wallet-token-fee"`(BPS)/`"direct"`(无注册一次性)。`preflightDisperse` 预检 5 类失败 + `batchLimit`;`recoverFromWallets({token,to})`;`computeSubtotals` 助手 |
| 8 | React hooks | 有。每个模块带 `/react` 变体,另有 `fhe-vesting/advanced`、`fhe-airdrop/advanced`(含 React)|
| 9 | 加密是否绑定合约地址 | **是,三类型都"先部署再加人"成立**。airdrop `encryptUint64({contractAddress})`;vesting 经带地址的 manager client 加密(先 `createManager` 再 `createVesting`);disperse 先 `register` 再 `disperse` |
| 10 | airdrop 工件投递 | 官方明确"通过安全渠道把 `{encryptedInput:{handle,inputProof}, signature}` 交给用户"——**就是我们后端的活**。另有 `airdrop.isSignatureValid(...)` 供领取前校验。admin 操作:`setPaused / extendClaimWindow / withdraw` |

### ❗ 影响设计的新发现

- **解密自己的额度可能是写交易**:airdrop `getClaimAmount` 是**写交易**(链上授 FHE ACL),vesting `getClaimableAmount` 返回 `{handle}` 走 relayer `userDecrypt`(链下)。接收方"查看我的额度"的 UX 要按此区分。
- **ACL 授权不可撤销(append-only)**:披露/访问授出去收不回。合规叙事要诚实——"可授予审计只读",不能说"可随时撤销"。§5.3 改为仅"授予"。
- **admin 加密放哪是隐私关键**:官方示例在 **admin/server** 侧加密+签名。我们要守住"后端不见明文"→ 必须把 admin 加密+签名放在 **admin 的浏览器**(admin 连钱包,客户端加密+签名,只有密文+签名进后端)。⚠️ **大批量权衡**:浏览器逐条加密上万人慢;服务端批量快但会看到明文。demo/隐私叙事用浏览器侧;超大批量再议。
- **disperse 无每项目合约 + 有 batchLimit**:`createConfidentialDisperseClient` 不传 address,用单例 + 每用户钱包;单次有上限。海量分发优先 airdrop 模块。

### ❓ 仍待确认(动手时)

1. **浏览器/react 版 encryptor 初始化**(react-sdk 的 relayer 实例,非 `RelayerNode` node 版)——我们 SPA 必须用浏览器版
2. gas 代付里"谁最终付 gas"(claimer 付 `value=fee` 报销?还是 relayer 代付后扣费)——`FeeType` 的各模式语义
3. airdrop/vesting 是否各自有可订阅事件用于仪表盘进度(vesting `VestingCreated` 已确认)
4. slug 唯一性 / 归属校验——**我们后端的事**(Postgres 唯一约束 + SIWE 归属),非 SDK

---

## 13. 与既有文档的关系

- **本计划取代** `Confidential_Distribution_Unlock.md`(Cascade)里"从零写 distributor 合约"的路线——本 bounty 必须用 TokenOps SDK,自写合约属重造轮子 + off-spec。
- Cascade 的**领域分析仍是参考**:epoch 解锁算法、隐私边界(金额加密/地址公开)、euint64 精度约束、输入绑定——这些理解直接用于评估 SDK 行为与设计 UX。
- 与 `Confidential_Attestation_Schema.md`(CAS)**无关**:本 bounty 不涉及 KYC/资格门控。

---

## 附录 D:已验证的 SDK 速查(2026-05-29)

### 合约地址(按 chainId 自动解析)
| 模块 | Sepolia | Mainnet |
|---|---|---|
| Airdrop 工厂 | `0xbE6A3B78B36684fFee48De77d47Bc3393F5Acd4c` | 显式传入(slot=null)|
| Vesting 工厂 | `0xA87701CE9A52D43681600583a99c85b50DbE3150` | — |
| Disperse 单例 | `0x710dD9885Cc9986EfD234E7719483147a6d8DBb4` | `0x4fC0d28cBe4B82D512Ad0B42F6787480Cc98cC70` |

### 通用初始化(node 版;⚠️ 浏览器换 react-sdk relayer)
```ts
import { RelayerNode, SepoliaConfig } from "@zama-fhe/sdk/node";
const encryptor = new RelayerNode({
  transports: { [SepoliaConfig.chainId]: { ...SepoliaConfig, network: rpcUrl } },
  getChainId: () => Promise.resolve(sepolia.id),
});
```

### Airdrop
```ts
import { createConfidentialAirdropFactoryClient, createConfidentialAirdropClient,
         encryptUint64, signClaimAuthorization } from "@tokenops/sdk/fhe-airdrop";
const factory = createConfidentialAirdropFactoryClient({ publicClient, walletClient, encryptor });
const { airdrop } = await factory.createConfidentialAirdrop({
  params: { token, startTimestamp, endTimestamp, canExtendClaimWindow, admin }, userSalt });
// admin 浏览器内:加密(绑定 recipient)+ 签名
const enc = await encryptUint64({ encryptor, contractAddress: airdrop, userAddress: recipient, value });
const signature = await signClaimAuthorization({ walletClient, airdropAddress: airdrop, recipient, encryptedAmountHandle: enc.handle });
// recipient:claim(后端把 {enc, signature} 投递给他)
const client = createConfidentialAirdropClient({ publicClient, walletClient, address: airdrop });
await client.claim({ signature, encryptedInput: enc });
// admin 运维:setPaused / extendClaimWindow / withdraw;校验:isSignatureValid(...)
```

### Vesting
```ts
import { createConfidentialVestingFactoryClient, createConfidentialVestingManagerClient,
         confidentialVestingManagerAbi } from "@tokenops/sdk/fhe-vesting";
const { manager } = await createConfidentialVestingFactoryClient({ publicClient, walletClient })
  .createManager({ token, userSalt });            // Phase 1:部署(每 token 一个 manager)
const m = createConfidentialVestingManagerClient({ publicClient, walletClient, address: manager, encryptor });
const hash = await m.createVesting({ params: {     // Phase 2:加人
  recipient, startTimestamp, endTimestamp, cliffSeconds, releaseIntervalSecs,
  timelockSeconds, initialUnlockBps, cliffAmountBps, isRevocable }, amount });
// VestingCreated → vestingId(parseEventLogs + confidentialVestingManagerAbi)
await m.batchCreateVesting({ items: [...] });
const { feeType, fee } = await m.getFeeInfo();
await m.claim({ vestingId, feeType, ...(feeType===FeeType.Gas ? { value: fee } : {}) });
const { handle } = await m.getClaimableAmount({ vestingId }); // → relayer.userDecrypt
await m.discloseToParty({ vestingId, party, disclosureType: DisclosureType.TotalAllocation }); // 不可撤销
await m.splitVesting({ vestingId, numerator, denominator, newRecipient });
await m.revokeVesting(vestingId);
```

### Disperse
```ts
import { createConfidentialDisperseClient, computeSubtotals } from "@tokenops/sdk/fhe-disperse";
const c = createConfidentialDisperseClient({ publicClient, walletClient, encryptor }); // 无 address
await c.register({ token });                                    // 每用户一次
const report = await c.preflightDisperse({ user, token, recipients, amounts, mode: "wallet" });
const { hash } = await c.disperse({ token, mode: "wallet", recipients, amounts });
await c.recoverFromWallets({ token, to });
```

---

*v0.2 草稿。第 0 步 SDK 端到端验证仍为阻塞项;§12 大部分已确认,剩 4 项动手时核对(首要:浏览器版 encryptor)。品牌名待定(占位"机密分发控制台")。*
