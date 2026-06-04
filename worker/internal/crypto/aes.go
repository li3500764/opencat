package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"encoding/hex"
	"errors"
	"strings"
)

// Decrypt 使用 AES-256-GCM 算法解密数据，完全兼容 Node.js crypto 格式
// encrypted 格式: "密文Hex:AuthTagHex"
// ivHex 格式: "IVHex" (16字节/32位十六进制字符)
// keyHex 格式: "ENCRYPTION_KEY" (32字节/64位十六进制字符)
func Decrypt(encrypted, ivHex, keyHex string) (string, error) {
	if encrypted == "" || ivHex == "" || keyHex == "" {
		return "", errors.New("解密参数不可为空")
	}

	// 1. 解析解密密钥 (64位 Hex)
	keyBytes, err := hex.DecodeString(keyHex)
	if err != nil {
		return "", errors.New("解析 ENCRYPTION_KEY 失败，必须是 hex 格式")
	}
	if len(keyBytes) != 32 {
		return "", errors.New("ENCRYPTION_KEY 长度必须是 32 字节 (64位 Hex 字符)")
	}

	// 2. 解析初始化向量 IV
	ivBytes, err := hex.DecodeString(ivHex)
	if err != nil {
		return "", errors.New("解析 IV 失败，必须是 hex 格式")
	}

	// 3. 拆分密文与 Auth Tag (格式：密文Hex:AuthTagHex)
	parts := strings.Split(encrypted, ":")
	if len(parts) != 2 {
		return "", errors.New("密文格式错误，应为 密文Hex:AuthTagHex")
	}
	cipherHex, tagHex := parts[0], parts[1]

	cipherBytes, err := hex.DecodeString(cipherHex)
	if err != nil {
		return "", errors.New("解析密文 Hex 失败")
	}

	tagBytes, err := hex.DecodeString(tagHex)
	if err != nil {
		return "", errors.New("解析 AuthTag Hex 失败")
	}

	// 4. 初始化 AES 密码块
	block, err := aes.NewCipher(keyBytes)
	if err != nil {
		return "", err
	}

	// 5. 初始化 GCM（使用自定义 Nonce 大小，Node.js 使用的是 16 字节 IV）
	aesGCM, err := cipher.NewGCMWithNonceSize(block, len(ivBytes))
	if err != nil {
		return "", err
	}

	// 6. Go 的 GCM Open 解密要求密文尾部包含 Auth Tag
	// 拼接 cipherBytes 和 tagBytes
	combinedCiphertext := make([]byte, len(cipherBytes)+len(tagBytes))
	copy(combinedCiphertext, cipherBytes)
	copy(combinedCiphertext[len(cipherBytes):], tagBytes)

	// 7. 执行解密
	plaintextBytes, err := aesGCM.Open(nil, ivBytes, combinedCiphertext, nil)
	if err != nil {
		return "", errors.New("解密失败，密文已被篡改或密钥错误")
	}

	return string(plaintextBytes), nil
}
