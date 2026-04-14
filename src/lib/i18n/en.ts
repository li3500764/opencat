// ============================================================
// i18n — 英文翻译文件
// ============================================================

const en = {
  // ---- Common ----
  common: {
    cancel: "Cancel",
    save: "Save",
    create: "Create",
    edit: "Edit",
    delete: "Delete",
    retry: "Retry",
    refresh: "Refresh",
    loading: "Loading...",
    unknownError: "Unknown error",
    failedToLoad: "Failed to load",
  },

  // ---- Sidebar ----
  sidebar: {
    beta: "beta",
    newChat: "New Chat",
    dashboard: "Dashboard",
    noConversations: "No conversations yet",
    agents: "Agents",
    knowledgeBase: "Knowledge Base",
    apiKeys: "API Keys",
    signOut: "Sign out",
  },

  // ---- Chat ----
  chat: {
    welcomeMessage: "What can I do for you?",
    placeholder: "Send a message...",
    stopGenerating: "Stop generating",
    sendMessage: "Send message",
    disclaimer: "OpenCat may make mistakes. Verify important information.",
    you: "You",
    assistant: "OpenCat",
    defaultAgent: "Default",
    defaultAgentDesc: "Default (no agent)",
    plainChat: "plain chat",
    noAgents: "No agents yet. Create one in Settings.",
    customAgents: "Custom Agents",
    enterModelId: "Enter model ID, e.g. gpt-5.4",
    useThisModel: "Use this model",
    customModelId: "Custom Model ID",
  },

  // ---- Dashboard ----
  dashboard: {
    title: "Dashboard",
    subtitle: "Platform usage overview and analytics",
    conversations: "Conversations",
    messages: "messages",
    tokenUsage: "Token Usage",
    ofQuota: "of {quota} quota",
    totalCost: "Total Cost",
    totalTokens: "total tokens",
    resources: "Resources",
    kbCount: "{kb} KB, {mem} memories",
    tokenQuota: "Token Quota",
    usageTrend: "Token Usage Trend (14 days)",
    modelDistribution: "Model Distribution",
    noUsageData: "No usage data yet",
    noModelData: "No model data yet",
    failedToFetch: "Failed to fetch stats",
    recentActivity: "Recent Activity",
    noActivity: "No activity yet",
    model: "Model",
    provider: "Provider",
    input: "Input",
    output: "Output",
    total: "Total",
    cost: "Cost",
    time: "Time",
    justNow: "just now",
    minsAgo: "{n}m ago",
    hoursAgo: "{n}h ago",
    daysAgo: "{n}d ago",
  },

  // ---- Settings / API Keys ----
  settings: {
    title: "API Keys",
    subtitle: "Manage your LLM provider API keys",
    noKeys: "No API keys configured",
    noKeysDesc: "Add a key to start chatting with AI models",
    addKey: "Add API Key",
    addAnotherKey: "Add another key",
    editKey: "Edit API Key",
    providerLabel: "Provider",
    formatLabel: "API Format",
    formatHelp: "(auto-detected, change if using proxy)",
    apiKeyLabel: "API Key",
    keepCurrent: "(leave empty to keep current)",
    keepCurrentPlaceholder: "Leave empty to keep unchanged",
    apiKeyPlaceholder: "sk-...",
    labelOptional: "Label (optional)",
    labelPlaceholder: "My DeepSeek Key",
    baseUrlLabel: "Base URL",
    baseUrlHelp: "(default: https://api.deepseek.com)",
    baseUrlPlaceholder: "https://api.deepseek.com",
    saveChanges: "Save Changes",
    test: "Test",
    customProvider: "Custom (OpenAI Compatible)",
  },

  // ---- Agents ----
  agents: {
    title: "Agents",
    subtitle: "Create and manage AI agents with custom prompts and tools",
    noAgents: "No agents created yet",
    noAgentsDesc: "Create an agent with custom system prompt and tools",
    createAgent: "Create Agent",
    editAgent: "Edit Agent",
    createAnother: "Create another agent",
    orchestrator: "Orchestrator",
    tools: "tools",
    chats: "chats",
    nameLabel: "Name",
    descLabel: "Description (optional)",
    systemPromptLabel: "System Prompt",
    modelLabel: "Model",
    temperature: "Temperature ({val})",
    maxSteps: "Max Steps",
    toolsLabel: "Tools",
    orchestratorMode: "Orchestrator mode (can call other Agents)",
    saveChanges: "Save Changes",
  },

  // ---- Knowledge Base ----
  knowledge: {
    title: "Knowledge Base",
    subtitle: "Upload documents for RAG — auto chunk, embed, and vector search",
    noKb: "No knowledge bases yet",
    noKbDesc: "Create a knowledge base and upload documents for RAG retrieval",
    createKb: "Create Knowledge Base",
    createAnother: "Create another knowledge base",
    documents: "documents",
    chunks: "chunks",
    upload: "Upload",
    uploadDoc: "Upload document",
    deleteKb: "Delete knowledge base",
    noDocuments: "No documents yet. Click Upload to add one.",
    nameLabel: "Name",
    namePlaceholder: "e.g. Product Docs, API Reference...",
    onlyTxtMd: "Only .txt and .md files are supported",
    uploadFailed: "Upload failed:",
  },

  // ---- Auth ----
  auth: {
    signInTitle: "OpenCat",
    signInSubtitle: "Sign in to your account",
    continueWithGithub: "Continue with GitHub",
    or: "or",
    emailPlaceholder: "Email",
    passwordPlaceholder: "Password",
    invalidCredentials: "Invalid email or password",
    somethingWrong: "Something went wrong",
    signIn: "Sign In",
    noAccount: "Don't have an account?",
    signUp: "Sign up",
    createAccountTitle: "Create account",
    createAccountSubtitle: "Get started with OpenCat",
    namePlaceholder: "Name (optional)",
    passwordHint: "Password (8+ characters)",
    createAccount: "Create Account",
    hasAccount: "Already have an account?",
    signInLink: "Sign in",
  },

  // ---- Tool display names ----
  tools: {
    calculator: "Calculator",
    datetime: "Date & Time",
    http_request: "HTTP Request",
    memory_save: "Save Memory",
    memory_search: "Search Memory",
    call_agent: "Call Agent",
    inputParams: "INPUT PARAMS",
    outputResult: "OUTPUT RESULT",
    error: "ERROR",
  },
} as const;

// 递归提取结构但值类型放宽为 string（让 zh.ts 能赋中文值）
type DeepStringify<T> = {
  [K in keyof T]: T[K] extends Record<string, unknown> ? DeepStringify<T[K]> : string;
};

export type TranslationKeys = DeepStringify<typeof en>;
export default en;
