# === 第一阶段：编译构建 ===
FROM golang:1.22-alpine AS builder

# 安装证书，以便支持 Go Worker 向大模型 API 发起 HTTPS 请求
RUN apk add --no-cache git ca-certificates

# 配置 Go 国内代理，避免 Docker 构建时下载模块超时
ENV GOPROXY=https://goproxy.cn,direct

WORKDIR /build

# 复制 go.mod（go.sum 随后在 go mod tidy 后生成）
COPY go.mod ./
RUN go mod download

# 复制所有源代码
COPY . .

# 静态编译 Linux 下的可执行二进制文件，去除符号表以压缩体积
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /worker ./cmd/worker

# === 第二阶段：生产运行 ===
# 使用轻量的 alpine 镜像，便于时区处理和可能需要的网络诊断
FROM alpine:3.19

# 安装时区数据和 TLS 根证书
RUN apk add --no-cache tzdata ca-certificates

# 设置中国时区
ENV TZ=Asia/Shanghai

WORKDIR /app

# 从构建阶段拷贝编译好的二进制
COPY --from=builder /worker /worker

# 执行入口
ENTRYPOINT ["/worker"]
