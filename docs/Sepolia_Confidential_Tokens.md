# Sepolia 可用机密 Token(ERC-7984)

> 链上核对于 **2026-05-30**(数据源:Zama WrappersRegistry,Sepolia chainId 11155111)。
> 这些是已注册、可直接在本应用里 wrap / 分发的机密 token。

## 速查

- **WrappersRegistry(Sepolia)**:`0x2f0750Bbb0A246059d80e94c454586a7F27a128e`
- **所有机密 token 都是 6 位小数**(Zama 约定,euint64 范围有限)—— 已对全部 8 个逐一核对。
- **底层 ERC-20 小数位各异**(USDC/USDT/XAUt=6,其余=18)。
- **底层都是 Mock**,带 `mint(address,uint256)` 开放水龙头,可自行铸造测试余额。

> ⚠️ 表里**「机密 token 地址」才是要填进 app 的**(Wrap 框、Create 的 token、分发的 token 都填它)。
> 「底层 ERC-20」只用来 `mint` 拿余额、再 wrap 进机密 token。填错(填了底层)会被校验拦下。

## Token 列表

| 符号 | 名称 | 底层 dec | **机密 token 地址(填这个)** | 底层 ERC-20(mint 这个拿余额) |
|---|---|---|---|---|
| **cUSDT** ⭐ | Tether USD (Mock) | 6 | `0x4E7B06D78965594eB5EF5414c357ca21E1554491` | `0xa7dA08FafDC9097Cc0E7D4f113A61e31d7e8e9b0` |
| **cUSDC** ⭐ | USD Coin (Mock) | 6 | `0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639` | `0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF` |
| cWETH | Wrapped Ether (Mock) | 18 | `0x46208622DA27d91db4f0393733C8BA082ed83158` | `0xff54739b16576FA5402F211D0b938469Ab9A5f3F` |
| cBRON | Bron (Mock) | 18 | `0xaa5612FA27c927a0c7961f5AEFEE5ba3A0F9C891` | `0xFf021fB13cA64e5354c62c954b949a88cfDEb25E` |
| cZAMA | Zama (Mock) | 18 | `0xf2D628d2598aF4eAF94CB76a437Ff86CA78FfbFB` | `0x75355a85c6FB9df5f0C80FF54e8747EEe9a0BF57` |
| ctGBP | tGBP (Mock) | 18 | `0xfCE5c7069c5525eF6c8C2b2E35A745bA20a2F7CC` | `0x93c931278A2aad1916783F952f94276eA5111442` |
| cXAUt | XAUt (Mock) | 6 | `0xe4FcF848739845BC81Dee1d5352cf3844F0a60C7` | `0x24377AE4AA0C45ecEe71225007f17c5D423dd940` |
| ctGBP | tGBP | 18 | `0x167DC962808B32CFFFc7e14B5018c0bE06A3A208` | `0xf6Ef9ADB61A48E29E36bc873070A46A3D2667ff3` |

⭐ **demo 首选 cUSDT / cUSDC**:① 底层是 6 位,机密也是 6 位,换算最省心;② 赏金本身计价 cUSDT,主题贴合。
18 位底层(cWETH/cZAMA 等)也能用 —— app 的 wrap 输入按底层小数、余额/分发按机密 6 位,均已动态读取。

## 使用顺序(单钱包即可)

```
1. mint 底层:对底层 ERC-20 调 mint(你的地址, 数量)   # Etherscan Write,或后续的 app 水龙头
2. Wrap:在 Wrap 页填【机密 token 地址】→ approve + shield，把底层换成机密余额
3. 分发:Create/Airdrop 的 token 填同一个机密地址，从机密余额注资
4. 领取:接收方在 /claim/<slug> 连钱包 → reveal(只看到自己的额度)→ claim
```

## RPC 注意

合约读取(`eth_call`)必须用**允许 eth_call 的 RPC**。

- 当前写死:`https://sepolia.gateway.tenderly.co`(实测 `eth_call` 正常),见 `src/lib/config.ts`。
- **keyless 的 `https://api.zan.top/eth-sepolia` 会屏蔽 `eth_call`**(返回 "cu limit exceeded … not available for unregistered accounts"),会导致校验/余额/decimals 全部失败 —— 不要用。

## app 如何用这些数据

- 输入校验:`useIsWrapper`(wrap/unwrap)、`useIsConfidential`(create)—— 非机密 token 当场拦下,不会再去打无效的 `underlying()`。
- 发现/枚举:`useListPairs` 可在 app 内列出上面这些配对(选择器尚未做,先用本表手填地址)。
- 小数位:`useTokenDecimals` 动态读取(机密侧 6 位,wrap 输入按底层)。
