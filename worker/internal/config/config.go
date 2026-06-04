package config

import (
	"os"
	"strconv"
)

// Config 存储服务的所有配置项
type Config struct {
	DatabaseURL       string // PostgreSQL 连接串
	RedisURL          string // Redis 连接串
	EncryptionKey     string // API Key 解密的十六进制密钥
	Concurrency       int    // 任务执行最大并发数
	TaskTimeoutSec    int    // 单个任务的超时时间（秒）
	LogLevel          string // 日志级别: debug / info / warn / error
	DownloadsDir      string // 定时清理的下载文件目录
}

// LoadConfig 从环境变量中加载配置，并设置默认值
func LoadConfig() *Config {
	concurrency := getEnvAsInt("WORKER_CONCURRENCY", 20)
	taskTimeout := getEnvAsInt("WORKER_TASK_TIMEOUT", 1800) // 默认30分钟

	downloadsDir := getEnv("DOWNLOADS_DIR", "")
	if downloadsDir == "" {
		// 自动探测本地目录：优先使用 ../public/downloads（假设在 worker 目录启动），其次使用 ./public/downloads
		if _, err := os.Stat("../public/downloads"); err == nil {
			downloadsDir = "../public/downloads"
		} else if _, err := os.Stat("./public/downloads"); err == nil {
			downloadsDir = "./public/downloads"
		} else {
			downloadsDir = "../public/downloads" // 最终回退默认值
		}
	}

	return &Config{
		// 本地开发时，如果需要密码或使用特定配置，请在非 Git 追踪的本地环境变量中配置 DATABASE_URL
		DatabaseURL:    getEnv("DATABASE_URL", "postgresql://localhost:5433/opencat?schema=public"),
		RedisURL:       getEnv("REDIS_URL", "redis://localhost:6379"),
		EncryptionKey:  getEnv("ENCRYPTION_KEY", ""),
		Concurrency:    concurrency,
		TaskTimeoutSec: taskTimeout,
		LogLevel:       getEnv("LOG_LEVEL", "info"),
		DownloadsDir:   downloadsDir,
	}
}

// getEnv 获取环境变量，如果不存在则返回默认值
func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}

// getEnvAsInt 获取整型环境变量，如果不存在或解析失败则返回默认值
func getEnvAsInt(name string, defaultVal int) int {
	valueStr := getEnv(name, "")
	if value, err := strconv.Atoi(valueStr); err == nil {
		return value
	}
	return defaultVal
}
