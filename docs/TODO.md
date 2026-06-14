# VeilFlow — 下一步 TODO

> 起草 2026-05-31 · 截止 **7/7**(约 5 周)· 配合 `Season3_TokenOps_Bounty_Plan.md` §10 里程碑。
> 勾选规则:**只有在 Sepolia 真跑通**才算 done,代码写完不算。

## 当前状态快照

- ✅ 三类型(Airdrop / Vesting / Disperse)**代码全部完成**,已提交 `d235159`。
- ✅ 后端(Neon + Drizzle + `/api`)、`/claim/:slug`、`/audit`、`/wrap` `/unwrap`、`/dashboard` 列表均已实现。
- ✅ toast、CSV 上传、动态 decimals、token 校验、tenderly RPC、dev `/api` 中间件(5173)就绪。
- ⚠️ **链上一次都没跑过** —— 所有交互(部署/加密/签名/领取/解密/披露)均未验证。这是 P0。
- ⚠️ 后端无鉴权(SIWE 未做):任何人可 PATCH 分发 / 加 recipient。demo 可接受,需登记为已知缺口。

---

## 🔴 P0 — 链上端到端测试(立即,阻塞其余一切)

按 plan §10「先 Airdrop 跑通证明链路,再 Vesting,最后 Disperse」的顺序验。每条线**截图一笔成功的 testnet 交易**(pitch §11 现场 demo 要用)。

### 准备
- [ ] `pnpm dev`(5173,dev `/api` 中间件;不要用 `vercel dev`)。`.env` 有 `DATABASE_URL`,表已迁移。
- [ ] 钱包切 Sepolia + 领测试 ETH。
- [ ] 备机密余额:对底层 `mint(你的地址, 数量)` → `/wrap` 填**机密地址** approve+shield。
      首选 **cUSDT** 机密 `0x4E7B06D78965594eB5EF5414c357ca21E1554491` / 底层 `0xa7dA08FafDC9097Cc0E7D4f113A61e31d7e8e9b0`(见 `Sepolia_Confidential_Tokens.md`)。
- [ ] 准备第二个测试地址(当接收方/审计方),方便验"只看到自己的"。

### A. Airdrop
- [ ] `/create` 选 Airdrop,填 name/slug、token=cUSDT、claim opens(留空=部署即开)/closes → 建草稿 → 跳 `/d/:id`。
- [ ] 详情页 **Approve operator(1/2)→ Deploy & fund(2/2)**;确认 `contractAddress` 回写后端(刷新仍在 IssueCard)。
- [ ] 加人:填接收方地址 + 明文金额 → 浏览器加密+EIP-712 签名 → 密文工件入库(确认后端**只存 handle/proof/signature**,无明文)。
- [ ] go live(status=live)。
- [ ] 换接收方钱包打开 `/claim/<slug>` → **reveal**(只看到自己额度;注意:airdrop `getClaimAmount` 可能是写交易,确认 UX 不卡)→ **claim** → 在 `/unwrap` reveal 余额确认到账。

### B. Vesting
- [ ] `/create` 选 Vesting,填 schedule(start/end/cliff/interval/initial unlock%/revocable)→ 建草稿。
- [ ] 详情页 **部署 manager**(每 token 一个);确认地址回写。
- [ ] approve manager operator + **批量 createVesting**(接收方+金额)→ 确认 `VestingCreated` → 列表出现 vestingId。
- [ ] 接收方 `/claim/<slug>`:看到 **多 vesting 列表**,各自 reveal claimable → **claim**(`FeeType.Gas` 模式确认 `value=fee` 付得对)→ 余额到账。
- [ ] **选择性披露**:详情页对某 vestingId `discloseToParty`(给第二地址),**二次确认文案写明"不可撤销"** → 复制 `/audit` 链接。
- [ ] 换审计钱包打开 `/audit` → 选披露类型 → reveal → `userDecrypt` 看到被授权值;**未被授权的地址应解不开**(验隐私边界)。

### C. Disperse
- [ ] `/create` 选 Disperse → 建草稿。
- [ ] 详情页 DisperseCard:approve 单例 operator + 批量(接收方+金额)→ 一次 **direct disperse** → status=completed、回写 txHash。
- [ ] 接收方钱包在 `/wrap`(或 `/unwrap`)reveal 机密余额,确认**直接到账**(disperse 无 claim;claim 页应显示"已直接发放"提示)。

---

## 🟡 P1 — W4 功能补齐(测试通过后,~6/26 前)

- [ ] **自定义主题/品牌**:`distributions.theme` jsonb 已存在但**无 UI**。create 加主题字段(logo/主色/文案)→ `/claim/:slug` 渲染品牌化领取页。
- [ ] **Dashboard 打磨**:状态优先反映链上(当前仅读后端);加每条的类型/进度/快捷操作。
- [ ] **空/加载/错误态**:逐页过(尤其 claim 的未连钱包/未开始倒计时/已结束/不支持 token),这些是"experience"评分点。
- [ ] **claim 防枚举**:slug 不可遍历;确认接收方非白名单时不泄露分发存在性。
- [ ] **后端鉴权(可选但建议)**:SIWE 校验 PATCH/加人归属,堵住"任何人可改"。

---

## 🟢 P2 — 可选加分

- [ ] **`DistributionRegistry` 合约**(plan §4.2/§7):极小 Foundry 合约(struct+mapping+event),作"原创合约"交付项 + slug→地址链上锚点。不碰 FHE。后端已能索引,故非必需。

---

## 🚀 P3 — 提交物(W5,~7/3 前)

- [ ] **Vercel 生产部署**:前端 + `/api` 同项目;接环境变量 `DATABASE_URL`;验线上 SPA fallback(`vercel.json` rewrites)。
- [ ] **3 分钟真人 pitch 视频**:脚本见 plan §11(真人出镜/配音,**禁 AI 视频/配音**);现场录 Sepolia 真交易(创建 vesting → 投资人只看到自己 → 审计授权解密 → gas-free 领取)。
- [ ] **X thread / 文章**:大纲见 plan §11;含产品图 + demo GIF + 合约地址 + 站点链接。

---

## ⚠️ 测试时重点核对的风险点(plan §12 遗留)

1. **浏览器版 encryptor**:react-sdk relayer 实例能否正常初始化加密(plan §12 ❓1,首要)。
2. **airdrop reveal 是写交易**:`getClaimAmount` 授 FHE ACL = 发链上交易,接收方"查看额度"会弹钱包 —— UX 是否解释清楚。
3. **vesting claim gas 语义**:`FeeType.Gas` 下 claimer 付 `value=fee` 的实际报销/扣费逻辑(plan §12 ❓2);非 Gas 模式不传 value。
4. **disperse `batchLimit`**:大批量超限,`preflightDisperse` 是否拦下并给清晰报错。
5. **ACL 披露不可撤销**:UI 文案只承诺"可授予",授权前二次确认到位。
6. **两次写对账**:部署成功但回写失败 → 用 txHash 幂等回写的重试路径是否好用(plan §5.1)。
7. **slug 唯一/归属**:后端有唯一约束;归属(SIWE)**未做**,见 P1。
