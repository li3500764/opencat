// ============================================================
// API Key 加密 / 解密工具
// ============================================================
// 用户存储的 LLM API Key 不能明文入库，必须加密。
// 使用 AES-256-GCM 对称加密：
// - 加密密钥从环境变量 ENCRYPTION_KEY 读取（32 bytes = 64 hex chars）
// - 每次加密生成随机 IV（初始化向量），保证同一个 key 加密两次密文不同
// - GCM 模式自带认证标签（authTag），能检测篡改
//
// 面试考点：为什么不用 bcrypt？
// bcrypt 是单向哈希，加密后无法解密。但我们需要解密出原始 API Key 去调 LLM，
// 所以必须用可逆的对称加密。

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // GCM 推荐 12-16 bytes

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY must be a 64-character hex string. Generate one with: openssl rand -hex 32"
    );
  }
  return Buffer.from(key, "hex"); // 64 hex chars → 32 bytes = 256 bits
}

export function encrypt(plaintext: string): {
  encrypted: string;
  iv: string;
} {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  // GCM 的 authTag 附加到密文末尾，解密时需要
  const authTag = cipher.getAuthTag().toString("hex");

  return {
    encrypted: encrypted + ":" + authTag, // 密文:认证标签
    iv: iv.toString("hex"),
  };
}

export function decrypt(encrypted: string, iv: string): string {
  const key = getEncryptionKey();
  const [ciphertext, authTagHex] = encrypted.split(":");

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(iv, "hex")
  );
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

// 只显示 API Key 的最后 4 位，其余用 * 遮盖
export function maskApiKey(key: string): string {
  if (key.length <= 4) return "****";
  return "*".repeat(key.length - 4) + key.slice(-4);
}
