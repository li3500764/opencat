package queue

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// RedisQueue 封装 Redis 客户端及队列相关配置
type RedisQueue struct {
	Client     *redis.Client
	StreamName string // 任务流的名称 (例如 "opencat:tasks")
	GroupName  string // 消费者组名称 (例如 "opencat-workers")
}

// ConnectRedis 初始化 Redis 客户端连接
func ConnectRedis(redisURL string) (*RedisQueue, error) {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("解析 Redis URL 失败: %w", err)
	}

	client := redis.NewClient(opts)

	// 测试连接
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("测试 Redis 连接失败: %w", err)
	}

	return &RedisQueue{
		Client:     client,
		StreamName: "opencat:tasks",
		GroupName:  "opencat-workers",
	}, nil
}

// Close 关闭 Redis 连接
func (rq *RedisQueue) Close() {
	if rq.Client != nil {
		rq.Client.Close()
	}
}

// CreateConsumerGroupIfNotExist 创建 Redis Stream 消费者组（如果不存在）
func (rq *RedisQueue) CreateConsumerGroupIfNotExist(ctx context.Context) error {
	// XGROUP CREATE stream group $ MKSTREAM
	err := rq.Client.XGroupCreateMkStream(ctx, rq.StreamName, rq.GroupName, "$").Err()
	if err != nil && err.Error() != "BUSYGROUP Consumer Group name already exists" {
		return fmt.Errorf("创建 Redis 消费者组失败: %w", err)
	}
	return nil
}

// TaskMessage 代表从 Redis Stream 读取出来的原始任务数据
type TaskMessage struct {
	ID      string            // Redis 消息 ID (例如 "162626262-0")
	Fields  map[string]string // 消息字段
}

// ReadTask 阻塞式地从 Redis Stream 中读取一个新任务
func (rq *RedisQueue) ReadTask(ctx context.Context, consumerName string) (*TaskMessage, error) {
	// 阻塞读取，如果没有新消息，最长阻塞 10 秒
	streams, err := rq.Client.XReadGroup(ctx, &redis.XReadGroupArgs{
		Group:    rq.GroupName,
		Consumer: consumerName,
		Streams:  []string{rq.StreamName, ">"}, // ">" 表示只读取从未分配给其他消费者的消息
		Count:    1,
		Block:    10 * time.Second,
	}).Result()

	if err != nil {
		if err == redis.Nil {
			// 阻塞超时，没有读到消息，属于正常情况
			return nil, nil
		}
		return nil, fmt.Errorf("读取 Redis Stream 任务失败: %w", err)
	}

	if len(streams) == 0 || len(streams[0].Messages) == 0 {
		return nil, nil
	}

	msg := streams[0].Messages[0]
	// 将 map[string]interface{} 转换为 map[string]string
	fields := make(map[string]string)
	for k, v := range msg.Values {
		if strVal, ok := v.(string); ok {
			fields[k] = strVal
		} else {
			fields[k] = fmt.Sprintf("%v", v)
		}
	}

	return &TaskMessage{
		ID:     msg.ID,
		Fields: fields,
	}, nil
}

// AckTask 确认任务已被成功消费并处理完毕 (XACK)
func (rq *RedisQueue) AckTask(ctx context.Context, messageID string) error {
	err := rq.Client.XAck(ctx, rq.StreamName, rq.GroupName, messageID).Err()
	if err != nil {
		return fmt.Errorf("确认 Redis 任务 (XACK) 失败: %w", err)
	}
	return nil
}

// PublishProgress 通过 Redis Pub/Sub 广播任务进度更新
func (rq *RedisQueue) PublishProgress(ctx context.Context, messageJSON string) error {
	channelName := "opencat:task-progress"
	err := rq.Client.Publish(ctx, channelName, messageJSON).Err()
	if err != nil {
		return fmt.Errorf("广播任务进度更新失败: %w", err)
	}
	return nil
}
